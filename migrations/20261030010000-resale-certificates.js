'use strict';
module.exports={
 async up(q,S){await q.sequelize.transaction(async transaction=>{
  const o={transaction},id={type:S.UUID,primaryKey:true},date={type:S.DATE,allowNull:false};
  await q.createTable('resale_applications',{
   id,userId:{type:S.INTEGER,allowNull:false,references:{model:'users',key:'id'},onDelete:'RESTRICT'},
   companyName:{type:S.STRING(200),allowNull:false},status:{type:S.STRING(20),allowNull:false,defaultValue:'pending'},
   fileName:{type:S.STRING(200),allowNull:false},mimeType:{type:S.STRING(100),allowNull:false},
   fileSize:{type:S.INTEGER,allowNull:false},sha256:{type:S.STRING(64),allowNull:false},documentData:{type:S.BLOB,allowNull:false},
   reviewComment:S.TEXT,reviewedBy:S.INTEGER,reviewedAt:S.DATE,createdAt:date,updatedAt:date,
  },o);
  await q.addIndex('resale_applications',['userId','createdAt'],o);
  await q.addIndex('resale_applications',['status','createdAt'],o);
  await q.addIndex('resale_applications',['userId'],{...o,unique:true,name:'resale_one_pending_per_user',where:{status:'pending'}});
  await q.addIndex('resale_applications',['userId'],{...o,unique:true,name:'resale_one_approved_per_user',where:{status:'approved'}});
  await q.createTable('resale_reviews',{
   id,applicationId:{type:S.UUID,allowNull:false,references:{model:'resale_applications',key:'id'},onDelete:'RESTRICT'},
   actorId:{type:S.INTEGER,allowNull:false},fromStatus:{type:S.STRING(20),allowNull:false},toStatus:{type:S.STRING(20),allowNull:false},comment:S.TEXT,createdAt:date,
  },o);
  await q.addIndex('resale_reviews',['applicationId','createdAt'],o);
  await q.addColumn('users','resaleTaxExempt',{type:S.BOOLEAN,allowNull:false,defaultValue:false},o);
  await q.addColumn('users','resaleCertificateId',{type:S.UUID},o);
  await q.addColumn('orders','resaleRequested',{type:S.BOOLEAN,allowNull:false,defaultValue:false},o);
  await q.addColumn('orders','resaleTaxExempt',{type:S.BOOLEAN,allowNull:false,defaultValue:false},o);
  await q.addColumn('orders','resaleSnapshot',{type:S.JSONB},o);
 });},
 async down(q){await q.sequelize.transaction(async transaction=>{
  const o={transaction};
  for(const c of ['resaleRequested','resaleTaxExempt','resaleSnapshot'])await q.removeColumn('orders',c,o);
  for(const c of ['resaleTaxExempt','resaleCertificateId'])await q.removeColumn('users',c,o);
  await q.dropTable('resale_reviews',o);await q.dropTable('resale_applications',o);
 });}
};
