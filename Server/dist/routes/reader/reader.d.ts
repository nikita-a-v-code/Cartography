/**
 * POST /api/readings/update
 *
 * Ручной запуск синхронизации показаний счётчиков.
 * Вызывается с фронтенда кнопкой "Обновить показания".
 *
 * updateReadings() запускается АСИНХРОННО — ответ возвращается немедленно,
 * а реальный прогресс операции отслеживается через SSE /api/readings/progress.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=reader.d.ts.map