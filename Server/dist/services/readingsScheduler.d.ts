/**
 * readingsScheduler.ts — Планировщик синхронизации показаний счётчиков
 *
 * Что делает:
 *   1. Читает все source_id из COORDS DB (таблица Main.location)
 *   2. Для каждого идентификатора делает запрос в SOURCE DB (bp_result)
 *      и получает MAX(дата последнего показания)
 *   3. Сохраняет результат в COORDS DB (Main.readings) через UPSERT
 *
 * Прогресс операции транслируется через EventEmitter (readingsProgress)
 * и доставляется клиенту через SSE-маршрут /api/readings/progress.
 *
 * Расписание по умолчанию: каждые 3 дня в 02:00 ночи
 */
import { EventEmitter } from "events";
export declare const readingsProgress: EventEmitter<[never]>;
/** Формат одного события прогресса */
export interface ReadingsProgressData {
    status: "running" | "done" | "error";
    processed: number;
    total: number;
    withReadings: number;
    message?: string;
}
declare let isRunning: boolean;
declare function updateReadings(): Promise<void>;
/**
 * Запуск планировщика показаний
 * По умолчанию: каждые 3 дня в 02:00
 */
export declare function startReadingsScheduler(cronExpression?: string): void;
/** Пауза выполнения обновления показаний */
export declare function pauseReadings(): void;
/** Возобновление выполнения обновления показаний */
export declare function resumeReadings(): void;
/** Отмена выполнения обновления показаний */
export declare function cancelReadings(): void;
export { updateReadings, isRunning };
//# sourceMappingURL=readingsScheduler.d.ts.map