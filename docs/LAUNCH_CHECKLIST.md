# Launch checklist

Do not accept real customers until these gates have evidence. Implemented code and passing local tests do not establish live readiness.

## Staging verification

- [ ] Create isolated Supabase and Stripe TEST projects; follow `STAGING.md`, apply all nine migrations and load only safe staging setup data.
- [ ] Review legacy order price snapshots against Stripe if upgrading a populated project.
- [ ] Record passing live parent/adult/teen Auth, onboarding, guardian invitation, ownership and hosted RLS results.
- [ ] Record real simultaneous PostgreSQL booking results: one winner, one `BOOKING_UNAVAILABLE`, one consumed credit.
- [ ] Run five Stripe TEST scenarios: one-time, video, Premium/rollover/replay/cancellation, expiration, failed renewal/recovery. Confirm credits and notification counts in the database.
- [ ] Open Billing Portal and verify invoice access, payment methods and cancellation at period end. Disable subscription plan switching/coupons for V1.
- [ ] Exercise partial refund review and full refund handling. Assign an owner for unresolved `payment_reviews` and `paid_conflict` booking changes.
- [ ] Reconcile a pending expired Checkout using the admin endpoint; verify open/paid sessions are not cancelled by reconciliation.
- [ ] Review every customer and coach route with real data: loading, empty, success, API failure, retry, keyboard controls and required mobile widths. Verify three-athlete actions and minor restrictions.
- [ ] Test configured business email and E.164 phone on actual email/SMS clients; verify fallback instructions without file upload.
- [ ] Verify Resend sender/domain and real delivery/deduplication for booking, reminders, changes, membership/payment, expiration, video receipt/feedback, plan and report notices. Use controlled inboxes, not fixture `.test` addresses.
- [ ] Verify Sentry/PostHog privacy and event delivery; no tokens, private notes, invite URLs, athlete data or email bodies in logs/telemetry.

## Human content and policy

- [ ] Enter Jacob’s approved business email/phone in business settings.
- [ ] Supply and substantiate biography, credentials, training claims and photo rights.
- [ ] Replace visibly marked testimonial placeholders with genuine consented content. Do not invent results.
- [ ] Obtain qualified review of Privacy, Terms, Cancellation and Refund drafts; leave warnings visible until approval is recorded.
- [ ] Approve age-aware registration, guardian consent and the full-refund-only automation/manual partial-refund policy.
- [ ] Review the public site against the reference prototype and performance/accessibility targets before creating `prototype-replica-v1`. No tag was created during hardening.

## Production provisioning and operations

- [ ] Provision production Supabase; apply migrations only, initialize approved settings/catalog without fixture users, assign Jacob’s verified Auth profile `admin` through a trusted operator.
- [ ] Provision separate production Stripe products/prices, endpoint and Billing Portal after TEST validation. Production keys never enter automated staging tests.
- [ ] Configure HTTPS web/API origins, Auth redirects, exact CORS origin and all required server/public environment values. Never set `PITCH_PREVIEW_BUILD` on staging/production deployments.
- [ ] Configure canonical domain, DNS, Open Graph metadata, Resend sender verification and API health monitoring.
- [ ] Schedule `POST /api/v1/jobs/notifications` every five minutes using the server-only job secret; monitor failed jobs and pending payment holds/reviews.
- [ ] Configure platform request protection; the process-local limiter is supplemental and resets on deploy. No Redis required for V1.
- [ ] Configure backups, restore rehearsal, monitoring ownership and incident contacts.
- [ ] Require PRs and the standard CI check for `main`; disallow force push; optionally require an up-to-date branch. Restrict/review the GitHub staging environment and keep secrets out of PR/fork CI.
- [ ] Re-run standard CI and record the deployed commit, migration list, staging results and human sign-offs.
