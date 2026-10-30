const ExcelJS = require('exceljs');
const {fail} = require('./segments');
const columns = [
  ['id','ID',10], ['name','Name',30], ['mail','Email',36], ['phone','Phone',22],
  ['purchasingAs','Purchasing as',20], ['category','Loyalty category',20], ['discount','Discount (%)',16],
  ['paidOrdersCount','Paid orders',16], ['total','Paid items (USD)',20], ['cartSum','Cart (USD)',18],
  ['createdAt','Registered (UTC)',24], ['lastOrderAt','Last purchase (UTC)',24], ['resaleTaxExempt','Resale approved',20],
];
function csvCell(value) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? '');
  // CSV is untyped: prevent spreadsheet formulas, including after leading whitespace.
  if (typeof value === 'string' && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
async function makeExport(rows, format, fields) {
  if (!['csv','xlsx'].includes(format) || !['emails','contacts'].includes(fields)) fail('Invalid export format');
  let selectedColumns = columns, data = rows;
  if (fields === 'emails') {
    selectedColumns = [['mail','Email',36]];
    const seen = new Set();
    data = rows.flatMap(row => {
      const mail = String(row.mail || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || seen.has(mail)) return [];
      seen.add(mail); return [{mail}];
    });
  }
  if (!data.length) fail(fields === 'emails' ? 'No valid email addresses in this selection.' : 'No users in this selection.');
  const values = data.map(row => selectedColumns.map(([key]) => {
    const value = row[key];
    if (value == null) return '';
    if (['createdAt','lastOrderAt'].includes(key)) return new Date(value);
    if (key === 'resaleTaxExempt') return value ? 'Yes' : 'No';
    return value;
  }));
  if (format === 'csv') return {buffer: Buffer.from('\uFEFF' + [selectedColumns.map(c => c[1]), ...values].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'), count: data.length, type:'text/csv; charset=utf-8'};
  const book = new ExcelJS.Workbook(); book.creator = 'Carisma'; book.created = new Date();
  const sheet = book.addWorksheet(fields === 'emails' ? 'Emails' : 'Customers', {views: [{state:'frozen', ySplit:1}]});
  sheet.columns = selectedColumns.map(([key,header,width]) => ({key,header,width}));
  sheet.addRows(values);
  sheet.autoFilter = {from:{row:1,column:1},to:{row:data.length+1,column:selectedColumns.length}};
  sheet.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF176B68'}};
  sheet.getRow(1).height = 24;
  selectedColumns.forEach(([key], index) => {
    if (['createdAt','lastOrderAt'].includes(key)) sheet.getColumn(index+1).numFmt = 'yyyy-mm-dd hh:mm';
    if (['total','cartSum'].includes(key)) sheet.getColumn(index+1).numFmt = '0.00';
  });
  return {buffer:Buffer.from(await book.xlsx.writeBuffer()),count:data.length,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
}
module.exports = {makeExport, csvCell};
