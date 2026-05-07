/**
 * geocodeScheduler.ts — Фоновый планировщик геокодирования
 *
 * Автоматически геокодирует новые адреса без участия пользователя.
 * Запускается при старте сервера + далее по расписанию (cron).
 *
 * Отличие от scripts/geocode.ts:
 *   - geocodeScheduler работает в фоне, небольшими порциями (BATCH_SIZE=50)
 *   - scripts/geocode.ts запускается вручную для массовой обработки (BATCH_SIZE=5000)
 *
 * Расписание по умолчанию: 1 раз в неделю
 */

import cron from "node-cron";
import { sourcePool, coordsPool } from "../config/database";
import { geocode } from "./geocoder";

// Задержка между запросами к геокодеру.
// Nominatim требует минимум 1000 мс по Terms of Use,
// берём 1100 мс с запасом.
const DELAY_MS = 1100;

// Небольшой размер батча для фоновой задачи — не нагружаем сервер
const BATCH_SIZE = 50;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface SourceRow {
  id: number;
  address: string;
  serialNumber: string;
  meterModel: string | null;
  usdName: string | null;
  usdType: string | null;
}

interface ExistingRow {
  source_id: number;
  address: string | null;
  serial_number: string | null;
  meter_model: string | null;
  usd_name: string | null;
  usd_type: string | null;
}

interface ProcessedRow {
  source_id: number;
}

async function processNewAddresses(): Promise<void> {
  console.log(`[${new Date().toISOString()}] 🔄 Проверка новых адресов...`);

  try {
    // ── Шаг 1: Загружаем все адреса из SOURCE DB ──────────────────────────
    const sourceResult = await sourcePool.query<SourceRow>(`
      SELECT sf.id, sf.object_location as address, sf.device_id as "serialNumber",
             bt.idname as "meterModel",
             bu.idname as "usdName",
             but.idname as "usdType"
      FROM "enforce_dba".schet_fr sf
      LEFT JOIN "enforce_dba".bp_type_mp bt ON sf.id_type_mp = bt.id
      LEFT JOIN "enforce_dba".bp_sostav_usd bsu ON sf.id = bsu.id_sch
      LEFT JOIN "enforce_dba".bp_usd bu ON bsu.id_usd = bu.id
      LEFT JOIN "enforce_dba".bp_usd_type but ON bu.id_type = but.id
      WHERE sf.device_id IS NOT NULL
        AND sf.device_id != ''
      ORDER BY sf.id
    `);
    const sourceRows = sourceResult.rows;
    const sourceIds = sourceRows.map((r) => r.id);

    if (sourceIds.length === 0) {
      console.log("   Источник данных пуст, пропускаем");
      return;
    }

    // ── Шаг 2: Удаляем записи счётчиков, удалённых из SOURCE DB ──────────
    // Сначала readings (FK), потом location
    await coordsPool.query(
      `DELETE FROM "Main".readings WHERE source_id != ALL($1::integer[])`,
      [sourceIds],
    );
    const deletedResult = await coordsPool.query(
      `DELETE FROM "Main".location WHERE source_id != ALL($1::integer[]) RETURNING source_id`,
      [sourceIds],
    );
    if ((deletedResult.rowCount ?? 0) > 0) {
      console.log(
        `   🗑️  Удалено удалённых счётчиков: ${deletedResult.rowCount}`,
      );
    }

    // ── Шаг 3: Загружаем существующие записи из COORDS DB ─────────────────
    const existingResult = await coordsPool.query<ExistingRow>(`
      SELECT source_id, address, serial_number, meter_model, usd_name, usd_type
      FROM "Main".location
    `);
    const existingMap = new Map(
      existingResult.rows.map((r) => [r.source_id, r]),
    );

    // ── Шаг 4: Обновляем записи с изменёнными данными ─────────────────────
    let resetCoords = 0;
    let updatedMeta = 0;

    for (const row of sourceRows) {
      const existing = existingMap.get(row.id);
      if (!existing) continue;

      const addressChanged = existing.address !== row.address;
      const metaChanged =
        existing.serial_number !== row.serialNumber ||
        existing.meter_model !== (row.meterModel ?? null) ||
        existing.usd_name !== (row.usdName ?? null) ||
        existing.usd_type !== (row.usdType ?? null);

      if (addressChanged) {
        // Адрес изменился — сбрасываем координаты, будет геокодирован заново
        await coordsPool.query(
          `UPDATE "Main".location
           SET address = $2, serial_number = $3, meter_model = $4, usd_name = $5, usd_type = $6,
               coordinates = NULL, last_geocode_request = NULL
           WHERE source_id = $1`,
          [
            row.id,
            row.address,
            row.serialNumber,
            row.meterModel,
            row.usdName,
            row.usdType,
          ],
        );
        resetCoords++;
      } else if (metaChanged) {
        // Только метаданные изменились — обновляем без сброса координат
        await coordsPool.query(
          `UPDATE "Main".location
           SET serial_number = $2, meter_model = $3, usd_name = $4, usd_type = $5
           WHERE source_id = $1`,
          [row.id, row.serialNumber, row.meterModel, row.usdName, row.usdType],
        );
        updatedMeta++;
      }
    }

    if (resetCoords > 0)
      console.log(`   🔄 Адрес изменился, перегеокодируется: ${resetCoords}`);
    if (updatedMeta > 0)
      console.log(
        `   ✏️  Обновлены метаданные (без перегеокодирования): ${updatedMeta}`,
      );

    // ── Шаг 5: Определяем что нужно геокодировать ─────────────────────────
    // Берём source_id без координат (новые + со сброшенным адресом)
    const processedResult = await coordsPool.query<ProcessedRow>(`
      SELECT source_id FROM "Main".location WHERE coordinates IS NOT NULL
    `);
    const processedIds = new Set(processedResult.rows.map((r) => r.source_id));

    const toGeocode = sourceRows
      .filter((r) => !processedIds.has(r.id))
      .slice(0, BATCH_SIZE);

    if (toGeocode.length === 0) {
      console.log("   Новых/изменённых адресов нет");
      return;
    }

    console.log(`   Найдено ${toGeocode.length} адресов для геокодирования`);

    let success = 0;

    for (let i = 0; i < toGeocode.length; i++) {
      const { id, address, serialNumber, meterModel, usdName, usdType } =
        toGeocode[i];

      // ── Шаг 6: Геокодируем адрес ──────────────────────────────────────────
      const coords = await geocode(address);

      if (coords) {
        // ── Шаг 7а: Координаты найдены — сохраняем в COORDS DB ───────────────
        const coordsJson = JSON.stringify({
          lat: coords.latitude,
          lon: coords.longitude,
        });
        await coordsPool.query(
          `INSERT INTO "Main".location (source_id, address, serial_number, meter_model, usd_name, usd_type, coordinates, last_geocode_request)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
           ON CONFLICT (source_id)
           DO UPDATE SET address = $2, serial_number = $3, meter_model = $4, usd_name = $5, usd_type = $6, coordinates = $7::jsonb, last_geocode_request = NOW()`,
          [id, address, serialNumber, meterModel, usdName, usdType, coordsJson],
        );
        success++;
      } else {
        // ── Шаг 7б: Не нашли — сохраняем без координат чтобы не повторять ────
        await coordsPool.query(
          `INSERT INTO "Main".location (source_id, address, serial_number, meter_model, usd_name, usd_type, last_geocode_request)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (source_id)
           DO UPDATE SET address = $2, serial_number = $3, meter_model = $4, usd_name = $5, usd_type = $6, last_geocode_request = NOW()`,
          [id, address, serialNumber, meterModel, usdName, usdType],
        );
      }

      // ── Шаг 8: Соблюдаем лимит запросов Nominatim ────────────────────────
      if (i < toGeocode.length - 1) {
        await delay(DELAY_MS);
      }
    }

    console.log(`   ✅ Геокодировано: ${success}/${toGeocode.length}`);
  } catch (error) {
    const err = error as Error;
    console.error("   ❌ Ошибка:", err.message);
  }
}

/**
 * Запуск планировщика
 * По умолчанию: каждые 30 минут
 */
export function startScheduler(cronExpression: string = "*0 3 * * 0"): void {
  console.log("📅 Планировщик геокодирования запущен");
  console.log(`   Расписание: ${cronExpression}`);

  // Запускаем сразу при старте
  processNewAddresses();

  // Планируем регулярный запуск
  cron.schedule(cronExpression, processNewAddresses);
}

export { processNewAddresses };
