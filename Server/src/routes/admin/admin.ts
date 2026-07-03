/**
 * admin.ts — Маршруты панели администратора
 *
 * GET  /api/admin/settings  — получить все настройки
 * PUT  /api/admin/settings  — обновить настройки
 */

import { Router, Request, Response } from "express";
import { getSettings, updateSettings } from "../../services/configService";

const router = Router();

/** GET /api/admin/settings */
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PUT /api/admin/settings */
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<{
      enableGeocoder: boolean;
      geocoderCron: string;
      geocoderBatchSize: number;
      geocodingBatchSize: number;
      geocoderRetryDays: number;
      enableReadings: boolean;
      readingsCron: string;
      readingsBatchSize: number;
    }>;

    // Переводим camelCase → snake_case ключи для БД
    const dbUpdates: Record<string, string> = {};
    if (body.enableGeocoder !== undefined)
      dbUpdates.enable_geocoder = String(body.enableGeocoder);
    if (body.geocoderCron !== undefined)
      dbUpdates.geocoder_cron = body.geocoderCron;
    if (body.geocoderBatchSize !== undefined)
      dbUpdates.geocoder_batch_size = String(body.geocoderBatchSize);
    if (body.geocodingBatchSize !== undefined)
      dbUpdates.geocoding_batch_size = String(body.geocodingBatchSize);
    if (body.geocoderRetryDays !== undefined)
      dbUpdates.geocoder_retry_days = String(body.geocoderRetryDays);
    if (body.enableReadings !== undefined)
      dbUpdates.enable_readings = String(body.enableReadings);
    if (body.readingsCron !== undefined)
      dbUpdates.readings_cron = body.readingsCron;
    if (body.readingsBatchSize !== undefined)
      dbUpdates.readings_batch_size = String(body.readingsBatchSize);

    await updateSettings(dbUpdates);
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
