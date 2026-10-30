'use strict';
module.exports={
 async up(q,S){await q.sequelize.transaction(async transaction=>{
  await q.addColumn('orders','stripeRefundedCents',{type:S.INTEGER,allowNull:false,defaultValue:0},{transaction});
  await q.addColumn('orders','stripeRefundUpdatedAt',{type:S.DATE,allowNull:true},{transaction});
  await q.createTable('refund_requests',{
   id:{type:S.UUID,primaryKey:true,allowNull:false},
   orderId:{type:S.UUID,allowNull:false,unique:true,references:{model:'orders',key:'id'},onDelete:'CASCADE'},
   userId:{type:S.INTEGER,allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},
   reason:{type:S.TEXT,allowNull:false},status:{type:S.STRING(20),allowNull:false,defaultValue:'pending'},
   reviewComment:{type:S.TEXT,allowNull:false,defaultValue:''},reviewedBy:{type:S.INTEGER,allowNull:true},reviewedAt:S.DATE,
   createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false},
  },{transaction});
  await q.sequelize.query(`ALTER TABLE refund_requests ADD CONSTRAINT refund_request_status CHECK (status IN ('pending','approved','rejected'))`,{transaction});
  await q.addIndex('refund_requests',['status','createdAt'],{name:'refund_requests_status_created',transaction});
 });},
 async down(q){await q.sequelize.transaction(async transaction=>{await q.dropTable('refund_requests',{transaction});await q.removeColumn('orders','stripeRefundedCents',{transaction});await q.removeColumn('orders','stripeRefundUpdatedAt',{transaction});});}
};
