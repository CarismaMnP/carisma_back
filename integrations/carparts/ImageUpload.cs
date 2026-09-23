using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Security.Cryptography;
using System.Threading.Tasks;

public sealed class CarismaImageInput { public string id; public string path; public string url; }
public sealed class CarismaImageResult { public string id; public string sha256; public int bytes; public string error; }
public static class CarismaImageUpload {
 public static CarismaImageResult[] Upload(CarismaImageInput[] inputs) {
  ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
  ServicePointManager.DefaultConnectionLimit=16;
  var results=new CarismaImageResult[inputs.Length];
  using(var http=new HttpClient()) {
   http.Timeout=TimeSpan.FromSeconds(90);
   Parallel.For(0,inputs.Length,new ParallelOptions{MaxDegreeOfParallelism=8}, i=>{
    var item=inputs[i];var result=new CarismaImageResult{id=item.id};results[i]=result;
    try {
     using(var original=Image.FromFile(item.path)) {
      if(Array.IndexOf(original.PropertyIdList,274)>=0) {
       int orientation=original.GetPropertyItem(274).Value[0];
       RotateFlipType[] transforms={RotateFlipType.RotateNoneFlipNone,RotateFlipType.RotateNoneFlipNone,RotateFlipType.RotateNoneFlipX,RotateFlipType.Rotate180FlipNone,RotateFlipType.Rotate180FlipX,RotateFlipType.Rotate90FlipX,RotateFlipType.Rotate90FlipNone,RotateFlipType.Rotate270FlipX,RotateFlipType.Rotate270FlipNone};
       if(orientation>0 && orientation<9)original.RotateFlip(transforms[orientation]);
      }
      double scale=Math.Min(1.0,1600.0/Math.Max(original.Width,original.Height));
      using(var resized=new Bitmap(Math.Max(1,(int)Math.Round(original.Width*scale)),Math.Max(1,(int)Math.Round(original.Height*scale)))) {
       using(var graphics=Graphics.FromImage(resized)) {
        graphics.Clear(Color.White);graphics.CompositingQuality=CompositingQuality.HighQuality;graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;graphics.PixelOffsetMode=PixelOffsetMode.HighQuality;
        graphics.DrawImage(original,0,0,resized.Width,resized.Height);
       }
       using(var output=new MemoryStream()) using(var parameters=new EncoderParameters(1)) {
        parameters.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,88L);
        var codec=Array.Find(ImageCodecInfo.GetImageEncoders(),c=>c.MimeType=="image/jpeg");
        resized.Save(output,codec,parameters);byte[] data=output.ToArray();result.bytes=data.Length;
        using(var sha=SHA256.Create())result.sha256=BitConverter.ToString(sha.ComputeHash(data)).Replace("-","").ToLowerInvariant();
        using(var content=new ByteArrayContent(data)) {
         content.Headers.ContentType=new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
         using(var response=http.PutAsync(item.url,content).GetAwaiter().GetResult()) {
          if(!response.IsSuccessStatusCode)throw new InvalidOperationException("Object storage returned HTTP "+(int)response.StatusCode);
         }
        }
       }
      }
     }
    } catch(Exception e) { result.error=e is HttpRequestException?"Object storage connection failed":e.Message; }
   });
  }
  return results;
 }
}
