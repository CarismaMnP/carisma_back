# No ODBC/database access. Exercise the actual checkpoint/call functions with a fake native executor.
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'create-sale.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Sale script has syntax errors'}
. "$PSScriptRoot\native-sale-contract.ps1"
foreach($name in @('Save','Native','Canonical','EmailAddress','VerifyEditable','CompleteWorkOrder','CompletedHandoff')){
 $fn=$ast.Find({param($node) $node-is[Management.Automation.Language.FunctionDefinitionAst] -and $node.Name-eq$name},$true)
 . ([scriptblock]::Create($fn.Extent.Text))
}
$dir=Join-Path ([IO.Path]::GetTempPath()) ('carisma-checkpoint-test-'+[guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $dir
$statePath=Join-Path $dir 'test.json';$AuditOnly=$false;$script:calls=0;$script:loseResponse=$false
function Q($sql,$values){$script:calls++;if($script:loseResponse){throw 'Simulated connection loss'};return [pscustomobject]@{Result='1'}}
try {
 $state=[pscustomobject]@{attempts=@();wo=$null;fingerprint=$null}
 Native 'create' 'WOCreate' ([ordered]@{Yard='9032'})
 $state=Get-Content -Raw $statePath|ConvertFrom-Json
 if($state.attempts.Count-ne1 -or !$state.attempts[0].returned -or !(Test-Path ($statePath+'.previous'))){throw 'Atomic checkpoint persistence failed'}
 $blocked=$false;try{Native 'create' 'WOCreate' ([ordered]@{})}catch{$blocked=$_.Exception.Message-like'Uncertain native call*'}
 if(!$blocked -or $script:calls-ne1){throw 'Duplicate native call was not blocked'}
 $script:loseResponse=$true
 try{Native 'add:fake' 'WOAddPart' ([ordered]@{})}catch{if($_.Exception.Message-ne'Simulated connection loss'){throw}}
 $state=Get-Content -Raw $statePath|ConvertFrom-Json
 if($state.attempts.Count-ne2 -or $state.attempts[-1].returned){throw 'Uncertain attempt was not persisted'}
 $blocked=$false;try{Native 'add:fake' 'WOAddPart' ([ordered]@{})}catch{$blocked=$_.Exception.Message-like'Uncertain native call*'}
 if(!$blocked -or $script:calls-ne2){throw 'Uncertain write was replayed'}
 foreach($method in @('FinalizeWO','PostInvoice','WOChangeField')){
  $blocked=$false;try{Native ('forbidden:'+ $method) $method ([ordered]@{})}catch{$blocked=$_.Exception.Message-eq'Only editable work-order operations are allowed'}
  if(!$blocked -or $script:calls-ne2){throw 'Financial or edit operation was allowed'}
 }
 $AuditOnly=$true;$blocked=$false;try{Native 'post' 'PostInvoice' ([ordered]@{})}catch{$blocked=$_.Exception.Message-eq'Audit cannot write'}
 if(!$blocked -or $script:calls-ne2){throw 'Audit attempted a write'}
 if((EmailAddress 'mailto:buyer@example.invalid')-ne'buyer@example.invalid'){throw 'Native email prefix normalization failed'}
 $a=Canonical ('{"customer":{"name":"Test","email":"x"},"lines":[{"price":776,"guid":"a"}],"empty":[]}'|ConvertFrom-Json)
 $b=Canonical ('{"empty":[],"lines":[{"guid":"a","price":776}],"customer":{"email":"x","name":"Test"}}'|ConvertFrom-Json)
 if(($a|ConvertTo-Json -Depth 15 -Compress)-cne($b|ConvertTo-Json -Depth 15 -Compress)){throw 'Payload hash depends on JSON property order'}
 $future=[datetimeoffset]::UtcNow.AddMinutes(30)
 foreach($offset in @(-4,0,5)){if([datetimeoffset]($future.ToOffset([timespan]::FromHours($offset)).ToString('o'))-le[datetimeoffset]::UtcNow){throw 'Timezone expiry check failed'}}
 $AuditOnly=$false;$id='test';$totalCents=1994;$total=[decimal]19.94;$fingerprint='test';$state.wo='2500'
 $lines=@([pscustomobject]@{guid='one'},[pscustomobject]@{guid='two'})
 $script:header=[pscustomobject]@{WOType='WK';WOStatus='Not Printed';Finalized=$null;InvoiceNum=0;Tax=0;Freight=0;PartsSubtotal=19.94;TotalPrice=19.94}
 $script:inventoryStatus='W';$script:assignedWO='2500';$script:detailsComplete=$true
 function Header {return $script:header}
 function VerifyDetails([switch]$Complete){if(!$Complete -or !$script:detailsComplete){throw 'Line count mismatch'}}
 function Target($line){return [pscustomobject]@{Status=$script:inventoryStatus;WONum=$script:assignedWO}}
 foreach($case in @('finalized','invoice','sold','wrong-wo','partial')){
  $script:header.Finalized=$(if($case-eq'finalized'){'Yes'}else{$null});$script:header.InvoiceNum=$(if($case-eq'invoice'){2000}else{0})
  $script:inventoryStatus=$(if($case-eq'sold'){'S'}else{'W'});$script:assignedWO=$(if($case-eq'wrong-wo'){'2501'}else{'2500'});$script:detailsComplete=$case-ne'partial'
  $blocked=$false;try{$null=CompleteWorkOrder}catch{$blocked=$true}
  if(!$blocked -or $state.handoff){throw ('Unsafe handoff accepted: '+$case)}
 }
 $script:detailsComplete=$true
 $receipt=CompleteWorkOrder
 if($receipt.state-ne'work_order' -or $receipt.invoice -or $receipt.finalized -or $receipt.lineCount-ne2){throw 'Invalid work-order receipt'}
 $state=Get-Content -Raw $statePath|ConvertFrom-Json
 # A manager may edit, add a line, or finalize after the durable handoff. A retry
 # acknowledges that transfer without touching any of those later decisions.
 function Header {throw 'Manager-owned order must not be reread for replay'}
 function Target($line){throw 'Manager-owned inventory must not be changed'}
 $retry=CompletedHandoff
 if($retry.state-ne'already_work_order' -or $retry.writeCalled -or $script:calls-ne2){throw 'Handoff replay was not a no-op'}
 [pscustomobject]@{ok=$true;checks=@('syntax','atomic-checkpoint','duplicate-call-blocked','lost-response-checkpoint','uncertain-write-not-replayed','audit-read-only','timezone-expiry','canonical-payload','financial-writes-forbidden','incomplete-finalized-or-unallocated-blocked','multi-line-handoff','manager-edits-preserved-on-retry');databaseCalls=0}|ConvertTo-Json -Compress
}finally{Remove-Item -LiteralPath $dir -Recurse -Force}
