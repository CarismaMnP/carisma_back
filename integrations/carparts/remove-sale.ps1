param($Request,[switch]$AuditOnly)
# A paid website order removes one physical part through the native Workstation procedure.
# Never use SQL DELETE/UPDATE against Checkmate or perform a separate marketplace delist.
$ErrorActionPreference='Stop'
function Review([string]$message){[pscustomobject]@{ok=$false;state='review_required';writeCalled=$false;error=$message}|ConvertTo-Json -Compress}
$guid=[string]$Request.guid;$orderId=[string]$Request.orderId
if($guid -notmatch '^[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12}$' -or $orderId -notmatch '^[0-9a-fA-F-]{36}$'){Review 'Invalid identity';return}
$reason='WEB '+$orderId
$c=New-Object System.Data.Odbc.OdbcConnection('DSN=Checkmate')
function Read-Q([string]$sql,[object[]]$values=@()){
 $q=$c.CreateCommand();$q.CommandTimeout=20;$q.CommandText=$sql
 foreach($v in $values){$null=$q.Parameters.Add('p'+$q.Parameters.Count,[Data.Odbc.OdbcType]::VarChar,16384);$q.Parameters[$q.Parameters.Count-1].Value=$v}
 $rd=$q.ExecuteReader();$rows=New-Object System.Collections.Generic.List[object]
 try{while($rd.Read()){$row=[ordered]@{};for($i=0;$i -lt $rd.FieldCount;$i++){$v=$rd.GetValue($i);if($v -is [DBNull]){$v=$null};$row[$rd.GetName($i)]=$v};$rows.Add([pscustomobject]$row)}}finally{$rd.Close();$q.Dispose()};return $rows.ToArray()
}
function Target {return @(Read-Q 'SELECT CAST(ID AS VARCHAR(200)) AS InventoryID,GUID,Tag,Yard,Part,Status,DisplayStatus,EbayStatus,Available,Private,WONum,HoldName,TimeStamp,AssemblyParentGUID FROM SQLUser.Inventory WHERE GUID=?' @($guid))}
try{
 $c.Open();$rows=@(Target)
 if($rows.Count -eq 0){
  $audit=@(Read-Q 'SELECT Comment FROM SQLUser.InvRemoval WHERE GUID=? AND Comment=?' @($guid,$reason))
  [pscustomobject]@{ok=($audit.Count -gt 0);state=$(if($audit.Count -gt 0){'already_removed'}else{'absent_without_order_audit'});writeCalled=$false}|ConvertTo-Json -Compress;return
 }
 if($rows.Count -ne 1){Review 'Ambiguous inventory GUID';return};$t=$rows[0]
 if($t.InventoryID -ne $Request.inventoryId -or $t.Tag -ne $Request.tag -or $t.Yard -ne 9032 -or $t.Part -eq 'AUT'){Review 'Inventory identity mismatch';return}
 if(([string]$t.Status).Trim() -ne '' -or ([string]$t.EbayStatus).Trim() -ieq 'C' -or ([string]$t.DisplayStatus).Trim() -ieq 'C' -or $t.Available -ine 'Yes' -or $t.Private -ieq 'Yes' -or $t.WONum -or $t.HoldName){
  [pscustomobject]@{ok=$false;state='unavailable';writeCalled=$false}|ConvertTo-Json -Compress;return
 }
 if($t.AssemblyParentGUID -and $t.AssemblyParentGUID -ne 'X'){Review 'Assembly part requires review';return}
 if(@(Read-Q 'SELECT GUID FROM SQLUser.Inventory WHERE AssemblyParentGUID=?' @($guid)).Count){Review 'Part has assembly children';return}
 $settings=@(Read-Q 'SELECT HomeYard,SalesAutoRemoveDelParts FROM SQLUser.YardSettings')
 if($settings.Count -ne 1 -or $settings[0].HomeYard -ne 9032 -or $settings[0].SalesAutoRemoveDelParts -ne 'Y'){Review 'Native deletion configuration changed';return}
 $user=@(Read-Q "SELECT EmpName,EmpPrivileges,YardNumber FROM SQLUser.UserFeatures WHERE EmpNum='100'")
 if($user.Count -ne 1 -or $user[0].EmpName -ne 'SERGEI' -or $user[0].YardNumber -ne 9032 -or $user[0].EmpPrivileges -notmatch ',1,'){Review 'Native application user changed';return}
 if($AuditOnly){[pscustomobject]@{ok=$true;state='audit_only';writeCalled=$false;guid=$guid}|ConvertTo-Json -Compress;return}
 $config=Get-Content -Raw -LiteralPath "$PSScriptRoot\config.json"|ConvertFrom-Json
 if($config.enableSales -ne $true -or $Request.paidLive -ne $true -or !$config.salesAfter -or [datetime]$Request.paidAt -lt [datetime]$config.salesAfter){throw 'Live sales are not enabled for this order'}
 $data=$guid+'}'+$reason+'}'+$t.TimeStamp+"`r`n"
 $seed='9032'+(Get-Date).ToString('MM/dd/yyyy',[Globalization.CultureInfo]::InvariantCulture)+'SPInventoryUpdate'
 $sha=[Security.Cryptography.SHA256]::Create();try{$marker=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($seed))).Replace('-','')}finally{$sha.Dispose()}
 $response=@(Read-Q 'SELECT SQLUser.SPInventoryUpdate(?,?,?,?,?,?,?) AS Result' @($marker,'','9032','100','',$data,''))
 $after=@(Target);$audit=@(Read-Q 'SELECT Comment FROM SQLUser.InvRemoval WHERE GUID=? AND Comment=?' @($guid,$reason))
 [pscustomobject]@{ok=($after.Count -eq 0 -and $audit.Count -gt 0);state=$(if($after.Count -eq 0 -and $audit.Count -gt 0){'removed'}else{'native_rejected'});writeCalled=$true;nativeResult=[string]$response[0].Result;remaining=$after.Count;orderAudit=($audit.Count -gt 0)}|ConvertTo-Json -Depth 3 -Compress
}finally{$c.Close();$c.Dispose()}
