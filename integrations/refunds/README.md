# Manual return requests

Customers request a return from Profile → Order history → Refund, only for `delivered` or `completed` orders. Unpaid/in-transit orders and integration test orders are ineligible. The 5–2,000 character reason is mandatory. One request per order is retained for audit; duplicate submissions return the existing request. A declined request remains visible with the review comment; further questions use the order's contact link.

Administrators use `/refunds` in the admin app. Approval requires an explicit acknowledgment and atomically changes the request to `approved` and order to `refunded`. Rejection requires a customer-visible explanation and keeps the order state. Review identity/time and comment are persisted. Only current database administrators can list/review requests; customers can access only their own orders.

## Money and inventory

This feature **never creates a Stripe refund**, shipping label, inventory return or Checkmate job. Arrange the return, inspect the part and refund the appropriate amount (less return label costs) manually in Stripe Dashboard. Approval status is not evidence of a completed money transfer. Refunds remain visible even before Stripe has sent a refund notification.

The existing signed `charge.refunded` webhook records the cumulative USD `amount_refunded` as `stripeRefundedCents`. Duplicate/older events cannot decrease it. A full Stripe refund sets `refunded`; a partial refund preserves order status, including a manually approved `refunded` return. The timestamp is when Stripe reported the increased amount, not a bank settlement date. Historical refunds before this deployment are not backfilled.

All order changes lock the order first. Late payment/expiry events and stale administrator state edits cannot reopen refunded orders. Signed charge metadata can match a refund received before the payment confirmation; such refunded-before-confirmation orders deliberately remain for manual stock review and never initiate another sale. Inventory must be checked/restored separately after physical inspection. Refunded status does not undo an already queued Checkmate work order.

## Deployment and verification

Run migration `20261030030000-refund-requests.js` before the new backend serves requests, then deploy admin/customer UI. Customer route: `POST /api/public/order/:id/refund`. Admin routes: `GET /api/admin/refunds` and `POST /api/admin/refunds/:id/review`. Stripe endpoint must subscribe to `charge.refunded` (already enabled in production at deployment).

`npm run test:checkout` runs database-free checks. Full workflow tests require `CARPARTS_TEST_DB=true` and an isolated database named `carisma_sync_test_*`; the tests refuse other DB names. They cover migration, authorization, duplicate submissions, concurrent reviews, partial/full/out-of-order signed webhooks, late payments/expiry, stale admin updates and no stock/Stripe write side effects. Browser QA covers customer submission, admin approval/rejection, order links, mobile modal/layout and customer decision display.
