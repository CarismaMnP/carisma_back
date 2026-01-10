# Admin: товары
## POST `/api/admin/product/manual`
- Назначение: добавить товар вручную; такие записи помечаются `isManual=true` и не переписываются синхронизацией eBay.
- Авторизация: `Bearer` с ролью `ADMINISTRATOR`.
- Формат: `multipart/form-data` с полем `data` (JSON-строка) и опциональным `files` (один файл или массив файлов).
- `data` поля:
  - `name` (string, required)
  - `link` (string, required, уникальный слаг)
  - `price` (number, required)
  - `about` (string, optional)
  - `additionalFields` (JSON string, optional)
  - `ebayCategory` (string, optional)
  - `ebayModel` (string, optional)
  - `ebayYear` (string, optional)
  - `ebayAdditionalNotes` (string, optional)
  - `count` (number, optional) - кладётся в `count` и `ebayStock`, если передан
  - `ebayAlsoFits` (Array<string> или JSON string, optional)
- Ответ `200`: объект `Product` с полями модели, включая `images` (массив `{ imageUrl, previewUrl }`), `count`, `ebayStock`, `ebayCategory`, `ebayModel`, `ebayYear`, `ebayAdditionalNotes`, `ebayAlsoFits`, `isManual=true`, `createdAt`, `updatedAt`.

## GET `/api/admin/product/ebay_categories`
- Назначение: уникальный список актуальных `ebayCategory` из товаров с `isDeleted=false`.
- Авторизация: `Bearer` с ролью `ADMINISTRATOR`.
- Ответ `200`: отсортированный массив строк `["Body Parts", "Engine", ...]`.
