import { Router, Request, Response } from "express";
import { coordsPool } from "../../config/database";

const router = Router();

/** Тип УСПД из справочника Main.uspd_types */
interface UspdTypeRow {
  id: number;
  name: string;
  description: string | null;
}
// ─── УСПД: работа с типами ─────────────────────────────────────────────────────

/** GET /api/uspd-types — список всех типов УСПД */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await coordsPool.query<UspdTypeRow>(
      `SELECT id, name, description FROM "Main".uspd_types ORDER BY name`,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения типов УСПД:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** POST /api/uspd-types — создать новый тип УСПД */
router.post("/", async (req: Request, res: Response) => {
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Поле name обязательно" });
    return;
  }
  try {
    // Сразу возвращаем созданный тип с его id, чтобы фронтенд мог сразу использовать его для новой точки УСПД
    const result = await coordsPool.query<UspdTypeRow>(
      `INSERT INTO "Main".uspd_types (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description`,
      [name.trim(), description?.trim() || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Тип УСПД с таким именем уже существует" });
    } else {
      console.error("Ошибка создания типа УСПД:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }
});

/** PUT /api/uspd-types/:id — переименовать / изменить описание типа УСПД */
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Поле name обязательно" });
    return;
  }
  try {
    const result = await coordsPool.query<UspdTypeRow>(
      `UPDATE "Main".uspd_types
       SET name = $1, description = $2
       WHERE id = $3
       RETURNING id, name, description`,
      [name.trim(), description?.trim() || null, id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Тип не найден" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Тип УСПД с таким именем уже существует" });
    } else {
      console.error("Ошибка обновления типа УСПД:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }
});

/** DELETE /api/uspd-types/:id — удалить тип УСПД (точки сбросят тип в NULL) */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }
  try {
    const result = await coordsPool.query(
      `DELETE FROM "Main".uspd_types WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Тип не найден" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Ошибка удаления типа УСПД:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
