const path = require('path');
const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const ApiError = require('../error/ApiError');
const { s3 } = require('../db');
const { Arrival } = require('../models/models');

class PublicArrivalsController {
    async fetch(req, res, next) {
        try {
            const items = await Arrival.findAll({
                order: [['createdAt', 'DESC']],
                limit: 3
            });
            return res.json(items);
        } catch (e) { next(ApiError.badRequest(e.message)); }
    }
}

module.exports = new PublicArrivalsController();
