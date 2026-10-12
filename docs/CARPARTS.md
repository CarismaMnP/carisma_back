# Checkmate integration

The source of imported inventory is Checkmate, yard 9032. The application no longer calls eBay APIs or runs an eBay import job. Column names beginning with `ebay` remain for existing storefront compatibility and historic URLs. They are populated from Checkmate. A one-time migration uses Checkmate's own listing history to retain the active website product ID when listings were replaced; older aliases remain unavailable.

## Inventory ownership and availability

`products.source` distinguishes `carparts`, `manual`, and archived/unmapped `legacy` data. Only `carparts` products can be retired by reconciliation or create a native invoice job. Admin additions and copies always become manual items. Checkmate products are edited at their source; hiding one in the website admin affects the website only. Private Checkmate records and archived legacy aliases are excluded from public direct product lookups. Archived legacy aliases cannot be edited back into available stock; an explicit manual copy creates a separately managed item.

One GUID represents one physical part. Eligible rows have Part other than AUT, Available=Yes, Private other than Yes, blank Status, no work order/hold and positive retail price. Status S is sold even if Available still says Yes. Inventory.EbayStatus C (Committed: sold on eBay awaiting an invoice) also blocks publication, checkout and native sale; DisplayStatus C is checked as a fallback. This is read from Checkmate itself, with no eBay API. An expired X listing or no listing does not make unsold stock unavailable. A complete missing record also becomes unavailable. A partial snapshot, inconsistent counts, wrong yard, duplicate GUIDs or a drop exceeding 20% stops reconciliation for review. Current site reservations, paid sales and admin hides cannot be resurrected by later imports.

The worker reads inventory and photo metadata every five minutes. This full identity scan is needed to detect physical deletions; stable hashes prevent rewriting unchanged website records or re-uploading unchanged images. Photos go directly from Windows to existing S3-compatible storage using short-lived, object-specific upload URLs. The Windows bridge has no permanent S3 credentials. Privacy, path and source checksums are revalidated before reading files. Images are rotated and resized within 1600px with JPEG quality 88. Original files and the Checkmate database are unchanged. Obsolete photo slots without a file are excluded; a large missing-file anomaly stops the snapshot.

## Checkout and sales

Before checkout, the API checks live Checkmate availability and price, then locks website product rows and creates a 35-minute local reservation. Stripe Checkout expires after 30 minutes. Only signed, matching live payments can apply stock and create a persistent outbox job. Order state alone is never proof of payment. A GUID can belong to one sale job only. Duplicate events share a transaction and cannot debit stock twice.

An independent worker checks jobs every five seconds. Jobs for all Checkmate parts in one website order are grouped into one work order and invoice. The verified native Workstation contracts are `WOCreate`, `WOAddPart`, `FinalizeWO`, and `PostInvoice`; inventory remains in Checkmate with Status S and the work-order number. The old `removeSale` bridge action is disabled. There is no direct SQL UPDATE/DELETE and no direct marketplace API call.

Checkout captures immutable unit prices and inventory identities. Before its first native call, the worker freezes the customer, billing/shipping addresses, lines and website totals in `orders.checkmatePayload`. All Checkmate lines use Tax=N, freight tax=N, and zero freight. Its PrePaid invoice records only the net price of Checkmate parts; website tax remains in `orders.tax` and is referenced separately in the work-order note. Manual parts remain website-only. Stripe is not charged by this bridge. Order state alone never authorizes a sale.

Windows serializes invoices with a global mutex and flushes a per-order checkpoint under `C:\CarismaSync\sales` before every native call. The PO is `WEB <order UUID>`. Each retry uses the same frozen payload and reconciles the work order, exact GUIDs, non-taxable lines, totals, payment and posted inventory. An attempted call with no verifiable effect is held for review, never blindly reissued. Preserve these checkpoint files in backups. Missing historical checkout prices, changed identities, assemblies or source conflicts require review. Inspect the named work order before manual resolution; do not delete checkpoints to force a retry.

The worker checks genuine Stripe session status before releasing expired reservations, including recovering a session whose response was lost. Refunds, disputes and manual status edits do not restore sold inventory or reverse a posted invoice. Returns require separate operator handling. Both invoice/work-order numbers are shown on the website admin order. Existing successful removal jobs remain historical records and are never replayed as invoices.

An owner-authorized integration test uses an explicitly marked `isIntegrationTest` order, `paidLive=false`, no Stripe payment ID or emails, one allowlisted GUID/order/expiry in Windows `config.testSale`, and the matching process-local `CARPARTS_TEST_ORDER_ID`. The normal worker ignores these orders. `scripts/checkmate-test-sale.js` refuses to proceed without the exact order and product IDs, checks the product is still the cheapest available website item, and reuses that order on retries. Remove the temporary Windows allowlist afterwards. This is a real native inventory/invoice mutation despite no money being charged; never run it without explicit owner authorization.

Cross-channel checkout is not a distributed transaction: a part can sell elsewhere while a customer pays. The live pre-check reduces this window; a source conflict after payment is held for manager review rather than selling an unrelated item. Checkmate controls the delay before its marketplace updates appear.

## Deployment and configuration

`deploy.sh` applies additive migrations and supervises `carisma_backend` plus `carisma_carparts` with PM2. `/etc/carisma/integration.env` survives GitHub checkout. Required machine settings:

- `CARPARTS_SALES_ENABLED=true` only after cutover validation.
- `CARPARTS_SALES_AFTER=<UTC cutover time>`: earlier orders cannot trigger sales.
- `CARPARTS_STAGE_ONLY=false` for publication; true only stages photos.
- `CARPARTS_SYNC_INTERVAL_MS=300000`.
- `CARPARTS_IMAGE_DIRECT=true` for Windows-to-S3 uploads.
- `CARPARTS_IMAGE_WORKERS=4` by default; bounded photo concurrency leaves connection capacity for checkout.
- Optional `CARPARTS_S3_PUBLIC_URL` and `CARPARTS_SSH_DIR` override existing storage/access locations.

The dedicated key at `/etc/carisma/carparts_ed25519` connects only through the existing loopback tunnel on port 22022. Windows authorized_keys forces `C:/CarismaSync/bridge.ps1` and disallows forwarding. Host keys are pinned. Requests are gzip/base64 envelopes passed through SSH_ORIGINAL_COMMAND as data, never executed. This avoids unreliable Windows SSH stdin delivery. Responses are compressed; the bridge only accepts the documented catalog, stock, image and sale actions. Deploy all `.ps1` files and `ImageUpload.cs` from `integrations/carparts` together.

Windows `C:\CarismaSync\config.json` has `enableSales`, `salesAfter` and `uploadHost`. Both Linux and Windows sale gates must be enabled. `uploadHost` is the existing object-storage endpoint hostname. Never put the website database password or permanent S3 keys on Windows.

## Operations and verification

The protected admin page `/carparts` shows freshness, source counts, photo progress and paid-order jobs needing review. A stale catalog blocks checkout of Checkmate items while manual items remain independent. Failed connections retry with backoff and persisted checkpoints. PM2 restarts workers after failure; advisory locks prevent overlapping copies of a job.

`NODE_ENV=production node scripts/carparts.js status` reads status. `audit-sale GUID` is a legacy read-only stock audit; `auditInvoiceSale` validates the invoice contract and availability without writes. `stage` stages image metadata; `sync` publishes a complete snapshot. Do not run these casually on another installation.

`npm run test:carparts` runs pure/mocked tests. Transactional tests only run with `CARPARTS_TEST_DB=true` and a database name beginning `carisma_sync_test_`; they reset that isolated database. Never set those flags on production. Tests never call the live bridge or send payment emails. A full-catalog rehearsal must preserve manual products, retain active relisting IDs, reconcile missing records and make a second identical import perform zero product updates.

Before cutover, create and verify a database backup. Migrations are additive; rolling back application code does not require deleting synchronization identities or paid-order audit history. To pause native writes, set `CARPARTS_SALES_ENABLED=false` and restart the worker, and/or disable `enableSales` on Windows. Preserve queued jobs for investigation. A process restart or deploy must never reset the cutover timestamp or replay historical paid orders.

## Customer profiles and product administration

The October 2026 additive migration fills blank account names from the latest confirmed/completed/refunded order with the same normalized email and user ID. Existing names are preserved. Future verified payment confirmations perform the same blank-only fill atomically.

Admin `/product` supports `active`, `inactive` (independent boolean strings), `minPrice`, `maxPrice`, exact `make`/`model`, `source`, case-insensitive literal `search` (name/tag/GUID/ID), `sort` (`newest`, `price_asc`, `price_desc`, `name`), `page`, and `limit` (1–100). Defaults: active, 25/page. Both status flags enable all rows; neither returns none. Inactive includes hidden and sold stock. Counts reflect all other filters. `/product/filters` returns makes and their models, including unavailable inventory. Only the protected admin router exposes these views.
