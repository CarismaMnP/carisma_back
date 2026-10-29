const express=require('express');
const upload=require('express-fileupload');
const auth=require('../middleware/authMiddleware');
const {User,ResaleReview}=require('../models/models');
const service=require('../integrations/resale/service');
const {MAX_BYTES}=require('../integrations/resale/documents');
const handle=fn=>async(req,res)=>{try{await fn(req,res)}catch(e){
 const known=e.status; if(!known)console.error('Resale request failed:',e.name);
 res.status(known||500).json({message:known?e.message:'Unable to update resale documents. Please try again.'});
}};
module.exports=({admin=false}={})=>{
 const r=express.Router();
 r.use(auth);
 // The current database role, not a stale JWT claim, authorizes document review.
 r.use(async(req,res,next)=>{try{
  const u=await User.findByPk(req.user.id,{attributes:['id','role']});
  if(!u)return res.status(401).json({message:'Please sign in again'});
  if(admin&&u.role!=='ADMINISTRATOR')return res.status(403).json({message:'Administrator access required'});
  res.set('Cache-Control','private, no-store');next();
 }catch(_){res.status(503).json({message:'Please try again shortly'});}});
 r.get('/',handle(async(req,res)=>res.json(admin?await service.list(req.query):await service.status(req.user.id))));
 r.get('/:id/document',handle(async(req,res)=>{
  const a=await service.download(req.user.id,req.params.id,admin);
  res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; sandbox");
  res.attachment(a.fileName).type(a.mimeType).send(a.documentData);
 }));
 if(admin){
  r.post('/:id/review',handle(async(req,res)=>res.json(await service.review(req.user.id,req.params.id,req.body))));
  r.get('/:id/reviews',handle(async(req,res)=>{
   if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.status(404).json({message:'Application not found'});
   res.json(await ResaleReview.findAll({where:{applicationId:req.params.id},order:[['createdAt','ASC']]}));
  }));
 }else{
  r.post('/',upload({limits:{fileSize:MAX_BYTES+1,files:2,fields:2,parts:5},abortOnLimit:true,
   limitHandler:(_req,res)=>res.status(413).json({message:'Upload one PDF or Word document, up to 10 MB.'})}),
   handle(async(req,res)=>{
    if(Object.keys(req.files||{}).length!==1||Array.isArray(req.files?.document)||!req.files?.document||Object.keys(req.body||{}).some(k=>k!=='companyName'))return res.status(400).json({message:'Upload one certificate document.'});
    res.status(201).json(await service.submit(req.user.id,req.body.companyName,req.files.document));
   }));
 }
 return r;
};
