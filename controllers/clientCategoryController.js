const ApiError = require('../error/ApiError')
const { Category, Product } = require('../models/models')
const { Op } = require('sequelize');
const sequelize = require('sequelize');

class CategoryController {
    async fetch(req, res, next) {
        try {
            const categories = await Category.findAll({ where: { isDeleted: false }, order: [['name', 'ASC']] })
            return res.json(categories)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fetchMainCategories(req, res, next) {
        try {
            const categories = await Category.findAll({ where: { isDeleted: false, parentId: null }, order: [['name', 'ASC']] })

            const uniqueRegions = await Product.findAll({
                attributes: [
                    [sequelize.fn('DISTINCT', sequelize.col('region')), 'region']
                ],
                where: {
                    region: {
                        [Op.ne]: null // Исключаем null значения
                    },
                    isDeleted: false
                },
                raw: true
            });

            const regions = uniqueRegions.map(item => item.region).filter(Boolean);

            return res.json({categories, regions});
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fetchSubCategories(req, res, next) {
        try {
            const { parentId } = req.params;
            const categories = await Category.findAll({ where: { isDeleted: false, parentId }, order: [['name', 'ASC']] })
            return res.json(categories)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new CategoryController()