import { Router, Request, Response } from "express";
import { coordsPool } from "../../config/database";

const router = Router();

/**
 * Одна точка счётчика с координатами — результат JOIN таблиц location и readings.
 * PostgreSQL возвращает числа из jsonb-полей как строки, поэтому latitude/longitude — string.
 */
interface PointRow {
  source_id: number; // первичный ключ из SOURCE DB (таблица schet_fr)
  address: string; // исходный (ненормализованный) адрес установки счётчика
  serial_number: string; // серийный номер прибора учёта
  meter_model: string | null; // модель прибора — NULL если не заполнено в SOURCE DB
  usd_type: string | null; // тип УСПД (устройство сбора и передачи данных)
  usd_name: string | null; // наименование конкретного УСПД
  last_reading_date: string | null; // дата последнего показания из таблицы readings
  latitude: string; // широта — извлечена из jsonb: coordinates->>'lat'
  longitude: string; // долгота — извлечена из jsonb: coordinates->>'lon'
}

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
router.get("/", async (req: Request, res: Response) => {
  try {
    // Читаем строковый параметр из URL, например "Киров,Слободской"
    const localitiesParam = req.query.localities as string | undefined;

    // Разбиваем по запятой, убираем пробелы и пустые строки
    const localities = localitiesParam
      ? localitiesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    let query: string;
    let params: any[];

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
    } else {
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

    const coordsResult = await coordsPool.query<PointRow>(query, params);
    res.json(coordsResult.rows);
  } catch (error) {
    console.error("Ошибка получения точек:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
