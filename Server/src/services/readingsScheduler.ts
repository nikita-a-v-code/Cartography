/**
 * readingsScheduler.ts — Планировщик синхронизации показаний счётчиков
 *
 * Что делает:
 *   1. Читает все source_id из COORDS DB (таблица Main.location)
 *   2. Для каждого идентификатора делает запрос в SOURCE DB (bp_result)
 *      и получает MAX(дата последнего показания)
 *   3. Сохраняет результат в COORDS DB (Main.readings) через UPSERT
 *
 * Прогресс операции транслируется через EventEmitter (readingsProgress)
 * и доставляется клиенту через SSE-маршрут /api/readings/progress.
 *
 * Расписание по умолчанию: 1 раз в 3 дня в 02:00
 */

import cron from "node-cron";
import { sourcePool, coordsPool } from "../config/database";
import { EventEmitter } from "events";

// Обрабатываем ID порциями (батчами), чтобы:
//   а) не создавать слишком большой SQL-запрос (PostgreSQL лимитирует размер списка в IN/ANY)
//   б) сохранять разумный объём памяти в одном запросе
const BATCH_SIZE = 1000;

// Глобальный EventEmitter — через него функция updateReadings() отправляет
// события прогресса SSE-событиям слушающим в index.ts (/api/readings/progress)
export const readingsProgress = new EventEmitter();

/** Формат одного события прогресса */
export interface ReadingsProgressData {
  status: "running" | "done" | "error"; // текущее состояние операции
  processed: number; // сколько локаций уже обработано
  total: number; // всего локаций в COORDS DB
  withReadings: number; // сколько из них имеют хоть бы одно показание
  message?: string; // опциональное сообщение (при ошибке — текст ошибки)
}

interface ReadingRow {
  id: number; // source_id счётчика
  max_date: string; // дата последнего показания (MAX из bp_result)
}

interface LocationRow {
  source_id: number; // идентификатор из таблицы schet_fr
}

// Флаг защиты от параллельного запуска: если уже идёт обновление — пропускаем
let isRunning = false;

async function updateReadings(): Promise<void> {
  if (isRunning) {
    // Защита от одновременного запуска двух синхронизаций (например, по расписанию + вручную)
    console.log("   ⏳ Обновление показаний уже выполняется, пропускаем");
    return;
  }
  isRunning = true;

  console.log(
    `[${new Date().toISOString()}] 📊 Обновление показаний счётчиков...`,
  );

  try {
    // ── Шаг 1: Загружаем все source_id из COORDS DB ────────────────────────────
    // Мы обновляем показания только для тех, у кого есть координаты —
    // бессмысленно искать показания для точек, которые нельзя отобразить на карте
    const locationResult = await coordsPool.query<LocationRow>(`
      SELECT source_id FROM "Main".location WHERE source_id IS NOT NULL
    `);
    const sourceIds = locationResult.rows.map((r) => r.source_id);

    if (sourceIds.length === 0) {
      console.log("   Нет записей для обновления показаний");
      readingsProgress.emit("progress", {
        status: "done",
        processed: 0,
        total: 0,
        withReadings: 0,
        message: "Нет записей",
      } as ReadingsProgressData);
      return;
    }

    const total = sourceIds.length;
    let processed = 0;
    let withReadings = 0;

    // Сообщаем фронтенду: операция началась
    readingsProgress.emit("progress", {
      status: "running",
      processed: 0,
      total,
      withReadings: 0,
    } as ReadingsProgressData);

    // ── Шаг 2: Обрабатываем ID порциями (batch) чтобы не загружать весь список в SQL ──
    for (let offset = 0; offset < sourceIds.length; offset += BATCH_SIZE) {
      const batchIds = sourceIds.slice(offset, offset + BATCH_SIZE);

      // ── Шаг 3: Запрашиваем дату последнего показания в SOURCE DB ──────────────
      // id_rt = 1 — фильтр по типу показаний (показания на начало суток)
      // MAX(dt) — нас интересует только самое последнее показание
      const readingsResult = await sourcePool.query<ReadingRow>(
        `
        SELECT id, MAX(dt) as max_date
        FROM "enforce_dba".bp_result
        WHERE id = ANY($1::integer[])
          AND id_rt = 1
        GROUP BY id
      `,
        [batchIds],
      );

      // Преобразуем массив строк в Map для O(1) поиска по ID
      const readingsMap = new Map(
        readingsResult.rows.map((r) => [r.id, r.max_date]),
      );

      // ── Шаг 4: Готовим данные для пакетного UPSERT ─────────────────────────
      // Для каждого ID в батче сохраняем [source_id, last_reading_date].
      // Если для ID нет записей в bp_result — сохраняем null (счётчик ещё не передавал данные)
      // [][] - это массив массивов, в которых могут быть любые значения
      const values: any[][] = [];
      for (const id of batchIds) {
        const lastDate = readingsMap.get(id) || null;
        values.push([id, lastDate]);
        if (lastDate) withReadings++;
      }

      // ── Шаг 5: Выполняем пакетный UPSERT в COORDS DB ─────────────────────────
      // Генерируем пласехолдеры вида ($1, $2, NOW()), ($3, $4, NOW()), ...
      // вместо отдельных INSERT-запросов — это много быстрее
      if (values.length > 0) {
        const placeholders = values
          .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, NOW())`)
          .join(", ");
        const flatParams = values.flat();

        await coordsPool.query(
          `
          INSERT INTO "Main".readings (source_id, last_reading_date, updated_at)
          VALUES ${placeholders}
          ON CONFLICT (source_id)
          DO UPDATE SET last_reading_date = EXCLUDED.last_reading_date, updated_at = NOW()
        `,
          flatParams,
        );
      }

      processed += batchIds.length;

      // Транслируем прогресс SSE-подписчикам после каждого батча
      readingsProgress.emit("progress", {
        status: "running",
        processed,
        total,
        withReadings,
      } as ReadingsProgressData);
    }

    console.log(
      `   ✅ Обновлено: ${processed}/${total}, с показаниями: ${withReadings}`,
    );

    readingsProgress.emit("progress", {
      status: "done",
      processed,
      total,
      withReadings,
      message: "Завершено",
    } as ReadingsProgressData);
  } catch (error) {
    const err = error as Error;
    console.error("   ❌ Ошибка обновления показаний:", err.message);
    readingsProgress.emit("progress", {
      status: "error",
      processed: 0,
      total: 0,
      withReadings: 0,
      message: err.message,
    } as ReadingsProgressData);
  } finally {
    isRunning = false;
  }
}

/**
 * Запуск планировщика показаний
 * По умолчанию: каждые 3 дня в 02:00
 */
export function startReadingsScheduler(
  cronExpression: string = "0 2 */3 * *",
): void {
  console.log("📅 Планировщик показаний запущен");
  console.log(`   Расписание: ${cronExpression}`);

  // Запускаем сразу при старте
  updateReadings();

  // Планируем регулярный запуск
  cron.schedule(cronExpression, updateReadings);
}

export { updateReadings, isRunning };
