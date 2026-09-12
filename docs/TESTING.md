# Testing

Run the local checks from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The unit and API suites cover credit rollover and expiration, booking fees and conflicts, capacity, ownership, role enforcement, environment validation, Stripe signatures, idempotency, and trusted server-side pricing. `test:db` applies every SQL migration to PostgreSQL WASM and runs 26 checks against real roles, RLS policies, transaction functions, the booking exclusion constraint, and seeded records.

The browser suite covers public navigation, mobile navigation, athlete switching, preview payment blocking, coach athlete workspaces, video handoff without a file input, and horizontal overflow at 320, 375, 390, 430, 768, 1024, 1280, and 1440 pixels. The live Supabase suite is intentionally skipped unless `E2E_LIVE=1` is set against an isolated test project.

The latest completed verification before this documentation update was: 21 unit/API tests passed, 26 database checks passed, lint passed, TypeScript passed, the API and Next.js production builds passed, and 12 ordinary browser tests passed. The real Supabase/Auth/Stripe flows remain a staging responsibility because no service credentials were supplied.

Do not run `supabase db reset` against a production project. Do not use fixture credentials or `supabase/seed.sql` outside local development.
