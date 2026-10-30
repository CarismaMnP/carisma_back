# Customer segmentation

`users.purchasingAs` is optional: `Residential`, `Assurance`, `Dealership` (the names in the requirements). Existing customers remain unclassified. This is independent of the existing loyalty `category`, discounts and resale tax approval. Customers set it in Contact Information; administrators can correct it in Users.

Admin API (current database administrator role required, responses never cached):

- `GET /api/admin/user`: `search`, `purchasingAs` (or `unset`), `purchases=yes|no`, `resale=yes|no`, exact `userId`, `sort`, `direction=asc|desc`, `page`, `limit` (maximum 100).
- `PUT /api/admin/user/:id/category`: only `{purchasingAs: string|null}`.
- `POST /api/admin/user/export`: `{format: "csv"|"xlsx", fields: "emails"|"contacts", filters: {...}, selection: {ids:[...]}}` or `selection: {allMatching:true, excludedIds:[...]}`. Exports all selected matching rows, independent of pagination, in the chosen sort order. Maximum 10,000; never silently truncates.

Email export has one Email column, trims/lowercases and deduplicates valid addresses. Contact export includes identity/contact fields, category, loyalty tier/discount, purchasing statistics, cart value, registration/last purchase (UTC), and resale approval. Credentials, authentication codes, payment identifiers, addresses and documents are never selected. CSV is UTF-8 with BOM and neutralizes formula prefixes. XLSX uses typed strings/numbers/dates, frozen headers and filtering. Empty selections or email exports without valid addresses fail with a message. Export logs contain the administrator ID, format and row counts, not contacts.

Paid item totals exclude tax/shipping, unpaid/canceled/refunded/test orders. Legacy orders without `paidAt` are included via settled states: confirmed, delivery, delivered, completed, paid. This is purchasing segmentation, not a financial ledger or a partial-refund calculation. Orders and carts aggregate independently to avoid multiplied totals/counts.

Orders link to `/users?userId=...`, filtering and highlighting the exact customer without selecting them for export. In Users, selection persists over pages/sorting; changing filters clears it. Category edits also clear selection. Selecting all matching customers is explicit, and individual exceptions remain excluded on export.

Verification: `npm run test:checkout` includes unit checks. Integration tests require an isolated PostgreSQL database prefixed `carisma_sync_test_` and `CARPARTS_TEST_DB=true`; they destroy only that database's test tables. No Stripe, Checkmate or mail calls are made.
