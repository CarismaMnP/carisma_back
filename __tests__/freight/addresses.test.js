jest.mock('axios',()=>{const fn=jest.fn();fn.get=jest.fn();return fn});
jest.mock('../../models/models',()=>({FreightQuote:{findOne:jest.fn()}}));
const axios=require('axios'),{FreightQuote}=require('../../models/models'),a=require('../../integrations/freight/addresses');
const quote='11111111-1111-4111-8111-111111111111';
beforeEach(()=>{jest.clearAllMocks();FreightQuote.findOne.mockResolvedValue({request:{zip:'34787'},expiresAt:new Date(Date.now()+60000)});axios.get.mockResolvedValue({data:{'country abbreviation':'US','post code':'34787',places:[{'place name':'Winter Garden','state abbreviation':'FL',state:'Florida',latitude:'28.5',longitude:'-81.5'}]}})});
test('ZIP lookup normalizes city/state and caches repeated calls',async()=>{const x=await a.lookupZip('34787');expect(x.places[0].city).toBe('Winter Garden');expect(x.places[0].state).toBe('FL');await a.lookupZip('34787');expect(axios.get).toHaveBeenCalledTimes(1)});
test('lookup failure permits manual entry and never fabricates a location',async()=>{axios.get.mockRejectedValueOnce(Error('Offline'));expect(await a.lookupZip('99999')).toEqual({zip:'99999',places:[]})});
test('invalid ZIP rejected before provider request',async()=>{await expect(a.lookupZip('../etc')).rejects.toThrow();expect(axios.get).not.toHaveBeenCalled()});
test('address fields require an owned valid quote',async()=>{FreightQuote.findOne.mockResolvedValueOnce(null);await expect(a.context(2,quote)).rejects.toThrow('Calculate freight');expect(FreightQuote.findOne).toHaveBeenCalledWith({where:{id:quote,userId:2,status:'quoted'}});FreightQuote.findOne.mockResolvedValueOnce({expiresAt:new Date(0)});await expect(a.context(1,quote)).rejects.toThrow('Calculate freight')});
