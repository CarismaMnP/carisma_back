const fs = require('fs');

const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres"
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    dialectOptions: {
      ssl: process.env.YANDEX_DB_CERT_PATH ? {
        ca: fs.readFileSync(process.env.YANDEX_DB_CERT_PATH).toString()
      } : undefined
    }
  }
}
