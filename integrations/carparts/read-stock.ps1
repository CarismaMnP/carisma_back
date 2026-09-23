param($Request)
$ErrorActionPreference='Stop'
$guids=@($Request.guids)
if(!$guids.Count -or $guids.Count -gt 100){throw 'Invalid stock request size'}
$c=New-Object System.Data.Odbc.OdbcConnection('DSN=Checkmate')
$rows=New-Object System.Collections.Generic.List[object]
try{
 $c.Open()
 foreach($guid in $guids){
  if($guid -notmatch '^[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12}$'){throw 'Invalid stock GUID'}
  $q=$c.CreateCommand();$q.CommandTimeout=10
  $q.CommandText='SELECT GUID,Part,Available,Private,Status,WONum,HoldName,PriceRetail FROM SQLUser.Inventory WHERE Yard=9032 AND GUID=?'
  $null=$q.Parameters.Add('guid',[Data.Odbc.OdbcType]::VarChar,36);$q.Parameters[0].Value=$guid
  $rd=$q.ExecuteReader()
  try{while($rd.Read()){$row=[ordered]@{};for($i=0;$i -lt $rd.FieldCount;$i++){$v=$rd.GetValue($i);if($v -is [DBNull]){$v=$null};$row[$rd.GetName($i)]=$v};$rows.Add([pscustomobject]$row)}}finally{$rd.Close();$q.Dispose()}
 }
 [pscustomobject]@{ok=$true;items=$rows.ToArray()}|ConvertTo-Json -Depth 3 -Compress
}finally{$c.Close();$c.Dispose()}
