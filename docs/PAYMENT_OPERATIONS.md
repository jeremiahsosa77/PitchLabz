# Payment operations

V1 automatic entitlement reversal supports **full one-time refunds only**. Partial refunds, subscription refunds, unmatched refunds and refunds involving booked/completed sessions require operator review. Partial refunds leave credits and order status unchanged; no arbitrary entitlement quantity is removed. Cumulative charge refund amounts update one ledger entry, so repeated events never double-subtract revenue. Full one-time refunds revoke unused entitlement; already booked sessions are flagged rather than silently changed.

The administrator's Revenue page shows unresolved `payment_reviews`. Coach-only users cannot read that table or its API. The event marker, ledger write, entitlement mutation and review record commit in one transaction. Raw Stripe payloads and refund customer notes are not stored.

For each review:

1. In Stripe's matching TEST/live environment inspect the charge, payment intent, invoice and original order metadata. Confirm cumulative refunded amount and event delivery.
2. Compare the order, credit batches, used bookings and any subscription paid periods. Contact the business operator to decide the intended entitlement adjustment; do not guess fractional credits.
3. Apply an approved adjustment through a trusted operator database transaction scoped to the exact credit/order IDs. Never restore expired/revoked entitlement implicitly. Record an audit entry with action `refund_manual_resolution`, the operator profile ID and order ID; omit private coaching/payment content.
4. In that same transaction set the exact `payment_reviews.id` to `resolved_at=now()` and a short non-sensitive `resolution`. Recheck the athlete's balance and ledger. Unmatched subscription/fee refunds may need a manual ledger reconciliation; the UI revenue total is not final accounting.

Pending Premium orders reserve capacity until Stripe confirms expiry. Browser Cancel is merely navigation and does not release the hold. Capacity display and reservation share the same calculation; a subscription arriving before its invoice does not double-count its pending order.

For an abandoned order, an authenticated administrator may send `POST /api/v1/coach/orders/<order-id>/reconcile` with their normal API bearer token. The server retrieves the stored Checkout session from Stripe and verifies the order metadata. Only an actually expired session cancels the pending order, via an idempotent reconciliation event. Open sessions retain capacity; completed sessions require resending their original Stripe payment/invoice events. Repeating reconciliation is safe.

An order without a saved Checkout session ID is explicitly returned for manual review. Locate it using Stripe metadata `order_id` (including its payment/subscription and idempotent Checkout request). Do not clear it on age alone. If needed, expire an open session in Stripe and wait for its webhook. Confirm that no payment exists before a trusted operator cancels an orphan hold. Check pending holds daily during staging and early launch; no queue infrastructure is needed.

Upgrade note: `202609130001` snapshots Stripe price IDs for new orders and backfills existing orders from current catalog mappings. Before applying to a populated environment, compare legacy subscriptions with their original Stripe prices and correct each historical order snapshot through the trusted operator path. Never re-price an existing subscription to make a test pass. Invoice validation requires the snapshotted price, USD and exact order amount; discounts, tax changes, prorations and arbitrary subscription price edits are not supported automated V1 entitlement paths. Configure the Portal to cancel at period end and manage payment methods/invoices, without plan switching or coupons.

Webhook endpoint: `POST /api/v1/webhooks/stripe`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Keep raw body and signature intact. See `STAGING.md` for test-mode verification and `LAUNCH_CHECKLIST.md` for release gates.
