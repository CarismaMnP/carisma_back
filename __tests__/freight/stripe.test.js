jest.mock('stripe',()=>jest.fn(()=>({customers:{create:jest.fn(async()=>({id:'cus_freight'}))},checkout:{sessions:{create:jest.fn(async()=>({id:'cs',url:'https://checkout.stripe.com/test',payment_intent:null}))}}})));
const {stripe,createCheckoutSession}=require('../../utils/stripe');
const base={orderId:'uuid',customerEmail:'test@example.invalid',lineItems:[{quantity:1,price_data:{unit_amount:1000}}]};
beforeEach(()=>jest.clearAllMocks());
test('standard shipped order keeps original zero-cost delivery and editable Stripe address',async()=>{
 await createCheckoutSession({...base,collectShippingAddress:true});
 const config=stripe.checkout.sessions.create.mock.calls[0][0];
 expect(config.shipping_address_collection.allowed_countries).toEqual(['US']);
 expect(config.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(0);
 expect(stripe.customers.create).not.toHaveBeenCalled();
});
test('pickup taxes use the fixed warehouse address while billing stays separate',async()=>{
 await createCheckoutSession({...base,collectShippingAddress:false,pickup:{name:'Test Buyer',phone:'9045550100',address:{state:'NY',postal_code:'10001'}}});
 expect(stripe.customers.create).toHaveBeenCalledWith({name:'Test Buyer',email:base.customerEmail,phone:'9045550100',tax_exempt:'none',
   shipping:{name:'Test Buyer',phone:'9045550100',address:{line1:'1300 W Beaver St',city:'Jacksonville',state:'FL',postal_code:'32209',country:'US'}},
   metadata:{orderId:'uuid',fulfillment:'pickup',pickupLocation:'jacksonville',resaleTaxExempt:'false'}},
   {idempotencyKey:'checkout-customer:uuid'});
 const config=stripe.checkout.sessions.create.mock.calls[0][0];
 expect(config.shipping_options).toBeUndefined();expect(config.shipping_address_collection).toBeUndefined();
 expect(config.customer).toBe('cus_freight');expect(config.customer_email).toBeUndefined();
 expect(config.billing_address_collection).toBe('required');expect(config.customer_update).toEqual({address:'auto'});
 expect(config.automatic_tax.enabled).toBe(true);expect(config.adaptive_pricing).toEqual({enabled:false});
 expect(config.custom_text.submit.message).toContain('Free pickup');
 expect(config.metadata).toEqual({orderId:'uuid',fulfillment:'pickup',pickupLocation:'jacksonville',resaleTaxExempt:'false'});
 expect(config.payment_intent_data.metadata).toEqual(config.metadata);
 expect(stripe.checkout.sessions.create.mock.calls[0][1]).toEqual({idempotencyKey:'checkout:uuid'});
});
test.each([{shipping:{}},{freight:{}},{collectShippingAddress:true}])('pickup rejects conflicting delivery parameters %j before Stripe calls',async conflict=>{
 await expect(createCheckoutSession({...base,pickup:{name:'Test'},...conflict})).rejects.toThrow('Pickup cannot be combined');
 expect(stripe.customers.create).not.toHaveBeenCalled();expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
});
test('freight uses server quote, immutable shipping address, tax code and idempotency',async()=>{
 const address={line1:'1 Test St',city:'Winter Garden',state:'FL',postal_code:'34787',country:'US'};
 await createCheckoutSession({...base,collectShippingAddress:true,freight:{quoteId:'q',amountCents:22961,address,name:'Test',phone:'9045550100'}});
 expect(stripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({shipping:expect.objectContaining({address})}),{idempotencyKey:'checkout-customer:uuid'});
 const config=stripe.checkout.sessions.create.mock.calls[0][0];
 expect(config.customer).toBe('cus_freight');expect(config.customer_email).toBeUndefined();
 expect(config.shipping_address_collection).toBeUndefined();expect(config.customer_update).toBeUndefined();
 expect(config.shipping_options[0].shipping_rate_data).toEqual(expect.objectContaining({fixed_amount:{amount:22961,currency:'usd'},tax_code:'txcd_92010001',tax_behavior:'exclusive'}));
 expect(config.adaptive_pricing).toEqual({enabled:false});
 expect(config.metadata.freightQuoteId).toBe('q');expect(config.automatic_tax.enabled).toBe(true);
});
test.each([0,2530,27530])('site address removes Stripe delivery fields and charges %i cents',async cents=>{
 const address={line1:'1 Main St',city:'Winter Garden',state:'FL',postal_code:'34787',country:'US'};
 await createCheckoutSession({...base,collectShippingAddress:true,shipping:{amountCents:cents,address,name:'Test',phone:'9045550100',label:'Delivery',parcelQuoteId:cents?'parcel-id':null,freightQuoteId:cents===27530?'freight-id':null}});
 const config=stripe.checkout.sessions.create.mock.calls[0][0];
 expect(config.shipping_address_collection).toBeUndefined();expect(config.customer_update).toBeUndefined();expect(config.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(cents);expect(config.automatic_tax.enabled).toBe(true);
 expect(stripe.customers.create.mock.calls[0][0].shipping.address).toEqual(address);if(cents)expect(config.metadata.parcelQuoteId).toBe('parcel-id');
});

test.each(['pickup','delivery','legacy'])('approved resale uses a fresh exempt Stripe customer for %s',async kind=>{
 const address={line1:'1 Main St',city:'Jacksonville',state:'FL',postal_code:'32209',country:'US'};
 const params=kind==='pickup'?{pickup:{name:'Buyer'}}:kind==='delivery'?{shipping:{amountCents:2500,address,name:'Buyer',parcelQuoteId:'pq'}}:{collectShippingAddress:true};
 await createCheckoutSession({...base,...params,resaleTaxExempt:true,resaleApplicationId:'cert-id'});
 expect(stripe.customers.create.mock.calls[0][0].tax_exempt).toBe('exempt');
 const config=stripe.checkout.sessions.create.mock.calls[0][0];expect(config.customer).toBe('cus_freight');expect(config.automatic_tax.enabled).toBe(true);
 expect(config.metadata.resaleTaxExempt).toBe('true');expect(config.metadata.resaleApplicationId).toBe('cert-id');
});
test('missing approval snapshot cannot create an exempt Stripe session',async()=>{
 await expect(createCheckoutSession({...base,pickup:{name:'Buyer'},resaleTaxExempt:true})).rejects.toThrow('approved certificate');
 expect(stripe.customers.create).not.toHaveBeenCalled();expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
});
