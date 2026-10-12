// One operator-authorized real Checkmate sale without a Stripe charge or customer email.
// Never scheduled. Both backend and Windows must allowlist this exact order/part.
require('../utils/loadEnvironment');
const {sequelize}=require('../db');
const {Order,OrderProduct,Product,User,CarpartsJob}=require('../models/models');
const {Op}=require('sequelize');
const {reserveOrder,confirmPayment}=require('../integrations/carparts/orders');
const {processSales}=require('../integrations/carparts/sales');
async function main() {
 const id=process.env.CARPARTS_TEST_ORDER_ID, productId=Number(process.env.CARPARTS_TEST_PRODUCT_ID);
 if (process.env.CARPARTS_TEST_CONFIRM !== 'NATIVE_SALE_NO_PAYMENT' ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id||'') || !Number.isSafeInteger(productId))
   throw Error('Explicit test confirmation, order UUID and product ID are required');
 let order=await Order.findByPk(id);
 if (!order) {
   const cheapest=await Product.findOne({where:{isDeleted:false,count:{[Op.gt]:0}},order:[['price','ASC'],['id','ASC']]});
   if (cheapest?.id !== productId || cheapest.source !== 'carparts') throw Error('Allowlisted item is no longer the cheapest available website product');
   const [user]=await User.findOrCreate({where:{mail:`website-test-${id}@example.invalid`},defaults:{name:'WEBSITE TEST - DO NOT SHIP'}});
   ({order}=await reserveOrder({userId:user.id,fullName:'WEBSITE TEST - DO NOT SHIP',mail:user.mail,
     phone:'9045550100',delivey_type:'pickup',products:[{productId,count:1}]},{authorizedTestId:id}));
 }
 const items=await OrderProduct.findAll({where:{orderId:id}});
 if (!order.isIntegrationTest || order.paidLive || items.length !== 1 || items[0].productId !== productId)
   throw Error('Existing order identity mismatch');
 if (!order.stockAppliedAt) await confirmPayment(id,{paidLive:false,updates:{tax:0,total:order.sum,
   billingAddress:{line1:'TEST ADDRESS - DO NOT SHIP',city:'Jacksonville',state:'FL',postal_code:'32254',country:'US'}}});
 await processSales({testOrderId:id});
 await order.reload();
 const jobs=await CarpartsJob.findAll({where:{orderId:id},attributes:['state','result','lastError'],raw:true});
 console.log(JSON.stringify({orderId:id,isIntegrationTest:order.isIntegrationTest,paidLive:order.paidLive,
   productId,subtotal:order.sum,tax:order.tax,invoice:order.checkmateInvoice,workOrder:order.checkmateWorkOrder,jobs}));
 if (!order.checkmateInvoice || jobs.some(j=>j.state!=='succeeded')) throw Error('Test is incomplete: inspect this same order; do not create another');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>sequelize.close());
