-- =============================================
-- Скрипт для ДОПОЛНЕНИЯ существующей таблицы
-- "Main".location (coordinates и last_geocode_request уже есть)
-- =============================================

-- Добавляем source_id для связи с исходной таблицей "enforce_dba".schet_fr
ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS source_id INTEGER;

-- Делаем source_id уникальным (ОБЯЗАТЕЛЬНО для ON CONFLICT)
ALTER TABLE "Main".location ADD CONSTRAINT unique_source_id UNIQUE (source_id);

-- Добавляем копию адреса для справки (опционально)
ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS address VARCHAR(500);

-- Добавляем нормализованный адрес (для анализа негеокодированных)
ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS normalized_address VARCHAR(500);

-- Добавляем серийный номер счётчика (device_id из schet_fr)
ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

-- Добавляем модель счётчика (idname из bp_type_mp через id_type_mp)
ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS meter_model VARCHAR(255);

-- Добавляем название УСД (idname из bp_usd через bp_sostav_usd)
ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS usd_name VARCHAR(255);

ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS usd_type VARCHAR(255);

ALTER TABLE "Main".location 
ADD COLUMN IF NOT EXISTS settlement VARCHAR(255);

-- =============================================
-- Отдельная таблица для показаний счётчиков
-- =============================================
CREATE TABLE IF NOT EXISTS "Main".readings (
  source_id INTEGER PRIMARY KEY,
  last_reading_date TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_source_id
ON "Main".readings (source_id);

-- =============================================
-- Индексы для производительности
-- =============================================

-- Индекс для быстрого поиска по source_id
CREATE INDEX IF NOT EXISTS idx_location_source_id 
ON "Main".location (source_id);

-- Индекс для быстрого поиска негеокодированных записей
CREATE INDEX IF NOT EXISTS idx_location_not_geocoded 
ON "Main".location (id) 
WHERE coordinates IS NULL;

-- Индекс для поиска по координатам (GIN для JSONB)
CREATE INDEX IF NOT EXISTS idx_location_coords 
ON "Main".location USING GIN (coordinates) 
WHERE coordinates IS NOT NULL;

-- =============================================
-- Проверка структуры таблицы
-- =============================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'Main' AND table_name = 'location';

-- =============================================
-- Примеры работы с данными
-- =============================================
-- Вставка:
-- INSERT INTO "Main".location (source_id, address) VALUES (123, 'г. Киров, ул. Ленина, 1');

-- Обновление координат:
-- UPDATE "Main".location SET coordinates = '{"lat": 58.6036, "lon": 49.6681}', last_geocode_request = NOW() WHERE source_id = 123;

-- Чтение с координатами:
-- SELECT source_id, address, coordinates->>'lat' as lat, coordinates->>'lon' as lon FROM "Main".location WHERE coordinates IS NOT NULL;

-- =============================================
-- ЗАПРОСЫ ДЛЯ АНАЛИЗА НЕГЕОКОДИРОВАННЫХ АДРЕСОВ
-- =============================================

-- 1. Все негеокодированные адреса (исходный и нормализованный)
-- SELECT source_id, address, normalized_address 
-- FROM "Main".location 
-- WHERE coordinates IS NULL AND last_geocode_request IS NOT NULL
-- ORDER BY normalized_address;

-- 2. Статистика по результатам геокодирования
-- SELECT 
--   COUNT(*) as total,
--   COUNT(coordinates) as geocoded,
--   COUNT(*) - COUNT(coordinates) as failed,
--   ROUND(COUNT(coordinates)::numeric / COUNT(*) * 100, 2) as success_rate
-- FROM "Main".location 
-- WHERE last_geocode_request IS NOT NULL;

-- 3. Частые паттерны в непереведённых адресах (для добавления в нормализатор)
-- SELECT 
--   SUBSTRING(normalized_address FROM '^[^,]+') as first_part,
--   COUNT(*) as cnt
-- FROM "Main".location 
-- WHERE coordinates IS NULL AND last_geocode_request IS NOT NULL
-- GROUP BY first_part
-- ORDER BY cnt DESC
-- LIMIT 20;

-- 4. Адреса, содержащие подозрительные слова (возможно нужна нормализация)
-- SELECT DISTINCT address, normalized_address
-- FROM "Main".location 
-- WHERE coordinates IS NULL 
--   AND (address ~* 'гар|бокс|участок|зем|сад|дача|снт')
-- LIMIT 50;

-- 5. Экспорт негеокодированных для ручной проверки
-- COPY (
--   SELECT source_id, address, normalized_address 
--   FROM "Main".location 
--   WHERE coordinates IS NULL AND last_geocode_request IS NOT NULL
-- ) TO '/tmp/failed_addresses.csv' WITH CSV HEADER;
