const {csvCell,makeExport}=require('../../integrations/users/export');
const {category,queryParts}=require('../../integrations/users/segments');
describe('safe customer exports',()=>{
 test.each(['=SUM(1,2)','+123','-cmd','@SUM(1)','  =test','\tformula','\n=foo'])('CSV escapes spreadsheet formula %j',value=>expect(csvCell(value)).toMatch(/^"'/));
 test('CSV preserves unicode, quotes, newlines, and typed numbers',()=>{expect(csvCell('Иван, "A"\nB')).toBe('"Иван, ""A""\nB"');expect(csvCell(-12)).toBe('"-12"')});
 test('selection boundaries and categories reject malformed inputs',()=>{
  expect(category('')).toBeNull();expect(()=>category({})).toThrow();expect(()=>queryParts({}, {ids:Array(10001).fill(1)})).toThrow();expect(()=>queryParts({}, {ids:['0']})).toThrow();
 });
 test('Excel email export is a real workbook containing unique valid emails',async()=>{
  const r=await makeExport([{mail:' X@Example.com '},{mail:'x@example.com'},{mail:null},{mail:'invalid'}],'xlsx','emails');
  const b=new(require('exceljs').Workbook)();await b.xlsx.load(r.buffer);expect(r.count).toBe(1);expect(b.worksheets[0].getCell('A2').value).toBe('x@example.com');
 });
});
