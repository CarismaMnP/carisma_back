const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

const { sequelize } = require('./db');
const models = require('./models/models');
const createServer = require('./utils/server');
// CarParts runs as a separately supervised worker; no marketplace importer in the API.

const PORT = process.env.PORT || 5050;

const app = createServer();

// Глобальные обработчики ошибок - предотвращают краш процесса
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // НЕ выходим из процесса, просто логируем
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // В production лучше перезапустить процесс после критической ошибки
  if (process.env.NODE_ENV === 'production') {
    console.error('Restarting process in 5 seconds...');
    setTimeout(() => process.exit(1), 5000);
  }
});

const start = async () => {
    try {
        await sequelize.authenticate();

        // Запускать HTTP сервер только если не worker mode
        if (process.env.CRON_JOBS_ONLY !== 'true') {
            const server=app.listen(PORT, () => console.log(`Server started on ${PORT}`));
            const stop=()=>server.close(async()=>{await sequelize.close();process.exit(0)});
            process.on('SIGINT',stop);process.on('SIGTERM',stop);
        } else {
            console.log('[Worker] Running as cron worker, HTTP server disabled');
        }
    } catch (e) {
        console.error('Failed to start server:', e.message);
        process.exitCode=1;await sequelize.close();
    }
};

start();
