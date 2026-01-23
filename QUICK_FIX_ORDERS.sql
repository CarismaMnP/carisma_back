-- БЫСТРЫЙ ФИКС для таблицы orders
-- Этот скрипт добавит ВСЕ недостающие колонки
-- Выполните его целиком в DBeaver

-- Добавляем все необходимые колонки (IF NOT EXISTS защищает от ошибок если колонка уже есть)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "fullName" VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mail VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivey_type VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zip_code VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "addressState" VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_instructions VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax FLOAT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total FLOAT DEFAULT 0;

-- Проверяем результат
SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position;
