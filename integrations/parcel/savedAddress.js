const {Op}=require('sequelize');
const {Order}=require('../../models/models');
const {shippingAddress}=require('../freight/service');

// Orders already persist validated delivery details. Reuse those for this owner,
// including older orders, without copying quotes or a different customer's data.
async function savedAddress(userId) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId)<=0) throw Error('Invalid customer');
  const orders=await Order.findAll({where:{userId:Number(userId),isIntegrationTest:false,
    delivey_type:{[Op.in]:['ups','freight','delivery','fedex']}},
    attributes:['shippingAddress','freightAddress','country','city','zip_code','addressState','address_line_1','address_line_2','freightSnapshot'],
    order:[['createdAt','DESC'],['id','DESC']],limit:100});
  for (const order of orders) {
    const candidates=[order.shippingAddress,order.freightAddress,{country:order.country,city:order.city,
      postal_code:order.zip_code,state:order.addressState,line1:order.address_line_1,line2:order.address_line_2}];
    for (const candidate of candidates) {
      try {
        const address=shippingAddress(candidate,String(candidate?.postal_code || '').slice(0,5));
        return {address:{...address,postal_code:address.postal_code.slice(0,5)},
          limitedAccess:order.freightSnapshot?.request?.limitedAccess===true};
      } catch (_) { /* Incomplete legacy addresses cannot prefill checkout. */ }
    }
  }
  return {address:null,limitedAccess:false};
}
module.exports={savedAddress};
