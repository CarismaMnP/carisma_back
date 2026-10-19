module.exports={
  async up(q,S){
    await q.addColumn('orders','checkoutExpiresAt',{type:S.DATE,allowNull:true});
    await q.sequelize.query(`UPDATE orders SET "checkoutExpiresAt" = "reservationExpiresAt" - interval '5 minutes' WHERE "checkoutSessionId" IS NOT NULL AND "reservationExpiresAt" IS NOT NULL`);
  },
  async down(q){await q.removeColumn('orders','checkoutExpiresAt');}
};
