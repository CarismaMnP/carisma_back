// Packed measurements are owned by the website, never overwritten by inventory sync.
function validatePackage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Enter the packed weight and all three dimensions');
  const out={};
  for (const key of ['weightLb','lengthIn','widthIn','heightIn']) {
    const n=Number(input[key]);
    if (!Number.isFinite(n) || n<=0 || n>10000) throw Error('Package measurements must be positive numbers');
    out[key]=key==='weightLb'?Math.ceil(n*100)/100:Math.ceil(n);
  }
  const [length,width,height]=[out.lengthIn,out.widthIn,out.heightIn].sort((a,b)=>b-a);
  if(out.weightLb>150 || length>108 || length+2*(width+height)>165)
    throw Error('This package exceeds FedEx parcel limits. Use a freight profile instead.');
  return out;
}
function productPackage(product) {try{return validatePackage(product.parcelPackage);}catch(_){return null;}}
async function save(productId,input) {
  if(!Number.isSafeInteger(Number(productId)) || Number(productId)<=0)throw Error('Invalid product');
  const {Product}=require('../../models/models');
  const p=await Product.findByPk(productId);
  if(!p || p.source==='legacy')throw Error('Product is unavailable');
  const parcelPackage=input===null?null:validatePackage(input);
  await p.update({parcelPackage});
  return {id:p.id,parcelPackage};
}
module.exports={validatePackage,productPackage,save};
