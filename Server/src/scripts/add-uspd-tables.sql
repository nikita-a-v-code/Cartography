-- =============================================
-- Миграция: справочник типов УСПД и таблица ручных точек УСПД
-- Запустить один раз после init-db.sql
-- =============================================

-- Справочник типов УСПД (устройств сбора и передачи данных)
CREATE TABLE IF NOT EXISTS "Main".uspd_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  description VARCHAR(500)
);

-- Несколько стартовых типов (можно добавлять через интерфейс)
INSERT INTO "Main".uspd_types (name) VALUES
  ('ПКЭ-17/1'),
  ('PLC-концентратор'),
  ('УСПД-301'),
  ('RTU-325'),
  ('Прочее')
ON CONFLICT (name) DO NOTHING;

-- Точки УСПД, размещённые вручную на карте
CREATE TABLE IF NOT EXISTS "Main".uspd_points (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  uspd_type_id INTEGER REFERENCES "Main".uspd_types(id) ON DELETE SET NULL,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  description  VARCHAR(500),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uspd_points_type_id
  ON "Main".uspd_points (uspd_type_id);
