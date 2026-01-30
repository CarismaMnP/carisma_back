# API Updates - Admin Product Endpoints

## Обзор изменений

Добавлены новые функции для работы с товарами в админской панели:
- Пагинация и поиск по названию товаров
- Поле `make` (марка авто) при создании/обновлении товаров
- Эндпоинты для получения уникальных марок и категорий

---

## 1. Обновлённый запрос списка товаров

### `GET /api/admin/product`

**Описание:** Получение списка товаров с пагинацией и поиском по названию

**Query параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|--------------|--------------|----------|
| `page` | number | нет | 1 | Номер страницы |
| `limit` | number | нет | 1000 | Количество товаров на странице |
| `search` | string | нет | - | Поиск по названию товара (частичное совпадение) |

**Особенности:**
- Сортировка: последние созданные товары выводятся первыми (по `createdAt DESC`)
- Поиск работает по частичному совпадению названия (case-sensitive)

**Пример запроса:**
```http
GET /api/admin/product?page=1&limit=20&search=BMW
```

**Пример ответа:**
```json
{
  "count": 150,
  "rows": [
    {
      "id": 1,
      "name": "BMW 5 Series Front Bumper",
      "description": "Original front bumper for BMW 5 Series",
      "link": "bmw-5-series-front-bumper",
      "price": 499.99,
      "old_price": 599.99,
      "make": "BMW",
      "categoryId": 2,
      "images": ["https://...", "https://..."],
      "createdAt": "2026-01-29T10:30:00.000Z",
      "updatedAt": "2026-01-29T10:30:00.000Z",
      "category": {
        "id": 2,
        "name": "Body Parts",
        "link": "body-parts"
      }
    }
  ]
}
```

---

## 2. Создание товара с полем `make`

### `POST /api/admin/product`

**Описание:** Создание нового товара (автоматическая загрузка с eBay)

**Content-Type:** `multipart/form-data`

**Новое поле в теле запроса:**

| Поле | Тип | Обязательный | Описание |
|------|-----|--------------|----------|
| `make` | string | нет | Марка автомобиля (например: BMW, Mercedes, Audi) |

**Пример запроса:**
```javascript
const formData = new FormData();
formData.append('data', JSON.stringify({
  name: 'BMW X5 Headlight Assembly',
  description: 'Left side headlight',
  link: 'bmw-x5-headlight-left',
  price: 299.99,
  old_price: 349.99,
  categoryId: 3,
  make: 'BMW',  // Новое поле
  ebayCategory: 'Motors:Parts & Accessories:Car & Truck Parts',
  ebayModel: 'X5',
  ebayYear: '2018-2022',
  count: 5
}));
formData.append('files', file1);
formData.append('files', file2);

fetch('/api/admin/product', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

### `POST /api/admin/product/manual`

**Описание:** Ручное создание товара (не синхронизируется с eBay)

Принимает те же параметры, включая поле `make`.

---

## 3. Обновление товара

### `PUT /api/admin/product?id={productId}`

**Описание:** Обновление существующего товара

**Новое поле:**
- `make` - теперь можно обновить марку автомобиля

**Пример запроса:**
```javascript
const formData = new FormData();
formData.append('data', JSON.stringify({
  name: 'Updated BMW X5 Headlight',
  make: 'BMW',  // Можно обновить марку
  price: 279.99,
  // ... другие поля
}));

fetch('/api/admin/product?id=123', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

---

## 4. Получение уникальных марок автомобилей

### `GET /api/admin/product/makes`

**Описание:** Возвращает список всех уникальных марок (`make`) из товаров

**Query параметры:** нет

**Особенности:**
- Возвращает только непустые значения
- Удаляет пробелы по краям
- Отфильтрованы удалённые товары (`isDeleted: false`)
- Сортировка по алфавиту

**Пример запроса:**
```http
GET /api/admin/product/makes
```

**Пример ответа:**
```json
[
  "Audi",
  "BMW",
  "Mercedes-Benz",
  "Porsche",
  "Volkswagen"
]
```

---

## 5. Получение всех категорий

### `GET /api/admin/product/categories`

**Описание:** Возвращает список всех категорий товаров

**Query параметры:** нет

**Особенности:**
- Возвращает полные объекты категорий (не только названия)
- Сортировка по имени категории

**Пример запроса:**
```http
GET /api/admin/product/categories
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "name": "Body Parts",
    "link": "body-parts",
    "createdAt": "2025-01-15T08:00:00.000Z",
    "updatedAt": "2025-01-15T08:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Engine Parts",
    "link": "engine-parts",
    "createdAt": "2025-01-15T08:00:00.000Z",
    "updatedAt": "2025-01-15T08:00:00.000Z"
  },
  {
    "id": 3,
    "name": "Lights & Lighting",
    "link": "lights-lighting",
    "createdAt": "2025-01-15T08:00:00.000Z",
    "updatedAt": "2025-01-15T08:00:00.000Z"
  }
]
```

---

## Примеры использования

### Фильтрация товаров по марке и категории

```javascript
// 1. Получить список всех марок
const makesResponse = await fetch('/api/admin/product/makes');
const makes = await makesResponse.json();
// ["Audi", "BMW", "Mercedes-Benz", ...]

// 2. Получить список всех категорий
const categoriesResponse = await fetch('/api/admin/product/categories');
const categories = await categoriesResponse.json();
// [{id: 1, name: "Body Parts", ...}, ...]

// 3. Отфильтровать товары по марке BMW
const productsResponse = await fetch('/api/admin/product?search=BMW&page=1&limit=50');
const products = await productsResponse.json();
```

### Создание товара с полной информацией

```javascript
const createProduct = async () => {
  const formData = new FormData();

  formData.append('data', JSON.stringify({
    // Основная информация
    name: 'Mercedes C-Class Door Panel',
    description: 'Interior door panel for Mercedes C-Class',
    link: 'mercedes-c-class-door-panel',

    // Цены
    price: 149.99,
    old_price: 199.99,

    // Категория
    categoryId: 5,

    // Марка авто (НОВОЕ ПОЛЕ)
    make: 'Mercedes-Benz',

    // eBay информация
    ebayCategory: 'Motors:Parts & Accessories:Car & Truck Parts:Interior',
    ebayModel: 'C-Class',
    ebayYear: '2015-2021',
    ebayAdditionalNotes: 'Fits both sedan and coupe models',

    // Количество
    count: 3,

    // Дополнительные поля
    additionalFields: JSON.stringify({
      color: 'Black',
      material: 'Leather',
      condition: 'Used - Good'
    })
  }));

  // Добавить изображения
  formData.append('files', imageFile1);
  formData.append('files', imageFile2);

  const response = await fetch('/api/admin/product', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return await response.json();
};
```

### Поиск и пагинация

```javascript
// Поиск товаров BMW с пагинацией
const searchProducts = async (searchTerm, page = 1) => {
  const response = await fetch(
    `/api/admin/product?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=20`
  );
  const data = await response.json();

  console.log(`Найдено товаров: ${data.count}`);
  console.log(`Страница: ${page}`);
  console.log(`Всего страниц: ${Math.ceil(data.count / 20)}`);

  return data.rows;
};

// Использование
const bmwProducts = await searchProducts('BMW', 1);
```

---

## Изменённые файлы

1. [controllers/adminProductController.js](controllers/adminProductController.js)
   - Обновлён метод `fetch()` - добавлен поиск и изменена сортировка
   - Обновлён метод `createProduct()` - добавлено поле `make`
   - Обновлён метод `update()` - добавлено поле `make`
   - Добавлен метод `getMakes()` - получение уникальных марок
   - Добавлен метод `getAllCategories()` - получение всех категорий

2. [routes/admin/productRouter.js](routes/admin/productRouter.js)
   - Добавлен маршрут `GET /makes`
   - Добавлен маршрут `GET /categories`

---

## Заметки по миграции

Если у вас уже есть фронтенд приложение:

1. **Пагинация** - теперь по умолчанию товары сортируются от новых к старым
2. **Поле `make`** - опциональное поле, существующие товары будут иметь `make: null`
3. **Обратная совместимость** - все изменения обратно совместимы, старые запросы продолжат работать

## Контрольный список для фронтенда

- [ ] Обновить запрос списка товаров для использования пагинации
- [ ] Добавить поле поиска по названию
- [ ] Добавить поле `make` в форму создания/редактирования товара
- [ ] Использовать `/makes` для автокомплита марок
- [ ] Использовать `/categories` для выпадающего списка категорий
- [ ] Проверить что сортировка от новых к старым работает корректно
