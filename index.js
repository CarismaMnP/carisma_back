const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

const { sequelize } = require('./db');
const models = require('./models/models');
const createServer = require('./utils/server');
const { scheduleEbayCatalogJob } = require('./utils/ebayCatalogJob');

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
        // await sequelize.authenticate();
        await sequelize.sync();

        await models.User.findOrCreate({
            where: {

                name : "Administrator",
                mail : "info@carismamp.com",
                phone : "89127864632",
                password : "242CaRismA516716!@#",
                role : "ADMINISTRATOR",
                prevCodeDatetime : null,
                wrongRecoveryCodeAttempts : 0,
                recoveryCode : "",
                category : "Basic",
                discount : 0,
                total : 0,
                smsCode : null,
            }
        })

        // models.BlockData.findOrCreate({
        //     where: {
        //         name: "products"
        //     },
        //     defaults: {
        //         data: {
        //           categories: [
        //             { id: 1, layout: "bigLeftVideo" },
        //             { id: 2, layout: "rightImage" },
        //             { id: 3, layout: "leftImage" },
        //             { id: 4, layout: "centerImage" }
        //           ]
        //         }
        //     }
        // })

        // Запускать cron jobs только если не отключены
        // Используйте DISABLE_CRON_JOBS=true для API реплик
        const shouldRunCronJobs = process.env.DISABLE_CRON_JOBS !== 'true';

        if (shouldRunCronJobs) {
            console.log('[Cron] Starting eBay catalog sync job...');
            scheduleEbayCatalogJob();
        } else {
            console.log('[Cron] Skipping cron jobs (DISABLE_CRON_JOBS=true)');
        }

        // Запускать HTTP сервер только если не worker mode
        if (process.env.CRON_JOBS_ONLY !== 'true') {
            app.listen(PORT, () => console.log(`Server started on ${PORT}`));
        } else {
            console.log('[Worker] Running as cron worker, HTTP server disabled');
        }
    } catch (e) {
        console.error('Failed to start server:', e);
    }
};

start();
