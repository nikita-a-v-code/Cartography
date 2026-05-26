"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../../config/database");
const router = (0, express_1.Router)();
// ─── УСПД: точки на карте ─────────────────────────────────────────────────────
/** GET /api/uspd-points — все ручные точки УСПД с именем типа */
router.get("/", async (_req, res) => {
    try {
        const result = await database_1.coordsPool.query(`
      SELECT p.id, p.name, p.uspd_type_id, t.name AS type_name,
             p.latitude, p.longitude, p.description, p.created_at
      FROM "Main".uspd_points p
      LEFT JOIN "Main".uspd_types t ON p.uspd_type_id = t.id
      ORDER BY p.created_at DESC
    `);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Ошибка получения точек УСПД:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
/** POST /api/uspd-points — создать точку УСПД */
router.post("/", async (req, res) => {
    const { name, uspd_type_id, latitude, longitude, description } = req.body;
    if (!name || !name.trim()) {
        res.status(400).json({ error: "Поле name обязательно" });
        return;
    }
    if (latitude == null || longitude == null) {
        res.status(400).json({ error: "Поля latitude и longitude обязательны" });
        return;
    }
    try {
        const result = await database_1.coordsPool.query(`
      INSERT INTO "Main".uspd_points (name, uspd_type_id, latitude, longitude, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, uspd_type_id, latitude, longitude, description, created_at
    `, [
            name.trim(),
            uspd_type_id || null,
            latitude,
            longitude,
            description?.trim() || null,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error("Ошибка создания точки УСПД:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
/** PUT /api/uspd-points/:id — обновить точку УСПД */
router.put("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { name, uspd_type_id, latitude, longitude, description } = req.body;
    if (!name || !name.trim()) {
        res.status(400).json({ error: "Поле name обязательно" });
        return;
    }
    if (latitude == null || longitude == null) {
        res.status(400).json({ error: "Поля latitude и longitude обязательны" });
        return;
    }
    try {
        const result = await database_1.coordsPool.query(`
      UPDATE "Main".uspd_points
      SET name = $1, uspd_type_id = $2, latitude = $3, longitude = $4,
          description = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING id, name, uspd_type_id, latitude, longitude, description, created_at
    `, [
            name.trim(),
            uspd_type_id || null,
            latitude,
            longitude,
            description?.trim() || null,
            id,
        ]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: "Точка УСПД не найдена" });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Ошибка обновления точки УСПД:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
/** DELETE /api/uspd-points/:id — удалить точку УСПД */
router.delete("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const result = await database_1.coordsPool.query(`DELETE FROM "Main".uspd_points WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: "Точка УСПД не найдена" });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Ошибка удаления точки УСПД:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
exports.default = router;
//# sourceMappingURL=uspd-points.js.map