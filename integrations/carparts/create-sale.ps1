param($Request,[switch]$AuditOnly)
# Native work-order/invoice workflow; never UPDATE/DELETE business tables.
# Checkpoints are flushed before each native call. Uncertain writes require reconciliation.
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
. "$PSScriptRoot\native-sale-contract.ps1"
$c=New-Object Data.Odbc.OdbcConnection('DSN=Checkmate')
$mutex=New-Object Threading.Mutex($false,'Global\CarismaCheckmateSaleV1')
$locked=$false;$writeCalled=$false;$state=$null
function Q([string]$sql,[object[]]$values=@()) {
 $q=$c.CreateCommand();$q.CommandTimeout=45;$q.CommandText=$sql
 foreach($v in $values){$p=$q.Parameters.Add('p'+$q.Parameters.Count,[Data.Odbc.OdbcType]::VarChar,16384);$p.Value=[string]$v}
 $rd=$q.ExecuteReader();$rows=New-Object 'System.Collections.Generic.List[object]'
 try{while($rd.Read()){$r=[ordered]@{};for($i=0;$i-lt$rd.FieldCount;$i++){$v=$rd.GetValue($i);if($v-is[DBNull]){$v=$null};$r[$rd.GetName($i)]=$v};$rows.Add([pscustomobject]$r)}}finally{$rd.Close();$q.Dispose()};return $rows.ToArray()
}
function Canonical($value) {
 if($null-eq$value){return $null}
 if($value-is[pscustomobject]){$out=[ordered]@{};foreach($p in @($value.PSObject.Properties|Sort-Object Name)){$out[$p.Name]=Canonical $p.Value};return $out}
 if($value-is[array]){$list=New-Object 'Collections.Generic.List[object]';foreach($v in $value){$list.Add((Canonical $v))};return ,$list.ToArray()}
 return $value
}
function Save {
 $bytes=[Text.Encoding]::UTF8.GetBytes(($state|ConvertTo-Json -Depth 15 -Compress))
 $tmp=$statePath+'.tmp'
 $f=New-Object IO.FileStream($tmp,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
 try{$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}
 if(Test-Path -LiteralPath $statePath){[IO.File]::Replace($tmp,$statePath,($statePath+'.previous'))}else{[IO.File]::Move($tmp,$statePath)}
}
function Text([object]$value,[int]$max=100) {
 $s=([string]$value).Trim() -replace '[\x00-\x1f\x7f}]',' '
 if($s.Length-gt$max){throw 'Customer field exceeds native field length; review required'}
 return $s
}
function Native([string]$key,[string]$method,$fields) {
 if($AuditOnly){throw 'Audit cannot write'}
 if(@($state.attempts|Where-Object{$_.key-eq$key}).Count){throw ('Uncertain native call '+$key+'; inspect work order before retry')}
 $expected=@($specs.$method);$values=@()
 foreach($k in $fields.Keys){if($k-notin$expected){throw 'Unexpected native argument'}}
 foreach($k in $expected){if($k-eq'PASS'){$values+=Marker}else{$v='';if($fields.Contains($k)){$v=[string]$fields[$k]};$values+=$v}}
 $state.attempts=@($state.attempts)+[pscustomobject]@{key=$key;method=$method;at=[datetime]::UtcNow.ToString('o');returned=$false}
 Save
 $script:writeCalled=$true
 $r=@(Q ('SELECT SQLUser.'+$method+'('+((@('?')*$values.Count)-join ',')+') AS Result') $values)
 $state.attempts[-1].returned=$true;Save
 if(!$r.Count -or [string]::IsNullOrWhiteSpace([string]$r[0].Result) -or [string]$r[0].Result-match'^(ERROR|FAIL)'){throw ('Native '+$method+' rejected; inspect checkpoint')}
}
function Headers {return @(Q 'SELECT WONum,WOStatus,Finalized,InvoiceNum,CustomerBillTo,Email,PO,AmountPaid,MethodOfPayment,PartsSubtotal,Tax,TotalPrice,Freight FROM SQLUser.WOSummary WHERE Yard=9032 AND PO=?' @($po))}
function EmailAddress($value) {return (([string]$value)-replace '^mailto:','').Trim()}
function Header {
 $hs=@(Headers);if($hs.Count-ne1){throw 'Expected one work order for website reference'}
 if([string]$hs[0].WONum-ne[string]$state.wo -or [string]$hs[0].CustomerBillTo-ne$customerName -or (EmailAddress $hs[0].Email)-ine$customerEmail){throw 'Work order customer or reference changed'}
 return $hs[0]
}
function Details {return @(Q 'SELECT WONum,ItemNum,GUID,Tag,NetAmount,Subtotal,Taxed,LineItemType FROM SQLUser.WODetail WHERE Yard=9032 AND WONum=?' @([string]$state.wo))}
function Target($line) {
 $ts=@(Q 'SELECT CAST(ID AS VARCHAR(200)) AS InventoryID,GUID,Tag,Yard,Part,Description,Model,Yr,VIN,PartKind,Status,Available,Private,DisplayStatus,EbayStatus,WONum,HoldName,AssemblyParentGUID FROM SQLUser.Inventory WHERE GUID=?' @($line.guid))
 if($ts.Count-ne1){throw 'Inventory missing or ambiguous'};$t=$ts[0]
 if($t.InventoryID-ne$line.inventoryId -or $t.Tag-ne$line.tag -or $t.Yard-ne9032 -or $t.Part-eq'AUT'){throw 'Inventory identity mismatch'}
 return $t
}
function Available($line) {
 $t=Target $line
 if($t.Available-ine'Yes' -or $t.Private-ieq'Yes' -or ([string]$t.Status).Trim() -or ([string]$t.EbayStatus).Trim()-ieq'C' -or ([string]$t.DisplayStatus).Trim()-ieq'C' -or $t.WONum -or $t.HoldName){throw 'Part no longer available; review required'}
 if(($t.AssemblyParentGUID -and $t.AssemblyParentGUID-ne'X') -or @(Q 'SELECT GUID FROM SQLUser.Inventory WHERE AssemblyParentGUID=?' @($line.guid)).Count){throw 'Assembly part requires manual sale'}
 if(@(Q 'SELECT WONum FROM SQLUser.WODetail WHERE GUID=?' @($line.guid)).Count){throw 'Inventory already assigned to a work order'}
 return $t
}
function VerifyDetails([switch]$Complete) {
 $ds=@(Details)
 if($Complete -and $ds.Count-ne$lines.Count){throw 'Invoice line count mismatch'}
 foreach($d in $ds){
  $ls=@($lines|Where-Object{$_.guid-eq$d.GUID})
  if($ls.Count-ne1 -or $d.Tag-ne$ls[0].tag -or $d.LineItemType-ne'Regular sale' -or
     [decimal]$d.NetAmount-ne([decimal]$ls[0].priceCents/100) -or $d.Taxed-ne'No'){throw 'Unexpected sale line, amount or tax'}
 }
 if(@($ds|ForEach-Object{[string]$_.GUID}|Select-Object -Unique).Count-ne$ds.Count){throw 'Duplicate sale line'}
}
function VerifyPayment($h) {
 if($h.Finalized-ne'Yes' -or $h.MethodOfPayment-ne'PrePaid' -or [decimal]$h.Tax-ne0 -or
    [decimal]$h.Freight-ne0 -or [decimal]$h.PartsSubtotal-ne$total -or [decimal]$h.TotalPrice-ne$total -or [decimal]$h.AmountPaid-ne$total){throw 'Invoice payment or totals mismatch'}
}
try {
 $id=[string]$Request.orderId
 if($id-notmatch'^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$' -or $Request.version-ne1 -or $Request.currency-ne'USD' -or $Request.taxMode-ne'not_taxable'){throw 'Invalid sale contract'}
 $po='WEB '+$id;$lines=@($Request.lines)
 if(!$lines.Count -or $lines.Count-gt100){throw 'Invalid sale size'}
 $totalCents=0
 foreach($line in $lines){
  if([string]$line.guid-notmatch'^[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12}$' -or $line.quantity-ne1 -or
     [string]$line.priceCents-notmatch'^[1-9][0-9]{0,8}$' -or !$line.inventoryId -or !$line.tag){throw 'Invalid sale line'}
  $totalCents += [long]$line.priceCents
 }
 if(@($lines.guid|Select-Object -Unique).Count-ne$lines.Count){throw 'Duplicate requested GUID'}
 $total=[decimal]$totalCents/100
 $customerName=Text $Request.customer.name 80;$customerEmail=Text $Request.customer.email 100;$phone=Text $Request.customer.phone 40
 if(!$customerName -or !$customerEmail){throw 'Customer name and email required'}
 $billing=$Request.customer.billing;$shipping=$Request.customer.shipping
 if(!$billing.line1){$billing=$shipping};if(!$shipping.line1){$shipping=$billing}
 $fields=[ordered]@{Yard='9032';Name=$customerName;Phone=$phone;Email=$customerEmail;
  ShipName=$customerName;ShipPhone=$phone;ShipEmail=$customerEmail;OrderBy='website';PO=$po;Mail='N';UID='100';BillContact=$customerName;CreateSource='WK'}
 foreach($entry in @(@('',$billing),@('Ship',$shipping))){$prefix=[string]$entry[0];$a=$entry[1]
  $fields[$prefix+'Addr1']=Text $a.line1 80
  $fields[$prefix+'Addr2']=Text $a.line2 80
  $fields[$prefix+'Addr3']=Text ((@($a.city,$a.state,$a.postal_code)|Where-Object{$_}) -join ' ') 80
  $fields[$prefix+'Addr4']=Text $a.country 40
 }
 $note='Website '+$id+'. Website tax '+([decimal]$Request.websiteTaxCents/100).ToString('0.00',[Globalization.CultureInfo]::InvariantCulture)+' USD recorded separately; Checkmate lines non-taxable.'
 if($Request.isIntegrationTest-eq$true){$note='TEST - NO REAL PAYMENT - DO NOT SHIP. '+$note}
 $fields['Notes']=Text $note 180
 try{$locked=$mutex.WaitOne(5000)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){throw 'Sale bridge busy; retry later'}
 $statePath=Join-Path (Join-Path $PSScriptRoot 'sales') ($id+'.json')
 $sha=[Security.Cryptography.SHA256]::Create()
 try{
  $body=$Request|Select-Object -Property * -ExcludeProperty action
  $legacyFingerprint=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($body|ConvertTo-Json -Depth 15 -Compress)))).Replace('-','')
  $fingerprint=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(((Canonical $body)|ConvertTo-Json -Depth 15 -Compress)))).Replace('-','')
 }finally{$sha.Dispose()}
 $state=[pscustomobject]@{version=1;orderId=$id;fingerprint=$fingerprint;wo=$null;invoice=$null;attempts=@()}
 if(Test-Path -LiteralPath $statePath){$state=Get-Content -Raw -LiteralPath $statePath|ConvertFrom-Json
  if($state.orderId-ne$id -or ($state.fingerprint-ne$fingerprint -and $state.fingerprint-ne$legacyFingerprint)){throw 'Immutable sale payload differs from checkpoint'}
 }
 $c.Open()
 foreach($method in @('WOCreate','WOAddPart','FinalizeWO','PostInvoice')) {
  $live=@(Q 'SELECT FormalSpec FROM %Dictionary.MethodDefinition WHERE Parent=? AND Name=?' @('User.WorkOrder',$method))
  $actual=@([regex]::Split([string]$live[0].FormalSpec,',(?=\w+:)')|ForEach-Object{($_ -split ':',2)[0]})
  if(($actual-join',')-cne(@($specs.$method)-join',')){throw 'Native parameter contract changed'}
 }
 $user=@(Q "SELECT EmpName,EmpPrivileges,YardNumber FROM SQLUser.UserFeatures WHERE EmpNum='100'")
 if($user.Count-ne1 -or $user[0].EmpName-ne'SERGEI' -or $user[0].YardNumber-ne9032 -or $user[0].EmpPrivileges-notmatch',1,'){throw 'Native application user changed'}
 $settings=@(Q 'SELECT HomeYard,InvPostPaidInFull,InvDelayPost,DefaultWarranty FROM SQLUser.YardSettings')
 if($settings.Count-ne1 -or $settings[0].HomeYard-ne9032 -or $settings[0].InvDelayPost-ne'N' -or $settings[0].DefaultWarranty-ne'90D'){throw 'Native invoice configuration changed'}
 $headers=@(Headers)
 if($headers.Count-gt1){throw 'Duplicate website work orders'}
 if($headers.Count-eq1){
  if(!@($state.attempts|Where-Object{$_.key-eq'create'}).Count){throw 'Existing work order without local checkpoint'}
  if($state.wo -and [string]$state.wo-ne[string]$headers[0].WONum){throw 'Checkpoint work order changed'}
  $state.wo=[string]$headers[0].WONum
  $h=Header;VerifyDetails
 }else{
  foreach($line in $lines){$null=Available $line}
 }
 if($AuditOnly){[pscustomobject]@{ok=$true;state='audit_only';orderId=$id;workOrder=$state.wo;writeCalled=$false;lines=$lines.Count;subtotalCents=$totalCents;taxCents=0}|ConvertTo-Json -Compress;return}
 $config=Get-Content -Raw -LiteralPath "$PSScriptRoot\config.json"|ConvertFrom-Json
 $testAllowed=($Request.isIntegrationTest-eq$true -and $Request.paidLive-ne$true -and $config.testSale.orderId-eq$id -and
  $lines.Count-eq1 -and $lines[0].guid-eq$config.testSale.guid -and [datetimeoffset]$config.testSale.expiresAt-gt[datetimeoffset]::UtcNow)
 if($config.enableSales-ne$true -or (!$testAllowed -and ($Request.paidLive-ne$true -or $Request.isIntegrationTest-eq$true)) -or
    !$config.salesAfter -or !$Request.paidAt -or !$Request.createdAt -or
    [datetimeoffset]$Request.paidAt-lt[datetimeoffset]$config.salesAfter -or [datetimeoffset]$Request.createdAt-lt[datetimeoffset]$config.salesAfter){throw 'Sale is not authorized'}
 if(!(Test-Path -LiteralPath (Split-Path $statePath))){$null=New-Item -ItemType Directory -Path (Split-Path $statePath)}
 if(!$state.wo){Native 'create' 'WOCreate' $fields;$headers=@(Headers)
  if($headers.Count-ne1){throw 'WOCreate outcome unknown'};$state.wo=[string]$headers[0].WONum;Save}
 $h=Header;VerifyDetails
 if($h.WOStatus-ne'Posted'){
  foreach($line in $lines){
   $existing=@(Details|Where-Object{$_.GUID-eq$line.guid})
   if($existing.Count){continue}
   if($h.Finalized-eq'Yes' -or $h.InvoiceNum-gt0){throw 'Incomplete order already finalized'}
   $t=Available $line
   Native ('add:'+ $line.guid) 'WOAddPart' ([ordered]@{Yard='9032';WO=[string]$state.wo;ReqModel=[string]$t.Model;ReqYear=([int]$t.Yr%100).ToString('00');GUID=$line.guid;
    Price=([decimal]$line.priceCents/100).ToString('0.00',[Globalization.CultureInfo]::InvariantCulture);Tax='N';Warranty='90D';Discount='N';Description=[string]$t.Description;
    TextInsert=$(if($Request.isIntegrationTest){'website TEST - DO NOT SHIP - NO REAL PAYMENT'}else{'website '+$id});UID='100';AddInventory='N';PartKind=[string]$t.PartKind;
    DeleteItem='N';Vin=[string]$t.VIN;MarkIncompleteAssembly='N';TakeOwnership='WK';RemoveInv='N'})
   VerifyDetails
   if(@(Details|Where-Object{$_.GUID-eq$line.guid}).Count-ne1){throw 'WOAddPart outcome unknown'}
  }
  VerifyDetails -Complete
  $h=Header
  if($h.Finalized-ne'Yes'){
   Native 'finalize' 'FinalizeWO' ([ordered]@{Yard='9032';WO=[string]$state.wo;UID='100';Payment='T';Method='9';Deposit='0';Freight='0';FreightTax='N';RemoveDepositForce='N';TakeOwnership='WK'})
  }
  $h=Header;VerifyPayment $h
  Native 'post' 'PostInvoice' ([ordered]@{Yard='9032';WO=[string]$state.wo;UID='100'})
 }
 $h=Header;VerifyDetails -Complete;VerifyPayment $h
 if($h.WOStatus-ne'Posted' -or [long]$h.InvoiceNum-le0){throw 'Invoice posting outcome unknown'}
 foreach($line in $lines){$t=Target $line;if(([string]$t.Status).Trim()-ne'S' -or [string]$t.WONum-ne[string]$state.wo){throw 'Inventory is not sold on this work order'}}
 $state.invoice=[string]$h.InvoiceNum;Save
 [pscustomobject]@{ok=$true;state=$(if($writeCalled){'posted'}else{'already_posted'});orderId=$id;workOrder=$state.wo;invoice=$state.invoice;subtotalCents=$totalCents;taxCents=0;writeCalled=$writeCalled;lineCount=$lines.Count}|ConvertTo-Json -Compress
}catch {
 [pscustomobject]@{ok=$false;state='review_required';orderId=$Request.orderId;workOrder=$state.wo;writeCalled=$writeCalled;error=$_.Exception.Message}|ConvertTo-Json -Compress
}finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose();$c.Close();$c.Dispose()}
