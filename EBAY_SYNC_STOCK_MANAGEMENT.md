# Управление остатками при синхронизации с eBay

## Проблема

Товары могут быть проданы как на вашем сайте, так и напрямую на eBay. Необходимо синхронизировать остатки между обеими платформами.

## Решение

При каждой синхронизации с eBay (`scheduleEbayCatalogJob`) автоматически проверяются товары, которые исчезли из каталога eBay, и обнуляются их остатки.

## Как это работает

### Шаг 1: Получение каталога с eBay

```javascript
const uniqueItems = Array.from(dedupMap.values());
// Например: [item1, item2, item3] - 3 товара пришли от eBay
```

### Шаг 2: Синхронизация каждого товара

Для каждого товара из eBay:
- Обновляется информация в БД (цена, описание, stock)
- Если товара нет в БД - создаётся новая запись

### Шаг 3: Поиск проданных товаров

После синхронизации всех товаров от eBay выполняется функция `markMissingProductsAsSold`:

1. **Собираем ID всех товаров от eBay:**
   ```javascript
   const syncedEbayItemIds = ['ebay123', 'ebay456', 'ebay789'];
   ```

2. **Ищем в БД все товары с eBay (isManual = false, count > 0):**
   ```javascript
   const allEbayProducts = await Product.findAll({
     where: {
       isManual: false,
       count: { [Op.gt]: 0 }
     }
   });
   ```

3. **Проверяем каждый товар из БД:**
   - Если `ebayItemId` товара **НЕТ** в списке от eBay → товар продан на eBay
   - Обнуляем `count = 0`

### Шаг 4: Логирование

В консоль выводится информация о проданных товарах:

```
[eBay] Product 456 (BMW E46 Hood) - eBay item ebay123 not found in sync, set count to 0 (sold on eBay)
[eBay] Marked 3 products as sold (count = 0) - they were sold on eBay.
```

## Примеры

### Пример 1: Товар продан на eBay

**До синхронизации (БД):**
```javascript
{
  id: 123,
  name: "BMW E46 Hood",
  ebayItemId: "ebay-12345",
  isManual: false,
  count: 1
}
```

**Синхронизация с eBay:**
- Получено 50 товаров от eBay
- Товар с `ebayItemId = "ebay-12345"` **отсутствует** в списке

**После синхронизации (БД):**
```javascript
{
  id: 123,
  name: "BMW E46 Hood",
  ebayItemId: "ebay-12345",
  isManual: false,
  count: 0 // ← обнулён
}
```

**Лог:**
```
[eBay] Product 123 (BMW E46 Hood) - eBay item ebay-12345 not found in sync, set count to 0 (sold on eBay)
```

### Пример 2: Товар всё ещё доступен на eBay

**До синхронизации (БД):**
```javascript
{
  id: 456,
  name: "Mercedes Bumper",
  ebayItemId: "ebay-67890",
  isManual: false,
  count: 1
}
```

**Синхронизация с eBay:**
- Получено 50 товаров от eBay
- Товар с `ebayItemId = "ebay-67890"` **присутствует** в списке

**После синхронизации (БД):**
```javascript
{
  id: 456,
  name: "Mercedes Bumper",
  ebayItemId: "ebay-67890",
  isManual: false,
  count: 1 // ← остался без изменений (или обновлён из eBay stock)
}
```

**Лог:**
```
[eBay] Updated product for ebay-67890 (stock: 1).
```

### Пример 3: Несколько товаров проданы на eBay

**БД перед синхронизацией:**
- Товар A (ebayItemId: "item-001", count: 1)
- Товар B (ebayItemId: "item-002", count: 1)
- Товар C (ebayItemId: "item-003", count: 1)
- Товар D (ebayItemId: "item-004", count: 1)

**От eBay пришло:**
- item-001 ✅
- item-003 ✅
- item-004 ✅

**Результат:**
- Товар A (count: 1) ✅ остался
- Товар B (count: 0) ❌ обнулён (продан на eBay)
- Товар C (count: 1) ✅ остался
- Товар D (count: 1) ✅ остался

**Лог:**
```
[eBay] Product 2 (Товар B) - eBay item item-002 not found in sync, set count to 0 (sold on eBay)
[eBay] Marked 1 products as sold (count = 0) - they were sold on eBay.
```

## Полный цикл синхронизации

### Сценарий: Товар продан на вашем сайте

1. **Пользователь покупает товар на сайте**
   - Webhook обнуляет `count = 0` (см. [PRODUCT_STOCK_MANAGEMENT.md](PRODUCT_STOCK_MANAGEMENT.md))

2. **Синхронизация с eBay (через 8 часов)**
   - Товар всё ещё есть на eBay (продан только на сайте)
   - Товар обновляется из eBay, но `count` уже 0
   - **Нужно добавить логику завершения листинга на eBay** ⚠️

### Сценарий: Товар продан на eBay

1. **Товар продан на eBay**
   - На сайте товар всё ещё отображается (`count = 1`)

2. **Синхронизация с eBay**
   - Товар не приходит в каталоге (продан)
   - `markMissingProductsAsSold` обнуляет `count = 0`
   - Товар исчезает с сайта ✅

## Расписание синхронизации

Синхронизация запускается:

1. **При старте приложения** (немедленно)
2. **Каждые 8 часов** (cron: `0 */8 * * *`)

```javascript
cron.schedule('0 */8 * * *', async () => {
  await runEbayCatalogPull();
});
```

## Исключения

### 1. Ручные товары (isManual = true)

Ручные товары **игнорируются** при обнулении:

```javascript
where: {
  isManual: false, // ← только eBay товары
  count: { [Op.gt]: 0 }
}
```

### 2. Товары с count = 0

Товары, у которых уже `count = 0`, не проверяются (оптимизация).

### 3. Товары без ebayItemId

Если у товара `isManual = false`, но нет `ebayItemId`:

```
[eBay] Product 123 has isManual=false but no ebayItemId, skipping.
```

## Мониторинг

### SQL запросы для проверки

**1. Товары с eBay, у которых count > 0:**
```sql
SELECT id, name, "ebayItemId", count, "ebayStock"
FROM products
WHERE "isManual" = false
AND count > 0
ORDER BY "updatedAt" DESC;
```

**2. Товары, которые были обнулены за последние 24 часа:**
```sql
SELECT id, name, "ebayItemId", count, "updatedAt"
FROM products
WHERE "isManual" = false
AND count = 0
AND "updatedAt" > NOW() - INTERVAL '24 hours'
ORDER BY "updatedAt" DESC;
```

**3. Несоответствие между count и ebayStock:**
```sql
SELECT id, name, "ebayItemId", count, "ebayStock"
FROM products
WHERE "isManual" = false
AND count != COALESCE("ebayStock", 0)
ORDER BY "updatedAt" DESC;
```

## Логи

### Успешная синхронизация

```
[eBay] Fetching catalog for store "Your Store" (seller 12345)...
[eBay] Fetching items for query "OEM"...
[eBay] Fetched 50/150 items (offset: 0)...
[eBay] Fetched 100/150 items (offset: 50)...
[eBay] Fetched 150/150 items (offset: 100)...
[eBay] Query "OEM" returned 150 items.
[eBay] Total unique items collected: 150.
[eBay] Updated product for ebay-001 (stock: 1).
[eBay] Updated product for ebay-002 (stock: 2).
...
[eBay] Product 456 (BMW E46 Hood) - eBay item ebay-123 not found in sync, set count to 0 (sold on eBay)
[eBay] Product 789 (Mercedes Bumper) - eBay item ebay-456 not found in sync, set count to 0 (sold on eBay)
[eBay] Marked 2 products as sold (count = 0) - they were sold on eBay.
[eBay] Sync pass completed.
```

### Все товары в наличии

```
[eBay] Sync pass completed.
[eBay] No products needed to be marked as sold.
```

## TODO: Двусторонняя синхронизация

### Проблема
Сейчас реализована только односторонняя синхронизация:
- eBay → Сайт ✅ (товары обнуляются)
- Сайт → eBay ❌ (листинги не завершаются)

### Решение

Добавить функцию завершения листингов на eBay для товаров, проданных на сайте:

```javascript
const endEbayListingsForSoldProducts = async () => {
  // Найти товары: isManual = false, count = 0, ebayItemId существует
  const soldProducts = await Product.findAll({
    where: {
      isManual: false,
      count: 0,
      ebayItemId: { [Op.ne]: null }
    }
  });

  for (const product of soldProducts) {
    try {
      // Вызвать eBay API для завершения листинга
      await ebayClient.endListing(product.ebayItemId);
      console.log(`[eBay] Ended listing for ${product.ebayItemId}`);
    } catch (error) {
      console.error(`[eBay] Failed to end listing ${product.ebayItemId}:`, error);
    }
  }
};
```

Это предотвратит продажу товара на eBay после того, как он продан на сайте.

## Безопасность

1. **Транзакции:** Обновления выполняются последовательно, без транзакций (можно улучшить)
2. **Откат:** Нет механизма отката при ошибках
3. **Логирование:** Все действия логируются для аудита
4. **Защита ручных товаров:** Ручные товары (isManual = true) никогда не обнуляются

## Тестирование

### Тест 1: Товар продан на eBay

1. Создайте товар с `isManual = false`, `ebayItemId = "test-123"`, `count = 1`
2. Убедитесь, что `test-123` НЕ приходит от eBay при следующей синхронизации
3. Проверьте, что `count` обнулился

### Тест 2: Товар доступен на eBay

1. Создайте товар с реальным `ebayItemId` с eBay
2. Запустите синхронизацию
3. Проверьте, что `count` **не** обнулился

### Тест 3: Ручной товар

1. Создайте товар с `isManual = true`, `ebayItemId = null`, `count = 5`
2. Запустите синхронизацию
3. Проверьте, что `count` остался 5 (не обнулился)

## Производительность

- **Запрос к БД:** 1 раз (получение всех eBay товаров с count > 0)
- **Обновления:** По одному для каждого проданного товара
- **Оптимизация:** Можно использовать `bulkUpdate` вместо циклического обновления

```javascript
// Оптимизированная версия
const missingIds = allEbayProducts
  .filter(p => !syncedEbayItemIds.includes(p.ebayItemId))
  .map(p => p.id);

if (missingIds.length > 0) {
  await Product.update(
    { count: 0 },
    { where: { id: { [Op.in]: missingIds } } }
  );
}
```
