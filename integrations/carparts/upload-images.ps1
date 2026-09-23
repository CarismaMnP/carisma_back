param($Request)
$ErrorActionPreference='Stop'
. "$PSScriptRoot\image-manifest.ps1"
$watch=[Diagnostics.Stopwatch]::StartNew()
if(@($Request.images).Count -gt 64){throw 'Maximum 64 images per request'}
$config=Get-Content -Raw -LiteralPath "$PSScriptRoot\config.json"|ConvertFrom-Json
if(!$config.uploadHost){throw 'Image upload host not configured'}
Add-Type -Path "$PSScriptRoot\ImageUpload.cs" -ReferencedAssemblies System.Drawing,System.Net.Http
$c=New-Object System.Data.Odbc.OdbcConnection('DSN=Checkmate')
$uploads=New-Object System.Collections.Generic.List[CarismaImageInput]
$result=New-Object System.Collections.Generic.List[object]
try{
 $c.Open();$records=Get-ImageRecords $c $Request.images
 foreach($wanted in $Request.images){
  try{
   $url=[uri]$wanted.uploadUrl
   if($url.Scheme -ne 'https' -or !($url.Host -eq $config.uploadHost -or $url.Host.EndsWith('.'+$config.uploadHost)) -or $url.AbsolutePath -notmatch '/carparts/9032/[0-9A-F-]{36}/[a-f0-9]{64}\.jpg$'){throw 'Unapproved image destination'}
   $key=[string]$wanted.GUID+'|'+[string]$wanted.ImageNumber+'|'+[string]$wanted.ImageLocation
   $entry=$records[$key];$source=$null
   if($entry -and $entry.checksum -eq [string]$wanted.CheckSum -and $entry.web -eq [string]$wanted.WebCheckSum){$source=$entry.path}
   if(!$source){throw 'Image changed or is no longer public'}
   if($source -notmatch '^P:\\[0-9]{4}\\[A-Za-z0-9_-]+\\[A-Za-z0-9_-]+\.(jpg|jpeg|png)$'){throw 'Unsupported image path'}
   $path=[IO.Path]::GetFullPath('D:\CPIMAGES\'+$source.Substring(3))
   if(!$path.StartsWith('D:\CPIMAGES\',[StringComparison]::OrdinalIgnoreCase)){throw 'Image path outside storage'}
   if(!(Test-Path -LiteralPath $path) -or (Get-Item -LiteralPath $path).Length -eq 0){
    $web=[IO.Path]::Combine([IO.Path]::GetDirectoryName($path),[IO.Path]::GetFileNameWithoutExtension($path)+'_web.jpg')
    if((Test-Path -LiteralPath $web) -and (Get-Item -LiteralPath $web).Length -gt 0){$path=$web}else{throw 'Source image file is missing or empty'}
   }
   if((Get-Item -LiteralPath $path).Length -gt 20MB){throw 'Image exceeds 20 MB'}
   $upload=New-Object CarismaImageInput;$upload.id=$wanted.id;$upload.path=$path;$upload.url=$wanted.uploadUrl;$uploads.Add($upload)
  }catch{$result.Add(@{id=$wanted.id;error=$_.Exception.Message})}
 }
}finally{$c.Close();$c.Dispose()}
$validationMs=$watch.ElapsedMilliseconds
foreach($entry in [CarismaImageUpload]::Upload($uploads.ToArray())){$result.Add($entry)}
[pscustomobject]@{ok=$true;images=$result.ToArray();timing=@{validationMs=$validationMs;uploadMs=($watch.ElapsedMilliseconds-$validationMs)}}|ConvertTo-Json -Depth 4 -Compress
