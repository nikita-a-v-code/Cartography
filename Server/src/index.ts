import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { sourcePool, coordsPool } from "./config/database";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(cors());
app.use(express.json());

interface PointRow {
  source_id: number;
  address: string;
  latitude: string;
  longitude: string;
}

interface CountRow {
  count: string;
}

// API: Получить все точки с координатами
// Объединяем данные из двух баз
app.get("/api/points", async (_req: Request, res: Response) => {
  try {
    // Получаем координаты из COORDS DB
    const coordsResult = await coordsPool.query<PointRow>(`
      SELECT source_id, address, 
             coordinates->>'lat' as latitude, 
             coordinates->>'lon' as longitude
      FROM "Main".location 
      WHERE coordinates IS NOT NULL
    `);
    res.json(coordsResult.rows);
  } catch (error) {
    console.error("Ошибка получения точек:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// API: Получить статистику геокодирования
app.get("/api/geocode/stats", async (_req: Request, res: Response) => {
  try {
    const total = await sourcePool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "enforce_dba".schet_fr 
      WHERE object_location IS NOT NULL AND object_location != ''
    `);
    const geocoded = await coordsPool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "Main".location 
      WHERE coordinates IS NOT NULL
    `);
    const pending = await coordsPool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "Main".location 
      WHERE coordinates IS NULL
    `);

    const totalCount = parseInt(total.rows[0].count);
    const geocodedCount = parseInt(geocoded.rows[0].count);

    res.json({
      total: totalCount,
      geocoded: geocodedCount,
      pending: totalCount - geocodedCount,
    });
  } catch (error) {
    console.error("Ошибка получения статистики:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Проверка здоровья
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
