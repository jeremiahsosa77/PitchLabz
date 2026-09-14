# Pitch Lab Athletics

A pitching-coaching platform for Coach Jacob Sosa: a public website, family Athlete Hub, coach workspace, Stripe billing, credit-based scheduling, and written coaching records. Raw pitching videos are never uploaded to this system.

The implementation is ready for local review and service configuration. It is **not cleared for real customers** until the staging and launch checklist is completed. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for verification results and remaining limitations.

## Quick start

Use Node.js 22 LTS and pnpm 10.33.4. This workspace was exercised with Node 22.10.0; CI uses the latest Node 22 release.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The API runs at http://localhost:4000. No credentials are needed for the public catalog and read-only fictional previews:

- `/preview` — example parent dashboard
- `/preview/coach` — example coach workspace

Private accounts and mutations fail closed until Supabase is configured. Preview actions never create payments, bookings, or account records.

## Structure

| Directory                     | Responsibility                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `apps/web`                    | Next.js, React, Tailwind, React Hook Form; public pages and private workspace UI |
| `apps/api`                    | Hono API, verified authentication, Stripe, notifications, validated commands     |
| `packages/contracts`          | Shared response and domain types                                                 |
| `packages/validation`         | Shared Zod request schemas                                                       |
| `packages/ui`                 | Repeated interface primitives                                                    |
| `packages/config`             | Development catalog and documented launch defaults                               |
| `supabase/migrations`         | Schema, RLS, transactional workflows and constraints                             |
| `supabase/seed.sql`           | Local-only fictional users and coaching records                                  |
| `tests`, `scripts/test-db.ts` | Unit, API, Stripe signature, database and browser coverage                       |
| `docs`                        | Architecture, API, environment, testing, deployment and launch instructions      |

## Connect local services

1. Install the Supabase CLI and start Docker Desktop.
2. Run `supabase start` and `supabase db reset` from the repository root. Reset is for the disposable **local development database only**.
3. Copy `apps/api/.env.example` to `apps/api/.env`, and `apps/web/.env.example` to `apps/web/.env.local`. Fill in the keys printed by `supabase status`.
4. Restart `pnpm dev`.

Local fixture accounts use `PitchLabDemo!2026`: `parent-a@example.test`, `parent-b@example.test`, `adult@example.test`, `minor@example.test`, and `coach@example.test`. All are fictional. The coach fixture has admin privileges. **Never deploy `seed.sql` or those credentials to production.**

Production database setup applies migrations only. Create Jacob’s real Auth account and explicitly assign the `admin` profile role through a trusted operator path. Browser metadata cannot grant staff privileges.

## Stripe test setup

1. Add a Stripe **test** secret key to the API environment.
2. Sign in as the local coach and save each program under Products. The API creates its Stripe Product/Price mapping. Existing subscription prices stay unchanged; edited prices apply to new purchases.
3. Run `stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe` and put its signing secret in the API environment. Restart the API.
4. Test checkout with Stripe test payment methods. A browser redirect never grants credits; verified webhooks do.
5. Configure the Stripe Billing Portal to cancel subscriptions at period end and allow payment-method and invoice access.

See [deployment](docs/DEPLOYMENT.md) for production webhook events and operational jobs.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
PITCH_PREVIEW_BUILD=1 pnpm build
pnpm exec playwright install chromium
PITCH_PREVIEW_BUILD=1 pnpm test:e2e
```

PowerShell: set `$env:PITCH_PREVIEW_BUILD="1"` before the review build/browser commands. Do not set it on connected staging/production deployments. See [staging validation](docs/STAGING.md) and [payment operations](docs/PAYMENT_OPERATIONS.md).

`test:db` runs the real migrations and SQL commands inside PostgreSQL WASM with actual roles, RLS, pgcrypto and exclusion constraints. It does not replace staging validation of Supabase Auth, PostgREST, or multi-connection concurrency. The explicitly gated live browser tests require a configured isolated test environment; ordinary browser tests require no service secrets.

## Deployment

Web: Vercel, root `apps/web`. API: Railway/Render or any Node host. Both build independently; the backend build bundles internal workspace packages. Auth and database: Supabase. Payments: Stripe. Email: Resend. Optional monitoring: Sentry. Optional anonymous funnel events: PostHog.

Read [environment](docs/ENVIRONMENT.md), [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [launch checklist](docs/LAUNCH_CHECKLIST.md) before provisioning a production environment.
