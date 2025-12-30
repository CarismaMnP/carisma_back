const { Order, User } = require("../models/models");
const Op = require('sequelize').Op;

const updateUserCategory = async (userId) => {
    const orders = Order.findAll({ where: { userId, state: {[Op.notIn]: ["pending", "canceled"]} } });

    let total = 0
    if (orders && orders.length > 0) {
        total = array.reduce((accum,item) => accum + item.sum, 0)
    }
    
    let category = "Basic"
    let discount = 0

    if (total >= 15000) {
        category = "Silver"
        discount = 2
    } else if (total >= 30000) {
        category = "Gold"
        discount = 5
    } else if (total >= 50000) {
        category = "Platinum"
        discount = 7
    } else if (total >= 100000) {
        category = "Private customer"
        discount = 10
    }
    
    await User.update({category, discount, total}, {where: {id: userId}})
  };
  
  module.exports = updateUserCategory;
  