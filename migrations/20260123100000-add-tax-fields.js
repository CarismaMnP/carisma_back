'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'tax', {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('orders', 'total', {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'tax');
    await queryInterface.removeColumn('orders', 'total');
  }
};
