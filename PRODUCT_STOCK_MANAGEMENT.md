# Управление остатками товаров после оплаты

## Как это работает

После успешной оплаты заказа автоматически уменьшается количество товаров на складе (`count`).

### Логика уменьшения остатков:

1. **Товары с eBay (`isManual = false`)**:
   - Остаток обнуляется (`count = 0`)
   - Логика: на eBay каждый товар уникален, после продажи его нет в наличии

2. **Ручные товары (`isManual = true`)**:
   - Остаток уменьшается на количество в заказе
   - Например: было 10 шт → заказали 3 шт → осталось 7 шт
   - Если остаток меньше 0, устанавливается 0

## Реализация

### Метод `decreaseProductStock`

Расположение: [controllers/stripeWebhookController.js](controllers/stripeWebhookController.js)

```javascript
async decreaseProductStock(orderId) {
    // Получаем все товары из заказа
    const orderProducts = await OrderProduct.findAll({
        where: { orderId },
        include: [{ model: Product, required: true }]
    });

    for (const orderProduct of orderProducts) {
        const product = orderProduct.product;
        const orderedCount = orderProduct.count;

        if (product.isManual === false) {
            // eBay товар - обнуляем count
            await product.update({ count: 0 });
        } else {
            // Ручной товар - уменьшаем count
            const newCount = Math.max(0, product.count - orderedCount);
            await product.update({ count: newCount });
        }
    }
}
```

### Когда вызывается

Метод вызывается после успешной оплаты в трёх обработчиках:

1. `handleCheckoutSessionCompleted` - немедленная оплата
2. `handleCheckoutSessionAsyncPaymentSucceeded` - асинхронная оплата
3. `handlePaymentIntentSucceeded` - успешный платёж

## Примеры

### Пример 1: Продажа товара с eBay

**До оплаты:**
```javascript
{
  id: 123,
  name: "BMW E46 Hood",
  isManual: false,
  count: 1,
  ebayItemId: "12345678"
}
```

**Заказ:**
- Товар 123, количество: 1

**После оплаты:**
```javascript
{
  id: 123,
  name: "BMW E46 Hood",
  isManual: false,
  count: 0, // ← обнулён
  ebayItemId: "12345678"
}
```

**Лог:**
```
eBay product 123 (BMW E46 Hood) - set count to 0
```

### Пример 2: Продажа ручного товара

**До оплаты:**
```javascript
{
  id: 456,
  name: "Oil Filter",
  isManual: true,
  count: 50
}
```

**Заказ:**
- Товар 456, количество: 5

**После оплаты:**
```javascript
{
  id: 456,
  name: "Oil Filter",
  isManual: true,
  count: 45 // ← уменьшен на 5
}
```

**Лог:**
```
Manual product 456 (Oil Filter) - decreased count from 50 to 45
```

### Пример 3: Заказ с несколькими товарами

**Заказ:**
- Товар 123 (eBay, count: 1) - количество: 1
- Товар 456 (ручной, count: 50) - количество: 5
- Товар 789 (eBay, count: 1) - количество: 1

**После оплаты:**
- Товар 123: count → 0
- Товар 456: count → 45
- Товар 789: count → 0

**Лог:**
```
eBay product 123 (BMW E46 Hood) - set count to 0
Manual product 456 (Oil Filter) - decreased count from 50 to 45
eBay product 789 (Mercedes Bumper) - set count to 0
Stock decreased for order abc-123-def
```

## Интеграция с синхронизацией eBay

### Проблема двойной продажи

Товар может быть продан одновременно на вашем сайте и на eBay. Реализована автоматическая синхронизация остатков.

### Реализованная логика

#### 1. Товар продан на сайте
- Webhook обнуляет `count = 0` сразу после оплаты ✅
- Товар исчезает с сайта
- **TODO:** Завершить листинг на eBay (чтобы товар нельзя было купить там)

#### 2. Товар продан на eBay
- При синхронизации (каждые 8 часов) проверяются все товары ✅
- Если товар отсутствует в каталоге eBay → он был продан там
- Автоматически устанавливается `count = 0`
- Товар исчезает с сайта

### Как это работает

В файле [utils/ebayCatalogJob.js](utils/ebayCatalogJob.js) добавлена функция `markMissingProductsAsSold`:

```javascript
async function markMissingProductsAsSold(syncedItems) {
  // Получаем ID всех товаров от eBay
  const syncedEbayItemIds = syncedItems.map(item => item.itemId);

  // Находим товары в БД (isManual = false, count > 0)
  const allEbayProducts = await Product.findAll({
    where: {
      isManual: false,
      count: { [Op.gt]: 0 }
    }
  });

  // Проверяем каждый товар
  for (const product of allEbayProducts) {
    // Если товара нет в списке от eBay → он продан там
    if (!syncedEbayItemIds.includes(product.ebayItemId)) {
      await product.update({ count: 0 });
      console.log(`Product ${product.id} sold on eBay - set count to 0`);
    }
  }
}
```

**Подробная документация:** [EBAY_SYNC_STOCK_MANAGEMENT.md](EBAY_SYNC_STOCK_MANAGEMENT.md)

## Безопасность и надёжность

### 1. Webhook подтверждение
Уменьшение остатков происходит **только после подтверждённой оплаты**, а не при создании заказа.

### 2. Защита от дублирования
Если webhook придёт дважды (например, `checkout.session.completed` и `payment_intent.succeeded`), товар не будет списан дважды, так как:
- Проверяется статус заказа
- Уменьшение происходит только при переходе в статус `confirmed`

### 3. Транзакции
Рекомендуется обернуть обновление в транзакцию:

```javascript
const transaction = await sequelize.transaction();
try {
  await order.update({ state: 'confirmed' }, { transaction });
  await this.decreaseProductStock(orderId, transaction);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

## Логи

При успешном уменьшении остатков в консоль выводится:

```
Order abc-123 confirmed - payment completed. Tax: $5.50, Total: $75.50
Cleared 3 items from cart for user 456
eBay product 123 (BMW E46 Hood) - set count to 0
Manual product 456 (Oil Filter) - decreased count from 50 to 45
Stock decreased for order abc-123
```

## Тестирование

### Тест 1: Продажа eBay товара

1. Создайте товар с `isManual = false`, `count = 1`
2. Добавьте в корзину и оформите заказ
3. Оплатите тестовой картой
4. Проверьте: `count` должен быть 0

```sql
SELECT id, name, "isManual", count
FROM products
WHERE id = 123;
```

### Тест 2: Продажа ручного товара

1. Создайте товар с `isManual = true`, `count = 100`
2. Закажите 10 шт
3. Оплатите
4. Проверьте: `count` должен быть 90

### Тест 3: Смешанный заказ

1. Добавьте в корзину:
   - 1x eBay товар (count = 1)
   - 5x ручной товар (count = 50)
2. Оплатите заказ
3. Проверьте:
   - eBay: count = 0
   - Ручной: count = 45

## Восстановление остатков при возврате

Если заказ отменён или возвращён (`state = 'refunded'`), можно добавить логику восстановления остатков:

```javascript
async handleChargeRefunded(charge) {
    // ... существующий код ...

    if (order) {
        await order.update({ state: 'refunded' });

        // Восстановить остатки (опционально)
        // await this.restoreProductStock(order.id);
    }
}
```

**Внимание:** Для eBay товаров восстановление может быть невозможно, так как они уникальны.

## Мониторинг

Рекомендуется настроить алерты для:

1. **Товары с отрицательным остатком**
   ```sql
   SELECT * FROM products WHERE count < 0;
   ```

2. **eBay товары с count > 0 после продажи**
   ```sql
   SELECT p.*
   FROM products p
   JOIN "orderProducts" op ON p.id = op."productId"
   JOIN orders o ON op."orderId" = o.id
   WHERE p."isManual" = false
   AND o.state = 'confirmed'
   AND p.count > 0;
   ```

3. **Несоответствие между count и ebayStock**
   ```sql
   SELECT * FROM products
   WHERE "isManual" = false
   AND count != "ebayStock";
   ```
