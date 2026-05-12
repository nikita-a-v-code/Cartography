/**
 * index.ts — Точка входа HTTP-сервера
 *
 * Поднимает Express-приложение и регистрирует все REST API-маршруты.
 * Сервер работает с двумя PostgreSQL-базами одновременно:
 *   • SOURCE DB (ve2)          — сторонняя БД с данными абонентов (только чтение)
 *   • COORDS DB (cartography)  — наша БД с координатами и показаниями (чтение/запись)
 *
 * Список маршрутов:
 *   GET  /api/localities        — уникальные населённые пункты + kол-во точек в каждом
 *   GET  /api/points            — все точки счётчиков с координатами (с фильтром по н.п.)
 *   GET  /api/geocode/stats     — статистика прогресса геокодирования
 *   GET  /api/health            — проверка работоспособности сервера (ping)
 *   POST /api/readings/update   — ручной старт синхронизации показаний
 *   GET  /api/readings/progress — SSE-стрим с прогрессом синхронизации в реальном времени
 */
import express, { Request, Response } from "express";
import cors from "cors"; // Разрешает запросы с других источников (нужно для React на другом порту)
import dotenv from "dotenv"; // Загружает переменные окружения из файла .env

// Загружаем .env ДО всех остальных импортов — иначе process.env.* будет пустым
// при инициализации пулов БД в database.ts
dotenv.config();

// Пулы подключений к двум базам данных (детали конфигурации в config/database.ts)
import { sourcePool, coordsPool } from "./config/database";
import path from "path";

// Функции и типы для работы с показаниями счётчиков
import {
  updateReadings, // асинхронная функция синхронизации показаний
  readingsProgress, // EventEmitter, через который планировщик рассылает события прогресса
  ReadingsProgressData, // тип одного события прогресса (status, processed, total, ...)
  startReadingsScheduler,
} from "./services/readingsScheduler";

import { startScheduler } from "./services/geocodeScheduler";

const ENABLE_SCHEDULERS = process.env.ENABLE_SCHEDULERS === "true";

if (ENABLE_SCHEDULERS) {
  startScheduler("0 3 * * 1");
  startReadingsScheduler("0 2 */3 * *");
}

const app = express();

// Порт берём из переменной окружения PORT, иначе используем 3000
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middlewares ──────────────────────────────────────────────────────────────

// cors() — без этого браузер блокирует запросы с http://localhost:3001 к http://localhost:3000
app.use(cors());

// express.json() — автоматически парсит JSON-тело входящих запросов (POST/PUT)
// После этого тело доступно через req.body
app.use(express.json());

app.use(express.static(path.join(__dirname, "../../frontend/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/build", "index.html"));
});

// ─── Интерфейсы строк из PostgreSQL ──────────────────────────────────────────

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

/** Результат SQL-выражения COUNT(*) — PostgreSQL всегда возвращает строку, нужен parseInt */
interface CountRow {
  count: string;
}

/** Строка агрегации: название населённого пункта и сколько точек в нём */
interface LocalityRow {
  locality: string;
  count: string;
}

/** Тип УСПД из справочника Main.uspd_types */
interface UspdTypeRow {
  id: number;
  name: string;
  description: string | null;
}

/** Точка УСПД, размещённая вручную на карте */
interface UspdPointRow {
  id: number;
  name: string;
  uspd_type_id: number | null;
  type_name: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  created_at: string;
}

// ─── API-маршруты ─────────────────────────────────────────────────────────────

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
app.get("/api/localities", async (_req: Request, res: Response) => {
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
app.get("/api/points", async (req: Request, res: Response) => {
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
app.get("/api/geocode/stats", async (_req: Request, res: Response) => {
  try {
    // Считаем все адреса в SOURCE DB, которые вообще имеют смысл геокодировать
    const total = await sourcePool.query<CountRow>(`
      SELECT COUNT(*) as count FROM "enforce_dba".schet_fr 
      WHERE object_location IS NOT NULL AND object_location != ''
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
 * GET /api/health
 *
 * Простая «живая» проверка сервера.
 * Мониторинг и балансировщики нагрузки используют этот эндпоинт.
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /api/readings/update
 *
 * Ручной запуск синхронизации показаний счётчиков.
 * Вызывается с фронтенда кнопкой "Обновить показания".
 *
 * updateReadings() запускается АСИНХРОННО — ответ возвращается немедленно,
 * а реальный прогресс операции отслеживается через SSE /api/readings/progress.
 */
app.post("/api/readings/update", (_req: Request, res: Response) => {
  // Запускаем фоновый процесс обновления (не ждём завершения — он может длиться минуты)
  updateReadings();
  res.json({ status: "started" });
});

/**
 * GET /api/readings/progress
 *
 * Server-Sent Events (SSE) — постоянное одностороннее соединение сервер → браузер.
 * Браузер подключается и получает события прогресса в реальном времени,
 * пока синхронизация показаний не завершится (status === "done" или "error").
 *
 * Каждое событие: "data: <JSON>\n\n"
 * Формат JSON: { status, processed, total, withReadings, message? }
 */
app.get("/api/readings/progress", (_req: Request, res: Response) => {
  // Заголовки SSE: браузер при таком Content-Type автоматически читает поток событий
  res.writeHead(200, {
    "Content-Type": "text/event-stream", // обязательный MIME-тип для SSE
    "Cache-Control": "no-cache", // запрещаем кешировать — данные всегда свежие
    Connection: "keep-alive", // держим TCP-соединение открытым до конца операции
  });

  // Каждый раз, когда планировщик испускает событие "progress", отправляем JSON клиенту
  const onProgress = (data: ReadingsProgressData) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Когда операция завершилась (успех или ошибка) — закрываем SSE-соединение
    if (data.status === "done" || data.status === "error") {
      res.end();
    }
  };

  // Подписываемся на EventEmitter планировщика показаний
  readingsProgress.on("progress", onProgress);

  // Если клиент закрыл вкладку или соединение разорвалось —
  // отписываемся от EventEmitter, чтобы не было утечки памяти
  // и попыток записи в уже закрытый Response
  _req.on("close", () => {
    readingsProgress.off("progress", onProgress);
  });
});

// ─── Запуск сервера ───────────────────────────────────────────────────────────
// ─── УСПД: справочник типов ────────────────────────────────────────────────────

/** GET /api/uspd-types — список всех типов УСПД */
app.get("/api/uspd-types", async (_req: Request, res: Response) => {
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
app.post("/api/uspd-types", async (req: Request, res: Response) => {
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
app.put("/api/uspd-types/:id", async (req: Request, res: Response) => {
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
app.delete("/api/uspd-types/:id", async (req: Request, res: Response) => {
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

// ─── УСПД: точки на карте ─────────────────────────────────────────────────────

/** GET /api/uspd-points — все ручные точки УСПД с именем типа */
app.get("/api/uspd-points", async (_req: Request, res: Response) => {
  try {
    const result = await coordsPool.query<UspdPointRow>(`
      SELECT p.id, p.name, p.uspd_type_id, t.name AS type_name,
             p.latitude, p.longitude, p.description, p.created_at
      FROM "Main".uspd_points p
      LEFT JOIN "Main".uspd_types t ON p.uspd_type_id = t.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения точек УСПД:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** POST /api/uspd-points — создать точку УСПД */
app.post("/api/uspd-points", async (req: Request, res: Response) => {
  const { name, uspd_type_id, latitude, longitude, description } = req.body as {
    name?: string;
    uspd_type_id?: number | null;
    latitude?: number;
    longitude?: number;
    description?: string;
  };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Поле name обязательно" });
    return;
  }
  if (latitude == null || longitude == null) {
    res.status(400).json({ error: "Поля latitude и longitude обязательны" });
    return;
  }
  try {
    const result = await coordsPool.query<UspdPointRow>(
      `
      INSERT INTO "Main".uspd_points (name, uspd_type_id, latitude, longitude, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, uspd_type_id, latitude, longitude, description, created_at
    `,
      [
        name.trim(),
        uspd_type_id || null,
        latitude,
        longitude,
        description?.trim() || null,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка создания точки УСПД:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** PUT /api/uspd-points/:id — обновить точку УСПД */
app.put("/api/uspd-points/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { name, uspd_type_id, latitude, longitude, description } = req.body as {
    name?: string;
    uspd_type_id?: number | null;
    latitude?: number;
    longitude?: number;
    description?: string;
  };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Поле name обязательно" });
    return;
  }
  if (latitude == null || longitude == null) {
    res.status(400).json({ error: "Поля latitude и longitude обязательны" });
    return;
  }
  try {
    const result = await coordsPool.query<UspdPointRow>(
      `
      UPDATE "Main".uspd_points
      SET name = $1, uspd_type_id = $2, latitude = $3, longitude = $4,
          description = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING id, name, uspd_type_id, latitude, longitude, description, created_at
    `,
      [
        name.trim(),
        uspd_type_id || null,
        latitude,
        longitude,
        description?.trim() || null,
        id,
      ],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Точка УСПД не найдена" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка обновления точки УСПД:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** DELETE /api/uspd-points/:id — удалить точку УСПД */
app.delete("/api/uspd-points/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await coordsPool.query(
      `DELETE FROM "Main".uspd_points WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Точка УСПД не найдена" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка удаления точки УСПД:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Запуск сервера ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
