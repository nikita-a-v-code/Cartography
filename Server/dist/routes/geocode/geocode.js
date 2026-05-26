"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../../config/database");
// Функции и типы для работы с геокодером
const geocode_1 = require("../../scripts/geocode");
const router = (0, express_1.Router)();
router.get("/stats", async (_req, res) => {
    try {
        // Считаем все адреса в SOURCE DB, которые вообще имеют смысл геокодировать
        const total = await database_1.sourcePool.query(`
      SELECT COUNT(*) as count FROM "enforce_dba".schet_fr 
      WHERE object_location IS NOT NULL AND object_location != ''
    `);
        // Считаем, сколько записей в COORDS DB уже имеют координаты (coordinates != NULL)
        const geocoded = await database_1.coordsPool.query(`
      SELECT COUNT(*) as count FROM "Main".location 
      WHERE coordinates IS NOT NULL
    `);
        // Считаем «неудачные» попытки: записи есть в location, но координаты не нашлись
        const pending = await database_1.coordsPool.query(`
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
    }
    catch (error) {
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
router.post("/update", (_req, res) => {
    // Запускаем фоновый процесс обновления (не ждём завершения — он может длиться минуты)
    (0, geocode_1.geocodeAddresses)();
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
router.get("/progress", (_req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    const onProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (data.status === "done" || data.status === "error") {
            res.end();
        }
    };
    geocode_1.geocodeProgress.on("progress", onProgress);
    _req.on("close", () => {
        geocode_1.geocodeProgress.off("progress", onProgress);
    });
});
exports.default = router;
//# sourceMappingURL=geocode.js.map