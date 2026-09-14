# Testing and verification record

Actually executed in the 2026-09-13 hardening session:

| Command / suite                         | Baseline                | Final                                                             |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`        | PASS                    | Lockfile unchanged; same dependencies                             |
| `pnpm lint`                             | PASS                    | See final session verification below                              |
| `pnpm typecheck`                        | PASS, 6 packages        | Now also checks all test/setup scripts with `tsconfig.tests.json` |
| `pnpm test`: domain                     | 11 passed               | 11 passed                                                         |
| `pnpm test`: payments                   | 4 passed                | 10 passed                                                         |
| `pnpm test`: basic API                  | 6 passed                | 6 passed                                                          |
| `pnpm test`: authorization              | —                       | 11 passed                                                         |
| `pnpm test`: environment/secret guard   | —                       | 4 passed                                                          |
| Vitest total                            | 21 passed               | **42 passed, 5 files**                                            |
| `pnpm test:db`                          | 26 passed, 6 migrations | **60 passed, 9 migrations**, PostgreSQL WASM/PGlite               |
| `pnpm build`                            | PASS, API + web         | Production review build requires explicit `PITCH_PREVIEW_BUILD=1` |
| `pnpm exec playwright install chromium` | PASS                    | Chromium installed and used                                       |
| Public Playwright                       | 12 passed               | 12 passed on desktop/mobile; required widths covered              |
| Connected Auth/RLS/UI/concurrency       | Not run                 | 8 desktop cases discovered and **skipped**, no credentials/opt-in |
| Connected Stripe TEST                   | Not run                 | 5 desktop cases discovered and **skipped**, no credentials/opt-in |

PGlite runs all real forward migrations from a fresh database, local fixtures, actual database roles/RLS and exclusion constraints. Tests now cover protected mutation/RPC grants, cross-family reads, minors, coach versus admin financial access, unpublished records, minimum notice/window, delivery mismatch, expiration, reschedule fee boundaries, cancellation/restore/no-show, webhook order/replay, Premium price snapshots and rollover, stale membership events, partial/full refunds, capacity release, video receipt, draft report publication and notification dedupe. PGlite is single-connection; it does not establish hosted PostgREST/Auth behavior or real booking concurrency. The latter has a dedicated connected test.

Vitest uses injected provider boundaries and real Stripe signature construction/verification, not network payments. Its API tests authenticate through mocked Supabase responses and assert ownership/role checks before mutations. Do not report these as real customer logins or card charges.

For local non-secret validation:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
PITCH_PREVIEW_BUILD=1 pnpm build
pnpm exec playwright install chromium
PITCH_PREVIEW_BUILD=1 pnpm exec playwright test tests/e2e/public.spec.ts
```

PowerShell: set `$env:PITCH_PREVIEW_BUILD='1'` before build and browser commands. This is an explicit **review-only** build, not connected production configuration. CI does the same. Configured staging/production builds must omit this flag and provide required public/server origins and public Supabase key. The production guard intentionally rejects missing configuration.

`STAGING.md` contains exact migrations, safe seed, confirmed fictional users, role assignment, and connected test commands. Tests must have `E2E_LIVE=1`, `E2E_TARGET=staging`, matching isolated project ref/URL, service credentials and setup marker. Stripe additionally requires `E2E_STRIPE=1` and TEST API/webhook secrets. Missing intentional configuration is an error; default runs skip all external tests. Live traces are off to avoid capturing tokens.

Not yet verified: real Auth/hosted DB/RLS; real Checkout/webhooks/subscriptions; Billing Portal controls; Resend delivery; Sentry and PostHog ingestion/privacy; every authenticated responsive/loading/error/keyboard state; public Lighthouse target scores; a new visual comparison against the reference prototype. No `prototype-replica-v1` tag was created. Source inspection and local preview tests do not satisfy those gates.

Final command execution results and any discovered failures are recorded in `SESSION_VERIFICATION.md`. Earlier failures during implementation (migration UTF-8 BOM, type errors and a timestamp assertion) were corrected and rerun; they are not concealed as passing first attempts.
