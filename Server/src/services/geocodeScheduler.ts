/**
 * Планировщик геокодирования
 * Автоматически геокодирует новые адреса по расписанию
 *
 * Читает из SOURCE DB, сохраняет в COORDS DB
 */

import cron from "node-cron";
import { sourcePool, coordsPool } from "../config/database";
import { geocode } from "./geocoder";

const DELAY_MS = 1100; // Nominatim требует 1 сек между запросами
const BATCH_SIZE = 50; // Меньше для фоновой задачи

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface SourceRow {
  id: number;
  address: string;
}

interface ProcessedRow {
  source_id: number;
}

async function processNewAddresses(): Promise<void> {
  console.log(`[${new Date().toISOString()}] 🔄 Проверка новых адресов...`);

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
      console.log("   Новых адресов нет");
      return;
    }

    console.log(`   Найдено ${addresses.length} новых адресов`);

    let success = 0;

    for (let i = 0; i < addresses.length; i++) {
      const { id, address } = addresses[i];

      const coords = await geocode(address);

      if (coords) {
        const coordsJson = JSON.stringify({
          lat: coords.latitude,
          lon: coords.longitude,
        });
        await coordsPool.query(
          `
          INSERT INTO "Main".location (source_id, coordinates, last_geocode_request)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (source_id) 
          DO UPDATE SET coordinates = $2::jsonb, last_geocode_request = NOW()
        `,
          [id, coordsJson],
        );
        success++;
      } else {
        await coordsPool.query(
          `
          INSERT INTO "Main".location (source_id, last_geocode_request)
          VALUES ($1, NOW())
          ON CONFLICT (source_id) 
          DO UPDATE SET last_geocode_request = NOW()
        `,
          [id],
        );
      }

      if (i < addresses.length - 1) {
        await delay(DELAY_MS);
      }
    }

    console.log(`   ✅ Геокодировано: ${success}/${addresses.length}`);
  } catch (error) {
    const err = error as Error;
    console.error("   ❌ Ошибка:", err.message);
  }
}

/**
 * Запуск планировщика
 * По умолчанию: каждые 30 минут
 */
export function startScheduler(cronExpression: string = "*/30 * * * *"): void {
  console.log("📅 Планировщик геокодирования запущен");
  console.log(`   Расписание: ${cronExpression}`);

  // Запускаем сразу при старте
  processNewAddresses();

  // Планируем регулярный запуск
  cron.schedule(cronExpression, processNewAddresses);
}

export { processNewAddresses };
