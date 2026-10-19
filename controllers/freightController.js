const checkout=require('../integrations/carparts/checkout');
const service=require('../integrations/freight/service');
const {profiles}=require('../integrations/freight/profiles');
const {FreightQuote}=require('../models/models');
const {Op}=require('sequelize');
const handle=fn=>async(req,res)=>{
  try {res.json(await fn(req));}
  catch(error) {res.status(error.status || 400).json({message:error.message || 'Freight calculation unavailable'});}
};
module.exports={
  requirements:handle(req=>checkout.withCheckoutLock(req.user.id,async()=>{
    const existing=await checkout.matchingOrder(req.user.id,req.body.products);
    if(existing) return {pendingOrder:checkout.summary(existing.order,existing.payment)};
    return service.requirements(req.body.products);
  })),
  quote:handle(req=>service.createQuote(Number(req.user.id),req.body)),
  profiles:handle(()=>profiles),
  list:handle(async req=>{
    const page=Math.max(1,Math.min(10000,parseInt(req.query.page,10)||1));
    const where={};
    if (['requested','quoted','failed'].includes(req.query.status)) where.status=req.query.status;
    if (/^\d{5}$/.test(req.query.zip || '')) where.request={zip:req.query.zip};
    const result=await FreightQuote.findAndCountAll({where,order:[['createdAt','DESC'],['id','DESC']],limit:25,offset:(page-1)*25});
    return {...result,page};
  }),
};
