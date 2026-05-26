/**
 * geocodeScheduler.ts — Фоновый планировщик геокодирования
 *
 * Автоматически геокодирует новые адреса и повторяет неудачные попытки.
 * Запускается при старте сервера + далее по расписанию (cron).
 *
 * Отличие от scripts/geocode.ts:
 *   - geocodeScheduler работает в фоне, небольшими порциями (BATCH_SIZE=300)
 *
 * Логика повторных попыток:
 *   - Адреса без координат проверяются повторно через RETRY_AFTER_DAYS дней
 *   - Дата последней попытки хранится в поле last_geocode_request
 *   - Новые адреса (отсутствующие в location) геокодируются сразу
 *
 * Расписание по умолчанию: каждые 3 дня в 03:00 ночи
 */
declare function processNewAddresses(): Promise<void>;
/**
 * Запуск планировщика
 * По умолчанию: каждые 30 минут
 */
export declare function startScheduler(cronExpression?: string): void;
export { processNewAddresses };
//# sourceMappingURL=geocodeScheduler.d.ts.map