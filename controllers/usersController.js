const ApiError = require('../error/ApiError')
const jwt = require('jsonwebtoken')
const {User, Order, CartProduct, Product, Session} = require('../models/models')
const axios = require("axios");
const Op = require('sequelize').Op;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const generateJwt = (id, name, mail, phone, role) => {
  return jwt.sign({id, name, mail, phone, role}, process.env.SECRET_KEY, {expiresIn: '72h'})
}
const newSMSCode = () => {
  return Math.floor(1000 + Math.random() * 9000)
}

class UsersController {
  async login(req, res, next) {
    try {
      const {phone, session} = req.body

      if (!phoneUtil.isValidNumberForRegion(phoneUtil.parse(phone, 'RU'), 'RU')) {
        return next(ApiError.internal('Неверный формат номера'))
      }
      const code = newSMSCode()

      const [findedUser, created] = await User.findOrCreate({where: {phone}, defaults: {phone, smsCode: code}});

      if (!created && findedUser?.id && findedUser?.phone) {
        findedUser.update({smsCode: code})
      }

      if (code && findedUser?.phone) {
        try {
          const url = process.env.SMS_AERO_URL
          const response = await axios.get(url, {
            params: {
              number: findedUser?.phone,
              text: `Fauno Код подтверждения ${code}`,
              sign: 'SMS Aero',
            },
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${process.env.SMS_AERO_LOGIN}:${process.env.SMS_AERO_TOKEN}`).toString('base64'),
              'Accept': '*/*',
            },
          });
        } catch (e) {
          console.log(e)
          return next(ApiError.internal('Ошибка при отправке SMS с кодом подтверждения, попробуйте позднее'))
        }
      }

      return res.json(phone)

    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async orders(req, res, next) {
    try {
      await User.findByPk(req.user.id)
      const orders = await Order.findAll({where: {userId: req.user.id}})

      return res.json(orders)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async checkLoginSMSCode(req, res, next) {
    const {phone, smsCode, session} = req.body

    try {
      if (!phoneUtil.isValidNumberForRegion(phoneUtil.parse(phone, 'RU'), 'RU')) {
        return next(ApiError.internal('Неверный формат номера'))
      }

      const findedUser = await User.findOne({where: {phone}});

      if (findedUser?.id && findedUser?.phone) {
        if (+findedUser?.smsCode === +smsCode) {
          findedUser.update({smsCode: null})
          const token = generateJwt(findedUser.id, findedUser?.name || '', findedUser?.mail || '', findedUser?.role || '')

          if (session) {
            await CartProduct.update({userId: findedUser.id}, {where: {session, userId: null}})
          }

          return res.json({token, user: findedUser})
        } else {
          next(ApiError.unprocessable('Неверный код'))
        }
      }

      return next(ApiError.internal('Неверные данные пользователя'))
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async session(req, res, next) {
    try {
      const session = await Session.create()
      return res.json(session.id)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async check(req, res, next) {
    try {
      const user = await User.findOne({where: {id: req.user.id}})

      const token = generateJwt(user.id, user.name, user.mail, user.phone, user.role)
      return res.json({token, user})

    } catch (e) {
      return next(ApiError.badRequest(e.message))
    }
  }

  async update(req, res, next) {
    try {
      const {name, phone, mail} = req.body;

      const user = await User.findOne({where: {id: req.user.id}})

      await user.update({name, phone, mail})

      return res.json({user})

    } catch (e) {
      return next(ApiError.badRequest(e.message))
    }
  }

  async fetch(req, res, next) {
    try {
      const {id} = req.params;

      if (id != req.user.id) {
        return next(ApiError.internal(`Ошибка доступа`))
      }

      const user = await User.findByPk(id);

      return res.json(user);

    } catch (e) {
      return next(ApiError.badRequest(e.message))
    }
  }

  async fetchOrders(req, res, next) {
    try {
      const {userId} = req.body;

      if (userId != req.user.id) {
        return next(ApiError.internal(`Ошибка доступа`))
      }

      const orders = await Order.findAll({
        where: {userId},
        include: [{model: Product, required: true}]
      });

      return res.json(orders);
    } catch (e) {
      return next(ApiError.badRequest(e.message))
    }
  }

  async fetchCart(req, res, next) {
    try {
      const {userId, session} = req.query;

      const or = [];
      if (userId) or.push({userId});
      if (session) or.push({session});

      const cartProducts = await CartProduct.findAll({
        where: {[Op.or]: or},
        include: [{model: Product, required: true}],
        order: [["createdAt", "ASC"]]
      });

      return res.json(cartProducts);

    } catch (e) {
      return next(ApiError.badRequest(e.message))
    }
  }

  async plusCart(req, res, next) {
    try {
      const {userId, session, productId, selectorValue} = req.body;

      if (!productId)
        return next(ApiError.badRequest('productId обязателен'));

      if (!userId && !session)
        return next(ApiError.badRequest('Нужен либо userId, либо session'));

      const product = await Product.findByPk(productId);
      if (!product)
        return next(ApiError.internal('Товар не найден'));

      const or = [];
      if (userId) or.push({userId});
      if (session) or.push({session});

      const cartProduct = await CartProduct.findOne({
        where: {
          productId,
          ...(!!selectorValue && {selectorValue}),
          [Op.or]: or
        }
      });

      if (cartProduct) {
        await cartProduct.increment('count');
      } else {
        const createData = {session, productId, count: 1, selectorValue};
        if (userId) createData.userId = userId;
        await CartProduct.create(createData);
      }

      return res.json('success');
    } catch (e) {
      return next(ApiError.badRequest(e.message));
    }
  }

  async minusCart(req, res, next) {
    try {
      const {userId, session, productId, selectorValue} = req.body;

      const product = await Product.findByPk(productId)

      if (!product) {
        return next(ApiError.internal('Товар не найден'))
      }

      const or = [];
      if (userId) or.push({userId});
      if (session) or.push({session});

      const cartProduct = await CartProduct.findOne({
        where: {
          productId,
          ...(!!selectorValue && {selectorValue}),
          [Op.or]: or
        }
      });

      if (!cartProduct) {
        return next(ApiError.internal('Товара нет в корзине'))
      }

      if (cartProduct.count === 1) {
        await cartProduct.destroy();
      } else {
        await cartProduct.decrement('count')
      }

      return res.json("success");
    } catch (e) {
      return next(ApiError.badRequest(e.message))
    }
  }
}

module.exports = new UsersController()