# Исправление проблемы перезапуска сервера при eBay синхронизации

## Проблема

Сервер постоянно перезапускается после создания 1 товара во время eBay синхронизации.

## Причины

### 1. **Множественные реплики (Главная проблема)**

В [docker-compose.yml](docker-compose.yml):
```yaml
backend:
  deploy:
    replicas: 2  # ← 2 экземпляра!
```

**Проблема:** Оба экземпляра одновременно запускают `scheduleEbayCatalogJob()`, что приводит к:
- Race conditions при создании товаров
- Дублирование API запросов к eBay
- Конфликты при записи в БД
- Случайные крашы и перезапуски

### 2. **Отсутствие обработчиков ошибок**

В [index.js](index.js) не было глобальных обработчиков для:
- `unhandledRejection` - необработанные отклонённые промисы
- `uncaughtException` - необработанные исключения

### 3. **Файлы samples вызывают watch mode**

Функция `saveSamples` создаёт файлы:
- `ebay_detail_sample.txt`
- `ebay_compatibility_sample.json`

Если используется nodemon или watch mode, это может вызывать автоперезапуск.

## Решения

### Решение 1: Использовать только 1 реплику для cron jobs (Рекомендуется)

**Вариант A: Отдельный worker для cron jobs**

Создайте два сервиса:

```yaml
version: '3.9'
services:
  # API сервер - множественные реплики для обработки запросов
  backend-api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    deploy:
      replicas: 2
    environment:
      - DISABLE_CRON_JOBS=true  # Отключить cron jobs
    ports:
      - "5050-5051:5050"
    networks:
      - clycon_network

  # Worker для cron jobs - одна реплика
  backend-worker:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    deploy:
      replicas: 1  # ← Только ОДИН worker!
    environment:
      - CRON_JOBS_ONLY=true  # Только cron jobs, без HTTP сервера
    networks:
      - clycon_network

  nginx:
    container_name: main_nginx
    image: nginx:latest
    restart: always
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
      - ./utils/public:/var/www/utils
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend-api
    networks:
      - clycon_network

networks:
  clycon_network:
    name: clycon_network
```

Затем обновите [index.js](index.js):

```javascript
const start = async () => {
    try {
        await sequelize.sync();

        await models.User.findOrCreate({
            where: {
                name : "Administrator",
                mail : "info@carismamp.com",
                // ... остальные поля
            }
        });

        // Запускать cron jobs только если:
        // 1. Это worker (CRON_JOBS_ONLY=true)
        // 2. Или cron jobs не отключены (DISABLE_CRON_JOBS != true)
        const shouldRunCronJobs = process.env.CRON_JOBS_ONLY === 'true'
            || process.env.DISABLE_CRON_JOBS !== 'true';

        if (shouldRunCronJobs) {
            console.log('[Cron] Starting eBay catalog sync job...');
            scheduleEbayCatalogJob();
        } else {
            console.log('[Cron] Skipping cron jobs (DISABLE_CRON_JOBS=true)');
        }

        // Запускать HTTP сервер только если это не worker
        if (process.env.CRON_JOBS_ONLY !== 'true') {
            app.listen(PORT, () => console.log(`Server started on ${PORT}`));
        } else {
            console.log('[Worker] Running as cron worker, HTTP server disabled');
        }
    } catch (e) {
        console.error('Failed to start server:', e);
    }
};
```

**Вариант B: Простое решение - уменьшить реплики до 1**

```yaml
backend:
  deploy:
    replicas: 1  # ← Только одна реплика
```

**Компромисс:** Меньше отказоустойчивость, но проще.

### Решение 2: Добавить обработчики ошибок (Уже применено)

В [index.js](index.js) добавлены:

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') {
    console.error('Restarting process in 5 seconds...');
    setTimeout(() => process.exit(1), 5000);
  }
});
```

### Решение 3: Оптимизировать память и batch обработку

Обновите [utils/ebayCatalogJob.js](utils/ebayCatalogJob.js):

```javascript
const runEbayCatalogPull = async () => {
  console.log(
    `[eBay] Fetching catalog for store "${storeName}" (seller ${sellerId})...`
  );

  const queryTerms = process.env.EBAY_QUERY_TERMS
    ? process.env.EBAY_QUERY_TERMS.split(',').map(s => s.trim()).filter(Boolean)
    : ['OEM'];

  const dedupMap = new Map();

  for (const term of queryTerms) {
    console.log(`[eBay] Fetching items for query "${term}"...`);
    const items = await fetchAllForQuery(term);
    console.log(`[eBay] Query "${term}" returned ${items.length} items.`);
    items.forEach((item) => dedupMap.set(item.itemId, item));
  }

  const uniqueItems = Array.from(dedupMap.values());
  console.log(`[eBay] Total unique items collected: ${uniqueItems.length}.`);

  // BATCH PROCESSING - обрабатывать по 50 товаров за раз
  const BATCH_SIZE = 50;
  for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
    const batch = uniqueItems.slice(i, i + BATCH_SIZE);
    console.log(`[eBay] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(uniqueItems.length/BATCH_SIZE)}...`);

    for (const item of batch) {
      try {
        await maybeSyncItem(item);
      } catch (err) {
        console.error(`[eBay] Failed to sync item ${item.itemId}:`, err);
        // Продолжаем обработку остальных товаров
      }
    }

    // Небольшая пауза между батчами для снижения нагрузки
    if (i + BATCH_SIZE < uniqueItems.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 секунда
    }
  }

  console.log('[eBay] Sync pass completed.');
};
```

### Решение 4: Использовать distributed lock (Продвинутое)

Для множественных реплик используйте Redis или PostgreSQL для координации:

```javascript
// utils/distributedLock.js
const { sequelize } = require('../db');

async function acquireLock(lockName, ttl = 3600000) {
  try {
    // Создать таблицу для блокировок (выполнить миграцию)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS distributed_locks (
        lock_name VARCHAR(255) PRIMARY KEY,
        acquired_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);

    // Попытаться захватить блокировку
    const expiresAt = new Date(Date.now() + ttl);
    const [results] = await sequelize.query(`
      INSERT INTO distributed_locks (lock_name, expires_at)
      VALUES (:lockName, :expiresAt)
      ON CONFLICT (lock_name) DO UPDATE
        SET expires_at = :expiresAt, acquired_at = NOW()
        WHERE distributed_locks.expires_at < NOW()
      RETURNING *
    `, {
      replacements: { lockName, expiresAt }
    });

    return results.length > 0;
  } catch (err) {
    console.error('[Lock] Failed to acquire lock:', err);
    return false;
  }
}

async function releaseLock(lockName) {
  await sequelize.query(`
    DELETE FROM distributed_locks WHERE lock_name = :lockName
  `, {
    replacements: { lockName }
  });
}

module.exports = { acquireLock, releaseLock };
```

Затем в `scheduleEbayCatalogJob`:

```javascript
const { acquireLock, releaseLock } = require('./distributedLock');

const runEbayCatalogPull = async () => {
  const lockAcquired = await acquireLock('ebay_catalog_sync', 3600000);

  if (!lockAcquired) {
    console.log('[eBay] Another instance is already running sync. Skipping.');
    return;
  }

  try {
    // ... существующий код синхронизации
  } finally {
    await releaseLock('ebay_catalog_sync');
  }
};
```

## Рекомендации

### Для production:

1. **Используйте Вариант A** (отдельный worker для cron)
2. Добавьте мониторинг памяти
3. Используйте batch processing
4. Настройте alerting при крашах

### Для development:

1. Используйте 1 реплику
2. Включите все логи для отладки

## Проверка

После применения исправлений проверьте:

```bash
# Посмотреть логи
docker-compose logs -f backend-worker

# Проверить количество запущенных контейнеров
docker ps | grep backend

# Проверить использование памяти
docker stats
```

## Дополнительные улучшения

1. **Добавить health checks** в docker-compose
2. **Лимитировать память** для контейнеров
3. **Использовать PM2** внутри контейнера для управления процессом
4. **Добавить graceful shutdown** при SIGTERM
