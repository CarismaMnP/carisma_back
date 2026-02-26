# Product API

Базовый путь: `/api/public/product`.

## GET `/get_filter`
- Собирает все товары и группирует их по `product.ebayModel`.
- Ответ: массив объектов `{ model, categories }`, где `categories` — уникальные значения `product.ebayCategory` для модели.

## GET `/products`
- Query-параметры: `model`, `category`, `name` (поиск `ILIKE %name%` с экранированием `%` и `_`).
- Возвращает массив объектов `{ category, products }`, где `category` — `product.ebayCategory` или `uncategorized`, `products` — список товаров, попадающих в группу.
- Путь `/api/public/product` возвращает те же данные.

## GET `/product`
- Query-параметр: `link` — значение `product.link`.
- Возвращает полную карточку товара с информацией о категориях; 404, если товар не найден.
- Альтернативный путь: `/api/public/product/:link`.

# Requests API

## Публичные запросы

### POST `/api/public/user/part-request`
Создаёт заявку на подбор детали, сохраняет её в БД (`part_requests`) с `isUnread: true`.

Request body:
```json
{
  "make": "BMW",
  "model": "330i",
  "generation": "G20",
  "email": "customer@example.com",
  "partDescription": "Front bumper with PDC sensors"
}
```

Success response:
```json
{
  "success": true,
  "message": "Request submitted successfully",
  "id": "3b6ed8fc-e4db-4f8f-9f8e-b7f2c8a88d8a",
  "isUnread": true
}
```

Error response:
```json
{
  "message": "Please provide a valid email address"
}
```

### POST `/api/public/user/client-message`
Создаёт клиентское сообщение, сохраняет его в БД (`client_message_requests`) с `isUnread: true`.

Request body:
```json
{
  "name": "John Doe",
  "mail": "customer@example.com",
  "message": "Hi! I have a question about my order."
}
```

Success response:
```json
{
  "success": true,
  "message": "Message sent successfully",
  "id": "5dcf6e69-9910-47fc-abec-9b03e013e498",
  "isUnread": true
}
```

Error response:
```json
{
  "message": "Please provide your message"
}
```

## Админские запросы

Для всех эндпоинтов ниже нужен заголовок:
`Authorization: Bearer <admin_jwt_token>`

### GET `/api/admin/request/part/requests`
Возвращает список заявок на подбор детали (новые и прочитанные), отсортированный по `createdAt DESC`.

Response:
```json
[
  {
    "id": "3b6ed8fc-e4db-4f8f-9f8e-b7f2c8a88d8a",
    "make": "BMW",
    "model": "330i",
    "generation": "G20",
    "email": "customer@example.com",
    "partDescription": "Front bumper with PDC sensors",
    "isUnread": true,
    "createdAt": "2026-02-26T12:00:00.000Z",
    "updatedAt": "2026-02-26T12:00:00.000Z"
  }
]
```

### GET `/api/admin/request/client/requests`
Возвращает список клиентских сообщений (новые и прочитанные), отсортированный по `createdAt DESC`.

Response:
```json
[
  {
    "id": "5dcf6e69-9910-47fc-abec-9b03e013e498",
    "name": "John Doe",
    "mail": "customer@example.com",
    "message": "Hi! I have a question about my order.",
    "isUnread": true,
    "createdAt": "2026-02-26T12:10:00.000Z",
    "updatedAt": "2026-02-26T12:10:00.000Z"
  }
]
```

### POST `/api/admin/request/read`
Принимает `id` запроса и ставит `isUnread = false` в соответствующей таблице.

Request body:
```json
{
  "id": "3b6ed8fc-e4db-4f8f-9f8e-b7f2c8a88d8a"
}
```

Success response:
```json
{
  "success": true,
  "requestType": "part-request",
  "request": {
    "id": "3b6ed8fc-e4db-4f8f-9f8e-b7f2c8a88d8a",
    "make": "BMW",
    "model": "330i",
    "generation": "G20",
    "email": "customer@example.com",
    "partDescription": "Front bumper with PDC sensors",
    "isUnread": false,
    "createdAt": "2026-02-26T12:00:00.000Z",
    "updatedAt": "2026-02-26T12:30:00.000Z"
  }
}
```

Error response:
```json
{
  "message": "Request not found"
}
```
