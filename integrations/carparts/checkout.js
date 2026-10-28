const {Op} = require('sequelize');
const {sequelize} = require('../../db');
const {Order, OrderProduct, Product} = require('../../models/models');
const {stripe} = require('../../utils/stripe');
const {orderItems, releaseReservation} = require('./orders');
const unpaidStates = ['pending', 'processing'];
const fail = (status, message) => Object.assign(new Error(message), {status});
const expiresAt = o => o.checkoutExpiresAt || (o.reservationExpiresAt ? new Date(new Date(o.reservationExpiresAt).getTime()-5*60000) : null);
const reserved = o => !!o.stockReservedAt && !o.stockAppliedAt && !o.stockReleasedAt && unpaidStates.includes(o.state);
const sameItems = (a,b) => JSON.stringify(orderItems(a)) === JSON.stringify(orderItems(b));
// Serialize a customer's create/resume/cancel calls across API processes.
// Inventory retains the existing transaction and product row locks.
async function withCheckoutLock(userId, action) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId)<1) throw fail(401,'Please sign in');
  return sequelize.transaction(async transaction=>{
    const [[lock]]=await sequelize.query('SELECT pg_try_advisory_xact_lock(9032021, :userId) AS acquired',{replacements:{userId:Number(userId)},transaction});
    if (!lock.acquired) throw fail(409,'Your checkout is being updated. Please try again in a moment.');
    return action();
  });
}
async function ownedOrder(userId,id) {
  if (!/^[0-9a-f-]{36}$/i.test(id||'')) throw fail(404,'Order not found');
  const order=await Order.findOne({where:{id,userId}});
  if (!order) throw fail(404,'Order not found');
  return order;
}
async function inspectPayment(order) {
  if (!reserved(order)) return {state:'unavailable'};
  if (!order.checkoutSessionId) return {state:'preparing'};
  let session;
  try {session=await stripe.checkout.sessions.retrieve(order.checkoutSessionId);}
  catch (_) {throw fail(503,'Payment status is temporarily unavailable. Please try again; your reservation is safe.');}
  if (session.id!==order.checkoutSessionId || session.metadata?.orderId!==order.id || session.mode!=='payment')
    throw fail(409,'Payment details need review. Please contact us.');
  if (session.payment_status==='paid' || session.status==='complete') return {state:'processing'};
  if (session.status==='expired') {
    await releaseReservation(order.id,'expired');await order.reload();return {state:'expired'};
  }
  if (session.status!=='open' || session.payment_status!=='unpaid' || session.expires_at*1000<=Date.now()) return {state:'processing'};
  let url;
  try {url=new URL(session.url);} catch (_) {throw fail(503,'The payment link is temporarily unavailable.');}
  if (url.protocol!=='https:' || url.hostname!=='checkout.stripe.com' || url.username || url.password)
    throw fail(503,'The payment link is temporarily unavailable.');
  const expiry=new Date(session.expires_at*1000);
  if (!order.checkoutExpiresAt || new Date(order.checkoutExpiresAt).getTime()!==expiry.getTime()) await order.update({checkoutExpiresAt:expiry});
  return {state:'open',url:url.href,expiresAt:expiry};
}
async function matchingOrder(userId,products) {
  const items=orderItems(products);
  const candidates=await Order.findAll({where:{userId,state:{[Op.in]:unpaidStates},stockReservedAt:{[Op.ne]:null},stockAppliedAt:null,stockReleasedAt:null},
    include:[{model:OrderProduct}],order:[['createdAt','DESC']]});
  for (const order of candidates) {
    if (!sameItems(items,order.orderProducts.map(x=>({productId:x.productId,count:x.count})))) continue;
    const payment=await inspectPayment(order);
    if (['expired','unavailable'].includes(payment.state)) continue;
    return {order,payment};
  }
  return null;
}
function summary(order,payment) {
  const p=order.get?order.get({plain:true}):order,expiry=payment?.expiresAt||expiresAt(order);
  const canResume=payment?payment.state==='open':reserved(order)&&!!order.checkoutSessionId&&Date.parse(expiry)>Date.now();
  return {id:p.id,state:p.state,createdAt:p.createdAt,paidAt:p.paidAt,
    promoCode:p.promoCode||null,discountCents:p.discountCents||0,
    subtotalCents:Math.round(Number(p.sum)*100),shippingCents:Math.round(Number(p.shippingAmount||0)*100),taxCents:Math.round(Number(p.tax||0)*100),
    totalCents:p.stockAppliedAt||p.paidAt?Math.round(Number(p.total||(Number(p.sum)+Number(p.shippingAmount||0)+Number(p.tax||0)))*100):null,
    deliveryType:p.delivey_type,shippingAddress:p.freightAddress||p.shippingAddress,carrier:[p.freightSnapshot?.result?.selected?.carrier,p.parcelSnapshot?.result?.selected?.serviceName].filter(Boolean).join(' + ')||null,
    canResume,canCancel:reserved(order)&&!!order.checkoutSessionId&&(!payment||payment.state==='open'),paymentState:payment?.state||(canResume?'open':reserved(order)?'pending':'closed'),paymentExpiresAt:expiry,
    items:(p.orderProducts||[]).map(x=>({productId:x.productId,count:x.count,name:x.productSnapshot?.name||x.product?.name||'Part',
      discountCents:x.discountCents||0,unitPriceCents:x.unitPriceCents??Math.round(Number(x.product?.price||0)*100),link:x.product?.link||null,image:x.product?.images?.[0]||null}))};
}
async function resume(userId,id) {
  const order=await ownedOrder(userId,id),payment=await inspectPayment(order);
  if (payment.state!=='open') throw fail(409,payment.state==='expired'?'This payment session has expired. Start a new checkout.':payment.state==='preparing'?'Your payment session is being prepared. Please try again shortly.':'This order cannot be paid again. Refresh your order history.');
  return {invoiceId:order.id,paymentUrl:payment.url,paymentExpiresAt:payment.expiresAt,reused:true};
}
async function cancel(userId,id) {
  const order=await ownedOrder(userId,id),payment=await inspectPayment(order);
  if (payment.state==='expired'||order.stockReleasedAt) return {id:order.id,state:order.state};
  if (payment.state!=='open') throw fail(409,'Only an unpaid, open checkout can be canceled. Refresh payment status.');
  let session;
  try {session=await stripe.checkout.sessions.expire(order.checkoutSessionId);}
  catch (_) {throw fail(409,'Payment status changed. Refresh your order history before trying again.');}
  if (session.status!=='expired'||session.payment_status==='paid') throw fail(409,'Payment is already processing and cannot be canceled here.');
  await releaseReservation(order.id,'canceled');return {id:order.id,state:'canceled'};
}
async function history(userId,rawPage) {
  const page=Math.max(1,Math.min(10000,parseInt(rawPage,10)||1)),limit=10;
  const {count,rows}=await Order.findAndCountAll({where:{userId,isIntegrationTest:false},distinct:true,
    include:[{model:OrderProduct,include:[{model:Product,attributes:['name','link','images','price']}]}],
    order:[['createdAt','DESC'],['id','DESC']],limit,offset:(page-1)*limit});
  return {rows:rows.map(x=>summary(x)),count,page};
}
module.exports={withCheckoutLock,ownedOrder,inspectPayment,matchingOrder,summary,resume,cancel,history,sameItems};
