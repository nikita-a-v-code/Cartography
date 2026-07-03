"use strict";
/**
 * geocode.ts — Одноразовый скрипт массового геокодирования адресов
 * Запуск вручную: npm run geocode
 *
 * Логика работы:
 *   1. Читает все адреса из SOURCE DB (enforce_dba.schet_fr)
 *   2. Определяет, какие уже обрабатывались (есть в Main.location)
 *   3. Сначала берёт НОВЫЕ адреса (которых вообще нет в location)
 *   4. Если новых меньше BATCH_SIZE — добирает СТАРЫЕ НЕУДАЧНЫЕ (coordinates IS NULL)
 *   5. Для каждого адреса вызывает геокодер (Yandex или Nominatim)
 *   6. Сохраняет результат в COORDS DB — координаты или NULL если не нашлось
 *
 * После каждого запуска выводит статистику и подсказывает, нужно ли запустить ещё раз.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeProgress = void 0;
exports.pauseGeocoding = pauseGeocoding;
exports.resumeGeocoding = resumeGeocoding;
exports.cancelGeocoding = cancelGeocoding;
exports.geocodeAddresses = geocodeAddresses;
const database_1 = require("../config/database");
const geocoder_1 = require("../services/geocoder");
const addressNormalizer_1 = require("../services/addressNormalizer");
const dotenv_1 = __importDefault(require("dotenv"));
const events_1 = require("events");
// Настройки из переменных окружения (с дефолтами)
const BATCH_SIZE = parseInt(process.env.GEOCODING_BATCH_SIZE || "5000", 10);
dotenv_1.default.config();
// Задержка между HTTP-запросами к геокодеру (мс).
// Nominatim (OpenStreetMap) требует минимум 1000 мс между запросами по Terms of Use.
// Берём 1100 мс с небольшим запасом.
const DELAY_MS = 1100;
// Сколько записей обрабатывать за один запуск скрипта.
// Ограничение нужно, чтобы скрипт не висел часами (при 5000 адресов ≈ 1.5 часа).
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Глобальный EventEmitter — через него функция geocodeAddresses() отправляет
// события прогресса SSE-событиям слушающим в index.ts (/api/readings/progress)
exports.geocodeProgress = new events_1.EventEmitter();
let isRunning = false;
// Флаги для контроля выполнения
let isPaused = false;
let shouldCancel = false;
async function geocodeAddresses() {
    if (isRunning) {
        console.log("Геокодирование уже выполняется, пропускаем");
        exports.geocodeProgress.emit("progress", {
            status: "error",
            processed: 0,
            total: 0,
            success: 0,
            failed: 0,
            message: "Геокодирование уже выполняется",
        });
        return;
    }
    isRunning = true;
    console.log("🚀 Запуск геокодирования адресов...\n");
    console.log("📖 SOURCE DB: исходные данные (enforce_dba.schet_fr)");
    console.log("💾 COORDS DB: сохранение координат (Main.location)\n");
    try {
        // ── Шаг 1: Какие адреса уже обрабатывались? ────────────────────────────────
        // Загружаем ВСЕ source_id из COORDS DB — как успешные (с координатами),
        // так и неудачные (coordinates IS NULL). Это нужно, чтобы отделить
        // «новые» адреса от «ранее пробованных но не найденных».
        const processedResult = await database_1.coordsPool.query(`
      SELECT source_id FROM "Main".location
    `);
        // Set для O(1) проверки вхождения (вместо медленного Array.includes)
        const allAttemptedIds = new Set(processedResult.rows.map((r) => r.source_id));
        // ── Шаг 2: Загружаем адреса из SOURCE DB ───────────────────────────────────
        // JOIN с несколькими таблицами, чтобы получить полную информацию о счётчике:
        //   bp_type_mp   — модель прибора учёта
        //   bp_sostav_usd — связь счётчика с УСПД
        //   bp_usd        — наименование УСПД
        //   bp_usd_type   — тип УСПД
        // Фильтр: только записи с непустым device_id (серийным номером)
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
        // ── Шаг 3: Выбираем НОВЫЕ адреса (которых нет в location вообще) ───────────
        // Условия: id НЕ в allAttemptedIds + адрес не пустой
        // .slice(0, BATCH_SIZE) — ограничиваем размер батча
        const newAddresses = sourceResult.rows
            .filter((r) => !allAttemptedIds.has(r.id) && r.address && r.address.trim() !== "")
            .slice(0, BATCH_SIZE);
        // ── Шаг 4: Добираем НЕУДАЧНЫЕ адреса если новых меньше BATCH_SIZE ──────────
        // Смысл: хотим максимально эффективно использовать один запуск скрипта.
        // Если новых адресов мало, добираем те, для которых ранее не нашлись координаты.
        // Сортируем по last_geocode_request ASC — берём самые «старые» попытки первыми,
        // т.к. адрес мог появиться в OSM с тех пор.
        let addresses;
        if (newAddresses.length >= BATCH_SIZE) {
            addresses = newAddresses;
        }
        else {
            const remaining = BATCH_SIZE - newAddresses.length;
            const failedResult = await database_1.coordsPool.query(`
        SELECT source_id, address, serial_number, meter_model, usd_name, usd_type
        FROM "Main".location
        WHERE coordinates IS NULL
        ORDER BY last_geocode_request ASC NULLS FIRST
        LIMIT $1
      `, [remaining]);
            const failedAddresses = failedResult.rows.map((r) => ({
                id: r.source_id,
                address: r.address,
                serialNumber: r.serial_number,
                meterModel: r.meter_model,
                usdName: r.usd_name,
                usdType: r.usd_type,
            }));
            addresses = [...newAddresses, ...failedAddresses];
        }
        if (addresses.length === 0) {
            console.log("✅ Все адреса уже геокодированы!");
            exports.geocodeProgress.emit("progress", {
                status: "done",
                processed: 0,
                total: 0,
                success: 0,
                failed: 0,
                message: "Все адреса уже геокодированы",
            });
            isRunning = false;
            return;
        }
        const newCount = newAddresses.length;
        const retryCount = addresses.length - newCount;
        if (newCount > 0)
            console.log(`📍 Новых адресов: ${newCount}`);
        if (retryCount > 0)
            console.log(`🔄 Повторных попыток (ранее не найдено): ${retryCount}`);
        console.log(`📊 Всего в этом запуске: ${addresses.length}\n`);
        const total = addresses.length;
        let processed = 0;
        let success = 0;
        let failed = 0;
        exports.geocodeProgress.emit("progress", {
            status: "running",
            processed: 0,
            total,
            success: 0,
            failed: 0,
        });
        for (let i = 0; i < addresses.length; i++) {
            // Проверяем флаги отмены и паузы
            if (shouldCancel) {
                console.log("\n   ⏹️ Геокодирование отменено пользователем");
                exports.geocodeProgress.emit("progress", {
                    status: "done",
                    processed,
                    total,
                    success,
                    failed,
                    message: "Отменено",
                });
                return;
            }
            // Пауза — ждём возобновления
            while (isPaused) {
                console.log("   ⏸️ Геокодирование на паузе");
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            // Деструктуризируем и выводим отдельные переменные
            const { id, address, serialNumber, meterModel, usdName, usdType } = addresses[i];
            // Обрезаем длинный адрес в выводе для читаемости
            const shortAddress = address.length > 50 ? address.substring(0, 50) + "..." : address;
            process.stdout.write(`[${i + 1}/${addresses.length}] ${shortAddress} `);
            // ── Шаг 5: Запрос к геокодеру ────────────────────────────────────────────
            // geocode() автоматически выбирает Yandex или Nominatim в зависимости от .env
            // Внутри нормализует адрес и добавляет «Кировская область» для точности
            const coords = await (0, geocoder_1.geocode)(address);
            if (coords) {
                // ── Шаг 6а: Координаты найдены — сохраняем в COORDS DB ────────────────
                // Сериализуем координаты в JSON для хранения в полe типа jsonb
                const coordsJson = JSON.stringify({
                    lat: coords.latitude,
                    lon: coords.longitude,
                });
                // Нормализуем адрес: убираем «ул.», «д.», квартиры и т.д. (см. addressNormalizer.ts)
                const cleanAddress = (0, addressNormalizer_1.normalizeAddress)(address);
                // Добавляем регион только если его ещё нет в адресе
                const fullAddress = cleanAddress.includes("Кировская")
                    ? cleanAddress
                    : `Кировская область, ${cleanAddress}`;
                // INSERT ... ON CONFLICT DO UPDATE — так называемый UPSERT:
                // если запись с таким source_id уже есть — обновляем, иначе — вставляем
                await database_1.coordsPool.query(`
          INSERT INTO "Main".location (source_id, address, normalized_address, serial_number, meter_model, usd_name, usd_type, coordinates, last_geocode_request)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
          ON CONFLICT (source_id) 
          DO UPDATE SET address = $2, normalized_address = $3, serial_number = $4, meter_model = $5, usd_name = $6, usd_type = $7, coordinates = $8::jsonb, last_geocode_request = NOW()
        `, [
                    id,
                    address,
                    fullAddress,
                    serialNumber,
                    meterModel,
                    usdName,
                    usdType,
                    coordsJson,
                ]);
                console.log(`✅ (${coords.latitude}, ${coords.longitude})`);
                success++;
            }
            else {
                // ── Шаг 6б: Координаты не найдены — сохраняем попытку без coordinates ──
                // Важно сохранить запись с coordinates = NULL, чтобы:
                //   а) следующий запуск знал, что мы уже пробовали этот адрес
                //   б) можно было позже повторить попытку (через шаг 4 этого скрипта)
                //   в) поле last_geocode_request хранит дату последней попытки
                const cleanAddress = (0, addressNormalizer_1.normalizeAddress)(address);
                const fullAddress = cleanAddress.includes("Кировская")
                    ? cleanAddress
                    : `Кировская область, ${cleanAddress}`;
                await database_1.coordsPool.query(`
          INSERT INTO "Main".location (source_id, address, normalized_address, serial_number, meter_model, usd_name, usd_type, last_geocode_request)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (source_id) 
          DO UPDATE SET address = $2, normalized_address = $3, serial_number = $4, meter_model = $5, usd_name = $6, usd_type = $7, last_geocode_request = NOW()
        `, [
                    id,
                    address,
                    fullAddress,
                    serialNumber,
                    meterModel,
                    usdName,
                    usdType,
                ]);
                console.log("❌ не найдено");
                failed++;
            }
            processed = i + 1;
            exports.geocodeProgress.emit("progress", {
                status: "running",
                processed,
                total,
                success,
                failed,
            });
            // ── Шаг 7: Пауза между запросами ─────────────────────────────────────────
            // Nominatim (OpenStreetMap) требует не более 1 запроса в секунду.
            // Пропускаем паузу только для последнего элемента.
            if (i < addresses.length - 1) {
                await delay(DELAY_MS);
            }
        }
        console.log("\n--- Результат ---");
        console.log(`✅ Успешно: ${success}`);
        console.log(`❌ Не найдено: ${failed}`);
        console.log(`📊 Всего обработано: ${addresses.length}`);
        exports.geocodeProgress.emit("progress", {
            status: "done",
            processed,
            total,
            success,
            failed,
            message: "Геокодирование завершено",
        });
        // Проверяем, остались ли ещё записи
        try {
            const totalSource = await database_1.sourcePool.query(`
        SELECT COUNT(*) as count FROM "enforce_dba".schet_fr 
        WHERE device_id IS NOT NULL AND device_id != ''
      `);
            const totalCoords = await database_1.coordsPool.query(`
        SELECT COUNT(*) as count FROM "Main".location WHERE coordinates IS NOT NULL
      `);
            const remaining = parseInt(totalSource.rows[0].count) -
                parseInt(totalCoords.rows[0].count);
            if (remaining > 0) {
                console.log(`\n⏳ Осталось геокодировать: ~${remaining} адресов`);
                console.log("   Запустите скрипт ещё раз: npm run geocode");
            }
            else {
                console.log("\n🎉 Все адреса геокодированы!");
            }
        }
        catch (statsError) {
            const err = statsError;
            console.log("\n⚠️ Не удалось получить статистику:", err.message);
        }
    }
    catch (error) {
        const err = error;
        console.error("❌ Ошибка:", err.message);
        console.error(err.stack);
        exports.geocodeProgress.emit("progress", {
            status: "error",
            processed: 0,
            total: 0,
            success: 0,
            failed: 0,
            message: err.message,
        });
    }
    finally {
        isRunning = false;
        isPaused = false;
        shouldCancel = false;
    }
}
/** Пауза выполнения геокодирования */
function pauseGeocoding() {
    isPaused = true;
    console.log("⏸️ Геокодирование приостановлено");
}
/** Возобновление выполнения геокодирования */
function resumeGeocoding() {
    isPaused = false;
    console.log("▶️ Геокодирование возобновлено");
}
/** Отмена выполнения геокодирования */
function cancelGeocoding() {
    shouldCancel = true;
    isPaused = false;
    console.log("⏹️ Геокодирование отменено");
}
//# sourceMappingURL=geocode.js.map