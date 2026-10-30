const {sequelize}=require('../../db');
const {Order,OrderProduct,Product,User,RefundRequest}=require('../../models/models');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const isUuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
const uuid=id=>{if(!isUuid(id))throw fail(404,'Order or request not found');return id;};
const eligible=order=>['delivered','completed'].includes(order.state)&&!order.isIntegrationTest;
function customerView(request){if(!request)return null;return {id:request.id,status:request.status,reason:request.reason,reviewComment:request.reviewComment,createdAt:request.createdAt,reviewedAt:request.reviewedAt};}
async function submit(userId,orderId,body){
 uuid(orderId);
 const reason=typeof body.reason==='string'?body.reason.trim():'';
 if(reason.length<5||reason.length>2000)throw fail(400,'Please describe the reason for your return (5–2,000 characters).');
 return sequelize.transaction(async transaction=>{
  const order=await Order.findOne({where:{id:orderId,userId},transaction,lock:transaction.LOCK.UPDATE});
  if(!order)throw fail(404,'Order not found');
  const existing=await RefundRequest.findOne({where:{orderId},transaction});
  if(existing)return {request:customerView(existing),existing:true};
  if(!eligible(order))throw fail(409,'Returns can be requested after your order is delivered or pickup is completed.');
  const request=await RefundRequest.create({orderId,userId,reason},{transaction});
  return {request:customerView(request),existing:false};
 });
}
async function review(adminId,id,body){
 uuid(id);const {decision}=body,comment=typeof body.comment==='string'?body.comment.trim():'';
 if(!['approved','rejected'].includes(decision)||comment.length>2000)throw fail(400,'Invalid review decision');
 if(decision==='rejected'&&!comment)throw fail(400,'Add a reason for the customer.');
 if(decision==='approved'&&body.confirmManualRefund!==true)throw fail(400,'Confirm that payment is refunded manually in Stripe.');
 const reference=await RefundRequest.findByPk(id,{attributes:['orderId']});if(!reference)throw fail(404,'Request not found');
 return sequelize.transaction(async transaction=>{
  // Always lock the order first, shared by submission, payment and refund callbacks.
  const order=await Order.findByPk(reference.orderId,{transaction,lock:transaction.LOCK.UPDATE});
  const request=await RefundRequest.findByPk(id,{transaction,lock:transaction.LOCK.UPDATE});
  if(!order||!request)throw fail(404,'Request not found');
  if(request.status===decision)return {request:customerView(request),orderState:order.state,alreadyReviewed:true};
  if(request.status!=='pending')throw fail(409,'This request has already been reviewed. Refresh the list.');
  if(decision==='approved'&&!['delivered','completed','refunded'].includes(order.state))throw fail(409,'The order status changed. Review the order before approving the return.');
  await request.update({status:decision,reviewComment:comment,reviewedBy:adminId,reviewedAt:new Date()},{transaction});
  if(decision==='approved'&&order.state!=='refunded')await order.update({state:'refunded'},{transaction});
  return {request:customerView(request),orderState:order.state};
 });
}
async function list(input={}){
 const page=Math.max(1,Math.min(100000,parseInt(input.page,10)||1)),where={};
 if(input.status){if(!['pending','approved','rejected'].includes(input.status))throw fail(400,'Invalid status');where.status=input.status;}
 if(input.orderId)where.orderId=uuid(input.orderId);
 return RefundRequest.findAndCountAll({where,distinct:true,limit:25,offset:(page-1)*25,order:[['createdAt','DESC'],['id','DESC']],include:[
  {model:User,attributes:['id','name','mail','phone']},
  {model:Order,attributes:['id','state','sum','tax','total','shippingAmount','stripePaymentIntentId','stripeRefundedCents','stripeRefundUpdatedAt','delivey_type','fullName','mail','phone','createdAt'],include:[{model:OrderProduct,attributes:['id','productId','count','unitPriceCents','discountCents','productSnapshot'],include:[{model:Product,attributes:['id','name','link','images']}]}]},
 ]});
}
async function chargeRefunded(charge,eventCreated){
 const paymentIntentId=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
 if(!paymentIntentId)return;
 const amount=charge.amount_refunded,paid=charge.amount_captured||charge.amount;
 if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(paid)||paid<=0||amount>paid||charge.currency!=='usd')throw fail(400,'Invalid Stripe refund amount');
 return sequelize.transaction(async transaction=>{
  let order=await Order.findOne({where:{stripePaymentIntentId:paymentIntentId},transaction,lock:transaction.LOCK.UPDATE});
  // PaymentIntent metadata is copied to the charge. Covers a refund arriving
  // before the first payment callback, when the order has no PaymentIntent yet.
  if(!order&&isUuid(charge.metadata?.orderId)){
   order=await Order.findByPk(charge.metadata.orderId,{transaction,lock:transaction.LOCK.UPDATE});
   if(order?.stripePaymentIntentId&&order.stripePaymentIntentId!==paymentIntentId)return;
  }
  if(!order||order.isIntegrationTest&&charge.livemode===true)return;
  if(charge.livemode===false&&order.paidLive)return;
  const previous=order.stripeRefundedCents||0;
  const full=charge.refunded===true||amount===paid;
  const updates={};
  if(amount>previous){updates.stripeRefundedCents=amount;updates.stripeRefundUpdatedAt=eventCreated?new Date(eventCreated*1000):new Date();}
  if(full&&order.state!=='refunded')updates.state='refunded';
  if(!order.stripePaymentIntentId)updates.stripePaymentIntentId=paymentIntentId;
  if(Object.keys(updates).length)await order.update(updates,{transaction});
  // No inventory restoration, new sale jobs, emails or Stripe refund API calls.
  return order;
 });
}
module.exports={submit,review,list,eligible,customerView,chargeRefunded};
