const { validHandoff } = require('../../integrations/carparts/handoff');
const payload = {version:2,orderId:'order',lines:[{priceCents:970},{priceCents:1024}]};
const receipt = {ok:true,state:'work_order',orderId:'order',workOrder:'2500',invoice:null,
  finalized:false,lineCount:2,taxCents:0,subtotalCents:1994};
test.each(['work_order','already_work_order'])('accepts durable %s handoff without an invoice', state => {
  expect(validHandoff({...receipt,state},payload)).toBe(true);
});
test.each([{invoice:'2500'},{finalized:true},{lineCount:1},{subtotalCents:970},{taxCents:1},
  {orderId:'different'},{workOrder:null},{state:'posted'},{state:'already_posted',invoice:'2500'},
  {state:'review_required'},{ok:false}])('rejects incomplete or finalized v2 handoffs: %j', change => {
  expect(validHandoff({...receipt,...change},payload)).toBe(false);
});
test('acknowledges only read-only reconciliation of a historical posted v1 invoice',()=>{
  expect(validHandoff({...receipt,state:'already_posted',invoice:'2400'},{...payload,version:1})).toBe(true);
  expect(validHandoff({...receipt,state:'posted',invoice:'2400'},{...payload,version:1})).toBe(false);
});
