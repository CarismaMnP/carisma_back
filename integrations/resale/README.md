# Resale certificates

Customers submit a business name and PDF, DOC or DOCX (maximum 10 MiB) from `/order` or `/profile`. `GET/POST /api/public/user/resale` requires authentication. Documents are stored as private PostgreSQL `bytea` evidence in `resale_applications`, included in database backups, and excluded from normal model queries. There is no public object URL. Owner/admin download endpoints enforce authorization and return attachments with no-store/nosniff headers.

Administrators use the **Resale certificates** tab (`/resale`). Review uses a fresh database role check, row locks and an append-only decision log in `resale_reviews`. Rejection and revocation require a customer-visible comment. Self-approval is prohibited. Uploading a replacement supersedes a pending submission; an existing approval remains active until a replacement is approved or the current approval is revoked. Files and previous decisions are retained for order audit.

Only an active approved certificate AND `resaleRequested: true` can produce an exempt order. The server captures the certificate ID, hash, company and approval in `orders.resaleSnapshot` in the inventory reservation transaction. Request-supplied exemption flags are not trusted. The frontend passes `resaleTaxExemptExpected` to detect a review change during checkout. Each order has its own Stripe Customer with `tax_exempt: exempt` or `none`; Automatic Tax remains enabled, shipping prices/addresses are unchanged. Paid webhooks reconcile the exemption and record discrepancies for review.

Approval affects **new orders only**. Existing unpaid sessions retain their original tax selection for their remaining payment window. Cancel an unpaid order and start again to change its selection. Approvals never refund or recalculate previous payments. Revoking approval likewise does not alter an already issued payment session. Stripe does not validate certificates: administrators must review the supplied evidence before approving.

## Deployment and verification

- Apply migration `20261030010000-resale-certificates.js` before restarting API/worker. It only adds tables/columns and defaults existing users/orders to nonexempt.
- Nginx must allow multipart overhead: the production resale upload location uses `client_max_body_size 11M`; the API enforces a 10 MiB document limit.
- Back up `resale_applications` **including documentData**, `resale_reviews`, users and orders together. Do not publish those backups or documents to the public product-image bucket.
- `npm run test:checkout` includes document, Stripe and webhook tests. DB integration tests require `CARPARTS_TEST_DB=true` and an isolated `DB_NAME` beginning `carisma_sync_test_`. They rebuild the test schema and must never target production.
- Test states: pending, rejected with reason, approved checked/unchecked, replacement, revocation, another user's download, stale/forged roles, concurrent reviews, existing payment continuation, pickup and shipped orders. No inventory/Checkmate changes are needed for an unpaid Stripe tax probe.
