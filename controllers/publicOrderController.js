const ApiError = require('../error/ApiError')
const {Product, Order, User, OrderProduct} = require('../models/models');
const { Op } = require('sequelize');
const { createCheckoutSession } = require('../utils/stripe');
class OrderController {
    async create (req, res, next) {
        try {
            const {
                userId, products,
                fullName, mail, phone,
                delivey_type, country, city, zip_code, state: addressState, address_line_1, address_line_2,
                delivery_instructions
            } = req.body;

            if (!userId || !fullName || !phone || !mail || !products?.length){
                return res.status(500).json({ error: 'Please, fill order form' });
            }
            
            const user = await User.findByPk(userId)
            
            if (!user){
                return res.status(500).json({ error: 'User not found. Please authorize' });
            }
            if (delivey_type === "ups" && (!zip_code || !addressState || !address_line_1)){
                return res.status(500).json({ error: 'Please, fill delivery form' });
            }

            const dbProds = await Product.findAll({ where: { id: {[Op.in]: products.map(p=>p.productId)} } });
            
            let sum = 0;
            let weight = 0;
            products.forEach(({productId, count}) => {
                const prod = dbProds.find(p=>p.id===productId);
                sum += prod.price * count;
                weight += prod.weight * count;
            });

            // Prepare line items for Stripe checkout
            const lineItems = products.map(({ productId, count }) => {
                const prod = dbProds.find(p => p.id === productId);
                return {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: prod.name,
                            description: prod.description || '',
                        },
                        unit_amount: Math.round(prod.price * 100), // Convert to cents
                    },
                    quantity: count,
                };
            });

            const order = await Order.create({
                userId,
                state: 'pending',
                sum,
                fullName,
                mail,
                phone,
                delivey_type,
                country,
                city,
                zip_code,
                state: addressState,
                address_line_1,
                address_line_2,
                delivery_instructions
            });

            await OrderProduct.bulkCreate(
                products.map(p=>({ orderId: order.id, productId: p.productId, count: p.count, selectorValue: p.selectorValue }))
            );

            // Create Stripe checkout session
            const stripeSession = await createCheckoutSession({
                orderId: order.id,
                amount: sum,
                customerEmail: mail,
                lineItems: lineItems,
            });

            // Update order with Stripe payment intent ID
            await order.update({
                stripePaymentIntentId: stripeSession.sessionId
            });

            return res.status(200).json({
                invoiceId: order.id,
                amount: sum,
                currency: 'USD',
                paymentUrl: stripeSession.url,
                stripeSessionId: stripeSession.sessionId
            });
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderController()
