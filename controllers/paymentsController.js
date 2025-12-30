const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Order, User, OrderProduct, CartProduct} = require('../models/models');
const updateUserCategory = require('../utils/updateUserCategory');
const { Op } = require('sequelize');
const { ClientService, ResponseCodes, ReceiptTypes, VAT, TaxationSystem } = require('cloudpayments'); 
const CDEK = require('../utils/cdek');

class OrderController {
    async check (req, res, next) {
        try {
            console.log("check request")
            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });

            const handlers = client.getNotificationHandlers();
            const receiptApi = client.getReceiptApi();

            let response;

            response = await handlers.handleCheckRequest(req, async (request) => {
                const order = await Order.findByPk(request.InvoiceId, {include: [{model: OrderProduct, required: true, include: [{model: Product}]}]});
                if (!order) {
                return ResponseCodes.FAIL;
                }

                const user = await User.findByPk(order.userId)

                let discount = 1

                if(user.discount && user.discount > 0){
                    discount = (1 - user.discount / 100)
                }

                if (Number(request.Amount) !== Number(order.sum)) {
                return ResponseCodes.FAIL;
                }

                const receiptOptions = {
                        inn: 502919589904,
                        email: order.mail,
                        phone: order.phone,
                        taxationSystem: TaxationSystem.GENERAL,
                        Items: order.orderProducts.map((op) => {
                            return({
                                label: op.product.name,
                                quantity: op.count,
                                price: op.product.price * discount,
                                amount: op.product.price * discount * op.count,
                                vat: 5,
                            })
                        })
                }

                console.log(receiptOptions)

                const response = await receiptApi.createReceipt(
                    { 
                        Type: ReceiptTypes.Income,
                        invoiceId: request.InvoiceId,
                        accountId: request.AccountId,
                        Inn: 502919589904,
                    },
                    receiptOptions
                );

                
                console.log("Check SUCCESS")
                return ResponseCodes.SUCCESS;
            });

            console.log("Payment checked")
            console.log(response)
            
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(response.response));

        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message));
        }
    }
    
    async pay (req, res, next) {
        try {
            console.log("pay request")

            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });

            const handlers = client.getNotificationHandlers();

            const response = await handlers.handlePayRequest(req, async (request) => {
                const order = await Order.findByPk(request.InvoiceId);
                if (!order) return ResponseCodes.FAIL;

                if (order.state === 'paid') {
                    await CDEK.createCDEKOrder(order.id)
                    return ResponseCodes.SUCCESS;
                }

                await Order.update({ state: 'paid' }, {where: {id: order.id}});
                await CartProduct.destroy({where: {userId: order.userId}})

                await updateUserCategory(order.userId)
                await CDEK.createCDEKOrder(order.id)

                return ResponseCodes.SUCCESS;
            });

            console.log("Payment checked")

            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(response.response));

        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message));
        }
    }
    
    async confirm (req, res, next) {
        try {
            console.log("pay confirm")

            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });

            const handlers = client.getNotificationHandlers();

            const response = await handlers.handleConfirmRequest(req, async (request) => {
                const order = await Order.findByPk(request.InvoiceId);
                if (!order) return ResponseCodes.FAIL;

                if (order.state === 'paid') {
                await CDEK.createCDEKOrder(order.id)
                return ResponseCodes.SUCCESS;
                }

                await Order.update({ state: 'paid' }, {where: {id: order.id}});
                await CartProduct.destroy({where: {userId: order.userId}})

                await updateUserCategory(order.userId)
                await CDEK.createCDEKOrder(order.id)
                
                return ResponseCodes.SUCCESS;
            });

            console.log("Payment checked")
            return res.json(response);

        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message));
        }
    }
    
    async receipt (req, res, next) {
        try {
            console.log("receipt query")

            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });

            const handlers = client.getNotificationHandlers();

            const response = await handlers.handleReceiptRequest(req, async (request) => {
                const order = await Order.findByPk(request.InvoiceId);
                if (!order) return ResponseCodes.FAIL;
                return ResponseCodes.SUCCESS;
            });

            console.log("Payment checked")
            console.log(response)
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(response.response));

        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message)); 
        }
    }
}

module.exports = new OrderController()