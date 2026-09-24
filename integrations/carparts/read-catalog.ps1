param([switch]$IncludeLegacyHistory)
# Read-only complete inventory snapshot. No Checkmate writes or eBay calls.
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$c=New-Object System.Data.Odbc.OdbcConnection('DSN=Checkmate')
function Read-Q([string]$sql){
 $q=$c.CreateCommand();$q.CommandTimeout=90;$q.CommandText=$sql
 $rd=$q.ExecuteReader();$rows=New-Object System.Collections.Generic.List[object]
 try{while($rd.Read()){$r=[ordered]@{};for($i=0;$i -lt $rd.FieldCount;$i++){$v=$rd.GetValue($i);if($v -is [DBNull]){$v=$null}elseif($v -is [byte[]]){$v=[Text.Encoding]::Unicode.GetString($v)}elseif($v -is [datetime]){$v=$v.ToString('yyyy-MM-ddTHH:mm:ss')};$r[$rd.GetName($i)]=$v};$rows.Add([pscustomobject]$r)}}finally{$rd.Close();$q.Dispose()};return $rows.ToArray()
}
try{
 $c.Open();$r=[ordered]@{version=1;complete=$false;startedAt=[DateTime]::UtcNow.ToString('o');yard='9032'}
 $r.beforeCount=@(Read-Q "SELECT COUNT(*) AS N FROM SQLUser.Inventory WHERE Yard=9032 AND Part<>'AUT'")[0].N
 $r.items=@(Read-Q "SELECT CAST(p.ID AS VARCHAR(200)) AS InventoryID,p.GUID,p.Tag,p.Stock,p.Yard,p.Part,p.Description,p.PriceRetail,p.Status,p.DisplayStatus,p.EbayStatus,p.Available,p.Private,p.TimeStamp,p.WONum,p.HoldName,p.AssemblyParentGUID,p.Manufacturer,p.Model,p.Yr,p.VIN,p.Condition,p.PartGrade,p.Side,p.Interchange,p.EbayOriginalListingID,p.ItemSpecifics,p.AutGUID FROM SQLUser.Inventory p WHERE p.Yard=9032 AND p.Part<>'AUT'")
 $r.parts=@(Read-Q 'SELECT Part,FullName FROM SQLUser.Part')
 $r.vehicles=@(Read-Q 'SELECT GUID,ModelLong,Make,Mileage FROM SQLUser.InventoryAUT WHERE Yard=9032')
 $r.images=@(Read-Q 'SELECT i.GUID,i.ImageLocation,i.ImageNumber,i.PrimaryImage,i.CheckSum,i.WebCheckSum FROM SQLUser.PartImage i INNER JOIN SQLUser.Inventory p ON i.GUID=p.GUID WHERE p.Yard=9032 AND i.PrivateImage=0')
 # Checkmate retains old image-slot metadata after a photo is replaced. Publish
 # the files that actually exist, including the current primary image number.
 $missing=New-Object System.Collections.Generic.List[object]
 $present=New-Object System.Collections.Generic.List[object]
 $directories=@{}
 foreach($photo in $r.images){
  $location=[string]$photo.ImageLocation
  if($location -notmatch '^P:\\[0-9]{4}\\[A-Za-z0-9_-]+\\[A-Za-z0-9_-]+\.(jpg|jpeg|png)$'){throw 'Unexpected image path in catalog'}
  $local='D:\CPIMAGES\'+$location.Substring(3)
  $web=[IO.Path]::Combine([IO.Path]::GetDirectoryName($local),[IO.Path]::GetFileNameWithoutExtension($local)+'_web.jpg')
  $dir=[IO.Path]::GetDirectoryName($local)
  if(!$directories.ContainsKey($dir)){
   $set=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
   if([IO.Directory]::Exists($dir)){foreach($file in [IO.Directory]::EnumerateFiles($dir)){$null=$set.Add($file)}}
   $directories[$dir]=$set
  }
  if($directories[$dir].Contains($local) -or $directories[$dir].Contains($web)){$present.Add($photo)}else{$missing.Add($photo)}
 }
 if($missing.Count -gt $r.images.Count*0.1){throw 'Image storage appears incomplete; snapshot rejected'}
 $r.images=$present.ToArray();$r.missingImages=$missing.ToArray()
 # Existing IDs are only migration links; publication does not require a listing. Committed sales use Inventory.EbayStatus.
 $r.legacyLinks=@();if($IncludeLegacyHistory){$r.legacyLinks=@(Read-Q 'SELECT GUID,CAST(ItemID AS VARCHAR(30)) AS ItemID FROM SQLUser.EbayStatus UNION SELECT GUID,CAST(ItemID AS VARCHAR(30)) AS ItemID FROM SQLUser.EbayHistory WHERE GUID IS NOT NULL')}
 $r.afterCount=@(Read-Q "SELECT COUNT(*) AS N FROM SQLUser.Inventory WHERE Yard=9032 AND Part<>'AUT'")[0].N
 $r.finishedAt=[DateTime]::UtcNow.ToString('o');$r.complete=$true
 [pscustomobject]$r|ConvertTo-Json -Depth 6 -Compress
}finally{$c.Close();$c.Dispose()}
