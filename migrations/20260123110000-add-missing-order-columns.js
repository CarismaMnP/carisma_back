'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('orders');

    // Добавляем только те колонки, которых нет
    if (!tableDescription.fullName) {
      await queryInterface.addColumn('orders', 'fullName', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.mail) {
      await queryInterface.addColumn('orders', 'mail', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.delivey_type) {
      await queryInterface.addColumn('orders', 'delivey_type', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.country) {
      await queryInterface.addColumn('orders', 'country', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.zip_code) {
      await queryInterface.addColumn('orders', 'zip_code', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.addressState) {
      await queryInterface.addColumn('orders', 'addressState', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.address_line_1) {
      await queryInterface.addColumn('orders', 'address_line_1', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.address_line_2) {
      await queryInterface.addColumn('orders', 'address_line_2', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.delivery_instructions) {
      await queryInterface.addColumn('orders', 'delivery_instructions', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.stripePaymentIntentId) {
      await queryInterface.addColumn('orders', 'stripePaymentIntentId', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'fullName');
    await queryInterface.removeColumn('orders', 'mail');
    await queryInterface.removeColumn('orders', 'delivey_type');
    await queryInterface.removeColumn('orders', 'country');
    await queryInterface.removeColumn('orders', 'zip_code');
    await queryInterface.removeColumn('orders', 'addressState');
    await queryInterface.removeColumn('orders', 'address_line_1');
    await queryInterface.removeColumn('orders', 'address_line_2');
    await queryInterface.removeColumn('orders', 'delivery_instructions');
    await queryInterface.removeColumn('orders', 'stripePaymentIntentId');
  }
};
