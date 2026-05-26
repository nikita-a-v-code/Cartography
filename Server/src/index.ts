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

import path from "path";
import usersRouter from "./routes/users/users";
import geocodeRouter from "./routes/geocode/geocode";
import uspdTypesRouter from "./routes/uspd/uspd-types";
import uspdPointsRouter from "./routes/uspd/uspd-points";
import referenceRouter from "./routes/reference/reference";
import localitiesRouter from "./routes/localities/localities";
import pointsRouter from "./routes/points/points";
import readingsRouter from "./routes/reader/reader";

import { startReadingsScheduler } from "./services/readingsScheduler";
import { startScheduler } from "./services/geocodeScheduler";

// Геокодер (преобразование адресов в координаты)
// Запускается каждые 3 дня в 03:00 ночи
// Обрабатывает новые адреса и повторяет неудачные попытки раз в 30 дней

if (process.env.ENABLE_GEOCODER === "true") {
  startScheduler();
}

// Ридер показаний (синхронизация дат последних показаний счётчиков)
// Запускается каждые 3 дня в 02:00 ночи (на час раньше геокодера, чтобы снизить нагрузку)
// Обновляет таблицу readings на основе данных из SOURCE DB

if (process.env.ENABLE_READINGS === "true") {
  startReadingsScheduler();
}

const app = express();

// cors() — без этого браузер блокирует запросы с http://localhost:3001 к http://localhost:3000
app.use(cors());

// express.json() — автоматически парсит JSON-тело входящих запросов (POST/PUT)
// После этого тело доступно через req.body
app.use(express.json());

// Порт берём из переменной окружения PORT, иначе используем 3000
const PORT = parseInt(process.env.PORT || "3000", 10);

// ROUTES
// =============================================================================
app.use("/api/users", usersRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/uspd-types", uspdTypesRouter);
app.use("/api/uspd-points", uspdPointsRouter);
app.use("/api/config", referenceRouter);
app.use("/api/localities", localitiesRouter);
app.use("/api/points", pointsRouter);
app.use("/api/readings", readingsRouter);

// ─── API-маршруты ─────────────────────────────────────────────────────────────

/**
 * GET /api/health
 *
 * Простая «живая» проверка сервера.
 * Мониторинг и балансировщики нагрузки используют этот эндпоинт.
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.use(express.static(path.join(__dirname, "../../Web/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../Web/build", "index.html"));
});

// ─── Запуск сервера ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
