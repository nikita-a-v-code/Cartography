"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../../config/database");
const router = (0, express_1.Router)();
/**
 * GET /api/localities
 *
 * Возвращает массив объектов { locality, count } — список уникальных
 * населённых пунктов с количеством геокодированных точек в каждом.
 *
 * Населённый пункт вычисляется как часть адреса до первой запятой:
 *   "Киров, ул. Ленина, 1" → "Киров"
 *
 * Используется фронтендом для заполнения выпадающего фильтра по н.п.
 * Сортировка: сначала н.п. с наибольшим числом точек.
 */
router.get("/", async (_req, res) => {
    try {
        // SPLIT_PART(address, ',', 1) — берём фрагмент до первой запятой как название н.п.
        // Фильтруем: только записи с координатами И непустым адресом — иначе locality будет ''
        const result = await database_1.coordsPool.query(`
      SELECT SPLIT_PART(address, ',', 1) AS locality, COUNT(*) AS count
      FROM "Main".location
      WHERE coordinates IS NOT NULL
        AND address IS NOT NULL
        AND address != ''
      GROUP BY locality
      ORDER BY count DESC, locality
    `);
        // COUNT возвращается как строка — преобразуем в число для фронтенда
        res.json(result.rows.map((r) => ({
            locality: r.locality,
            count: parseInt(r.count),
        })));
    }
    catch (error) {
        console.error("Ошибка получения населённых пунктов:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
exports.default = router;
//# sourceMappingURL=localities.js.map