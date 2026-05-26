"use strict";
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
 * Расписание по умолчанию: каждые 3 дня в 02:00 ночи
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRunning = exports.readingsProgress = void 0;
exports.startReadingsScheduler = startReadingsScheduler;
exports.pauseReadings = pauseReadings;
exports.resumeReadings = resumeReadings;
exports.cancelReadings = cancelReadings;
exports.updateReadings = updateReadings;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("../config/database");
const events_1 = require("events");
const logger_1 = require("../utils/logger");
// Настройки из переменных окружения (с дефолтами)
const BATCH_SIZE = parseInt(process.env.READINGS_BATCH_SIZE || "1000", 10);
const READINGS_CRON = process.env.READINGS_CRON || "0 2 */3 * *";
// Глобальный EventEmitter — через него функция updateReadings() отправляет
// события прогресса SSE-событиям слушающим в index.ts (/api/readings/progress)
exports.readingsProgress = new events_1.EventEmitter();
// Флаг защиты от параллельного запуска: если уже идёт обновление — пропускаем
let isRunning = false;
exports.isRunning = isRunning;
// Флаги для контроля выполнения
let isPaused = false;
let shouldCancel = false;
async function updateReadings() {
    if (isRunning) {
        // Защита от одновременного запуска двух синхронизаций (например, по расписанию + вручную)
        console.log("   ⏳ Обновление показаний уже выполняется, пропускаем");
        return;
    }
    exports.isRunning = isRunning = true;
    console.log(`[${new Date().toISOString()}] 📊 Обновление показаний счётчиков...`);
    const logFileName = (0, logger_1.getReadingsLogFileName)();
    await (0, logger_1.writeLog)(logFileName, `=== Начало обновления показаний ===`);
    try {
        // ── Шаг 1: Загружаем все source_id из COORDS DB ────────────────────────────
        // Мы обновляем показания только для тех, у кого есть координаты —
        // бессмысленно искать показания для точек, которые нельзя отобразить на карте
        const locationResult = await database_1.coordsPool.query(`
      SELECT source_id FROM "Main".location WHERE source_id IS NOT NULL
    `);
        const sourceIds = locationResult.rows.map((r) => r.source_id);
        if (sourceIds.length === 0) {
            console.log("   Нет записей для обновления показаний");
            exports.readingsProgress.emit("progress", {
                status: "done",
                processed: 0,
                total: 0,
                withReadings: 0,
                message: "Нет записей",
            });
            return;
        }
        const total = sourceIds.length;
        let processed = 0;
        let withReadings = 0;
        // Сообщаем фронтенду: операция началась
        exports.readingsProgress.emit("progress", {
            status: "running",
            processed: 0,
            total,
            withReadings: 0,
        });
        // ── Шаг 2: Обрабатываем ID порциями (batch) чтобы не загружать весь список в SQL ──
        for (let offset = 0; offset < sourceIds.length; offset += BATCH_SIZE) {
            // Проверяем флаги отмены и паузы
            if (shouldCancel) {
                console.log("   ⏹️ Обновление показаний отменено пользователем");
                exports.readingsProgress.emit("progress", {
                    status: "done",
                    processed,
                    total,
                    withReadings,
                    message: "Отменено",
                });
                return;
            }
            // Пауза — ждём возобновления
            while (isPaused) {
                console.log("   ⏸️ Обновление показаний на паузе");
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            const batchIds = sourceIds.slice(offset, offset + BATCH_SIZE);
            // ── Шаг 3: Запрашиваем дату последнего показания в SOURCE DB ──────────────
            // id_rt = 1 — фильтр по типу показаний (показания на начало суток)
            // MAX(dt) — нас интересует только самое последнее показание
            const readingsResult = await database_1.sourcePool.query(`
        SELECT id, MAX(dt) as max_date
        FROM "enforce_dba".bp_result
        WHERE id = ANY($1::integer[])
          AND id_rt = 1
        GROUP BY id
      `, [batchIds]);
            // Преобразуем массив строк в Map для O(1) поиска по ID
            const readingsMap = new Map(readingsResult.rows.map((r) => [r.id, r.max_date]));
            // ── Шаг 4: Готовим данные для пакетного UPSERT ─────────────────────────
            // Для каждого ID в батче сохраняем [source_id, last_reading_date].
            // Если для ID нет записей в bp_result — сохраняем null (счётчик ещё не передавал данные)
            // [][] - это массив массивов, в которых могут быть любые значения
            const values = [];
            for (const id of batchIds) {
                const lastDate = readingsMap.get(id) || null;
                values.push([id, lastDate]);
                if (lastDate)
                    withReadings++;
            }
            // ── Шаг 5: Выполняем пакетный UPSERT в COORDS DB ─────────────────────────
            // Генерируем пласехолдеры вида ($1, $2, NOW()), ($3, $4, NOW()), ...
            // вместо отдельных INSERT-запросов — это много быстрее
            if (values.length > 0) {
                const placeholders = values
                    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, NOW())`)
                    .join(", ");
                const flatParams = values.flat();
                await database_1.coordsPool.query(`
          INSERT INTO "Main".readings (source_id, last_reading_date, updated_at)
          VALUES ${placeholders}
          ON CONFLICT (source_id)
          DO UPDATE SET last_reading_date = EXCLUDED.last_reading_date, updated_at = NOW()
        `, flatParams);
            }
            processed += batchIds.length;
            // Транслируем прогресс SSE-подписчикам после каждого батча
            exports.readingsProgress.emit("progress", {
                status: "running",
                processed,
                total,
                withReadings,
            });
        }
        await (0, logger_1.writeLog)(logFileName, `Обработано записей: ${total}, из них с показаниями: ${withReadings}`);
        console.log(`   ✅ Обновлено: ${processed}/${total}, с показаниями: ${withReadings}`);
        exports.readingsProgress.emit("progress", {
            status: "done",
            processed,
            total,
            withReadings,
            message: "Завершено",
        });
    }
    catch (error) {
        const err = error;
        console.error("   ❌ Ошибка обновления показаний:", err.message);
        await (0, logger_1.writeLog)(logFileName, `!!! Ошибка: ${err.message}`);
        exports.readingsProgress.emit("progress", {
            status: "error",
            processed: 0,
            total: 0,
            withReadings: 0,
            message: err.message,
        });
    }
    finally {
        exports.isRunning = isRunning = false;
        isPaused = false;
        shouldCancel = false;
    }
    await (0, logger_1.writeLog)(logFileName, `=== Успешно завершено ===`);
}
/**
 * Запуск планировщика показаний
 * По умолчанию: каждые 3 дня в 02:00
 */
function startReadingsScheduler(cronExpression = READINGS_CRON) {
    console.log("📅 Планировщик показаний запущен");
    console.log(`   Расписание: ${cronExpression}`);
    // Запускаем сразу при старте
    updateReadings();
    // Планируем регулярный запуск
    node_cron_1.default.schedule(cronExpression, updateReadings);
}
/** Пауза выполнения обновления показаний */
function pauseReadings() {
    isPaused = true;
    console.log("⏸️ Обновление показаний приостановлено");
}
/** Возобновление выполнения обновления показаний */
function resumeReadings() {
    isPaused = false;
    console.log("▶️ Обновление показаний возобновлено");
}
/** Отмена выполнения обновления показаний */
function cancelReadings() {
    shouldCancel = true;
    isPaused = false;
    console.log("⏹️ Обновление показаний отменено");
}
//# sourceMappingURL=readingsScheduler.js.map