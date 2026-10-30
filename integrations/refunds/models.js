const {DataTypes}=require('sequelize');
module.exports=sequelize=>({RefundRequest:sequelize.define('refundRequest',{
 id:{type:DataTypes.UUID,primaryKey:true,defaultValue:DataTypes.UUIDV4},
 orderId:{type:DataTypes.UUID,allowNull:false,unique:true},
 userId:{type:DataTypes.INTEGER,allowNull:false},
 reason:{type:DataTypes.TEXT,allowNull:false},
 status:{type:DataTypes.STRING(20),allowNull:false,defaultValue:'pending'},
 reviewComment:{type:DataTypes.TEXT,allowNull:false,defaultValue:''},
 reviewedBy:{type:DataTypes.INTEGER,allowNull:true},
 reviewedAt:DataTypes.DATE,
},{tableName:'refund_requests'})});
