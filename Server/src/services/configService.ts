/**
 * configService.ts — Сервис настроек приложения
 *
 * Читает настройки из таблицы "Main".settings в БД.
 * Кеширует результат на 30 секунд, чтобы не делать запрос к БД при каждой итерации.
 * При недоступности БД возвращает значения из process.env (как запасной вариант).
 *
 * Изменения настроек (enableGeocoder, batchSize, retryDays) вступают в силу
 * при следующем запуске планировщика (в течение до 30 секунд).
 * Изменение cron-расписания требует перезапуска сервера.
 */

import { coordsPool } from "../config/database";

export interface AppSettings {
  enableGeocoder: boolean;
  geocoderCron: string;
  geocoderBatchSize: number;
  geocodingBatchSize: number;
  geocoderRetryDays: number;
  enableReadings: boolean;
  readingsCron: string;
  readingsBatchSize: number;
}

/** Значения по умолчанию — берутся из .env если БД недоступна */
const defaults: AppSettings = {
  enableGeocoder: process.env.ENABLE_GEOCODER === "true",
  geocoderCron: process.env.GEOCODER_CRON || "0 3 */3 * *",
  geocoderBatchSize: parseInt(process.env.GEOCODER_BATCH_SIZE || "300", 10),
  geocodingBatchSize: parseInt(process.env.GEOCODING_BATCH_SIZE || "2000", 10),
  geocoderRetryDays: parseInt(process.env.GEOCODER_RETRY_DAYS || "30", 10),
  enableReadings: process.env.ENABLE_READINGS === "true",
  readingsCron: process.env.READINGS_CRON || "0 2 */3 * *",
  readingsBatchSize: parseInt(process.env.READINGS_BATCH_SIZE || "1000", 10),
};

let cache: AppSettings | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 секунд

/** Получить текущие настройки (с кешированием) */
export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) return cache;

  try {
    const result = await coordsPool.query<{ key: string; value: string }>(
      `SELECT key, value FROM "Main".settings`
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;

    cache = {
      enableGeocoder:
        map.enable_geocoder !== undefined
          ? map.enable_geocoder === "true"
          : defaults.enableGeocoder,
      geocoderCron: map.geocoder_cron || defaults.geocoderCron,
      geocoderBatchSize: map.geocoder_batch_size
        ? parseInt(map.geocoder_batch_size, 10)
        : defaults.geocoderBatchSize,
      geocodingBatchSize: map.geocoding_batch_size
        ? parseInt(map.geocoding_batch_size, 10)
        : defaults.geocodingBatchSize,
      geocoderRetryDays: map.geocoder_retry_days
        ? parseInt(map.geocoder_retry_days, 10)
        : defaults.geocoderRetryDays,
      enableReadings:
        map.enable_readings !== undefined
          ? map.enable_readings === "true"
          : defaults.enableReadings,
      readingsCron: map.readings_cron || defaults.readingsCron,
      readingsBatchSize: map.readings_batch_size
        ? parseInt(map.readings_batch_size, 10)
        : defaults.readingsBatchSize,
    };
    cacheTime = now;
    return cache;
  } catch {
    // Если БД недоступна — возвращаем кеш или defaults
    return cache ?? defaults;
  }
}

/** Сбросить кеш (вызывается после сохранения настроек) */
export function invalidateSettingsCache(): void {
  cache = null;
}

/** Сохранить изменения в БД */
export async function updateSettings(
  updates: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    await coordsPool.query(
      `INSERT INTO "Main".settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }
  invalidateSettingsCache();
}
