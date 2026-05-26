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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=geocode.d.ts.map