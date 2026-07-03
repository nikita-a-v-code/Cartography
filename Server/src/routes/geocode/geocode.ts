/**
 * GET /api/geocode/stats
 *
 * Возвращает прогресс геокодирования в виде:
 *   total    — всего адресов с непустым object_location в SOURCE DB
 *   geocoded — сколько из них уже получили координаты в COORDS DB
 *   pending  — сколько ещё остаётся (total - geocoded)
 *
 * Используется фронтендом для отображения прогресс-бара геокодирования.
 */

import { Router, Request, Response } from "express";
import { coordsPool, sourcePool } from "../../config/database";
// Функции и типы для работы с геокодером
import {
  geocodeAddresses,
  geocodeProgress,
  pauseGeocoding,
  resumeGeocoding,
  cancelGeocoding,
} from "../../scripts/geocode";
const router = Router();

/** Результат SQL-выражения COUNT(*) — PostgreSQL всегда возвращает строку, нужен parseInt */
interface CountRow {
  count: string;
}

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    // Считаем все адреса в SOURCE DB, которые вообще имеют смысл геокодировать
    const total = await sourcePool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "enforce_dba".schet_fr 
      WHERE object_location IS NOT NULL 
      AND object_location != ''
      AND device_id ~ '^[0-9]+$'
    `);

    // Считаем, сколько записей в COORDS DB уже имеют координаты (coordinates != NULL)
    const geocoded = await coordsPool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "Main".location 
      WHERE coordinates IS NOT NULL
    `);

    // Считаем «неудачные» попытки: записи есть в location, но координаты не нашлись
    const pending = await coordsPool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "Main".location 
      WHERE coordinates IS NULL
    `);

    const totalCount = parseInt(total.rows[0].count);
    const geocodedCount = parseInt(geocoded.rows[0].count);

    res.json({
      total: totalCount,
      geocoded: geocodedCount,
      // pending = не геокодированные вообще + не попавшие ещё в location
      pending: totalCount - geocodedCount,
    });
  } catch (error) {
    console.error("Ошибка получения статистики:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/**
 * POST /api/geocode/update
 *
 * Ручной запуск геокодирования.
 * Вызывается с фронтенда кнопкой "Запустить геокодирование".
 *
 * geocodeAddresses() запускается АСИНХРОННО — ответ возвращается немедленно,
 */
router.post("/update", (_req: Request, res: Response) => {
  // Запускаем фоновый процесс обновления (не ждём завершения — он может длиться минуты)
  geocodeAddresses();
  res.json({ status: "started" });
});

/**
 * GET /api/geocode/progress
 *
 * Server-Sent Events (SSE) — постоянное одностороннее соединение сервер → браузер.
 * Браузер подключается и получает события прогресса в реальном времени.
 *
 * Каждое событие: "data: <JSON>\n\n"
 */

router.get("/progress", (_req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const onProgress = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.status === "done" || data.status === "error") {
      res.end();
    }
  };

  geocodeProgress.on("progress", onProgress);
  _req.on("close", () => {
    geocodeProgress.off("progress", onProgress);
  });
});

/**
 * POST /api/geocode/pause
 * Приостановить геокодирование
 */
router.post("/pause", (_req: Request, res: Response) => {
  pauseGeocoding();
  res.json({ status: "paused" });
});

/**
 * POST /api/geocode/resume
 * Возобновить геокодирование
 */
router.post("/resume", (_req: Request, res: Response) => {
  resumeGeocoding();
  res.json({ status: "resumed" });
});

/**
 * POST /api/geocode/cancel
 * Отменить геокодирование
 */
router.post("/cancel", (_req: Request, res: Response) => {
  cancelGeocoding();
  res.json({ status: "cancelled" });
});

export default router;
