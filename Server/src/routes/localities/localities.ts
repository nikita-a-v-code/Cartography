import { Router, Request, Response } from "express";
import { coordsPool } from "../../config/database";

const router = Router();

/** Строка агрегации: название населённого пункта и сколько точек в нём */
interface LocalityRow {
  locality: string;
  count: string;
}

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

router.get("/", async (_req: Request, res: Response) => {
  try {
    // SPLIT_PART(address, ',', 1) — берём фрагмент до первой запятой как название н.п.
    // Фильтруем: только записи с координатами И непустым адресом — иначе locality будет ''
    const result = await coordsPool.query<LocalityRow>(`
      SELECT SPLIT_PART(address, ',', 1) AS locality, COUNT(*) AS count
      FROM "Main".location
      WHERE coordinates IS NOT NULL
        AND address IS NOT NULL
        AND address != ''
      GROUP BY locality
      ORDER BY count DESC, locality
    `);

    // COUNT возвращается как строка — преобразуем в число для фронтенда
    res.json(
      result.rows.map((r) => ({
        locality: r.locality,
        count: parseInt(r.count),
      })),
    );
  } catch (error) {
    console.error("Ошибка получения населённых пунктов:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
