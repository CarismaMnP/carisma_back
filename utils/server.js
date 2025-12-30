const express = require('express')
const cors = require('cors')
const router = require('../routes/index')
const errorHandler = require('../middleware/ErrorHandlingMiddleware')
const fileUpload = require('express-fileupload')

module.exports = function createServer() {
    const app = express()
    app.use(cors({
        // origin: ['https://admin.docly.ru', 'https://docly.ru', 'http://localhost:3000', 'http://localhost:3030'],
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }));
    app.use(fileUpload({}))
    app.use('/static', express.static(__dirname + '/public'));
    app.use(express.static('files'));
    app.use(express.json())
    app.use('/api', router)
    app.use(errorHandler)
    return app
}