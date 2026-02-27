import axios from "axios";
import dotenv from "dotenv";
import { normalizeAddress } from "./addressNormalizer";

dotenv.config();

/**
 * Сервис геокодирования - преобразование адреса в координаты
 * Поддерживает: Yandex, DaData, Nominatim
 */

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

interface AddressEntry {
  id: number;
  address: string;
}

interface GeocodeResult {
  id: number;
  address: string;
  coords: GeoCoordinates | null;
}

// Задержка между запросами (мс)
const DELAY_MS = 200;

// Утилита для задержки
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Геокодирование через Yandex (рекомендуется для России)
 * Лимит: 1000 запросов/сутки бесплатно
 */
export async function geocodeYandex(address: string): Promise<GeoCoordinates | null> {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  if (!apiKey) {
    throw new Error("YANDEX_GEOCODER_API_KEY не указан в .env");
  }

  try {
    const response = await axios.get("https://geocode-maps.yandex.ru/1.x/", {
      params: {
        apikey: apiKey,
        geocode: address,
        format: "json",
        results: 1,
      },
    });

    const featureMember =
      response.data.response.GeoObjectCollection.featureMember;

    if (featureMember.length === 0) {
      return null;
    }

    const pos: string[] = featureMember[0].GeoObject.Point.pos.split(" ");
    return {
      longitude: parseFloat(pos[0]),
      latitude: parseFloat(pos[1]),
    };
  } catch (error) {
    const err = error as Error;
    console.error(`Ошибка геокодирования Yandex: ${err.message}`);
    return null;
  }
}

/**
 * Геокодирование через Nominatim (OpenStreetMap)
 * Бесплатно, без ключа, но лимит 1 запрос/сек
 */
export async function geocodeNominatim(address: string): Promise<GeoCoordinates | null> {
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: address,
          format: "json",
          limit: 1,
        },
        headers: {
          "User-Agent": "CartographyApp/1.0",
        },
      },
    );

    if (response.data.length === 0) {
      return null;
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
 * Основная функция геокодирования
 * Автоматически выбирает доступный провайдер
 */
export async function geocode(address: string): Promise<GeoCoordinates | null> {
  // Нормализуем адрес (убираем префиксы типа "г.", "ул.", "дом" и т.д.)
  const cleanAddress = normalizeAddress(address);

  // Добавляем "Кировская область" для лучшего результата
  const fullAddress = cleanAddress.includes("Кировская")
    ? cleanAddress
    : `Кировская область, ${cleanAddress}`;

  console.log(`  [Геокодер] Исходный: "${address}"`);
  console.log(`  [Геокодер] Нормализованный: "${fullAddress}"`);

  let result: GeoCoordinates | null = null;

  // Пробуем провайдеры по приоритету
  if (process.env.YANDEX_GEOCODER_API_KEY) {
    result = await geocodeYandex(fullAddress);
  } else {
    // Nominatim как fallback (медленнее)
    result = await geocodeNominatim(fullAddress);
    await delay(1000); // Nominatim требует 1 сек между запросами
  }

  return result;
}

/**
 * Массовое геокодирование с задержкой
 */
export async function geocodeBatch(
  addresses: AddressEntry[],
  onProgress?: (current: number, total: number, address: string, coords: GeoCoordinates | null) => void,
): Promise<GeocodeResult[]> {
  const results: GeocodeResult[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const { id, address } = addresses[i];

    const coords = await geocode(address);
    results.push({ id, address, coords });

    if (onProgress) {
      onProgress(i + 1, addresses.length, address, coords);
    }

    // Задержка между запросами
    if (i < addresses.length - 1) {
      await delay(DELAY_MS);
    }
  }

  return results;
}
