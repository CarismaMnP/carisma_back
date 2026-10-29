const {Op}=require('sequelize');
const {sequelize}=require('../../db');
const {User,ResaleApplication:A,ResaleReview:R}=require('../../models/models');
const {validateDocument}=require('./documents');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const validId=id=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id||'');
const publicApplication=a=>a?Object.fromEntries(['id','companyName','status','fileName','fileSize','reviewComment','reviewedAt','createdAt'].map(k=>[k,a[k]])):null;
async function lockedUser(id,transaction){
 const u=await User.findByPk(id,{transaction,lock:transaction.LOCK.UPDATE});
 if(!u)throw fail(401,'Please sign in again');return u;
}
async function activeCertificate(user,transaction){
 return user.resaleTaxExempt&&user.resaleCertificateId?A.findOne({where:{id:user.resaleCertificateId,userId:user.id,status:'approved'},transaction}):null;
}
async function status(userId){
 const user=await User.findByPk(userId);if(!user)throw fail(401,'Please sign in again');
 const [active,rows]=await Promise.all([activeCertificate(user),A.findAll({where:{userId},order:[['createdAt','DESC']],limit:20})]);
 return {approved:!!active,active:publicApplication(active),latest:publicApplication(rows[0]),history:rows.map(publicApplication)};
}
async function transition(a,toStatus,actorId,comment,transaction){
 await R.create({applicationId:a.id,actorId,fromStatus:a.status,toStatus,comment:comment||null},{transaction});
 await a.update({status:toStatus,...(['approved','rejected','revoked'].includes(toStatus)?{reviewComment:comment||null,reviewedBy:actorId,reviewedAt:new Date()}: {})},{transaction});
}
async function submit(userId,companyName,file){
 const document=validateDocument(file);
 if(typeof companyName!=='string'||!companyName.trim()||companyName.trim().length>200)throw fail(400,'Enter your business name (up to 200 characters).');
 await sequelize.transaction(async transaction=>{
  await lockedUser(userId,transaction);
  const recent=await A.count({where:{userId,createdAt:{[Op.gt]:new Date(Date.now()-3600000)}},transaction});
  if(recent>=5)throw fail(429,'Too many uploads. Please try again in an hour.');
  const pending=await A.findAll({where:{userId,status:'pending'},transaction});
  for(const a of pending)await transition(a,'superseded',userId,'Replaced by a new submission',transaction);
  await A.create({userId,companyName:companyName.trim(),...document},{transaction});
 });
 return status(userId);
}
async function review(adminId,id,{decision,comment}){
 if(!validId(id))throw fail(404,'Application not found');
 if(!['approved','rejected','revoked'].includes(decision))throw fail(400,'Invalid review decision');
 if(comment!=null&&typeof comment!=='string')throw fail(400,'Invalid comment');
 comment=(comment||'').trim();
 if(comment.length>2000||(['rejected','revoked'].includes(decision)&&!comment))throw fail(400,'Enter a reason (up to 2,000 characters).');
 const initial=await A.findByPk(id);if(!initial)throw fail(404,'Application not found');
 if(initial.userId===adminId)throw fail(403,'Another administrator must review your own application.');
 await sequelize.transaction(async transaction=>{
  // Upload, review and order creation all lock the owner first.
  const u=await lockedUser(initial.userId,transaction);
  const a=await A.findByPk(id,{transaction,lock:transaction.LOCK.UPDATE});
  if(decision==='revoked'){
   if(a.status!=='approved'||u.resaleCertificateId!==id)throw fail(409,'This approval is no longer current. Refresh the list.');
   await u.update({resaleTaxExempt:false,resaleCertificateId:null},{transaction});
  }else{
   if(a.status!=='pending')throw fail(409,'This application was already reviewed or replaced. Refresh the list.');
   if(decision==='approved'){
    const old=await activeCertificate(u,transaction);
    if(old)await transition(old,'superseded',adminId,'Replaced by a newly approved certificate',transaction);
    await u.update({resaleTaxExempt:true,resaleCertificateId:id},{transaction});
   }
  }
  await transition(a,decision,adminId,comment,transaction);
 });
 return status(initial.userId);
}
async function checkoutSnapshot(data,transaction){
 const requested=data.resaleRequested===true;
 if(data.resaleRequested!==undefined&&typeof data.resaleRequested!=='boolean')throw fail(400,'Invalid resale selection');
 if(!requested)return {resaleRequested:false,resaleTaxExempt:false,resaleSnapshot:null};
 const u=await lockedUser(data.userId,transaction),active=await activeCertificate(u,transaction);
 const document=active||await A.findOne({where:{userId:data.userId,status:'pending'},transaction});
 if(!document)throw fail(400,'Upload your resale certificate before continuing, or uncheck purchase for resale.');
 const exempt=!!active;
 if(typeof data.resaleTaxExemptExpected==='boolean'&&data.resaleTaxExemptExpected!==exempt)
  throw fail(409,'Your resale approval changed. Refresh checkout to review the tax status before paying.');
 return {resaleRequested:true,resaleTaxExempt:exempt,resaleSnapshot:{applicationId:document.id,companyName:document.companyName,sha256:document.sha256,status:document.status,reviewedAt:document.reviewedAt,reviewedBy:document.reviewedBy,capturedAt:new Date().toISOString()}};
}
async function list({page:rawPage,status:state,search}){
 const page=Math.max(1,Math.min(10000,parseInt(rawPage,10)||1)),where={};
 if(state&&['pending','approved','rejected','revoked','superseded'].includes(state))where.status=state;
 const term=String(search||'').trim().slice(0,200);
 if(term){const like=`%${term.replace(/[\\%_]/g,'\\$&')}%`;where[Op.or]=[{companyName:{[Op.iLike]:like}},{'$user.mail$':{[Op.iLike]:like}},{'$user.name$':{[Op.iLike]:like}}];}
 const {rows,count}=await A.findAndCountAll({where,include:[{model:User,attributes:['id','name','mail','resaleTaxExempt','resaleCertificateId']}],order:[['createdAt','DESC'],['id','DESC']],limit:25,offset:(page-1)*25});
 return {rows,count,page};
}
async function download(userId,id,admin){
 if(!validId(id))throw fail(404,'Document not found');
 const a=await A.unscoped().findOne({where:{id,...(admin?{}:{userId})},attributes:['documentData','mimeType','fileName']});
 if(!a)throw fail(404,'Document not found');return a;
}
module.exports={status,submit,review,checkoutSnapshot,list,download};
