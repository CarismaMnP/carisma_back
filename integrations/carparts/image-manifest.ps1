# One read query per batch, including current privacy flags and checksums.
function Get-ImageRecords($Connection,$Images){
 $guids=@($Images|ForEach-Object{[string]$_.GUID}|Select-Object -Unique)
 if(!$guids.Count -or $guids.Count -gt 64){throw 'Invalid image batch'}
 $q=$Connection.CreateCommand();$q.CommandTimeout=60
 $q.CommandText='SELECT GUID,ImageNumber,ImageLocation,CheckSum,WebCheckSum FROM SQLUser.PartImage WHERE PrivateImage=0 AND GUID IN ('+(($guids|ForEach-Object{'?'}) -join ',')+')'
 foreach($guid in $guids){
  if($guid -notmatch '^[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12}$'){throw 'Invalid image identity'}
  $null=$q.Parameters.Add('p'+$q.Parameters.Count,[Data.Odbc.OdbcType]::VarChar,36);$q.Parameters[$q.Parameters.Count-1].Value=$guid
 }
 $reader=$q.ExecuteReader();$records=@{}
 try{while($reader.Read()){
  $key=[string]$reader['GUID']+'|'+[string]$reader['ImageNumber']+'|'+[string]$reader['ImageLocation']
  $records[$key]=@{path=[string]$reader['ImageLocation'];checksum=[string]$reader['CheckSum'];web=[string]$reader['WebCheckSum']}
 }}finally{$reader.Close();$q.Dispose()}
 return $records
}
