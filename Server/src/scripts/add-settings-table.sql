-- =============================================
-- Таблица настроек приложения
-- Хранит параметры планировщиков и конфигурации
-- Запуск: один раз вручную или через npm run migrate
-- =============================================

CREATE TABLE IF NOT EXISTS "Main".settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT         NOT NULL,
  description VARCHAR(500),
  updated_at  TIMESTAMP    DEFAULT NOW()
);

-- Начальные значения (вставляются только если ключа ещё нет)
INSERT INTO "Main".settings (key, value, description) VALUES
  ('enable_geocoder',      'true',          'Включить автоматический планировщик геокодирования'),
  ('geocoder_cron',        '0 3 */3 * *',   'Расписание планировщика геокодирования (cron-выражение)'),
  ('geocoder_batch_size',  '300',           'Количество адресов за один запуск планировщика'),
  ('geocoding_batch_size', '2000',          'Количество адресов при ручном геокодировании'),
  ('geocoder_retry_days',  '30',            'Через сколько дней повторять адреса без координат'),
  ('enable_readings',      'true',          'Включить автоматический планировщик показаний'),
  ('readings_cron',        '0 2 */3 * *',   'Расписание планировщика показаний (cron-выражение)'),
  ('readings_batch_size',  '1000',          'Размер батча при обновлении показаний')
ON CONFLICT (key) DO NOTHING;
