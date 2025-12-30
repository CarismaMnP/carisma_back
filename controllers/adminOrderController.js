const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Order, User, OrderProduct} = require('../models/models');
const updateUserCategory = require('../utils/updateUserCategory');

class OrderController {
    async fetch (req, res, next) {
        try {
            let {page, limit} = req.query
            page = page || 1
            limit = limit || 20
            let offset = page * limit - limit
            const orders = await Order.findAndCountAll({
                limit, offset, order: [['createdAt', 'DESC']], 
                include: [
                    {model: OrderProduct, required: false, include: [{model: Product, required: true}]}, 
                    {model: User, required: false}
                ]
            })
            return res.json(orders)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fetchOne (req, res, next) {
        try {
            const { id } = req.params;
            const order = await Order.findByPk(
                id, 
                {include: [
                    {model: OrderProduct, required: false, include: [{model: Product, required: true}]}, 
                    {model: User, required: false}
                ]}
            )
            return res.json(order)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async update (req, res, next) {
        try {
            const {id} = req.query;
            const {state, sum} = req.body;
            const order = await Order.update({state, sum}, {where: {id}, returning: true});
            return res.json(order[1][0])
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async updateState (req, res, next) {
        try {
            const {id} = req.query;
            const {state} = req.body;
            const order = await Order.update({state}, {where: {id}, returning: true});
            return res.json(order[1][0])
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async cancel (req, res, next) {
        try {
            let {id} = req.query;
            const order = await Order.update({state: "canceled"}, {where: {id}, returning: true})
            const updatedOrder = order[1][0]
            await updateUserCategory(updatedOrder.userId)
            return res.json("Canceled successfully");
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderController()