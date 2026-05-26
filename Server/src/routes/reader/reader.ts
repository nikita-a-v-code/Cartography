/**
 * POST /api/readings/update
 *
 * Ручной запуск синхронизации показаний счётчиков.
 * Вызывается с фронтенда кнопкой "Обновить показания".
 *
 * updateReadings() запускается АСИНХРОННО — ответ возвращается немедленно,
 * а реальный прогресс операции отслеживается через SSE /api/readings/progress.
 */

import { Router, Request, Response } from "express";
// Функции и типы для работы с показаниями счётчиков
import {
  updateReadings, // асинхронная функция синхронизации показаний
  readingsProgress, // EventEmitter, через который планировщик рассылает события прогресса
  ReadingsProgressData, // тип одного события прогресса (status, processed, total, ...)
  pauseReadings,
  resumeReadings,
  cancelReadings,
} from "../../services/readingsScheduler";
const router = Router();

router.post("/update", (_req: Request, res: Response) => {
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

router.get("/progress", (_req: Request, res: Response) => {
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

/**
 * POST /api/readings/pause
 * Приостановить обновление показаний
 */
router.post("/pause", (_req: Request, res: Response) => {
  pauseReadings();
  res.json({ status: "paused" });
});

/**
 * POST /api/readings/resume
 * Возобновить обновление показаний
 */
router.post("/resume", (_req: Request, res: Response) => {
  resumeReadings();
  res.json({ status: "resumed" });
});

/**
 * POST /api/readings/cancel
 * Отменить обновление показаний
 */
router.post("/cancel", (_req: Request, res: Response) => {
  cancelReadings();
  res.json({ status: "cancelled" });
});

export default router;
