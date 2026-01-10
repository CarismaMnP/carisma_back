const path = require('path');
const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const ApiError = require('../error/ApiError');
const { s3, bucketName } = require('../db');
const { Arrival } = require('../models/models');

function makeKey(originalName) {
    const ext = path.extname(originalName) || '';
    const uniq = crypto.randomBytes(8).toString('hex');
    const y = new Date().getUTCFullYear();
    const m = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    return `arrivals/${y}/${m}/${Date.now()}_${uniq}${ext}`;
}

class AdminArrivalsController {
    async fetch(req, res, next) {
        try {
            const items = await Arrival.findAll({
                order: [['createdAt', 'DESC']],
            });
            return res.json(items);
        } catch (e) { next(ApiError.badRequest(e.message)); }
    }
    async fetchOne(req, res, next) {
        try {
            const { id } = req.params;
            const item = await Arrival.findByPk(id);
            return res.json(item);
        } catch (e) { next(ApiError.badRequest(e.message)); }
    }
    async create(req, res, next) {
        try {
            const file = req.files?.file;
            const payload = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body;
            const { model, body, year } = payload;

            let imageURL = '';

            if (file) {
                const Key = makeKey(file.name);
                await s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key,
                    Body: file.data,
                    ContentType: file.mimetype,
                }));
                imageURL = Key;
            }

            const created = await Arrival.create({ model, body, year, imageURL });
            return res.json(created);
        } catch (e) { next(ApiError.badRequest(e.message)); }
    }
    async update(req, res, next) {
        try {
            const { id } = req.query;
            const file = req.files?.file;
            const payload = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body;
            const { model, body, year } = payload;

            let imageURL;

            if (file) {
                const Key = makeKey(file.name);
                await s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key,
                    Body: file.data,
                    ContentType: file.mimetype,
                }));
                imageURL = Key;
            }

            const [_, rows] = await Arrival.update(
                { model, body, year, ...(imageURL ? { imageURL } : {}) },
                { where: { id }, returning: true }
            );

            return res.json(rows[0]);
        } catch (e) { next(ApiError.badRequest(e.message)); }
    }

    async delete(req, res, next) {
        try {
            const { id } = req.query;
            await Arrival.delete({ where: { id } });
            return res.json('Deleted successfully');
        } catch (e) { next(ApiError.badRequest(e.message)); }
    }
}

module.exports = new AdminArrivalsController();
