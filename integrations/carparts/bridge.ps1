# Restricted SSH entry point. The dedicated key is forced to this command.
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 # A newline frame avoids waiting for EOF on Windows OpenSSH console handles.
 $inputText=[Console]::In.ReadLine();if(!$inputText -or $inputText.Length -gt 131072){throw 'Invalid request size'}
 if($inputText.StartsWith('gzip:')){
  $stream=New-Object IO.MemoryStream(,[Convert]::FromBase64String($inputText.Substring(5)))
  $gzip=New-Object IO.Compression.GzipStream($stream,[IO.Compression.CompressionMode]::Decompress)
  $reader=New-Object IO.StreamReader($gzip);try{$inputText=$reader.ReadToEnd()}finally{$reader.Dispose()}
  if($inputText.Length -gt 1048576){throw 'Expanded request too large'}
 }
 $request=$inputText|ConvertFrom-Json
 $response=switch($request.action){
  'catalog' { & "$PSScriptRoot\read-catalog.ps1" -IncludeLegacyHistory:($request.migration -eq $true) }
  'images' { & "$PSScriptRoot\read-images.ps1" -Request $request }
  'uploadImages' { & "$PSScriptRoot\upload-images.ps1" -Request $request }
  'stock' { & "$PSScriptRoot\read-stock.ps1" -Request $request }
  'auditSale' { & "$PSScriptRoot\remove-sale.ps1" -Request $request -AuditOnly }
  'removeSale' { & "$PSScriptRoot\remove-sale.ps1" -Request $request }
  default {throw 'Unsupported bridge action'}
 }
 $bytes=[Text.Encoding]::UTF8.GetBytes([string]$response)
 $stream=New-Object IO.MemoryStream
 $gzip=New-Object IO.Compression.GzipStream($stream,[IO.Compression.CompressionMode]::Compress,$true)
 $gzip.Write($bytes,0,$bytes.Length);$gzip.Dispose()
 [Console]::Out.WriteLine('gzip:'+ [Convert]::ToBase64String($stream.ToArray()));$stream.Dispose()
}catch{[pscustomobject]@{ok=$false;error=$_.Exception.Message}|ConvertTo-Json -Depth 3 -Compress;exit 1}
