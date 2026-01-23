# Инструкция по исправлению таблицы orders на продакшене

## Проблема
Таблица `orders` на продакшене имеет старую структуру без колонки `fullName` и других полей.

## Решение через DBeaver

### Вариант 1: Быстрый фикс (рекомендуется)

1. Откройте DBeaver и подключитесь к production базе данных

2. Откройте SQL редактор (правая кнопка на БД → SQL Editor → New SQL Script)

3. **Скопируйте и выполните весь скрипт из файла `QUICK_FIX_ORDERS.sql`:**

```sql
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
```

4. Нажмите **Execute** (Ctrl+Enter или кнопка ▶)

5. **Проверьте результат:**

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
```

Вы должны увидеть все колонки, включая `fullName`, `addressState`, `tax`, `total`.

### Вариант 2: Пошаговый фикс с проверками

Используйте файл `FIX_PROD_ORDERS_TABLE.sql` для пошагового исправления с проверками.

## После исправления

1. **Тест создания заказа:**
   - Попробуйте создать новый заказ через API
   - Проверьте, что ошибка `column "fullName" does not exist` больше не возникает

2. **Обновите статус миграций на проде:**

Если вы хотите синхронизировать статус миграций:

```bash
# На продакшен сервере
npx sequelize-cli db:migrate:status
```

Если миграции не применены, примените их:

```bash
npx sequelize-cli db:migrate
```

**ВАЖНО:** Это безопасно только если миграции используют `IF NOT EXISTS` или проверяют существование колонок.

## Проверка работы Stripe Tax

После исправления таблицы, убедитесь что:

1. В Stripe Dashboard включен Stripe Tax
2. Webhook настроен и работает
3. В `.env` на проде установлены:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_SUCCESS_URL`
   - `STRIPE_CANCEL_URL`

## Если что-то пошло не так

### Откат изменений

Если нужно удалить добавленные колонки:

```sql
-- ВНИМАНИЕ: Это удалит данные в этих колонках!
ALTER TABLE orders DROP COLUMN IF EXISTS "fullName";
ALTER TABLE orders DROP COLUMN IF EXISTS "addressState";
ALTER TABLE orders DROP COLUMN IF EXISTS tax;
ALTER TABLE orders DROP COLUMN IF EXISTS total;
-- и т.д. для остальных колонок
```

### Создать таблицу заново (ОПАСНО - потеря данных!)

**Только если таблица пустая или данные не важны:**

```sql
-- Сделайте бэкап перед выполнением!
DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" INTEGER NOT NULL,
  state VARCHAR(255) NOT NULL,
  sum FLOAT NOT NULL,
  "fullName" VARCHAR(255),
  phone VARCHAR(255),
  mail VARCHAR(255),
  delivey_type VARCHAR(255),
  country VARCHAR(255),
  city VARCHAR(255),
  zip_code VARCHAR(255),
  "addressState" VARCHAR(255),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  delivery_instructions VARCHAR(255),
  "stripePaymentIntentId" VARCHAR(255),
  tax FLOAT DEFAULT 0,
  total FLOAT DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Контакты для помощи

Если возникли проблемы:
1. Проверьте логи приложения
2. Проверьте структуру таблицы через DBeaver
3. Убедитесь, что все колонки из Шага 5 присутствуют
