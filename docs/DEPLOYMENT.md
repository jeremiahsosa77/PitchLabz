# Deployment

Deploy the existing web and API independently. Follow `STAGING.md` before provisioning production; that runbook defines isolated migrations, safe fixtures and opt-in connected tests. No staging deployment was performed in the hardening session.

| Component                          | Configuration                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web / Vercel                       | Root `apps/web`, monorepo install `pnpm install --frozen-lockfile`; build `pnpm --filter @pitch/web build` from repository root (or `pnpm build` from app root). Output is Next.js managed. |
| API / Railway, Render or Node host | Install at repository root; build `pnpm --filter @pitch/api build`; start `pnpm --filter @pitch/api start`. Bind host-provided `PORT`. Workspace dependencies are bundled by tsup.          |
| Health                             | `GET /health` returns process health and Supabase configuration presence. It is not a database/payment readiness probe.                                                                     |
| Stripe                             | `POST https://<api-origin>/api/v1/webhooks/stripe`; exact events and refund/reconciliation policy in `PAYMENT_OPERATIONS.md`. Preserve raw body and `Stripe-Signature`.                     |
| Supabase Auth                      | Site URL `https://<web-origin>`; allow `/auth/callback` and `/reset-password` on that origin. Configure staging separately.                                                                 |
| CORS                               | `CORS_ORIGIN=https://<web-origin>` on API, one exact origin without path/query/fragment. No wildcard credentialed origins.                                                                  |
| Resend                             | Verify a business-owned sender domain, configure `RESEND_API_KEY` and `EMAIL_FROM`; test delivery to controlled inboxes.                                                                    |
| Notifications                      | Scheduler calls `POST /api/v1/jobs/notifications` every five minutes with `Authorization: Bearer <JOB_SECRET>`. Keep token out of URLs/logs.                                                |

Set `NODE_ENV=production` on deployed API, all required secrets and HTTPS origins from `ENVIRONMENT.md`. Staging also uses production runtime checks but Stripe TEST keys. Build web with public Supabase/API/canonical URLs and server `API_URL`; set `DEPLOYMENT_ENV=staging` or `production`. `PITCH_PREVIEW_BUILD` must be absent. Misconfigured production builds fail rather than silently emitting a development catalog.

For a **non-connected local review build or non-secret CI only**, explicitly set `PITCH_PREVIEW_BUILD=1` before `pnpm build` and before starting its server/browser tests. This opts into the marked fictional preview/catalog. It is rejected when `DEPLOYMENT_ENV` is staging/production or `VERCEL_ENV=production`. `NEXT_PUBLIC_*` must never contain secrets; a build guard rejects secret names, new Supabase secret keys and legacy service-role JWTs.

Production initialization must not run `supabase/seed.sql` or the staging fixture helper. Insert the approved catalog/settings, create Jacob’s real verified Auth identity, and assign `admin` using a trusted operator. Confirm all Stripe price snapshots when migrating an existing project. No localhost URLs belong in deployed public/server config.

Use the host’s native WAF/request rate controls where available: protect unauthenticated Auth-facing traffic, limit abusive private API requests and body size, and monitor spikes. Keep Stripe webhook retry traffic and the authenticated scheduler separate so global throttling does not discard legitimate events. The Hono account mutation limiter is process-local supplemental protection, not shared distributed enforcement. Avoid Redis until measured traffic justifies it. Validate any proxy settings in the selected host before launch.

Standard CI remains secret-free: frozen install, lint, complete typecheck, unit/API/payment tests, DB tests, production review build and public E2E. Connected validation is only the manually triggered, main-only `staging-live.yml` workflow with a restricted staging environment and TEST secrets. Configure environment reviewers and allowed branches before supplying credentials.

Recommended `main` protection: require pull requests, require the `validate` job from standard CI, disallow force push and deletion, and optionally require branches up to date. Repository administration was not changed in this session.

Hub lists remain bounded at 500 rows; all primary reads execute concurrently, and capacity is one database projection rather than one count query per product. Schedule history is not fully paginated/windowed yet. Add date windows/pagination before data exceeds that bound. Assign daily ownership for checkout holds, payment review/conflicts and failed notifications. Configure backups, alerts and restore procedures before real customers.
