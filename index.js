const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

const { sequelize } = require('./db');
const models = require('./models/models');
const createServer = require('./utils/server');
const { scheduleEbayCatalogJob } = require('./utils/ebayCatalogJob');

const PORT = process.env.PORT || 5050;

const app = createServer();

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

        scheduleEbayCatalogJob();
        app.listen(PORT, () => console.log(`Server started on ${PORT}`));
    } catch (e) {
        console.error('Failed to start server:', e);
    }
};

start();
