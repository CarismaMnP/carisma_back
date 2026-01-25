'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'make', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Set default make = 'BMW' for all existing products
    await queryInterface.sequelize.query(
      `UPDATE products SET make = 'BAVARIAN MOTOR WORKS (BMW)' WHERE make IS NULL`
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'make');
  }
};
