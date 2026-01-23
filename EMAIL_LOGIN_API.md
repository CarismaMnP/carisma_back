# Email Login API

API для аутентификации пользователей через email с использованием временного кода.

## Endpoints

### 1. POST /user/login/email

Генерирует и отправляет временный код на указанный email. Код действителен в течение 5 минут.

#### Request

```json
{
  "email": "user@example.com"
}
```

#### Parameters

| Параметр | Тип    | Обязательный | Описание                    |
|----------|--------|--------------|----------------------------|
| email    | string | Да           | Email адрес пользователя   |

#### Response

**Success (200 OK)**

```json
{
  "email": "user@example.com"
}
```

**Error (400 Bad Request)**

```json
{
  "message": "Неверный формат email"
}
```

#### Примечания

- Если пользователь с указанным email не существует, он будет создан автоматически
- Если пользователь уже существует, новый код перезапишет предыдущий
- Код действителен в течение 5 минут с момента генерации
- В текущей реализации все коды имеют значение "123456" (для тестирования)
- В production версии код должен отправляться на email пользователя

---

### 2. POST /user/login/email/check

Проверяет временный код и возвращает JWT-токен для авторизованной сессии.

#### Request

```json
{
  "email": "user@example.com",
  "code": "123456",
  "session": "optional-session-id"
}
```

#### Parameters

| Параметр | Тип    | Обязательный | Описание                                              |
|----------|--------|--------------|-------------------------------------------------------|
| email    | string | Да           | Email адрес пользователя                              |
| code     | string | Да           | 6-значный код подтверждения                           |
| session  | string | Нет          | ID сессии для привязки корзины к пользователю         |

#### Response

**Success (200 OK)**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+79001234567",
    "role": "user",
    "createdAt": "2026-01-23T09:00:00.000Z",
    "updatedAt": "2026-01-23T09:30:00.000Z"
  }
}
```

**Error Responses**

| Код | Описание                                      | Response                                           |
|-----|-----------------------------------------------|----------------------------------------------------|
| 400 | Неверный формат email                         | `{"message": "Неверный формат email"}`             |
| 400 | Код не указан                                 | `{"message": "Код не указан"}`                     |
| 422 | Неверный код                                  | `{"message": "Неверный код"}`                      |
| 422 | Код истек (прошло более 5 минут)              | `{"message": "Код истек. Запросите новый код"}`    |
| 500 | Пользователь не найден                        | `{"message": "Пользователь не найден"}`            |

#### Примечания

- JWT токен действителен в течение 72 часов
- После успешной проверки код удаляется из базы данных
- Если передан `session`, все товары из корзины анонимного пользователя будут привязаны к авторизованному пользователю
- Каждый код можно использовать только один раз

---

## Пример использования

### 1. Запрос кода

```bash
curl -X POST http://localhost:3000/user/login/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### 2. Проверка кода и получение токена

```bash
curl -X POST http://localhost:3000/user/login/email/check \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "code": "123456",
    "session": "optional-session-id"
  }'
```

### 3. Использование токена

```bash
curl -X GET http://localhost:3000/user/check \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Миграция базы данных

Для работы email login необходимо выполнить миграцию:

```bash
npx sequelize-cli db:migrate
```

Миграция добавляет следующие поля в таблицу `Users`:
- `emailLoginCode` - временный код для входа
- `emailLoginCodeExpiry` - время истечения кода

---

## Генерация случайного кода

В текущей реализации используется фиксированный код "123456" для тестирования. Для production версии раскомментируйте функцию генерации случайного кода в [controllers/usersController.js](controllers/usersController.js):

```javascript
// Раскомментировать для production:
const generateEmailCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Удалить для production:
// const generateEmailCode = () => {
//   return '123456'
// }
```

---

## TODO

- [ ] Настроить отправку email через SMTP или сервис рассылок
- [ ] Добавить rate limiting для защиты от спама
- [ ] Добавить логирование попыток входа
- [ ] Переключить на случайную генерацию кодов в production
