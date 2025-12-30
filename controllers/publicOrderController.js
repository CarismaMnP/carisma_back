const ApiError = require('../error/ApiError')
const {Product, Order, User, OrderProduct} = require('../models/models');
const { Op } = require('sequelize');
const CDEK = require('../utils/cdek');
const BOXBERRY = require('../utils/boxberry');


class OrderController {
    async create (req, res, next) {
        try {
            const {
                userId, phone, products, name, mail, city,
                cityId, selectedDelivery, officeName, officeId,
                address, flat, building, floor, intercom, comment,
                boxberryCityId, boxberryOfficeId, boxberryOfficeName
            } = req.body;

            if (!userId || !name || !phone || !mail || !products?.length){
                return res.status(500).json({ error: 'Недостаточно данных' });
            }
            
            const user = await User.findByPk(userId)
            
            if (!user){
                return res.status(500).json({ error: 'Пользователь не найден' });
            }

            const dbProds = await Product.findAll({ where: { id: {[Op.in]: products.map(p=>p.productId)} } });
            
            let sum = 0;
            let weight = 0;
            products.forEach(({productId, count}) => {
                const prod = dbProds.find(p=>p.id===productId);
                sum += prod.price * count;
                weight += prod.weight * count;
            });

            if(user.discount && user.discount > 0){
                sum = sum * (1 - user.discount / 100)
            }

            if(selectedDelivery.price){
                sum += selectedDelivery.price
            }

            const existingOrder = await Order.findOne({where: {state: "pending", userId}})
            if(existingOrder){
                await OrderProduct.destroy({where: {orderId: existingOrder.id}})
                await Order.destroy({where: {id: existingOrder.id}})
            }

            let type = "fauno"
            if(selectedDelivery.cdekId){
                type = "cdek"
            }
            if(selectedDelivery.boxberryOfficeRequired){
                type = "boxberry"
            }

            let deliveryName = ""
            let deliveryPrice = undefined
            let deliveryCdekId = undefined

            if(selectedDelivery.name){
                deliveryName = selectedDelivery.name
            }
            if(selectedDelivery.price){
                deliveryPrice = selectedDelivery.price
            }
            if(selectedDelivery.cdekId){
                deliveryCdekId = selectedDelivery.cdekId
            }


            const order = await Order.create({
                userId, state: 'pending', sum, name, phone, mail,
                address, flat, building, floor, intercom, comment,
                city, deliveryName, deliveryPrice,
                
                cdekCityId: cityId, 
                officeName, 
                cdekOfficeId: 
                officeId, type,
                deliveryCdekId,

                boxberryCityId,
                boxberryOfficeId,
                boxberryOfficeName,
            });


            await OrderProduct.bulkCreate(
                products.map(p=>({ orderId: order.id, productId: p.productId, count: p.count, selectorValue: p.selectorValue }))
            );

            return res.status(200).json({
                invoiceId: order.id,
                amount: sum,
                currency: 'RUB'
            });
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async city (req, res, next) {
        try {
            const {name} = req.query;

            const data = await CDEK.suggestCities(name);

            return res.json(data);
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async office (req, res, next) {
        try {
            const {cityCode, cityName} = req.query;

            const offecies = await CDEK.getOffice(cityCode);
            const boxberryCityId = await BOXBERRY.getCity(cityName)
            let boxberryOffices = []
            if(boxberryCityId){
                boxberryOffices = await BOXBERRY.getOffice(boxberryCityId);
            }

            return res.json({offecies, boxberryCityId, boxberryOffices});
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async tariffs (req, res, next) {
        try {
            const {cityCode, boxberryCityId, weight} = req.query;

            const data = await CDEK.getTariffs(cityCode, weight);
            const bdata = await BOXBERRY.getTariffs(boxberryCityId, weight)

            const { tariff_codes = [] } = data;

            const options = [];

            if(tariff_codes && tariff_codes.length > 0){
                const byType = code =>
                tariff_codes
                .filter(t => t.tariff_name.includes(code) && !t.tariff_name.includes('маркетплейс'))
                .sort((a, b) => a.delivery_sum - b.delivery_sum);

                const door = byType('склад-дверь')[0];
                const pvz = byType('склад-склад')[0];

                if (door) options.push({ name: 'CDEK до двери', days: door.period_min, price: door.delivery_sum, cdekId: door.tariff_code, addressRequired: true, cdekOfficeRequired: false, boxberryOfficeRequired: false });
                if (pvz) options.push({ name: 'CDEK до пункта выдачи', days: pvz.period_min, price: pvz.delivery_sum, cdekId: pvz.tariff_code, addressRequired: false, cdekOfficeRequired: true, boxberryOfficeRequired: false });
            }
            
            for (let tariff of bdata){
                options.push({ name: 'Boxberry до пункта выдачи', days: tariff.DeliveryPeriod, price: tariff.TotalPrice, cdekId: undefined, addressRequired: false, cdekOfficeRequired: false, boxberryOfficeRequired: true })
            }

            return res.json(options);
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderController()