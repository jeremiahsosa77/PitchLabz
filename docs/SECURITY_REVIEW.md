# Security review — hardening session

This is a source review plus local automated verification, not a hosted penetration test. All original migrations, Hono routes, payment normalization, Supabase imports, frontend auth/data access, and CI workflows were inspected. No production credentials or repository administration changes were used.

| Tables                                              | Effective read boundary                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| profiles                                            | Own profile or staff; role loaded from persisted database record           |
| athletes                                            | Guardian-owned, linked athlete or staff                                    |
| athlete_access                                      | Inviting guardian only; stored tokens are hashes                           |
| coaching_products                                   | Active public catalog; staff can read inactive rows                        |
| business_settings, coach_availability               | Authenticated configuration/scheduling reads; no direct writes             |
| availability_exceptions                             | Staff only; private reasons hidden                                         |
| lesson_bookings, service_credits, video_submissions | Athlete ownership/link or staff                                            |
| throwing_plans                                      | Staff or published records of an accessible athlete                        |
| throwing_plan_days                                  | Only through a readable parent plan                                        |
| progress_reports, video_feedback                    | Staff or published feedback/report for an accessible athlete               |
| coach_notes                                         | Staff; only explicitly customer-visible notes reach families               |
| orders, subscriptions, booking_changes, waitlist    | Purchasing customer or admin; linked minor does not inherit parent billing |
| payment_ledger                                      | Purchasing customer or admin                                               |
| payment_reviews                                     | Admin only                                                                 |
| notifications                                       | Recipient or admin                                                         |
| audit_logs                                          | Staff                                                                      |
| stripe_events                                       | No customer/staff SELECT policy; service-role operations only              |

All public application tables have RLS. `anon` has only catalog SELECT; neither anonymous nor authenticated roles can INSERT/UPDATE/DELETE application tables. Privileged business RPCs are denied to both roles, including newly added coaching status/capacity/video commands. Trigger functions cannot be invoked as ordinary mutation RPCs. Staff UI actions use the same authenticated database role and cannot bypass these direct-write grants.

Every service-role API mutation sits behind verified Supabase `getUser`, confirmed email and a persisted profile (except onboarding/invite acceptance, which require verified identity first and enforce their own SQL rules). Parent creation forces ownership to the actor; edits/invites/waitlists assert ownership. Checkout/bookings/video/reschedule/cancellation validate through transactional commands. Coaching actions require coach/admin. Price/settings/revenue/refund review/reconciliation require admin. New report updates check staff, validate the full payload and keep athlete/record identity matched. Browser role/price/customer IDs never grant authority.

Payment defects repaired: partial refunds previously revoked all unused credits; Premium invoices lacked strict price/amount validation; current membership dates could reuse historical invoice dates; capacity display ignored pending holds and could double-count subscription-before-invoice delivery. Orders now snapshot prices, webhook transactions remain idempotent, and reconciliation releases only Stripe-confirmed expired sessions. Refund review is documented in `PAYMENT_OPERATIONS.md`.

Minor navigation hiding previously left family controls reachable through direct routes. Those routes now reject the account role. Premium access for minors/coaches is a deliberately narrow athlete/status projection rather than access to subscription rows. Booking filters and athlete changes clear stale actions; server ownership/slot checks remain authoritative.

API CORS uses one configured origin and security headers. Production origins reject paths, credentials and non-HTTPS URLs. Next.js retains frame/content-type/referrer/permissions headers. In-memory rate limits remain supplemental; platform request protection is a launch configuration task. No RLS policy was weakened.

The browser uses only a publishable/anon Supabase Auth client. A new build guard rejects service-role/secret browser keys and secret public variable names, with a source regression test against importing server clients/secrets. Production web catalog fallback requires explicit review-only mode; API failures clear the authenticated workspace rather than substituting demo data. Test/setup scripts are now included in typechecking. Safe logger/telemetry configuration was inspected; actual external ingestion and every possible error payload still require staging verification. Do not attach live network traces to public artifacts.

Local checks prove the assertions listed in `TESTING.md`. Live Auth, hosted RLS and multi-connection behavior remain **IMPLEMENTED BUT NOT LIVE-VERIFIED**. Use the staging workflow before asserting release readiness.
