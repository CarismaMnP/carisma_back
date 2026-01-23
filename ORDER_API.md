# Order API Documentation

## Endpoint: Create Order

**URL:** `POST /api/public/order`

**Description:** Создает новый заказ и автоматически генерирует платежную ссылку Stripe для оплаты.

---

## Request Body

### Required Fields

| Field      | Type      | Description             | Example              |
| ---------- | --------- | ----------------------- | -------------------- |
| `userId`   | `integer` | ID пользователя         | `123`                |
| `fullName` | `string`  | Полное имя покупателя   | `"John Doe"`         |
| `mail`     | `string`  | Email покупателя        | `"john@example.com"` |
| `phone`    | `string`  | Телефон покупателя      | `"+1234567890"`      |
| `products` | `array`   | Массив товаров в заказе | См. структуру ниже   |

### Optional Fields

| Field                   | Type     | Description            | Example                   |
| ----------------------- | -------- | ---------------------- | ------------------------- |
| `delivey_type`          | `string` | Тип доставки           | `"ups"`, `"pickup"`, etc. |
| `country`               | `string` | Страна доставки        | `"USA"`                   |
| `city`                  | `string` | Город доставки         | `"New York"`              |
| `zip_code`              | `string` | Почтовый индекс        | `"10001"`                 |
| `state`                 | `string` | Штат/область           | `"NY"`                    |
| `address_line_1`        | `string` | Адрес (строка 1)       | `"123 Main St"`           |
| `address_line_2`        | `string` | Адрес (строка 2)       | `"Apt 4B"`                |
| `delivery_instructions` | `string` | Инструкции по доставке | `"Leave at door"`         |

### Products Array Structure

Каждый элемент массива `products` должен содержать:

| Field           | Type      | Required | Description                              | Example                  |
| --------------- | --------- | -------- | ---------------------------------------- | ------------------------ |
| `productId`     | `integer` | Yes      | ID товара                                | `42`                     |
| `count`         | `integer` | Yes      | Количество товара                        | `2`                      |
| `selectorValue` | `string`  | Yes      | Значение селектора (размер, цвет и т.д.) | `"Large"`, `"Red"`, `""` |

---

## Request Example

```json
{
  "userId": 123,
  "fullName": "John Doe",
  "mail": "john@example.com",
  "phone": "+1234567890",
  "delivey_type": "ups",
  "country": "USA",
  "city": "New York",
  "zip_code": "10001",
  "state": "NY",
  "address_line_1": "123 Main St",
  "address_line_2": "Apt 4B",
  "delivery_instructions": "Leave at door",
  "products": [
    {
      "productId": 42,
      "count": 2,
      "selectorValue": "Large"
    },
    {
      "productId": 56,
      "count": 1,
      "selectorValue": ""
    }
  ]
}
```

---

## Response

### Success Response (200 OK)

| Field             | Type            | Description                          | Example                                           |
| ----------------- | --------------- | ------------------------------------ | ------------------------------------------------- |
| `invoiceId`       | `string (UUID)` | ID созданного заказа                 | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`          |
| `amount`          | `number`        | Общая сумма заказа в USD             | `150.50`                                          |
| `currency`        | `string`        | Валюта                               | `"USD"`                                           |
| `paymentUrl`      | `string`        | URL для оплаты через Stripe Checkout | `"https://checkout.stripe.com/c/pay/cs_test_..."` |
| `stripeSessionId` | `string`        | ID сессии Stripe                     | `"cs_test_a1b2c3d4e5f6..."`                       |

#### Response Example

```json
{
  "invoiceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 150.5,
  "currency": "USD",
  "paymentUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6...",
  "stripeSessionId": "cs_test_a1b2c3d4e5f6..."
}
```

### Error Responses

#### 500 - Missing Required Fields

```json
{
  "error": "Please, fill order form"
}
```

**Причина:** Отсутствует одно из обязательных полей: `userId`, `fullName`, `phone`, `mail` или `products`

#### 500 - User Not Found

```json
{
  "error": "User not found. Please authorize"
}
```

**Причина:** Пользователь с указанным `userId` не найден в базе данных

#### 500 - Missing Delivery Information

```json
{
  "error": "Please, fill delivery form"
}
```

**Причина:** Для доставки типа `"ups"` обязательны поля `zip_code`, `state` и `address_line_1`

#### 400 - General Error

```json
{
  "message": "Error description"
}
```

**Причина:** Другая ошибка (например, проблема с Stripe API, некорректные данные товаров)

---

## Validation Rules

1. **Required fields validation:**
   - `userId`, `fullName`, `phone`, `mail` - обязательны всегда
   - `products` должен быть непустым массивом

2. **Delivery type validation:**
   - Если `delivey_type === "ups"`, то обязательны: `zip_code`, `state`, `address_line_1`

3. **Products validation:**
   - Все товары с указанными `productId` должны существовать в базе данных
   - `count` должен быть положительным числом

4. **User validation:**
   - Пользователь с `userId` должен существовать в базе данных

---

## Payment Flow

1. **Клиент отправляет запрос** на создание заказа
2. **Сервер создает заказ** со статусом `state: "pending"`
3. **Сервер генерирует Stripe Checkout Session** с товарами
4. **Сервер возвращает** `paymentUrl` и данные заказа
5. **Клиент перенаправляет пользователя** на `paymentUrl`
6. **Пользователь оплачивает** на странице Stripe
7. **Stripe отправляет webhook** на сервер
8. **Сервер обновляет статус заказа** на `"confirmed"` при успешной оплате
9. **Stripe перенаправляет пользователя** на `STRIPE_SUCCESS_URL` или `STRIPE_CANCEL_URL`

---

## Order States

После создания заказа его статус может изменяться через webhook события:

| State            | Description                  |
| ---------------- | ---------------------------- |
| `pending`        | Заказ создан, ожидает оплаты |
| `confirmed`      | Оплата подтверждена          |
| `processing`     | Оплата обрабатывается        |
| `payment_failed` | Оплата не прошла             |
| `expired`        | Сессия оплаты истекла        |
| `canceled`       | Платеж отменен               |
| `refunded`       | Возврат средств              |
| `disputed`       | Создан диспут                |

---

## Frontend Implementation Example

```javascript
// Создание заказа
async function createOrder(orderData) {
  try {
    const response = await fetch('/api/public/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to create order');
    }

    // Перенаправление на страницу оплаты Stripe
    window.location.href = data.paymentUrl;

    return data;
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}

// Пример использования
const orderData = {
  userId: 123,
  fullName: 'John Doe',
  mail: 'john@example.com',
  phone: '+1234567890',
  delivey_type: 'ups',
  country: 'USA',
  city: 'New York',
  zip_code: '10001',
  state: 'NY',
  address_line_1: '123 Main St',
  address_line_2: 'Apt 4B',
  delivery_instructions: 'Leave at door',
  products: [
    {
      productId: 42,
      count: 2,
      selectorValue: 'Large',
    },
  ],
};

createOrder(orderData);
```

---

## Notes

- **Автоматический расчет суммы:** Сервер автоматически рассчитывает сумму заказа на основе цен товаров из базы данных
- **Безопасность:** Цены товаров берутся из базы данных, а не из запроса клиента
- **Stripe Checkout:** Используется готовая форма оплаты Stripe, что обеспечивает PCI compliance
- **Webhook обработка:** Статус заказа обновляется автоматически через webhook события от Stripe
- **Email клиента:** Используется для отправки квитанций от Stripe

---

## Testing

### Test Data

```json
{
  "userId": 1,
  "fullName": "Test User",
  "mail": "test@example.com",
  "phone": "+1234567890",
  "delivey_type": "pickup",
  "products": [
    {
      "productId": 1,
      "count": 1,
      "selectorValue": ""
    }
  ]
}
```

### Stripe Test Cards

- **Успешная оплата:** `4242 4242 4242 4242`
- **Отклонена:** `4000 0000 0000 0002`
- **Требует аутентификации:** `4000 0025 0000 3155`

Любая будущая дата для срока действия, любой CVC (3 цифры), любой почтовый индекс.
