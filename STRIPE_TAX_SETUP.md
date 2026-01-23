# Настройка автоматического расчета налогов в Stripe

## Что было реализовано

Система теперь автоматически рассчитывает и добавляет налоги к заказам через Stripe Tax. Налог добавляется **сверху** к сумме заказа и автоматически рассчитывается на основе адреса доставки покупателя.

## Изменения в коде

### 1. Модель Order
Добавлены поля:
- `tax` - сумма налога в долларах
- `total` - итоговая сумма с налогом в долларах

### 2. Stripe Checkout
- Включен `automatic_tax` в сессии оплаты
- Добавлены `tax_code` к каждому товару (по умолчанию `txcd_99999999` - General Tangible Goods)
- Передается адрес доставки для расчета налога

### 3. Webhook обработчик
- При успешной оплате сохраняет информацию о налоге и итоговой сумме в БД
- Обрабатывает событие `checkout.session.completed`

## Настройка Stripe Dashboard

### Шаг 1: Включите Stripe Tax

1. Перейдите в [Stripe Tax Settings](https://dashboard.stripe.com/settings/tax)
2. Нажмите **"Enable Stripe Tax"**
3. Выберите страны, в которых вы продаете товары (например, США)
4. Настройте налоговые регистрации:
   - Для США добавьте штаты, в которых вы обязаны собирать налоги
   - Stripe автоматически рассчитает налоги для этих штатов

### Шаг 2: Настройте Webhook

1. Перейдите в [Webhooks](https://dashboard.stripe.com/webhooks)
2. Нажмите **"Add endpoint"**
3. Укажите URL: `https://ваш-домен.com/api/stripe/webhook`
4. Выберите события для отслеживания:
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.async_payment_succeeded`
   - ✅ `checkout.session.async_payment_failed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
5. Скопируйте **Webhook signing secret**
6. Добавьте в `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Шаг 3: Настройте Tax Codes (опционально)

По умолчанию используется код `txcd_99999999` (General - Tangible Goods).

Если вы хотите использовать более специфичные коды для автозапчастей:

1. Перейдите в [Tax Categories](https://stripe.com/docs/tax/tax-categories)
2. Найдите подходящий код для автозапчастей
3. Обновите код в `controllers/publicOrderController.js`:
   ```javascript
   tax_code: 'txcd_10000000', // Ваш код
   ```

## Тестирование

### В тестовом режиме Stripe

1. Используйте тестовые карты:
   - Успешная оплата: `4242 4242 4242 4242`
   - Любой CVV (например, 123)
   - Любая дата истечения в будущем

2. Тестовые адреса для проверки налогов:
   - **Высокие налоги**: California, Los Angeles, 90210
   - **Средние налоги**: Texas, Austin, 78701
   - **Без налогов**: Delaware, Wilmington, 19801

3. Проверьте в Stripe Dashboard:
   - Перейдите в [Payments](https://dashboard.stripe.com/test/payments)
   - Найдите свой платеж
   - Проверьте, что налог был рассчитан

### Проверка в БД

После успешной оплаты проверьте таблицу `orders`:

```sql
SELECT id, sum, tax, total, state
FROM orders
WHERE state = 'confirmed'
ORDER BY "createdAt" DESC
LIMIT 5;
```

Вы должны увидеть:
- `sum` - исходная сумма заказа без налога
- `tax` - сумма налога
- `total` - итоговая сумма (sum + tax)

## Примечания

1. **Stripe Tax требует адрес доставки** для расчета налога. Убедитесь, что пользователь заполняет:
   - `address_line_1`
   - `city`
   - `addressState` (штат)
   - `zip_code`
   - `country`

2. **Налоги рассчитываются автоматически** на основе:
   - Адреса доставки
   - Tax code товара
   - Ваших налоговых регистраций в Stripe

3. **Production режим**:
   - Перед запуском в production убедитесь, что:
     - Настроены все налоговые регистрации
     - Webhook endpoint доступен и защищен
     - Все необходимые переменные окружения установлены

## Переменные окружения

Убедитесь, что в `.env` установлены:

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://ваш-сайт.com/success
STRIPE_CANCEL_URL=https://ваш-сайт.com/cart
```

## Полезные ссылки

- [Stripe Tax Documentation](https://stripe.com/docs/tax)
- [Tax Categories](https://stripe.com/docs/tax/tax-categories)
- [Checkout Session API](https://stripe.com/docs/api/checkout/sessions)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
