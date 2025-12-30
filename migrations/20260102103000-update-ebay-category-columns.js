'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('products', 'ebayCategoryPath', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('products', 'ebayCategory', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'ebayCategory');
    await queryInterface.changeColumn('products', 'ebayCategoryPath', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
