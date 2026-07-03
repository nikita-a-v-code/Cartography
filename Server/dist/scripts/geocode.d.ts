/**
 * geocode.ts — Одноразовый скрипт массового геокодирования адресов
 * Запуск вручную: npm run geocode
 *
 * Логика работы:
 *   1. Читает все адреса из SOURCE DB (enforce_dba.schet_fr)
 *   2. Определяет, какие уже обрабатывались (есть в Main.location)
 *   3. Сначала берёт НОВЫЕ адреса (которых вообще нет в location)
 *   4. Если новых меньше BATCH_SIZE — добирает СТАРЫЕ НЕУДАЧНЫЕ (coordinates IS NULL)
 *   5. Для каждого адреса вызывает геокодер (Yandex или Nominatim)
 *   6. Сохраняет результат в COORDS DB — координаты или NULL если не нашлось
 *
 * После каждого запуска выводит статистику и подсказывает, нужно ли запустить ещё раз.
 */
import { EventEmitter } from "events";
export declare const geocodeProgress: EventEmitter<[never]>;
declare function geocodeAddresses(): Promise<void>;
/** Пауза выполнения геокодирования */
export declare function pauseGeocoding(): void;
/** Возобновление выполнения геокодирования */
export declare function resumeGeocoding(): void;
/** Отмена выполнения геокодирования */
export declare function cancelGeocoding(): void;
export { geocodeAddresses };
//# sourceMappingURL=geocode.d.ts.map