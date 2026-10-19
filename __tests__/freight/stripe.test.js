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
test('self-pickup has no shipping charge or shipping address form',async()=>{
 await createCheckoutSession({...base,collectShippingAddress:false});
 const config=stripe.checkout.sessions.create.mock.calls[0][0];
 expect(config.shipping_options).toBeUndefined();expect(config.shipping_address_collection).toBeUndefined();
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
