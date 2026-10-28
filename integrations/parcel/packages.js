// Owner-approved default for one ordinary part. Keep metric units exact in the
// carrier request; converting to whole inches would inflate these dimensions.
const DEFAULT_PACKAGE=Object.freeze({weightKg:7,lengthCm:40,widthCm:30,heightCm:20});
// Explicit packed measurements are owned by the website, never overwritten by inventory sync.
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
function productPackage(product) {
  if(product?.parcelPackage==null)return {...DEFAULT_PACKAGE};
  // An invalid explicit override must be corrected, not hidden by the default.
  try{return validatePackage(product.parcelPackage);}catch(_){return null;}
}
async function save(productId,input) {
  if(!Number.isSafeInteger(Number(productId)) || Number(productId)<=0)throw Error('Invalid product');
  const {Product}=require('../../models/models');
  const p=await Product.findByPk(productId);
  if(!p || p.source==='legacy')throw Error('Product is unavailable');
  const parcelPackage=input===null?null:validatePackage(input);
  await p.update({parcelPackage});
  return {id:p.id,parcelPackage};
}
module.exports={DEFAULT_PACKAGE,validatePackage,productPackage,save};
