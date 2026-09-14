# Architecture

## Application boundary

Next.js renders public content on the server and interactive workspaces in client components. The browser uses Supabase only for authentication and session refresh, then sends its access token to the separately deployed Hono API. Hono verifies each token with Supabase `getUser`, requires a verified email, and loads the profile role from the database. No staff role is accepted from browser metadata.

Read operations use a Supabase client bearing the caller’s JWT. RLS restricts rows even if a frontend sends a different athlete identifier. Commands use the server secret client, explicit actor checks, shared Zod schemas, and PostgreSQL transaction functions. Direct writes are revoked for both `anon` and `authenticated`, including coaches. Privileged functions are executable only by `service_role`.

The application uses Supabase’s documented [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) security model. Authorization belongs to persisted records, not user-editable JWT metadata.

## Ownership

Profiles have parent, athlete, coach, or admin roles. An athlete has one parent owner and at most one athlete login. Independent athletes must be at least 18. Guardian-created invitations link verified email accounts aged 13+; invitation tokens are stored only as SHA-256 hashes and expire after seven days. Under-13 athletes have parent-managed records only. Adult birth dates are self-declared; final consent and identity procedures require business/legal review.

Parents read their own athletes; athletes read only their linked record. Minor accounts cannot control checkout, billing, booking mutations, or parent subscription records. A restricted server projection returns athlete IDs and current Premium-access booleans to authorized coaches/linked athletes without returning parent billing data. Direct minor family/billing UI routes are blocked as well as hidden from navigation. Coaches read coaching data, while financial/settings administration requires admin. Jacob’s initial role is admin, which also permits coaching functions. Private coach notes and draft plans/reports/feedback remain hidden from customers.

## Payments and entitlements

An order reserves a program for an authorized athlete. The API resolves the Stripe price from the database and creates a hosted Checkout session with stable idempotency keys. Webhooks verify the raw request signature. PostgreSQL inserts the unique event and applies all resulting order, subscription, credit, ledger and notification writes atomically. A failed transaction rolls back the event marker, allowing Stripe to retry.

One-time purchases issue credits once per order. Premium issues four configured training credits once per paid billing-cycle invoice, never for prorations or the checkout redirect. Credit batch uniqueness protects against different webhook events representing the same purchase. Credits expire at the invoice’s paid period end plus one calendar month, using PostgreSQL calendar intervals. Failed payments start a configurable grace period; historical records remain intact. Canceled subscriptions retain ordinary unexpired credits.

Stripe subscription state is retrieved when handling subscription/invoice events. Event ordering prevents older snapshots overwriting newer state. Invoice credit periods are separate from the current subscription periods retrieved from Stripe, preventing late invoices from moving membership dates backwards. Orders snapshot their Stripe price; Premium cycle invoices must match that price, USD and the original amount. Premium capacity counts subscriptions plus pending order holds under a product row lock. Holds are released by verified Checkout expiration events, not local time, so delayed webhooks cannot cause overselling. Admin reconciliation retrieves Stripe state and only releases verified expired sessions. A pending order and its synchronized subscription are counted once. A server failure before the Checkout session is saved can leave a conservative hold requiring Stripe reconciliation; do not manually clear a hold without checking whether payment exists.

Full one-time refunds revoke unused credits from the associated order. Partial refunds preserve entitlement and create administrator-only payment review records; subscription, unmatched and already-booked refunds also require operator review. Cumulative refund amounts update one ledger row per charge. See PAYMENT_OPERATIONS.md for the exact manual procedure. Stripe is authoritative for payment amounts and transaction status. The local ledger supports a lightweight net-revenue view, not accounting. MRR is clearly labeled an estimate at current catalog pricing.

Reference: [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

## Scheduling

UTC timestamps represent appointments. Available slots are generated from the local business day in `America/Chicago` and converted to UTC by PostgreSQL, including DST. Recurring windows and positive exceptions permit sessions; negative exceptions override them. The API returns slot metadata without exposing other customers’ appointments.

Booking locks the coach schedule, validates the slot at write time, selects the oldest issued usable credit with the correct service/delivery mode, locks that credit and decrements it atomically. A GiST exclusion constraint independently prohibits overlapping confirmed appointments.

Reschedule/cancel commands record the original booking version and server-computed fee. Free changes apply immediately. Paid changes apply only after webhook confirmation; the original booking remains until then. If the target is lost or the version changes, a `paid_conflict` state records the need for fee resolution and sends an action-required notification. Restoration preserves the original credit expiration; revoked credits are not resurrected. No-shows forfeit their scheduled credit, with an audited coach override available.

## Coaching and video

Plans and their days are saved transactionally. Reports and video feedback support draft/published status. Publication queues a notification in the same transaction. Video receipt now commits state, audit and a deduplicated receipt notification together. Plans/reports use browser print styles instead of a PDF service.

Video submissions consume an analysis credit or verify current Premium access. Only metadata, status, context and written feedback are stored. A readable reference connects the request to a video sent directly through the customer’s email/text app. No upload input, storage bucket, file proxy, media processor or video thumbnail exists.

## Notifications and telemetry

Supabase sends email verification and recovery messages. A database outbox holds welcome, purchase, membership, booking, coaching and expiration notifications. A protected scheduler endpoint claims jobs with `FOR UPDATE SKIP LOCKED`, retries with bounded backoff, and uses Resend idempotency keys. Missing Resend configuration leaves jobs pending and logs only a safe configuration event.

PostHog accepts only an allowlisted event name, no arbitrary properties, with autocapture/session recording disabled. Sentry is optional and strips request/user/breadcrumb/extra data. Provider configuration and delivery must be validated in staging.

## Intentional V1 limits

One guardian owner, no hosted video, no in-app SMS/chat, no calendar-provider integration, no AI analysis, no custom payment UI, no server PDF generation, no automatic retention promotions. Retention enablement is stored for future work; no discount is applied automatically. Read lists are bounded at 500 rows and need pagination before the business grows beyond that operational scale.

Incremental UI modules live under `apps/web/src/features/{athletes,bookings,videos,plans,reports,coach}`. The Hub retains orchestration; booking dialogs name the athlete, changing selection clears open actions, and changing booking filters clears prior slots. API refresh failures clear stale workspace data. Coach priorities use Chicago business dates. Production web configuration is validated before build/start; review-only builds require explicit `PITCH_PREVIEW_BUILD=1`.
