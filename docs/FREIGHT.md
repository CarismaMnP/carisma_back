# Freight checkout

Large parts require a server-validated Savtrans quote or free local pickup. Small-only orders keep the existing Standard Shipping checkout. Mixed orders charge freight for the large items; smaller items retain standard shipping.

## Categories and packing

`products.carpartsPartCode` is imported from Checkmate `Part` (also retained in `carpartsData.part`). Matching is exact by code, not eBay categories or title keywords. `TRA` is the live transmission code; `TR` is an alias. Both `RGL` and `RGF` use the supplied roof packing profile. Manual products use `freightCategoryCode`, editable in the admin product form. Imported products retain Checkmate ownership. The migration classifies existing manual Engine/Engines categories as ENG.

`integrations/freight/profiles.js` is the versioned packing configuration. Dimensions are inches, weights pounds, one pallet/piece per large item. Values must describe the actual packed shipment, including packaging. A changed profile invalidates existing unconsumed quotes. The class/NMFC mapping was verified against the authenticated Savtrans commodity selector on 2026-10-19:

| Code | L × W × H | lbs | Class | NMFC |
|---|---|---:|---:|---|
| FDR / RDR | 60 × 40 × 55 | 165 | 150 | 18520-2 |
| FBR / RBR | 80 × 40 × 30 | 160 | 300 | 18415-6 |
| HOD | 85 × 40 × 65 | 165 | 250 | 18600 |
| PLR | 50 × 40 × 55 | 250 | 250 | 18260-3 |
| QTR | 90 × 40 × 60 | 300 | 250 | 18260-3 |
| APL | 80 × 40 × 55 | 250 | 250 | 18260-3 |
| ENG | 50 × 40 × 40 | 450 | 110 | 120850-8 |
| TRA / TR | 45 × 40 × 30 | 250 | 100 | 18260-6 |
| LID | 65 × 40 × 55 | 180 | 150 | 18520-2 |
| RGL / RGF | 75 × 40 × 60 | 200 | 300 | 18260-2 |
| HDL | 50 × 40 × 70 | 125 | 300 | 18260-2 |
| FEN | 52 × 40 × 40 | 100 | 250 | 18660-1 |
| DPN | 65 × 40 × 40 | 125 | 100 | 18900 |

Dedicated commodities take precedence over the generic density class. Generic Auto Parts NOI and Transmission brackets use `lbs * 1728 / (L*W*H)`. Bumpers use the palletized commodity. Shipping inventory outside these profiles requires an explicit future profile; title matching must not silently reclassify small accessories.

## Broker connection

Official API: https://vsa.savtrans.com/api.php/doc/rest/rate_request
Authentication: https://vsa.savtrans.com/api.php/doc/auth

Machine configuration in `/etc/carisma/integration.env`:

```
FREIGHT_ENABLED=true
SAVTRANS_USERNAME=<portal username>
SAVTRANS_PASSWORD=<portal password>
```

Use HTTPS Basic authentication only. Credentials never enter browser code, query strings, quote logs, or the repository. Only POST rate_request and GET its returned same-origin reference are implemented; no dispatch/truck booking, insurance purchase, or bill-of-lading action is invoked.

Origin ZIP 32209. Mandatory delivery accessorial 4 (lift gate); residential adds 8; limited access adds 7. Each physical large part creates a shipment item. Insured value is the sum of large-part prices, as requested by Carisma; the broker's UI recommends including freight too, but this integration intentionally insures the specified goods value. The minimum positive `total_charge` is selected numerically. That amount ALREADY includes `insured_charge` and must not be increased again.

Every new request is persisted in `freight_quotes`, including failure, trusted dimensions/classification, rates, selected carrier and reference. No customer address/name goes to the broker during quoting, only ZIP, address type and shipment details. Authentication is required. Per-user lock, in-flight guard and limits (20/hour/user, 200/hour total) protect the account. Identical quotes are reused for up to 30 minutes. Timeout/interrupted requests cannot yield a free rate.

## Payment and synchronization

The checkout transaction locks stock and validates quote ownership, expiry, basket/prices/profile version, destination and accessorials. Client-supplied amounts are ignored. The saved quote is frozen onto the order, including `shippingExpectedCents`, `freightAddress`, and `freightSnapshot`.

For freight, the complete US delivery address is collected on Carisma and must match the quoted ZIP. Hosted Stripe Checkout cannot dynamically rerate. An order-specific Stripe Customer holds the shipping address; the Stripe shipping address editor is disabled by omission. Billing address remains editable for card payment. Shipping is a fixed shipping option (`txcd_92010001`, exclusive tax). Adaptive Pricing is disabled for freight to retain the USD quote/payment contract. Stripe Tax continues to calculate any applicable tax. Standard small-order Stripe behavior is preserved.

Webhook reconciliation records paid shipping separately from items and tax. A discrepancy marks `shippingReview`; inventory is held unavailable and native posting goes to review. It never silently fulfils an underpaid shipment. Native Checkmate invoices continue to record part sales without tax; shipping and website tax remain separate website accounting fields. No new native method or database write was added on Windows.

Admin Freight provides searchable quote history and carrier offers. Orders and customer/merchant emails show shipping separately. Carrier dispatch is an operational step in Savtrans; this feature calculates and charges delivery but does not book a truck automatically. Returns/cancellations still require the existing order/payment workflow.

## Operations and validation

Deploy additive migration `20261019010000-freight-quotes.js` before the new front/admin. Save a database backup first. Disabling `FREIGHT_ENABLED` blocks new broker calls while self-pickup and small orders remain available; already issued valid quotes can still be paid. Quote/payment history has no destructive down migration.

Run `npm run test:checkout`. Database suites require explicit `CARPARTS_TEST_DB=true` and an isolated database whose name starts with `carisma_sync_test_`; the suites reset that database. Unit/transaction tests never contact live Checkmate, Stripe or the broker. Live validation should create quote-only requests and unpaid Stripe sessions, expire those sessions afterward, and never simulate a paid webhook or native sale.


## ZIP address assistance and payment continuation (2026-10-19)

The address form remains disabled until a valid freight quote exists. The authenticated `/order/address/context` endpoint accepts only the current customer's unexpired quote and returns city/state suggestions from Zippopotam.us for its ZIP. Results are cached for 24 hours. Multiple place names remain available in the city input; state is checked against known ZIP states on the server. On a lookup outage, manual entry stays available. This is geographic assistance, not street deliverability validation. Street/house fields use native browser autofill; Google Places is intentionally not enabled.

`POST /order/shipping-requirements` first checks an exact normalized basket against the signed-in customer's reserved unpaid orders. A match returns `pendingOrder` instead of failing against stock already reserved by that customer. `POST /order` also reuses a matching open Stripe session before attempting a new reservation. Product IDs AND quantities must match; partial baskets and other customers' orders are never reused. The original order prices, shipping destination and freight charge remain fixed when resuming. An expired freight quote does not invalidate an already issued, still-open payment session.

Customer endpoints: `GET /order/history?page=1`, `POST /order/:id/resume`, `POST /order/:id/cancel`. History is paginated and exposes an allowlist of order fields and captured item prices. Payment URLs are returned only after checking ownership and live Stripe session status. Create/resume/cancel are serialized per customer using a PostgreSQL advisory lock. Expired sessions release stock through the existing idempotent reservation function. Cancellation expires the unpaid Stripe session before releasing inventory. Paid/processing payments and ambiguous provider failures never release stock or create another payment. Closing a browser tab still does not cancel a reservation.

`checkoutExpiresAt` records Stripe's expiry; the additive migration backfills older reservations with their previous 30-minute window. No Windows/Checkmate bridge changes are required. Customer actions on unpaid orders never create a native sale.
