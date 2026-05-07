import axios from "axios";
import dotenv from "dotenv";
import { normalizeAddress } from "./addressNormalizer";

dotenv.config();

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
  coords: GeoCoordinates | null; // null — если адрес не был найден ни одним провайдером
}

// Задержка внутри geocodeBatch между отдельными запросами (мс)
const DELAY_MS = 200;

// Вспомогательная функция задержки через Promise
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
export async function geocodeYandex(
  address: string,
): Promise<GeoCoordinates | null> {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  if (!apiKey) {
    throw new Error("YANDEX_GEOCODER_API_KEY не указан в .env");
  }

  try {
    const response = await axios.get("https://geocode-maps.yandex.ru/1.x/", {
      params: {
        apikey: apiKey,
        geocode: address, // строка для поиска
        format: "json", // ответ в JSON (не XML)
        results: 1, // нужен только первый результат
      },
    });

    // Достаём массив найденных объектов из вложенной структуры ответа Яндекса
    const featureMember =
      response.data.response.GeoObjectCollection.featureMember;

    if (featureMember.length === 0) {
      return null; // адрес не найден
    }

    // Яндекс возвращает координаты в формате "lon lat" (долгота, потом широта!)
    const pos: string[] = featureMember[0].GeoObject.Point.pos.split(" ");
    return {
      longitude: parseFloat(pos[0]), // первое число — долгота
      latitude: parseFloat(pos[1]), // второе число — широта
    };
  } catch (error) {
    const err = error as Error;
    console.error(`Ошибка геокодирования Yandex: ${err.message}`);
    return null;
  }
}

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
export async function geocodeNominatim(
  address: string,
): Promise<GeoCoordinates | null> {
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: address, // текстовый поисковый запрос
          format: "json", // формат ответа
          limit: 1, // достаточно одного результата
        },
        headers: {
          // OSM требует идентификацию приложения через User-Agent
          "User-Agent": "CartographyApp/1.0",
        },
      },
    );

    if (response.data.length === 0) {
      return null; // адрес не найден в базе OSM
    }

    return {
      latitude: parseFloat(response.data[0].lat),
      longitude: parseFloat(response.data[0].lon),
    };
  } catch (error) {
    const err = error as Error;
    console.error(`Ошибка геокодирования Nominatim: ${err.message}`);
    return null;
  }
}

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
export async function geocode(address: string): Promise<GeoCoordinates | null> {
  // Нормализуем адрес: убираем "ул.", "д.", квартиры, корпуса и т.д.
  const cleanAddress = normalizeAddress(address);

  // Добавляем регион к адресу для лучшей точности (если его ещё нет)
  // Например: "Киров, Ленина 5" → "Кировская область, Киров, Ленина 5"
  const fullAddress = cleanAddress.includes("Кировская")
    ? cleanAddress
    : `Кировская область, ${cleanAddress}`;

  console.log(`  [Геокодер] Исходный: "${address}"`);
  console.log(`  [Геокодер] Нормализованный: "${fullAddress}"`);

  let result: GeoCoordinates | null = null;

  // Выбираем провайдера по наличию API-ключа в переменных окружения
  if (process.env.YANDEX_GEOCODER_API_KEY) {
    // Яндекс точнее для российских адресов, используем его при наличии ключа
    result = await geocodeYandex(fullAddress);
  } else {
    // Nominatim — fallback: работает без ключа, но требует паузу между запросами
    result = await geocodeNominatim(fullAddress);
    await delay(1000); // соблюдаем лимит Nominatim: 1 запрос/сек
  }

  return result;
}

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
export async function geocodeBatch(
  addresses: AddressEntry[],
  onProgress?: (
    current: number,
    total: number,
    address: string,
    coords: GeoCoordinates | null,
  ) => void,
): Promise<GeocodeResult[]> {
  const results: GeocodeResult[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const { id, address } = addresses[i];

    const coords = await geocode(address);
    results.push({ id, address, coords });

    // Уведомляем вызывающий код о прогрессе (например для обновления прогресс-бара)
    if (onProgress) {
      onProgress(i + 1, addresses.length, address, coords);
    }

    // Пауза между запросами — соблюдаем rate limit выбранного провайдера
    if (i < addresses.length - 1) {
      await delay(DELAY_MS);
    }
  }

  return results;
}
