"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../../config/database");
const router = (0, express_1.Router)();
/**
 * GET /api/points?localities=Киров,Слободской
 *
 * Возвращает массив точек счётчиков с координатами.
 * Параметр ?localities — необязательный, несколько значений через запятую.
 * Если параметр не передан — возвращаются все точки без фильтра.
 *
 * Для каждой точки выполняется LEFT JOIN с таблицей readings:
 *   LEFT (а не INNER) — чтобы вернуть точку даже если показаний для неё ещё нет.
 */
router.get("/", async (req, res) => {
    try {
        // Читаем строковый параметр из URL, например "Киров,Слободской"
        const localitiesParam = req.query.localities;
        // Разбиваем по запятой, убираем пробелы и пустые строки
        const localities = localitiesParam
            ? localitiesParam
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : null;
        let query;
        let params;
        if (localities && localities.length > 0) {
            // Фильтруем по н.п. через PostgreSQL-оператор ANY($1::text[]),
            // который принимает массив строк и проверяет вхождение
            query = `
        SELECT l.source_id, l.address, l.serial_number, l.meter_model, l.usd_type, l.usd_name,
               (l.coordinates->>'lat') AS latitude, (l.coordinates->>'lon') AS longitude,
               r.last_reading_date
        FROM "Main".location l
        LEFT JOIN "Main".readings r ON l.source_id = r.source_id
        WHERE l.serial_number IS NOT NULL
          AND l.coordinates IS NOT NULL
          AND SPLIT_PART(l.address, ',', 1) = ANY($1::text[])
      `;
            params = [localities];
        }
        else {
            // Без фильтра — отдаём все точки, у которых есть координаты
            query = `
        SELECT l.source_id, l.address, l.serial_number, l.meter_model, l.usd_type, l.usd_name,
               (l.coordinates->>'lat') AS latitude, (l.coordinates->>'lon') AS longitude,
               r.last_reading_date
        FROM "Main".location l
        LEFT JOIN "Main".readings r ON l.source_id = r.source_id
        WHERE l.serial_number IS NOT NULL
          AND l.coordinates IS NOT NULL
      `;
            params = [];
        }
        const coordsResult = await database_1.coordsPool.query(query, params);
        res.json(coordsResult.rows);
    }
    catch (error) {
        console.error("Ошибка получения точек:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
exports.default = router;
//# sourceMappingURL=points.js.map