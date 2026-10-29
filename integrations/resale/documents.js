const crypto=require('crypto');
const MAX_BYTES=10*1024*1024;
const fail=message=>Object.assign(new Error(message),{status:400});
// Inspect ZIP directory metadata only. No decompression or execution of customer files.
function isDocx(b){
 let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50){end=p;break;}
 if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))return false;
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),offset=b.readUInt32LE(end+16);
 if(!count||count>2000||offset+size>end)return false;
 let p=offset,total=0;const names=new Set();
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50||(b.readUInt16LE(p+8)&1))return false;
  const len=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32);
  if(p+46+len+extra+comment>end)return false;
  const local=b.readUInt32LE(p+42),compressed=b.readUInt32LE(p+20);
  if(local+30>offset||b.readUInt32LE(local)!==0x04034b50||local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28)+compressed>offset)return false;
  if(![0,8].includes(b.readUInt16LE(p+10)))return false;
  const name=b.subarray(p+46,p+46+len).toString('utf8');
  if(name.includes('..')||name.startsWith('/')||/vbaProject\.bin$/i.test(name))return false;
  names.add(name);total+=b.readUInt32LE(p+24);p+=46+len+extra+comment;
 }
 return total<=50*1024*1024&&p===offset+size&&names.has('[Content_Types].xml')&&names.has('word/document.xml');
}
function validateDocument(file){
 if(!file||Array.isArray(file)||file.truncated||!Buffer.isBuffer(file.data)||!file.data.length||file.data.length>MAX_BYTES)
  throw fail('Upload one PDF or Word document, up to 10 MB.');
 const ext=String(file.name||'').toLowerCase().match(/\.(pdf|docx|doc)$/)?.[1],b=file.data;
 const valid=ext==='pdf'?b.subarray(0,5).toString()==='%PDF-'&&b.subarray(-2048).includes(Buffer.from('%%EOF')):
  ext==='doc'?b.length>=512&&b.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'))&&b.includes(Buffer.from('WordDocument','utf16le')):
  ext==='docx'?isDocx(b):false;
 if(!valid)throw fail('The file must be a valid PDF, DOC or DOCX document.');
 const fileName=String(file.name).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,'').slice(-180)||`certificate.${ext}`;
 return {fileName,mimeType:{pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext],fileSize:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),documentData:b};
}
module.exports={MAX_BYTES,validateDocument};
