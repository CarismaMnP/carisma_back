const {salePayload} = require('../../integrations/carparts/sale-payload');
const {filters} = require('../../utils/adminProductFilters');
const {Op} = require('sequelize');
const job = {productId:1,guid:'G',inventoryId:'I',tag:'T'};
const item = {productId:1,count:1,unitPriceCents:1234,productSnapshot:{source:'carparts',guid:'G',inventoryId:'I',tag:'T',name:'Part'}};
const order = {id:'order',fullName:' Buyer ',mail:'buyer@example.invalid',paidAt:new Date(),createdAt:new Date(),paidLive:true,tax:0.93,total:13.27,billingAddress:{line1:'Billing'},shippingAddress:{line1:'Shipping'}};
test('editable work order uses captured net price and transfers customer and Stripe receipt separately', () => {
 const p = salePayload({...order,stripePaymentIntentId:'pi_verified',shippingAmount:3},[item],[job]);
 expect(p.version).toBe(2);expect(p.fulfillment).toBe('work_order');
 expect(p.paymentIntentId).toBe('pi_verified');expect(p.websiteShippingCents).toBe(300);
 expect(p.lines[0].priceCents).toBe(1234);expect(p.taxMode).toBe('not_taxable');
 expect(p.websiteTaxCents).toBe(93);expect(p.customer.billing.line1).toBe('Billing');expect(p.customer.shipping.line1).toBe('Shipping');
});
test.each([{...item,unitPriceCents:null},{...item,count:2},{...item,productSnapshot:{...item.productSnapshot,guid:'OTHER'}}])('unsafe historical or changed line is held for review', invalid => {
 expect(() => salePayload(order,[invalid],[job])).toThrow();
});
test.each([{minPrice:'20',maxPrice:'10'},{minPrice:'-1'},{limit:'100000'},{sort:'price;DROP'},{active:'yes'},{search:[]}])('rejects invalid admin filters %p', query => expect(() => filters(query)).toThrow());
test('all statuses keep search/price/make; deterministic price order and literal wildcard search', () => {
 const f=filters({active:'true',inactive:'true',search:'a%b_',minPrice:'0',maxPrice:'25',make:'Audi',model:'Q5',sort:'price_asc'});
 expect(f.base.make).toBe('Audi');expect(f.base.price[Op.lte]).toBe(25);
 expect(f.base[Op.or][0].name[Op.iLike]).toBe('%a\\%b\\_%');expect(f.order).toEqual([['price','ASC'],['id','ASC']]);
});
