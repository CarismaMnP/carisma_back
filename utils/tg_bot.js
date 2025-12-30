const TelegramBot = require('node-telegram-bot-api');
const token = '6802925680:AAG8_06N1hHveUS6LHFZHLCxzUNM_j1_GLs';
module.exports = new TelegramBot(token, {polling: true});