const ApiError = require('../error/ApiError')
const {User, Category, Product} = require('../models/models')
const { s3 } = require('../db');
const sharp = require('sharp');

class CategoryController {
    async fetch(req, res, next) {
        try {
            const categories = await Category.findAll({order: [['name', 'ASC']]})
            return res.json(categories)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fetchOne(req, res, next) {
        try {
            const { id } = req.params;
            const category = await Category.findByPk(id)
            return res.json(category)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async create(req, res, next) {
        try {
            const file = req.files?.file;
            const file2 = req.files?.file2;
            const {name, link, parentId, description} = JSON.parse(req.body.data);

            let imageUrl = '';
            let previewUrl = '';
            
            
            if (file) {
                // Загрузка оригинального изображения
                const upload = await s3.Upload({ buffer: file.data }, '/categories/');
                imageUrl = upload.Key;
                
                // Создание миниатюры 24x24px с помощью sharp
                
                const previewBuffer = await sharp(file.data)
                .resize(24, 24)
                .toBuffer();
                
                // Загрузка миниатюры на S3
                const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/categories/previews/');
                previewUrl = previewUpload.Key;
            }
            
            let imageUrl2 = '';
            
            if (file2) {                
                const upload = await s3.Upload({ buffer: file2.data }, '/categories/');
                imageUrl2 = upload.Key;
            }

            const category = await Category.create({name, link, parentId, description, imageUrl, previewUrl, horizontalImageUrl: imageUrl2})
            return res.json(category)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    async update(req, res, next) {
        try {
            const {id} = req.query;
            const file = req.files?.file;
            const file2 = req.files?.file2;
            const {name, link, parentId, description} = JSON.parse(req.body.data);

            let imageUrl = '';
            let previewUrl = '';

            if (file) {
                // Загрузка оригинального изображения
                const upload = await s3.Upload({ buffer: file.data }, '/categories/');
                imageUrl = upload.Key;
    
                // Создание миниатюры 24x24px с помощью sharp

                const previewBuffer = await sharp(file.data)
                    .resize(24, 24)
                    .toBuffer();
    
                // Загрузка миниатюры на S3
                const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/categories/previews/');
                previewUrl = previewUpload.Key;
            }

            let imageUrl2 = '';
            
            if (file2) {                
                const upload = await s3.Upload({ buffer: file2.data }, '/categories/');
                imageUrl2 = upload.Key;
            }

            const category = await Category.update({name, link, parentId, description, imageUrl, previewUrl, horizontalImageUrl: imageUrl2}, {where: {id}, returning: true})
            return res.json(category[1][0])
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete (req, res, next) {
        try {
            let {id} = req.query;
            await Category.update({isDeleted: true}, {where: {id}})
            return res.json("Deleted successfully");
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new CategoryController()