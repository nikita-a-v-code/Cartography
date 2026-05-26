"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors")); // Разрешает запросы с других источников (нужно для React на другом порту)
const dotenv_1 = __importDefault(require("dotenv")); // Загружает переменные окружения из файла .env
// Загружаем .env ДО всех остальных импортов — иначе process.env.* будет пустым
// при инициализации пулов БД в database.ts
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const users_1 = __importDefault(require("./routes/users/users"));
const geocode_1 = __importDefault(require("./routes/geocode/geocode"));
const uspd_types_1 = __importDefault(require("./routes/uspd/uspd-types"));
const uspd_points_1 = __importDefault(require("./routes/uspd/uspd-points"));
const reference_1 = __importDefault(require("./routes/reference/reference"));
const localities_1 = __importDefault(require("./routes/localities/localities"));
const points_1 = __importDefault(require("./routes/points/points"));
const reader_1 = __importDefault(require("./routes/reader/reader"));
const readingsScheduler_1 = require("./services/readingsScheduler");
const geocodeScheduler_1 = require("./services/geocodeScheduler");
// Геокодер (преобразование адресов в координаты)
// Запускается каждые 3 дня в 03:00 ночи
// Обрабатывает новые адреса и повторяет неудачные попытки раз в 30 дней
if (process.env.ENABLE_GEOCODER === "true") {
    (0, geocodeScheduler_1.startScheduler)();
}
// Ридер показаний (синхронизация дат последних показаний счётчиков)
// Запускается каждые 3 дня в 02:00 ночи (на час раньше геокодера, чтобы снизить нагрузку)
// Обновляет таблицу readings на основе данных из SOURCE DB
if (process.env.ENABLE_READINGS === "true") {
    (0, readingsScheduler_1.startReadingsScheduler)();
}
const app = (0, express_1.default)();
// cors() — без этого браузер блокирует запросы с http://localhost:3001 к http://localhost:3000
app.use((0, cors_1.default)());
// express.json() — автоматически парсит JSON-тело входящих запросов (POST/PUT)
// После этого тело доступно через req.body
app.use(express_1.default.json());
// Порт берём из переменной окружения PORT, иначе используем 3000
const PORT = parseInt(process.env.PORT || "3000", 10);
// ROUTES
// =============================================================================
app.use("/api/users", users_1.default);
app.use("/api/geocode", geocode_1.default);
app.use("/api/uspd-types", uspd_types_1.default);
app.use("/api/uspd-points", uspd_points_1.default);
app.use("/api/config", reference_1.default);
app.use("/api/localities", localities_1.default);
app.use("/api/points", points_1.default);
app.use("/api/readings", reader_1.default);
// ─── API-маршруты ─────────────────────────────────────────────────────────────
/**
 * GET /api/health
 *
 * Простая «живая» проверка сервера.
 * Мониторинг и балансировщики нагрузки используют этот эндпоинт.
 */
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});
app.use(express_1.default.static(path_1.default.join(__dirname, "../../Web/build")));
app.get("*", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../../Web/build", "index.html"));
});
// ─── Запуск сервера ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map