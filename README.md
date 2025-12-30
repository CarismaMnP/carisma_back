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
