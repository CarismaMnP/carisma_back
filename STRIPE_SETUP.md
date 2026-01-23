# Stripe Integration Setup

## Описание

Интеграция со Stripe добавляет автоматическое создание платежных ссылок при создании заказа и обработку всех webhook-событий от Stripe.

## Настройка переменных окружения

Добавьте следующие переменные в ваш `.env.local` или `.env.production` файл:

```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key  # Секретный ключ из Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_lpRhVmIIMt5X9YmTw1UQS07APspefkyh   # Webhook signing secret из Stripe Dashboard
STRIPE_SUCCESS_URL=https://carismamp.com/success  # URL для редиректа после успешной оплаты
STRIPE_CANCEL_URL=https://carismamp.com/cancel    # URL для редиректа при отмене оплаты
```

## Получение ключей Stripe

1. Зарегистрируйтесь на [Stripe Dashboard](https://dashboard.stripe.com/)
2. Перейдите в раздел **Developers > API keys**
3. Скопируйте **Secret key** в `STRIPE_SECRET_KEY`
4. Для webhook secret:
   - Перейдите в **Developers > Webhooks**
   - Нажмите **Add endpoint**
   - URL: `https://your-domain.com/api/public/stripe-webhook`
   - Выберите события для прослушивания (рекомендуется выбрать все события checkout и payment_intent)
   - Скопируйте **Signing secret** в `STRIPE_WEBHOOK_SECRET`

## Webhook события

Обрабатываются следующие события:

### Checkout Session Events

- `checkout.session.completed` - Сессия завершена, оплата успешна → state = "confirmed"
- `checkout.session.async_payment_succeeded` - Асинхронная оплата успешна → state = "confirmed"
- `checkout.session.async_payment_failed` - Асинхронная оплата неудачна → state = "payment_failed"
- `checkout.session.expired` - Сессия истекла → state = "expired"

### Payment Intent Events

- `payment_intent.succeeded` - Платеж успешен → state = "confirmed"
- `payment_intent.payment_failed` - Платеж неудачен → state = "payment_failed"
- `payment_intent.canceled` - Платеж отменен → state = "canceled"
- `payment_intent.created` - Платеж создан → обновляется stripePaymentIntentId
- `payment_intent.processing` - Платеж обрабатывается → state = "processing"

### Charge Events

- `charge.succeeded` - Списание успешно
- `charge.failed` - Списание неудачно
- `charge.refunded` - Возврат средств → state = "refunded"
- `charge.dispute.created` - Создан диспут → state = "disputed"

## API Endpoints

### Создание заказа

`POST /api/public/order`

**Response:**

```json
{
  "invoiceId": "uuid-order-id",
  "amount": 100.5,
  "currency": "USD",
  "paymentUrl": "https://checkout.stripe.com/...",
  "stripeSessionId": "cs_test_..."
}
```

Клиент должен перенаправить пользователя на `paymentUrl` для оплаты.

### Webhook Endpoint

`POST /api/public/stripe-webhook`

Этот endpoint автоматически обрабатывает все webhook-события от Stripe.

## Миграция базы данных

Запустите миграцию для добавления поля `stripePaymentIntentId` в таблицу `order`:

```bash
npx sequelize-cli db:migrate
```

## Тестирование

1. Используйте тестовые ключи Stripe (начинаются с `sk_test_`)
2. Для тестирования платежей используйте [тестовые карты Stripe](https://stripe.com/docs/testing):
   - Успешная оплата: `4242 4242 4242 4242`
   - Declined: `4000 0000 0000 0002`
3. Используйте [Stripe CLI](https://stripe.com/docs/stripe-cli) для тестирования webhooks локально:
   ```bash
   stripe listen --forward-to localhost:5050/api/public/stripe-webhook
   ```

## Состояния заказа (state)

- `pending` - Заказ создан, ожидает оплаты
- `confirmed` - Оплата подтверждена
- `processing` - Оплата обрабатывается
- `payment_failed` - Оплата неудачна
- `expired` - Сессия оплаты истекла
- `canceled` - Платеж отменен
- `refunded` - Возврат средств
- `disputed` - Создан диспут

## Безопасность

- Webhook-запросы верифицируются с помощью Stripe signature
- Raw body необходим для верификации подписи (настроено в `utils/server.js`)
- Все ошибки логируются в консоль
