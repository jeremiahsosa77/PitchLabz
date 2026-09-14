# Staging validation runbook

This is a disposable, isolated environment. No connected integration was exercised during the 2026-09-13 hardening session: only example env files were present. Never point these helpers at production. Do not copy `supabase/seed.sql` into hosted projects.

1. Create a separate Supabase project and Stripe TEST sandbox. Record its project ref. Apply all migrations, in filename order, using the Supabase CLI from this repository:

```sh
supabase login
supabase link --project-ref <ISOLATED_STAGING_PROJECT_REF>
supabase migration list --linked
supabase db push --linked
```

Verify the linked ref in `supabase/.temp/project-ref` before pushing. `db push` applies migrations; do not pass `--include-seed`. Never run a hosted reset. The fast `pnpm test:db` additionally proves a fresh database executes the migration sequence, but does not prove hosted extensions/Auth/PostgREST compatibility.

2. Configure API and web using `ENVIRONMENT.md`. Set `NODE_ENV=production` on the deployed API, HTTPS origins and Stripe `sk_test_` credentials. Set `DEPLOYMENT_ENV=staging` on the web; leave `PITCH_PREVIEW_BUILD` unset. Configure Auth Site URL and redirect allowlist to the staging web origin and `/auth/callback`, `/reset-password`. Create the TEST webhook endpoint before purchases.

3. Export these values in a private terminal or a restricted CI environment (never in committed files):

| Variable                     | Value                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| E2E_LIVE                     | `1`                                                        |
| E2E_TARGET                   | `staging`                                                  |
| E2E_BASE_URL                 | HTTPS deployed web origin                                  |
| E2E_API_URL                  | HTTPS deployed API origin                                  |
| E2E_SUPABASE_URL             | `https://<ref>.supabase.co`                                |
| E2E_SUPABASE_PROJECT_REF     | That exact isolated ref                                    |
| E2E_SUPABASE_PUBLISHABLE_KEY | Staging publishable/anon key                               |
| E2E_SUPABASE_SECRET_KEY      | Staging server secret; test runner only                    |
| E2E_STRIPE_SECRET_KEY        | Optional for setup; required for payments, `sk_test_` only |
| E2E_STRIPE_WEBHOOK_SECRET    | Signing secret for that deployed TEST endpoint             |

4. On an empty migrated project run `pnpm setup:staging`. This refuses projects containing any application profiles. It loads the four catalog programs and settings, with a `Pitch Lab Staging` marker. With the TEST key configured it creates Stripe test products/prices and saves their mapping. Business contact remains blank until intentionally configured. Re-running after user fixtures exist is deliberately refused; create a fresh isolated project when a clean reset is needed.

5. Run connected account tests:

```sh
pnpm exec playwright install chromium
pnpm exec playwright test tests/e2e/live.spec.ts --project=desktop
```

The suite creates confirmed fictional Auth accounts with random passwords through the Admin API, then uses real password login and API onboarding. It creates parents, an adult athlete and a coach-only account; the teen is linked by the actual guardian invitation/acceptance endpoints. No verification email dependency is needed. Role assignment occurs only in the server-side fixture helper. The business-settings marker is checked before user creation. Parent creation/editing is exercised through the actual UI. The concurrency test inserts explicitly fictional credits and sends simultaneous authenticated API requests that execute against separate hosted PostgreSQL connections.

Tests intentionally retain fictional records for operator inspection and do not delete shared project data. Test users have unique `pitch-e2e-* @example.test` identities. Do not enable Resend delivery to this fixture set. Use a separately controlled mailbox for human email delivery checks. Run suites serially; repeat on mobile with `--project=mobile` after desktop passes. Disable traces and do not upload live Auth network artifacts.

6. For connected payments set `E2E_STRIPE=1` and run:

```sh
pnpm exec playwright test tests/e2e/stripe-live.spec.ts --project=desktop
```

Five tests cover hosted TEST card Checkout, one-time credit issuance, real webhook delivery, signed replay of the original Stripe test event, video entitlement consumption, Premium invoice issuance and calendar-month rollover, Billing Portal session creation, period-end cancellation, expired checkout, partial/full refunds, and a test-clock renewal failure followed by successful invoice recovery. The failure/recovery test advances Stripe's TEST clock only; database grace expiration is tested locally. Hosted checkout selectors and test-clock/provider behavior remain unverified until this suite runs against configured services. A failing hosted payment must be investigated rather than counted as a pass. The Billing Portal test creates its session; a human must also open it and verify configured invoice/payment-method/cancellation controls.

Successful payment tests retain their Stripe test objects; Premium tests schedule cancellation at period end. A failed test may leave an active TEST subscription/clock. After recording results, inspect and cancel leftover test subscriptions or delete their test clocks in the Stripe sandbox. Never use live mode for this cleanup.

7. Configure `.github/workflows/staging-live.yml` in a GitHub `staging` environment. Restrict allowed branches to `main`, require an environment reviewer and store only isolated TEST secrets. The workflow is manual, main-only, read-only for repository permissions, and serial. Variables and secrets match the table. Its optional Stripe checkbox explicitly enables payment/refund tests. Missing staging env fails clearly before browser execution. No secrets are used by ordinary PR CI, and live traces are not uploaded.

Record date, deployed commit, migration list, test counts, event IDs and operator sign-off. Do not record passwords, bearer tokens, secrets, customer payloads or payment details. Finish human browser checks for loading/error/retry states on every route, real email delivery, Sentry/PostHog privacy, and external email/SMS composer behavior before marking staging verified.
