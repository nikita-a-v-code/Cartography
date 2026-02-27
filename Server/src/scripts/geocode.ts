/**
 * Скрипт для геокодирования адресов из базы данных
 * Запуск: npm run geocode
 *
 * Читает адреса из SOURCE DB ("enforce_dba".schet_fr)
 * Сохраняет координаты в COORDS DB ("Main".location)
 */

import { sourcePool, coordsPool } from "../config/database";
import { geocode } from "../services/geocoder";
import { normalizeAddress } from "../services/addressNormalizer";
import dotenv from "dotenv";

dotenv.config();

// Задержка между запросами (мс) - для Nominatim нужно 1000мс
const DELAY_MS = 1100;
// Сколько записей обрабатывать за один запуск
const BATCH_SIZE = 100;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface SourceRow {
  id: number;
  address: string;
}

interface ProcessedRow {
  source_id: number;
}

interface CountRow {
  count: string;
}

async function geocodeAddresses(): Promise<void> {
  console.log("🚀 Запуск геокодирования адресов...\n");
  console.log("📖 SOURCE DB: исходные данные (enforce_dba.schet_fr)");
  console.log("💾 COORDS DB: сохранение координат (Main.location)\n");

  try {
    // 1. Получаем уже обработанные id из COORDS DB
    const processedResult = await coordsPool.query<ProcessedRow>(`
      SELECT source_id FROM "Main".location WHERE coordinates IS NOT NULL
    `);
    const processedIds = new Set(processedResult.rows.map((r) => r.source_id));

    // 2. Получаем адреса из SOURCE DB
    const sourceResult = await sourcePool.query<SourceRow>(`
      SELECT id, object_location as address
      FROM "enforce_dba".schet_fr
      WHERE object_location IS NOT NULL
        AND object_location != ''
      ORDER BY id
    `);

    // 3. Фильтруем те, что ещё не обработаны
    const addresses = sourceResult.rows
      .filter((r) => !processedIds.has(r.id))
      .slice(0, BATCH_SIZE);

    if (addresses.length === 0) {
      console.log("✅ Все адреса уже геокодированы!");
      return;
    }

    console.log(`📍 Найдено ${addresses.length} адресов для геокодирования\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < addresses.length; i++) {
      const { id, address } = addresses[i];

      const shortAddress =
        address.length > 50 ? address.substring(0, 50) + "..." : address;
      process.stdout.write(`[${i + 1}/${addresses.length}] ${shortAddress} `);

      const coords = await geocode(address);

      if (coords) {
        // Сохраняем в COORDS DB
        const coordsJson = JSON.stringify({
          lat: coords.latitude,
          lon: coords.longitude,
        });

        // Нормализуем адрес для сохранения
        const cleanAddress = normalizeAddress(address);
        const fullAddress = cleanAddress.includes("Кировская")
          ? cleanAddress
          : `Кировская область, ${cleanAddress}`;

        await coordsPool.query(
          `
          INSERT INTO "Main".location (source_id, address, normalized_address, coordinates, last_geocode_request)
          VALUES ($1, $2, $3, $4::jsonb, NOW())
          ON CONFLICT (source_id) 
          DO UPDATE SET address = $2, normalized_address = $3, coordinates = $4::jsonb, last_geocode_request = NOW()
        `,
          [id, address, fullAddress, coordsJson],
        );

        console.log(`✅ (${coords.latitude}, ${coords.longitude})`);
        success++;
      } else {
        // Записываем что пытались, но не нашли
        // Нормализуем адрес для анализа
        const cleanAddress = normalizeAddress(address);
        const fullAddress = cleanAddress.includes("Кировская")
          ? cleanAddress
          : `Кировская область, ${cleanAddress}`;

        await coordsPool.query(
          `
          INSERT INTO "Main".location (source_id, address, normalized_address, last_geocode_request)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (source_id) 
          DO UPDATE SET address = $2, normalized_address = $3, last_geocode_request = NOW()
        `,
          [id, address, fullAddress],
        );

        console.log("❌ не найдено");
        failed++;
      }

      // Задержка между запросами (Nominatim требует 1 сек)
      if (i < addresses.length - 1) {
        await delay(DELAY_MS);
      }
    }

    console.log("\n--- Результат ---");
    console.log(`✅ Успешно: ${success}`);
    console.log(`❌ Не найдено: ${failed}`);
    console.log(`📊 Всего обработано: ${addresses.length}`);

    // Проверяем, остались ли ещё записи
    try {
      const totalSource = await sourcePool.query<CountRow>(`
        SELECT COUNT(*) as count FROM "enforce_dba".schet_fr 
        WHERE object_location IS NOT NULL AND object_location != ''
      `);
      const totalCoords = await coordsPool.query<CountRow>(`
        SELECT COUNT(*) as count FROM "Main".location WHERE coordinates IS NOT NULL
      `);

      const remaining =
        parseInt(totalSource.rows[0].count) -
        parseInt(totalCoords.rows[0].count);
      if (remaining > 0) {
        console.log(`\n⏳ Осталось геокодировать: ~${remaining} адресов`);
        console.log("   Запустите скрипт ещё раз: npm run geocode");
      } else {
        console.log("\n🎉 Все адреса геокодированы!");
      }
    } catch (statsError) {
      const err = statsError as Error;
      console.log("\n⚠️ Не удалось получить статистику:", err.message);
    }
  } catch (error) {
    const err = error as Error;
    console.error("❌ Ошибка:", err.message);
    console.error(err.stack);
  } finally {
    await sourcePool.end();
    await coordsPool.end();
  }
}

// Запуск
geocodeAddresses();
