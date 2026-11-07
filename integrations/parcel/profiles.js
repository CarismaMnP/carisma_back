// Carisma-approved packed dimensions in inches and weight in pounds (2026-11-07).
// Codes verified against Checkmate's Part dictionary. No matching on product titles
// or broad eBay groups such as Auto Glass, Fenders or Other Exterior Parts.
const definitions = [
  ["GRL", "Grille|Grilles", 30, 10, 10, 15],
  ["RSP", "Radiator Core Supp|Radiator Support", 48, 10, 10, 20],
  ["FFL FEX", "Fender Flare/Ext|Fender Flare|Fr Fender Extension", 40, 30, 5, 30],
  ["INF", "Inner Fender|Fender Inner Panel", 30, 25, 16, 10],
  ["HLP", "Headlamp Assembly|Headlight Assemblies", 22, 16, 16, 20],
  ["HSH", "Hood Strut|Hood Shock", 14, 12, 10, 5],
  ["COW", "Cowl", 48, 15, 10, 45],
  ["RBD RMD RPN", "Running Board|Running Boards|Rocker molding|Rocker moulding|Rocker panel", 85, 10, 10, 10],
  ["FRG", "Door Window Reg, Fr|Front Door Regulator", 35, 30, 8, 10],
  ["DMR", "Side View Mirror|Door Mirror|Mirror Assemblies", 16, 14, 12, 10],
  ["LRK", "Luggage Rack|Roof Racks & Cross Bars", 88, 7, 7, 15],
  ["RLB", "Roll Bar", 38, 15, 8, 15],
  ["RRS", "Spoiler, Rear|Rear Spoiler|Spoilers & Wings", 48, 20, 10, 20],
  ["CCR", "Cargo Cover/Shade|Cargo Cover", 48, 10, 10, 15],
  ["SWH", "Steering Wheel", 16, 16, 8, 10],
  ["COL", "Steering Column", 24, 10, 10, 20],
  ["FCN RCN", "Console|Front Console|Rear Console|Center & Overhead Consoles", 48, 20, 20, 20],
  ["GLB", "Glove Box", 22, 16, 16, 15],
  ["FDW", "Door Glass, Front|Front Door Glass/Window", 41, 25, 6, 15],
  ["RDW", "Door Glass, Rear|Rear Door Glass/Window", 35, 25, 6, 15],
  ["TRB", "Turbo-Supercharger|Turbo/Supercharger", 16, 16, 16, 40],
  ["FAN", "Fan Blade", 35, 35, 8, 20],
  ["ENV", "Engine Cover", 32, 24, 8, 10],
  ["MTP", "AT Parts, Misc.|Misc. Trans. Part|Automatic Transmission Parts", 24, 10, 10, 25],
  ["CNV", "Torque Converter", 14, 10, 8, 30],
  ["TCS", "Transfer Case Assy|Transfer Case", 16, 16, 16, 70],
  ["FDS", "Drive Shaft, Front|Front Drive Shaft", 50, 10, 10, 50],
  ["RDS", "Drive Shaft, Rear|Rear Drive Shaft", 50, 10, 10, 50],
  ["CRR", "Differential Assy|Carrier/Differential Assembly|Differential Assemblies", 16, 16, 16, 80],
  ["ASH", "Axle Shaft", 24, 10, 10, 25],
  ["KNE", "Knee, Front|Knee Assembly", 16, 16, 16, 25],
  ["SPN", "Spindle Knuckle, Fr|Spindle Knuckle Front|Steering Knuckles", 24, 10, 10, 30],
  ["STB", "Stabilizer Bar", 36, 11, 5, 10],
  ["STT", "Strut|Strut Assembly", 24, 10, 10, 25],
  ["CAL", "Caliper", 14, 10, 8, 15],
  ["PBR", "Power Brake Booster", 16, 14, 10, 10],
  ["ABK", "Anti-lock Brake Pts|Anti-lock Brake Parts|Additional ABS Parts", 14, 10, 8, 15],
  ["STG", "Power Strg Assembly|Steering Gear Rack|Steering Gear (Incl. Rack)", 48, 10, 10, 30],
  ["WHL", "Wheel|Wheels", 22, 22, 10, 40],
  ["WEB", "Wheel Bearing Front|Wheel Bearing Rear|Wheel Bearings", 16, 14, 10, 18],
  ["XAF", "Spare Wheel Parts|Spare Whl Parts", 22, 22, 10, 60],
  ["IFL", "Inner Fender Liner", 22, 22, 16, 10],
  ["TIR", "Tires|Tire", 26, 26, 12, 45],
  ["BAT", "Battery|Batteries", 14, 10, 8, 25],
  ["ALT", "Alternator|Alternators & Generators", 14, 10, 18, 20],
  ["FSH", "Radiator Shroud|Fan Shroud|Fan & Shroud Assemblies", 30, 28, 10, 20],
  ["RAD", "Radiators|Radiator", 30, 28, 8, 25],
];
const normalizeLabel = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
const byCode = new Map(), byLabel = new Map();
for (const [codes,labels,lengthIn,widthIn,heightIn,weightLb] of definitions) {
  const pack=Object.freeze({lengthIn,widthIn,heightIn,weightLb});
  for (const code of codes.split(' ')) byCode.set(code,pack);
  for (const label of labels.split('|')) byLabel.set(normalizeLabel(label),pack);
}
function categoryPackage(product) {
  // A source code wins even when the imported eBay label refers to another part.
  if (product?.source==='carparts') {
    const code=String(product.carpartsPartCode || product.carpartsData?.part || '').trim().toUpperCase();
    return byCode.get(code) || null;
  }
  return byLabel.get(normalizeLabel(product?.ebayCategory)) || null;
}
module.exports={categoryPackage,definitions};
