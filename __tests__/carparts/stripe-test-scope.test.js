const fs=require('fs'),os=require('os'),path=require('path');
const {testConfig,authorizedStripeTest}=require('../../utils/stripeTest');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let dir,previous;
beforeAll(()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'carisma-stripe-scope-'));previous=process.env.STRIPE_TEST_CONFIG_FILE;process.env.STRIPE_TEST_CONFIG_FILE=path.join(dir,'test.json')});
afterAll(()=>{if(previous===undefined)delete process.env.STRIPE_TEST_CONFIG_FILE;else process.env.STRIPE_TEST_CONFIG_FILE=previous;fs.rmSync(dir,{recursive:true,force:true})});
function save(changes={}){fs.writeFileSync(process.env.STRIPE_TEST_CONFIG_FILE,JSON.stringify({secretKey:'sk_test_fixture',webhookSecret:'whsec_fixture',expiresAt:new Date(Date.now()+3600000).toISOString(),orderIds:[id],...changes}))}
test('scope permits only its exact UUID and expires without a restart',()=>{
 save();expect(authorizedStripeTest(id)).toBe(true);expect(authorizedStripeTest('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(false);
 save({expiresAt:new Date(Date.now()-1000).toISOString()});expect(authorizedStripeTest(id)).toBe(false);
});
test.each([{secretKey:'sk_live_forbidden'},{expiresAt:'invalid'},{expiresAt:new Date(Date.now()+25*3600000).toISOString()},{orderIds:null}])('invalid test scope is disabled: %j',changes=>{save(changes);expect(testConfig()).toBeNull()});
