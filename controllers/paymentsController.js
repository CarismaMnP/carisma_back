const ApiError = require('../error/ApiError')
const {Product, Order, User, OrderProduct, CartProduct} = require('../models/models');
const { ClientService, ResponseCodes, ReceiptTypes, VAT, TaxationSystem } = require('cloudpayments'); 

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