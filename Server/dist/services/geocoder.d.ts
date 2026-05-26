/**
 * geocoder.ts — Сервис преобразования адреса в географические координаты
 *
 * Поддерживает два провайдера геокодирования:
 *   1. Yandex Geocoder — платный (1000 запросов/сутки бесплатно), точнее для России.
 *      Требует YANDEX_GEOCODER_API_KEY в .env
 *   2. Nominatim (OpenStreetMap) — бесплатно, без ключа, но лимит 1 запрос/сек.
 *
 * Основная точка входа — функция geocode(address):
 *   Если в .env есть YANDEX_GEOCODER_API_KEY → используем Yandex
 *   Иначе → используем Nominatim
 */
/** Широта + долгота — результат геокодирования */
export interface GeoCoordinates {
    latitude: number;
    longitude: number;
}
/** Входная запись для массового геокодирования */
interface AddressEntry {
    id: number;
    address: string;
}
/** Результат обработки одного адреса при массовом геокодировании */
interface GeocodeResult {
    id: number;
    address: string;
    coords: GeoCoordinates | null;
}
/**
 * geocodeYandex — Геокодирование через Яндекс.Карты API
 *
 * Отправляет GET-запрос на https://geocode-maps.yandex.ru/1.x/
 * и извлекает координаты первого найденного объекта.
 *
 * Лимит бесплатного тарифа: 1000 запросов/сутки.
 * При превышении — ошибка 403, вернём null.
 *
 * @param address — строка адреса (нормализованная, с регионом)
 * @returns координаты или null если ничего не найдено
 */
export declare function geocodeYandex(address: string): Promise<GeoCoordinates | null>;
/**
 * geocodeNominatim — Геокодирование через Nominatim (OpenStreetMap)
 *
 * Полностью бесплатно, не требует ключа.
 * Ограничение: максимум 1 запрос в секунду (Terms of Use OSM).
 * User-Agent обязателен — без него запросы могут быть заблокированы.
 *
 * @param address — строка адреса
 * @returns координаты или null если не найдено
 */
export declare function geocodeNominatim(address: string): Promise<GeoCoordinates | null>;
/**
 * geocode — Основная функция геокодирования
 *
 * Нормализует адрес, добавляет регион и делает запрос к доступному провайдеру.
 * Провайдер выбирается автоматически:
 *   - Если YANDEX_GEOCODER_API_KEY задан в .env → Yandex
 *   - Иначе → Nominatim (бесплатно, но медленнее)
 *
 * @param address — сырой адрес из SOURCE DB
 * @returns координаты { latitude, longitude } или null
 */
export declare function geocode(address: string): Promise<GeoCoordinates | null>;
/**
 * geocodeBatch — Массовое геокодирование списка адресов
 *
 * Обрабатывает адреса по одному с задержкой между запросами (DELAY_MS).
 * Поддерживает callback onProgress для отслеживания прогресса.
 *
 * @param addresses  — массив { id, address } для геокодирования
 * @param onProgress — опциональный callback (current, total, address, coords)
 * @returns массив { id, address, coords } — coords может быть null
 */
export declare function geocodeBatch(addresses: AddressEntry[], onProgress?: (current: number, total: number, address: string, coords: GeoCoordinates | null) => void): Promise<GeocodeResult[]>;
export {};
//# sourceMappingURL=geocoder.d.ts.map