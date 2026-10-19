// Packaging supplied by Carisma. Inches / pounds, one packaged pallet per part.
// Classes and NMFC numbers verified against the account's Savtrans commodity catalog.
const VERSION = '2026-10-19-v1';
const definitions = {
  FDR: ['Front door', 60,40,55,165,'door'], RDR: ['Rear door',60,40,55,165,'door'],
  FBR: ['Front bumper',80,40,30,160,'bumper'], RBR: ['Rear bumper',80,40,30,160,'bumper'],
  HOD: ['Hood',85,40,65,165,'hood'], PLR: ['B pillar',50,40,55,250,'auto'],
  QTR: ['Quarter panel',90,40,60,300,'auto'], APL: ['A pillar',80,40,55,250,'auto'],
  ENG: ['Engine',50,40,40,450,'engine'], TRA: ['Transmission',45,40,30,250,'transmission'],
  LID: ['Trunk lid / liftgate',65,40,55,180,'door'], RGL: ['Panoramic roof / glass',75,40,60,200,'auto'],
  RGF: ['Panoramic roof frame',75,40,60,200,'auto'], HDL: ['Headliner',50,40,70,125,'auto'],
  FEN: ['Fender',52,40,40,100,'fender'], DPN: ['Dash panel',65,40,40,125,'dash'],
};
const aliases = {TR: 'TRA'};
const normalizeCode = value => aliases[String(value || '').trim().toUpperCase()] || String(value || '').trim().toUpperCase();
function validateManualCode(value) {
  const code = normalizeCode(value);
  if (code && !definitions[code]) throw Error('Unknown freight category');
  return code || null;
}
function classification(kind, density) {
  const fixed = {door: [150,'18520-2','Door / Decklid / Tailgate (Packaged)'],
    hood: [250,'18600','Hood'], fender: [250,'18660-1','Fender'], dash: [100,'18900','Dash Panel']};
  let result = fixed[kind];
  if (kind === 'bumper') result = density < 6 ? [300,'18415-6','Bumper (Palletized)'] : [150,'18415-7','Bumper (Palletized)'];
  if (kind === 'engine') {
    const index = density < 8 ? 0 : density < 12 ? 1 : density < 15 ? 2 : 3;
    result = [[175,'120850-7'],[110,'120850-8'],[92.5,'120850-9'],[77.5,'120850-10']][index].concat('Engine / Head / Motor');
  }
  if (!result) {
    const thresholds = [1,2,4,6,8,10,12,15,22.5,30,Infinity];
    const classes = [400,300,250,175,125,100,92.5,85,70,65,60];
    const i = thresholds.findIndex(max => density < max);
    // Savtrans's transmission catalog uses 18260-1 for both first two brackets.
    const sub = kind === 'transmission' && i === 1 ? 1 : i + 1;
    result = [classes[i],`18260-${sub}`,kind === 'transmission' ? 'Transmission / Transfer Case' : 'Auto Parts NOI'];
  }
  return {freightClass: result[0], nmfc: result[1], commodity: result[2]};
}
function profileForCode(value) {
  const code = normalizeCode(value), d = definitions[code];
  if (!d) return null;
  const [label,length,width,height,weight,kind] = d;
  const density = weight * 1728 / (length * width * height);
  return {code,label,length,width,height,weight,pallets:1,pieces:1,density,
    ...classification(kind,density),version: VERSION};
}
function productProfile(product) {
  return profileForCode(product.source === 'carparts'
    ? product.carpartsPartCode || product.carpartsData?.part
    : product.freightCategoryCode);
}
module.exports = {VERSION, normalizeCode, validateManualCode, productProfile, profileForCode, classification,
  profiles: Object.keys(definitions).map(profileForCode)};
