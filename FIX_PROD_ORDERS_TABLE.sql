-- SQL скрипт для исправления таблицы orders на продакшене
-- Выполните этот скрипт через DBeaver

-- Шаг 1: Проверьте текущую структуру таблицы
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- Шаг 2: Добавьте недостающие колонки (если их нет)
-- Проверьте вывод из Шага 1 и добавьте только те колонки, которых нет

-- Добавить fullName (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "fullName" VARCHAR(255);

-- Добавить mail (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mail VARCHAR(255);

-- Добавить delivey_type (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivey_type VARCHAR(255);

-- Добавить country (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country VARCHAR(255);

-- Добавить zip_code (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zip_code VARCHAR(255);

-- Добавить addressState (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "addressState" VARCHAR(255);

-- Добавить address_line_1 (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255);

-- Добавить address_line_2 (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255);

-- Добавить delivery_instructions (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_instructions VARCHAR(255);

-- Добавить stripePaymentIntentId (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" VARCHAR(255);

-- Добавить tax (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax FLOAT DEFAULT 0;

-- Добавить total (если нет)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total FLOAT DEFAULT 0;

-- Шаг 3: Переименовать phone в phone (если сейчас называется по-другому)
-- Проверьте Шаг 1 - если phone нет, но есть другое поле, переименуйте:
-- ALTER TABLE orders RENAME COLUMN old_phone_column TO phone;

-- Шаг 4: Проверьте результат
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- Шаг 5: Проверьте, что таблица работает
SELECT COUNT(*) as total_orders FROM orders;
