"use strict";
/**
 * geocodeScheduler.ts — Фоновый планировщик геокодирования
 *
 * Автоматически геокодирует новые адреса и повторяет неудачные попытки.
 * Запускается при старте сервера + далее по расписанию (cron).
 *
 * Отличие от scripts/geocode.ts:
 *   - geocodeScheduler работает в фоне, небольшими порциями (BATCH_SIZE=300)
 *
 * Логика повторных попыток:
 *   - Адреса без координат проверяются повторно через RETRY_AFTER_DAYS дней
 *   - Дата последней попытки хранится в поле last_geocode_request
 *   - Новые адреса (отсутствующие в location) геокодируются сразу
 *
 * Расписание по умолчанию: каждые 3 дня в 03:00 ночи
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
exports.processNewAddresses = processNewAddresses;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("../config/database");
const geocoder_1 = require("./geocoder");
const logger_1 = require("../utils/logger");
// Настройки из переменных окружения (с дефолтами)
const BATCH_SIZE = parseInt(process.env.GEOCODER_BATCH_SIZE || "300", 10);
const RETRY_AFTER_DAYS = parseInt(process.env.GEOCODER_RETRY_DAYS || "30", 10);
const DEFAULT_CRON = process.env.GEOCODER_CRON || "0 3 */3 * *";
// Задержка между запросами к геокодеру.
// Nominatim требует минимум 1000 мс по Terms of Use,
// берём 1100 мс с запасом.
const DELAY_MS = 1100;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function processNewAddresses() {
    const logFileName = (0, logger_1.getGeocodeLogFileName)();
    await (0, logger_1.writeLog)(logFileName, `=== Запуск геокодирования ===`);
    console.log(`[${new Date().toISOString()}] 🔄 Проверка новых адресов...`);
    try {
        // ── Шаг 1: Загружаем все адреса из SOURCE DB ──────────────────────────
        // Для геокодирования — только счётчики с цифровым device_id
        const sourceResult = await database_1.sourcePool.query(`
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
        AND sf.device_id ~ '^[0-9]+$'
        AND sf.object_location IS NOT NULL
      ORDER BY sf.id
    `);
        const sourceRows = sourceResult.rows;
        const sourceIds = sourceRows.map((r) => r.id);
        if (sourceIds.length === 0) {
            console.log("   Источник данных пуст, пропускаем");
            return;
        }
        // ── Шаг 2: Удаляем записи счётчиков, физически удалённых из SOURCE DB ──
        // Берём ВСЕ id из источника (без фильтра по device_id), чтобы не удалять
        // счётчики с нецифровым device_id — они просто не геокодируются, но остаются.
        const allSourceIdsResult = await database_1.sourcePool.query(`SELECT id FROM "enforce_dba".schet_fr`);
        const allSourceIds = allSourceIdsResult.rows.map((r) => r.id);
        await database_1.coordsPool.query(`DELETE FROM "Main".readings WHERE source_id != ALL($1::integer[])`, [allSourceIds]);
        const deletedResult = await database_1.coordsPool.query(`DELETE FROM "Main".location WHERE source_id != ALL($1::integer[]) RETURNING source_id`, [allSourceIds]);
        if ((deletedResult.rowCount ?? 0) > 0) {
            console.log(`   🗑️  Удалено удалённых счётчиков: ${deletedResult.rowCount}`);
        }
        // ── Шаг 3: Загружаем существующие записи из COORDS DB ─────────────────
        const existingResult = await database_1.coordsPool.query(`
      SELECT source_id, address, serial_number, meter_model, usd_name, usd_type,
         coordinates, last_geocode_request
      FROM "Main".location
    `);
        const existingMap = new Map(existingResult.rows.map((r) => [r.source_id, r]));
        // ── Шаг 4: Обновляем записи с изменёнными данными ─────────────────────
        let resetCoords = 0;
        let updatedMeta = 0;
        for (const row of sourceRows) {
            const existing = existingMap.get(row.id);
            if (!existing)
                continue;
            const addressChanged = existing.address !== row.address;
            const metaChanged = existing.serial_number !== row.serialNumber ||
                existing.meter_model !== (row.meterModel ?? null) ||
                existing.usd_name !== (row.usdName ?? null) ||
                existing.usd_type !== (row.usdType ?? null);
            if (addressChanged) {
                // Адрес изменился — сбрасываем координаты, будет геокодирован заново
                await database_1.coordsPool.query(`UPDATE "Main".location
           SET address = $2, serial_number = $3, meter_model = $4, usd_name = $5, usd_type = $6,
               coordinates = NULL, last_geocode_request = NULL
           WHERE source_id = $1`, [
                    row.id,
                    row.address,
                    row.serialNumber,
                    row.meterModel,
                    row.usdName,
                    row.usdType,
                ]);
                resetCoords++;
            }
            else if (metaChanged) {
                // Только метаданные изменились — обновляем без сброса координат
                await database_1.coordsPool.query(`UPDATE "Main".location
           SET serial_number = $2, meter_model = $3, usd_name = $4, usd_type = $5
           WHERE source_id = $1`, [row.id, row.serialNumber, row.meterModel, row.usdName, row.usdType]);
                updatedMeta++;
            }
        }
        if (resetCoords > 0)
            console.log(`   🔄 Адрес изменился, перегеокодируется: ${resetCoords}`);
        if (updatedMeta > 0)
            console.log(`   ✏️  Обновлены метаданные (без перегеокодирования): ${updatedMeta}`);
        // ── Шаг 5: Определяем, какие адреса нужно геокодировать ─────────────────
        // Включаем:
        // - новые записи (отсутствуют в location)
        // - существующие, у которых coordinates = NULL, и с момента последней попытки прошло RETRY_AFTER_DAYS дней
        const now = new Date();
        const toGeocode = [];
        for (const row of sourceRows) {
            const existing = existingMap.get(row.id);
            // Нет записи → геокодируем
            if (!existing) {
                toGeocode.push(row);
                if (toGeocode.length >= BATCH_SIZE)
                    break;
                continue;
            }
            // Если координаты уже есть → пропускаем
            if (existing.coordinates !== null && existing.coordinates !== undefined) {
                continue;
            }
            // Координат нет, проверяем дату последней попытки
            const lastRequest = existing.last_geocode_request;
            if (!lastRequest) {
                // Никогда не запрашивали → нужно
                toGeocode.push(row);
            }
            else {
                const daysSince = (now.getTime() - new Date(lastRequest).getTime()) /
                    (1000 * 60 * 60 * 24);
                if (daysSince >= RETRY_AFTER_DAYS) {
                    toGeocode.push(row);
                }
            }
            if (toGeocode.length >= BATCH_SIZE)
                break;
        }
        // (Опционально) выводим статистику для отладки
        const totalPending = sourceRows.filter((row) => {
            const ex = existingMap.get(row.id);
            if (!ex)
                return true;
            if (ex.coordinates)
                return false;
            if (!ex.last_geocode_request)
                return true;
            const days = (now.getTime() - new Date(ex.last_geocode_request).getTime()) /
                (1000 * 3600 * 24);
            return days >= RETRY_AFTER_DAYS;
        }).length;
        console.log(`   Всего адресов, требующих геокодирования (в т.ч. повтор через ${RETRY_AFTER_DAYS} дн): ${totalPending}`);
        if (toGeocode.length === 0) {
            console.log("   Новых/ожидающих повторной попытки адресов нет");
            return;
        }
        await (0, logger_1.writeLog)(logFileName, `Батч содержит ${toGeocode.length} адресов`);
        console.log(`   Запланировано на этот запуск: ${toGeocode.length} адресов`);
        let success = 0;
        for (let i = 0; i < toGeocode.length; i++) {
            const { id, address, serialNumber, meterModel, usdName, usdType } = toGeocode[i];
            // ── Шаг 6: Геокодируем адрес ──────────────────────────────────────────
            const coords = await (0, geocoder_1.geocode)(address);
            if (coords) {
                await (0, logger_1.writeLog)(logFileName, `✓ ID=${id} | Адрес: "${address}" | Координаты: ${coords.latitude}, ${coords.longitude} | Серийный номер: ${serialNumber}`);
                // ── Шаг 7а: Координаты найдены — сохраняем в COORDS DB ───────────────
                const coordsJson = JSON.stringify({
                    lat: coords.latitude,
                    lon: coords.longitude,
                });
                await database_1.coordsPool.query(`INSERT INTO "Main".location (source_id, address, serial_number, meter_model, usd_name, usd_type, coordinates, last_geocode_request)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
           ON CONFLICT (source_id)
           DO UPDATE SET address = $2, serial_number = $3, meter_model = $4, usd_name = $5, usd_type = $6, coordinates = $7::jsonb, last_geocode_request = NOW()`, [id, address, serialNumber, meterModel, usdName, usdType, coordsJson]);
                success++;
            }
            else {
                await (0, logger_1.writeLog)(logFileName, `✗ ID=${id} | Адрес: "${address}" | Не удалось загеокодировать | Серийный номер: ${serialNumber}`);
                // ── Шаг 7б: Не нашли — сохраняем без координат чтобы не повторять ────
                await database_1.coordsPool.query(`INSERT INTO "Main".location (source_id, address, serial_number, meter_model, usd_name, usd_type, last_geocode_request)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (source_id)
           DO UPDATE SET address = $2, serial_number = $3, meter_model = $4, usd_name = $5, usd_type = $6, last_geocode_request = NOW()`, [id, address, serialNumber, meterModel, usdName, usdType]);
            }
            // ── Шаг 8: Соблюдаем лимит запросов Nominatim ────────────────────────
            if (i < toGeocode.length - 1) {
                await delay(DELAY_MS);
            }
        }
        await (0, logger_1.writeLog)(logFileName, `=== Завершено: успешно ${success}/${toGeocode.length}, пропущено ${toGeocode.length - success} ===`);
        console.log(`   ✅ Геокодировано: ${success}/${toGeocode.length}`);
    }
    catch (error) {
        const err = error;
        console.error("   ❌ Ошибка:", err.message);
        await (0, logger_1.writeLog)(logFileName, `!!! Ошибка выполнения: ${err.message}`);
    }
}
/**
 * Запуск планировщика
 * По умолчанию: каждые 30 минут
 */
function startScheduler(cronExpression = DEFAULT_CRON) {
    console.log("📅 Планировщик геокодирования запущен");
    console.log(`   Расписание: ${cronExpression}`);
    console.log(`   Повтор неудачных адресов: каждые ${RETRY_AFTER_DAYS} дней`);
    // Запускаем сразу при старте
    processNewAddresses();
    // Планируем регулярный запуск
    node_cron_1.default.schedule(cronExpression, processNewAddresses);
}
//# sourceMappingURL=geocodeScheduler.js.map