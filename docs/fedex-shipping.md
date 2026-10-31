# Parcel shipping

FedEx rates complement the existing Savtrans freight flow. A mixed basket pays the sum of both quotes. Pickup is free. Nothing here books a shipment or creates a label.

## Activation

Machine-owned `/etc/carisma/integration.env` is loaded after deployment environment variables. Set these after production credentials, the linked account number and a live rate check are ready:

```
FEDEX_ENVIRONMENT=production
FEDEX_CHECKOUT_ENABLED=true
FEDEX_API_KEY=<production project key>
FEDEX_SECRET_KEY=<production project secret>
FEDEX_ACCOUNT_NUMBER=<9-digit linked shipping account>
FEDEX_PICKUP_TYPE=DROPOFF_AT_FEDEX_LOCATION
```

The pickup default assumes the warehouse drops packages at FedEx. If the actual operation uses scheduled pickup, configure `USE_SCHEDULED_PICKUP` and validate the applicable account rates. Ship date is the next weekday in America/New_York; checkout displays only carrier transit estimates, not a promised arrival date.

Enable Rates and Transit Times plus Address Validation on the project. Locations Search is not required for home/business delivery. Sandbox credentials authenticate against `https://apis-sandbox.fedex.com`, but virtualized sandbox prices are not valid customer charges. The code refuses to enable customer checkout in sandbox, and refuses a virtual rate response in production.

Until activation, the preexisting standard shipping price remains unchanged. New website checkout still collects and locks the full delivery address before Stripe. Existing unpaid Stripe sessions retain their original amounts and expiry.

## Package data

The owner-approved default for every ordinary part is **40 × 30 × 20 cm and 7 kg per physical unit**. It is sent to FedEx in CM/KG without conversion or rounding to inches. This is a rating assumption, not a measurement imported from Checkmate. Dimensions and weight are never included in the customer quote response or displayed in checkout. Large parts retain their Savtrans freight profiles and are excluded from FedEx packages; a mixed cart is quoted separately by each provider.

For a per-product override, open **Указать упаковку FedEx** in Products and enter packed lb and outer inches for one physical unit. Measurements are website-owned `products.parcelPackage`, retained during Checkmate sync. Clearing the override restores the default. One unit means one package; explicit dimensions round upward. Invalid explicit measurements block quoting rather than silently falling back. Parcels above 150 lb / 108 in longest edge / 165 in length plus girth require freight. Standard parcel calculation is only for goods eligible for ordinary shipping; hazardous/restricted parts require a separately supported service, not this package profile.

## Integrity

Server calculates prices from current inventory, never client amounts. Quotes are owner-scoped, cached for 30 minutes, persisted with full cart/price/package/address fingerprints and selected carrier service. Price, cart, package, account, ship date or address changes invalidate an unused quote. Pending and hourly limits bound provider traffic. No inventory is reserved while quoting.

FedEx determines the building type; customers no longer choose residential/commercial. BUSINESS uses a commercial rate, RESIDENTIAL uses a residential rate, and MIXED/UNKNOWN conservatively includes residential delivery. We do not compare both types and charge the cheaper one: that could omit a required residential surcharge. New version 2 quote fingerprints do not depend on a customer-supplied building flag. Unexpired version 1 quotes retain their original fingerprint during deployment.

Address validation accepts a resolved DPV-confirmed address or, when FedEx omits DPV, an exact standardized street/postal match with ZIP11 and a delivery point. A resolved, matched STANDARDIZED multi-unit building with ZIP4Match and SuiteRequiredButMissing can also be rated, with a visible customer/admin warning to add the unit if it exists. This building match is not confirmation of delivery to an individual unit. Invalid supplied units, unresolved, ambiguous, interpolated and PO Box results remain blocked.

The customer's entered address remains unchanged. FedEx's normalized suggestion is shown for review, including differing postal city names; accepting it requires a fresh quote. A changed ZIP/state requires explicit acceptance and recalculation. Validation evidence and warnings are saved with the quote. This is a suggestion after address submission, not a street autocomplete service. Before physical dispatch, staff must resolve any applicable unit warning.

Savtrans still rates oversized goods separately using its ZIP-first workflow. Without a building selector, checkout requests residential-inclusive freight with lift-gate and insurance; FedEx validation is not a prerequisite for freight-only orders.

## Street address suggestions

Set `GOOGLE_PLACES_API_KEY` in `/etc/carisma/integration.env` and enable Places API (New) on its Google project. This key is server-only; it must not be bundled into the frontend. The existing ZIP lookup supplies city/state and the geographic bias for US-only street predictions. Checkout calls authenticated `/order/address/autocomplete` after 350 ms of idle typing (minimum 3 characters), then `/order/address/details` after an explicit selection. Each search uses a new billing session; Details requests are restricted to the same user's suggested place IDs. Only address fields are requested. Google prediction lists are not persisted, and request payloads/keys are not logged.

The current single API process limits autocomplete/details traffic to 120 requests/minute and 600/hour per user, with global limits of 1,000/minute and 10,000/hour. Session metadata (IDs only) expires after 10 minutes and is bounded to 2,000 sessions. If moving to multiple API processes, use a shared admission store before scaling these limits. Restrict the Google key to Places API (New) and the production server's outbound IP in Google Cloud.

Autocomplete remains optional: manual entry works during provider errors, quota exhaustion or missing configuration. A selected address in another ZIP requires explicit confirmation and a new shipping quote. Google suggestions are not carrier validation; FedEx still determines serviceability and rates. The official Google Maps attribution asset is displayed beside the suggestions. The selected delivery address is retained for the customer's transaction.

Checkout refreshes availability in the background on window focus after 60 seconds (or immediately for an existing unpaid order), preserving the form and unchanged shipping quotes. Price/cart changes still invalidate quotes; quote expiry has its own deadline timer. Inventory, tax and quote validity remain enforced by the backend when creating the order.

At order creation, stock and quote are checked in one DB transaction. Small and large charges are added. Stripe receives an order-specific Customer.shipping address and fixed shipping amount; it does not collect a second shipping address. Stripe Tax uses that customer address. Webhook records billing separately, preserves delivery address, and flags shipping amount/customer/quote discrepancies for review before Checkmate processing.

Admin **Грузовая доставка → Посылки · FedEx** shows saved quote details and failures. Requests contain delivery addresses: retain administrator-only access. Credentials, bearer tokens and full Axios errors must not appear in logs or API responses.

## Validation

`npm run test:checkout` runs all inventory, freight and parcel tests. Database integration tests require `CARPARTS_TEST_DB=true` and a dedicated DB whose name begins `carisma_sync_test_`; they reset that database and mock Stripe/Checkmate/providers. Never use production DB credentials for tests.

Official references: https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html and https://developer.fedex.com/api/en-us/catalog/address-validation/docs.html .
