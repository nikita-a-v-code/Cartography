// Типы и интерфейсы данных для компонента карты.
// Используются по всему приложению для типизации запросов к API и состояния компонентов.

/** Статус последних показаний счётчика:
 * - actual  — показания актуальны (получены менее 3 дней назад)
 * - stale   — показания устарели (более 3 дней)
 * - none    — показания никогда не поступали
 */
export type ReadingStatus = "actual" | "stale" | "none";

/** Данные одной точки учёта (счётчик с координатами, принадлежностью к УСПД и показаниями) */
export interface PointData {
  source_id: number;
  address: string;
  serial_number: string;
  meter_model: string | null;
  usd_type: string | null;
  usd_name: string | null;
  last_reading_date: string | null;
  latitude: string;
  longitude: string;
}

/** Населённый пункт из справочника с числом счётчиков */
export interface LocalityData {
  locality: string;
  count: number;
}

/** Статистика геокодирования: сколько адресов обработано и сколько ещё ожидают */
export interface StatsData {
  total: number;
  geocoded: number;
  pending: number;
}

/** Прогресс фонового обновления показаний, приходящий через SSE (Server-Sent Events) */
export interface ReadingsProgress {
  status: "running" | "done" | "error";
  processed: number;
  total: number;
  withReadings: number;
  message?: string;
}

/** Тип УСПД из справочника */
export interface UspdType {
  id: number;
  name: string;
  description: string | null;
}

/** Точка УСПД, размещённая вручную на карте */
export interface UspdPoint {
  id: number;
  name: string;
  uspd_type_id: number | null;
  type_name: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  created_at: string;
}
