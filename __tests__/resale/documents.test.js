const {validateDocument}=require('../../integrations/resale/documents');
const docx=Buffer.from('UEsDBBQAAAAIAJIKXl3GEnoHrAAAAPEAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2Puw7CMAxFf6XKihoXBgaUlIEdGPgBK3HbiOahJBT4exKQOjBax/dcWxxfdm4Wisl4J9mWd+zYi9s7UGoKcUmyKedwAEhqIouJ+0CukMFHi7mMcYSA6o4jwa7r9qC8y+Rym6uD9eJS5NFoaq4Y8xktSQZPHzVorx62bPJiY83pF6vNkmEIs1GYy02wOP3X2fphMIrWfLWF6BWlZNxoZ74Si8Ztqh56Ad+n+g9QSwMEFAAAAAgAkgpeXdJqZxqMAAAAvgAAABEAAAB3b3JkL2RvY3VtZW50LnhtbEWOSw7CMAxErxLlAHVhwaLq5xJcIKRuG6mJI9sQuD1NWbB5o9GTRtNP77ibF7IESoO9NK2dxr50M/lnxKTm0Em6MthNNXcA4jeMThrKmA63EEenR+UVCvGcmTyKhLTGHa5te4PoQrJ18kHzp2au4Aod7yhqGMXtaDyyhiV4p9hDlZV8Mp/8DcD/3PgFUEsBAhQDFAAAAAgAkgpeXcYSegesAAAA8QAAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACACSCl5d0mpnGowAAAC+AAAAEQAAAAAAAAAAAAAAgAHdAAAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAIAAgCAAAAAmAEAAAAA','base64');

test('accepts Word DOCX and detects renamed ZIP/PDF content',()=>{
 const a=validateDocument({name:'certificate.docx',data:docx});expect(a.mimeType).toContain('wordprocessingml');expect(a.sha256).toHaveLength(64);
 expect(()=>validateDocument({name:'certificate.pdf',data:docx})).toThrow('valid PDF');
 expect(()=>validateDocument({name:'certificate.docx',data:Buffer.from('PK-not-an-archive')})).toThrow('valid PDF');
});
test('rejects encrypted, macro-enabled and malformed ZIP files',()=>{
 const encrypted=Buffer.from(docx);const cd=encrypted.indexOf(Buffer.from('504b0102','hex'));encrypted.writeUInt16LE(1,cd+8);
 expect(()=>validateDocument({name:'certificate.docx',data:encrypted})).toThrow();
 const broken=Buffer.from(docx);broken.writeUInt32LE(0xffffffff,cd+42);expect(()=>validateDocument({name:'certificate.docx',data:broken})).toThrow();
 expect(()=>validateDocument({name:'certificate.docm',data:docx})).toThrow();
});
test('legacy Word requires OLE signature and WordDocument stream name',()=>{
 const doc=Buffer.alloc(512);Buffer.from('d0cf11e0a1b11ae1','hex').copy(doc);Buffer.from('WordDocument','utf16le').copy(doc,128);
 expect(validateDocument({name:'certificate.doc',data:doc}).mimeType).toBe('application/msword');
 doc.fill(0,128);expect(()=>validateDocument({name:'certificate.doc',data:doc})).toThrow();
});
test('download filename cannot contain directories or control characters',()=>{
 expect(validateDocument({name:'../../bad\r\nname.pdf',data:Buffer.from('%PDF-1.4\n%%EOF')}).fileName).toBe('badname.pdf');
});
