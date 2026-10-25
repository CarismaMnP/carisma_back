const {Op} = require('sequelize');
function filters(query = {}) {
  const integer = (key, fallback, max) => {
    if (query[key] === undefined || query[key] === '') return fallback;
    const n = Number(query[key]);
    if (!Number.isSafeInteger(n) || n < 1 || n > max) throw Error(`Invalid ${key}`);
    return n;
  };
  const flag = (key, fallback) => {
    if (query[key] === undefined) return fallback;
    if (!['true','false'].includes(query[key])) throw Error(`Invalid ${key}`);
    return query[key] === 'true';
  };
  const active = flag('active', true), inactive = flag('inactive', false);
  const page = integer('page',1,1000000), limit = integer('limit',25,100);
  const base = {};
  for (const key of ['make','model','source','search','category'])
    if (query[key] !== undefined && (typeof query[key] !== 'string' || query[key].length > 250)) throw Error(`Invalid ${key}`);
  if (query.category) base.ebayCategory = query.category;
  if (query.make) base.make = query.make;
  if (query.model) base.ebayModel = query.model;
  if (query.source) {
    if (!['carparts','manual','legacy'].includes(query.source)) throw Error('Invalid source');
    base.source = query.source;
  }
  const price = {};
  for (const [key, op] of [['minPrice',Op.gte],['maxPrice',Op.lte]]) {
    if (query[key] !== undefined && query[key] !== '') {
      const n = Number(query[key]);
      if (!Number.isFinite(n) || n < 0 || n > 100000000) throw Error(`Invalid ${key}`);
      price[op] = n;
    }
  }
  if (price[Op.gte] !== undefined && price[Op.lte] !== undefined && price[Op.gte] > price[Op.lte]) throw Error('Minimum price exceeds maximum');
  if (Reflect.ownKeys(price).length) base.price = price;
  if (query.search?.trim()) {
    const search = query.search.trim();
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    base[Op.or] = ['name','carpartsTag','carpartsGuid'].map(k => ({[k]:{[Op.iLike]:pattern}}));
    base[Op.or].push({'carpartsData.stock':{[Op.iLike]:pattern}});
    if (/^\d+$/.test(search) && Number(search) <= 2147483647) base[Op.or].push({id:Number(search)});
  }
  // Same availability rule as the public catalog, including hidden products in the inactive view.
  const available = {isDeleted:false,count:{[Op.gt]:0}};
  const unavailable = {[Op.or]:[{isDeleted:true},{count:{[Op.lte]:0}},{count:null}]};
  const status = active && inactive ? {} : active ? available : inactive ? unavailable : {id:-1};
  const orders = {newest:[['createdAt','DESC']], price_asc:[['price','ASC']], price_desc:[['price','DESC']], name:[['name','ASC']]};
  if (query.sort && !orders[query.sort]) throw Error('Invalid sort');
  return {base, available, unavailable, where:{[Op.and]:[base,status]},page,limit,
    offset:(page-1)*limit,order:[...(orders[query.sort] || orders.newest),['id','ASC']]};
}
module.exports = {filters};
