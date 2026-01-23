const { DataTypes } = require('sequelize');
'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('order');
    await queryInterface.createTable('order', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      state: { type: DataTypes.STRING, allowNull: false },
      sum: { type: DataTypes.FLOAT, allowNull: false },
      fullName: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      mail: { type: DataTypes.STRING, allowNull: true },
      delivey_type: { type: DataTypes.STRING, allowNull: true },
      country: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      zip_code: { type: DataTypes.STRING, allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },
      address_line_1: { type: DataTypes.STRING, allowNull: true },
      address_line_2: { type: DataTypes.STRING, allowNull: true },
      delivery_instructions: { type: DataTypes.STRING, allowNull: true },
      stripePaymentIntentId: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface, Sequelize) {
    // await queryInterface.dropTable('Users');
  }
};