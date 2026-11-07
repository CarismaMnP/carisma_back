const {profileForCode,productProfile,classification}=require('../../integrations/freight/profiles');
const {requestBody,normalizeResult,quoteUrl}=require('../../integrations/freight/savtrans');
const fixture=require('./fixtures/savtrans-door.json');
const request={originZip:'32209',zip:'34787',insuredCents:70000,accessorials:[4],shipmentItems:[profileForCode('FDR')]};
test.each([['FDR',150,'18520-2'],['RDR',150,'18520-2'],['FBR',300,'18415-6'],['RBR',300,'18415-6'],['HOD',250,'18600'],['PLR',250,'18260-3'],['QTR',250,'18260-3'],['APL',250,'18260-3'],['ENG',110,'120850-8'],['TRA',100,'18260-6'],['TR',100,'18260-6'],['LID',150,'18520-2'],['RGL',300,'18260-2'],['RGF',300,'18260-2'],['HDL',300,'18260-2'],['FEN',250,'18660-1'],['DPN',100,'18900']])('verified commodity for %s',(code,freightClass,nmfc)=>{
 expect(profileForCode(code)).toEqual(expect.objectContaining({freightClass,nmfc}));
});
test('Checkmate codes win over unrelated category text; small parts never match title words',()=>{
 expect(productProfile({source:'carparts',carpartsData:{part:'HOS'},name:'Engine hose',ebayCategory:'Engines',freightCategoryCode:'ENG'})).toBeNull();
 expect(productProfile({source:'carparts',carpartsData:{part:'TRA'}}).code).toBe('TRA');
 expect(productProfile({source:'manual',freightCategoryCode:'ENG',carpartsData:{part:'HOS'}}).code).toBe('ENG');
});
test('density boundaries and exact 8 lb/ft3 transmission',()=>{
 expect(classification('auto',1).freightClass).toBe(300);
 expect(classification('auto',2).freightClass).toBe(250);
 expect(classification('transmission',8).freightClass).toBe(100);
});
test('broker form preserves each pallet, insured value, dimensions and accessorials',()=>{
 const body=requestBody({...request,accessorials:[4,8,7],shipmentItems:[profileForCode('FDR'),profileForCode('ENG')]});
 expect(body.getAll('add_charges[]')).toEqual(['4','8','7']);
 expect(body.get('items[1][weight]')).toBe('450');expect(body.get('items[1][class]')).toBe('110');
 expect(body.get('insured_value')).toBe('700.00');expect(body.get('items[0][length]')).toBe('60');
});
test('real broker response picks the numeric minimum, including insurance exactly once',()=>{
 const data={...fixture,rate_results:[...fixture.rate_results].reverse()};
 const result=normalizeResult(data,request,fixture.rest_uri);
 expect(result.selected.amountCents).toBe(22961);expect(result.insuranceCents).toBe(1260);
 expect(result.selected.carrier).toBe('AAA Cooper');
});
test.each([{insured_value:'0'},{delivery_postal:'10001'},{contract_charge_types:[]},{items:[]},{insured_charge:'0'},{rate_results:[]},{is_complete:true}])('rejects incomplete or changed shipment %j',changes=>{
 expect(()=>normalizeResult({...fixture,...changes},request,fixture.rest_uri)).toThrow();
});
test.each(['https://attacker.example/x','http://vsa.savtrans.com/api.php/rest/rate_request/abcdef.json','https://vsa.savtrans.com/api.php/rest/rate_dispatch/abcdef.json','https://vsa.savtrans.com/api.php/rest/rate_request/abcdef.json?api_password=secret'])('does not follow unsafe broker references %s',url=>expect(()=>quoteUrl(url)).toThrow());

test.each([['FST',50,40,55,165],['BWN',50,40,40,80],['MUF',50,40,50,100],['UCM',50,40,25,140]])('new freight category %s is an insured pallet, not a parcel',(code,length,width,height,weight)=>{
 const p=productProfile({source:'carparts',carpartsPartCode:code});
 expect(p).toMatchObject({code,length,width,height,weight,pallets:1});
 const body=requestBody({...request,insuredCents:25000,shipmentItems:[p]});
 expect(body.get('insured_value')).toBe('250.00');expect(body.get('items[0][weight]')).toBe(String(weight));
});
test.each(['STM','RST','BGG','FDW','RDW','TCM'])('related small/different part %s is not accidentally routed to new freight',code=>{
 expect(productProfile({source:'carparts',carpartsPartCode:code,ebayCategory:'Seats',name:'Front Seat'})).toBeNull();
});
