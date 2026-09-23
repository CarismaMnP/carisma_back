# Checkmate integration

The source of imported inventory is Checkmate, yard 9032. The application no longer calls eBay APIs or runs an eBay import job. Column names beginning with `ebay` remain for existing storefront compatibility and historic URLs. They are populated from Checkmate. A one-time migration uses Checkmate's own listing history to retain the active website product ID when listings were replaced; older aliases remain unavailable.

## Inventory ownership and availability

`products.source` distinguishes `carparts`, `manual`, and archived/unmapped `legacy` data. Only `carparts` products can be retired by reconciliation or create a native removal job. Admin additions and copies always become manual items. Checkmate products are edited at their source; hiding one in the website admin affects the website only.

One GUID represents one physical part. Eligible rows have Part other than AUT, Available=Yes, Private other than Yes, blank Status, no work order/hold and positive retail price. Status S is sold even if Available still says Yes. A complete missing record also becomes unavailable. A partial snapshot, inconsistent counts, wrong yard, duplicate GUIDs or a drop exceeding 20% stops reconciliation for review. Current site reservations, paid sales and admin hides cannot be resurrected by later imports.

The worker reads inventory and photo metadata every five minutes. This full identity scan is needed to detect physical deletions; stable hashes prevent rewriting unchanged website records or re-uploading unchanged images. Photos go directly from Windows to existing S3-compatible storage using short-lived, object-specific upload URLs. The Windows bridge has no permanent S3 credentials. Privacy, path and source checksums are revalidated before reading files. Images are rotated and resized within 1600px with JPEG quality 88. Original files and the Checkmate database are unchanged. Obsolete photo slots without a file are excluded; a large missing-file anomaly stops the snapshot.

## Checkout and sales

Before checkout, the API checks live Checkmate availability and price, then locks website product rows and creates a 35-minute local reservation. Stripe Checkout expires after 30 minutes. Only signed, matching live payments can apply stock and create a persistent outbox job. Order state alone is never proof of payment. A GUID can belong to one removal job only. Duplicate events share a transaction and cannot debit stock twice.

An independent worker checks jobs every five seconds. Native removal uses the previously verified Workstation `SQLUser.SPInventoryUpdate` single-part contract, with fresh identity/state/timestamp checks. There is no SQL DELETE/UPDATE against Checkmate and no direct marketplace delisting. The removal comment is `WEB <order UUID>`. On an uncertain connection failure, retrying the same order checks that audit record before considering the operation successful. Changed identity, source unavailability, assemblies or rejected native operations require review. Assemblies and child parts are never removed as a group.

The worker checks genuine Stripe session status before releasing expired reservations, including recovering a session whose response was lost. Refunds, disputes and manual status edits do not restore deleted physical inventory. The native operation records an inventory removal, not a Checkmate financial invoice. Website payment and order history remain in the website database.

Cross-channel checkout is not a distributed transaction: a part can sell elsewhere while a customer pays. The live pre-check reduces this window; a source conflict after payment is held for manager review rather than removing an unrelated item. Checkmate controls the delay before its marketplace updates appear.

## Deployment and configuration

`deploy.sh` applies additive migrations and supervises `carisma_backend` plus `carisma_carparts` with PM2. `/etc/carisma/integration.env` survives GitHub checkout. Required machine settings:

- `CARPARTS_SALES_ENABLED=true` only after cutover validation.
- `CARPARTS_SALES_AFTER=<UTC cutover time>`: earlier orders cannot trigger removal.
- `CARPARTS_STAGE_ONLY=false` for publication; true only stages photos.
- `CARPARTS_SYNC_INTERVAL_MS=300000`.
- `CARPARTS_IMAGE_DIRECT=true` for Windows-to-S3 uploads.
- Optional `CARPARTS_S3_PUBLIC_URL` and `CARPARTS_SSH_DIR` override existing storage/access locations.

The dedicated key at `/etc/carisma/carparts_ed25519` connects only through the existing loopback tunnel on port 22022. Windows authorized_keys forces `C:/CarismaSync/bridge.ps1` and disallows forwarding. Host keys are pinned. Requests are gzip/base64 envelopes passed through SSH_ORIGINAL_COMMAND as data, never executed. This avoids unreliable Windows SSH stdin delivery. Responses are compressed; the bridge only accepts the documented catalog, stock, image and sale actions. Deploy all `.ps1` files and `ImageUpload.cs` from `integrations/carparts` together.

Windows `C:\CarismaSync\config.json` has `enableSales`, `salesAfter` and `uploadHost`. Both Linux and Windows sale gates must be enabled. `uploadHost` is the existing object-storage endpoint hostname. Never put the website database password or permanent S3 keys on Windows.

## Operations and verification

The protected admin page `/carparts` shows freshness, source counts, photo progress and paid-order jobs needing review. A stale catalog blocks checkout of Checkmate items while manual items remain independent. Failed connections retry with backoff and persisted checkpoints. PM2 restarts workers after failure; advisory locks prevent overlapping copies of a job.

`NODE_ENV=production node scripts/carparts.js status` reads status. `audit-sale GUID` verifies native removal prerequisites without calling the write procedure. The CLI intentionally has no command to submit a synthetic live removal. `stage` stages image metadata; `sync` publishes a complete snapshot. Do not run these casually on another installation.

`npm run test:carparts` runs pure/mocked tests. Transactional tests only run with `CARPARTS_TEST_DB=true` and a database name beginning `carisma_sync_test_`; they reset that isolated database. Never set those flags on production. Tests never call the live bridge or send payment emails. A full-catalog rehearsal must preserve manual products, retain active relisting IDs, reconcile missing records and make a second identical import perform zero product updates.

Before cutover, create and verify a database backup. Migrations are additive; rolling back application code does not require deleting synchronization identities or paid-order audit history. To pause native writes, set `CARPARTS_SALES_ENABLED=false` and restart the worker, and/or disable `enableSales` on Windows. Preserve queued jobs for investigation. A process restart or deploy must never reset the cutover timestamp or replay historical paid orders.
