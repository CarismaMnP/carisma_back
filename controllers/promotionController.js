const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const {Promotion} = require('../models/models')

class PromotionController {
    async fetch(req, res, next) {
        try {
            const promotions = await Promotion.findAll({where: {isDeleted: false}})
            return res.json(promotions)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async create(req, res, next) {
        try {
            const file = req.files?.file;
            const {description, name, dateFrom, dateTo} = JSON.parse(req.body.data);

            let imageUrl = '';
            
            if (file) {
                const upload = await s3.Upload({ buffer: file.data }, '/categories/');
                imageUrl = upload.Key;
            }

            const promotion = await Promotion.create({description, name, dateFrom, dateTo, imageUrl})
    
            return res.json(promotion)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }
    
     async update(req, res, next) {
        try {
            const file = req.files?.file;
            const {id, description, name, dateFrom, dateTo} = JSON.parse(req.body.data);

            let imageUrl = '';
            
            if (file) {
                const upload = await s3.Upload({ buffer: file.data }, '/categories/');
                imageUrl = upload.Key;
            }

            const promotion = await Promotion.update({description, name, dateFrom, dateTo, imageUrl}, {where: {id}})
    
            return res.json("success")
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }

    async delete (req, res, next) {
        try {
            let {id} = req.query;
            await Promotion.update({isDeleted: true}, {where: {id}})
            return res.json("Deleted successfully");
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new PromotionController()