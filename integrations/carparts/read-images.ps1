param($Request)
$ErrorActionPreference='Stop'
. "$PSScriptRoot\image-manifest.ps1"
if(@($Request.images).Count -gt 64){throw 'Maximum 64 images per request'}
$c=New-Object System.Data.Odbc.OdbcConnection('DSN=Checkmate');$result=New-Object System.Collections.Generic.List[object]
try{
 $c.Open();$records=Get-ImageRecords $c $Request.images
 foreach($wanted in $Request.images){
  $key=[string]$wanted.GUID+'|'+[string]$wanted.ImageNumber+'|'+[string]$wanted.ImageLocation
  $entry=$records[$key];$source=$null;$found=$false
  if($entry -and $entry.checksum -eq [string]$wanted.CheckSum -and $entry.web -eq [string]$wanted.WebCheckSum){$source=$entry.path;$found=$true}
  if(!$found){$result.Add(@{id=$wanted.id;error='Image changed or is no longer public'});continue}
  try{
   if($source -notmatch '^P:\\[0-9]{4}\\[A-Za-z0-9_-]+\\[A-Za-z0-9_-]+\.(jpg|jpeg|png)$'){throw 'Unsupported image path'}
   $path=[IO.Path]::GetFullPath('D:\CPIMAGES\'+$source.Substring(3))
   if(!$path.StartsWith('D:\CPIMAGES\',[StringComparison]::OrdinalIgnoreCase)){throw 'Image path outside storage'}
   $info=Get-Item -LiteralPath $path
   if($info.Length -gt 20MB){throw 'Image exceeds 20 MB'}
   $bytes=[IO.File]::ReadAllBytes($path);$sha=[Security.Cryptography.SHA256]::Create()
   try{$digest=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
   $result.Add(@{id=$wanted.id;sha256=$digest;data=[Convert]::ToBase64String($bytes)})
  }catch{$result.Add(@{id=$wanted.id;error=$_.Exception.Message})}
 }
 [pscustomobject]@{ok=$true;images=$result.ToArray()}|ConvertTo-Json -Depth 4 -Compress
}finally{$c.Close();$c.Dispose()}
