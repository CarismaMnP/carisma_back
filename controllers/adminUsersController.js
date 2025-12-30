const ApiError = require('../error/ApiError')
const jwt = require('jsonwebtoken')
const {User, CartProduct, Product} = require('../models/models')

const generateJwt = (id, name, mail, role) => {
    return jwt.sign({id, name, mail, role}, process.env.SECRET_KEY,{expiresIn: '72h'})
}

class UsersController {
    async login(req, res, next) {
        const {mail, password} = req.body
        const user = await User.findOne({where: {mail}})
        if (!user){
            return next(ApiError.internal('Пользователь с таким логином не найден'))
        }
        let comparePassword = user.password === password;
        if (!comparePassword){
            return next(ApiError.internal('Указан неверный пароль'))
        }

        const token = generateJwt(user.id, user.name, user.mail, user.role)
        return res.json({token})
    }
 
    async check(req, res, next) {
        try {
            const user = await User.findOne({where: {id: req.user.id}})
            const token = generateJwt(user.id, user.name, user.mail, user.role)
            return res.json({token})
            
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async fetch(req, res, next) {
        try {
            let {page, limit} = req.query
            page = page || 1
            limit = limit || 20
            let offset = page * limit - limit
            const users = await User.findAndCountAll({
                limit, offset, order: [['name', 'ASC']], 
                include: [{model: CartProduct, required: false, include: [{model: Product, required: false}]}]
            })

            users.rows.forEach(user => {
                if(user.cartProducts && user.cartProducts.length > 0){
                    let cartSum = 0
                    user.cartProducts.forEach((cartProduct) => {
                        cartSum += cartProduct.count * cartProduct.product.price
                    })
                    user.setDataValue('cartSum', cartSum)
                } else {
                    user.setDataValue('cartSum', 0)
                }
            });

            return res.json(users)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new UsersController()