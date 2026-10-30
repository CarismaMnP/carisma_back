'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn('users', 'purchasingAs', {type:Sequelize.STRING(20),allowNull:true}, {transaction});
      await queryInterface.sequelize.query(`ALTER TABLE users ADD CONSTRAINT users_purchasing_as_check CHECK ("purchasingAs" IN ('Residential', 'Assurance', 'Dealership'))`, {transaction});
      await queryInterface.addIndex('users', ['purchasingAs'], {name:'users_purchasing_as',transaction});
    });
  },
  async down(queryInterface) {await queryInterface.removeColumn('users','purchasingAs');},
};
