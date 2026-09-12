# Environment variables

Copy only the relevant template into each app. Restart after changing values. Next.js `NEXT_PUBLIC_*` variables are embedded at build time and must never contain server secrets. Optional values should be omitted, not set to an empty URL string.

| Variable | Classification | Purpose |
| --- | --- | --- |
| NEXT_PUBLIC_APP_URL | PUBLIC, required for deployment | Canonical public web origin |
| NEXT_PUBLIC_API_URL | PUBLIC, required for connected web | API origin; defaults to localhost:4000 |
| NEXT_PUBLIC_SUPABASE_URL | PUBLIC, required for auth | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | PUBLIC, required for auth | Publishable/legacy anon key only |
| API_URL | WEB SERVER, required for live catalog | API origin for server-rendered product data |
| NEXT_PUBLIC_POSTHOG_KEY | PUBLIC, optional | PostHog project key |
| NEXT_PUBLIC_POSTHOG_HOST | PUBLIC, optional | PostHog ingestion host |
| NEXT_PUBLIC_SENTRY_DSN | PUBLIC, optional | Browser error ingestion DSN |
| NODE_ENV | API CONFIG, required in deployment | development/test/production |
| PORT | API CONFIG, optional | Listen port, default 4000 |
| APP_URL | API CONFIG, required in production | Stripe redirect and email link web origin |
| CORS_ORIGIN | API CONFIG, required in production | One exact permitted browser origin |
| SUPABASE_URL | API CONFIG, required in production | Supabase project URL |
| SUPABASE_PUBLISHABLE_KEY | PUBLIC KEY ON API, required in production | Creates caller-scoped read clients |
| SUPABASE_SECRET_KEY | SERVER SECRET, required in production | Secret/legacy service_role key, API only |
| STRIPE_SECRET_KEY | SERVER SECRET, required in production | Test key outside production; live key at launch |
| STRIPE_WEBHOOK_SECRET | SERVER SECRET, required in production | Endpoint signing secret; distinct from API key |
| RESEND_API_KEY | SERVER SECRET, required in production | Transactional email delivery |
| EMAIL_FROM | API CONFIG, required in production | Sender on verified Resend domain |
| SENTRY_DSN | API CONFIG, optional | Backend Sentry ingestion DSN |
| JOB_SECRET | SERVER SECRET, required in production | At least 32 random characters; scheduler bearer token |
| E2E_BASE_URL | TEST CONFIG, optional | Configured staging frontend origin |
| E2E_LIVE | TEST CONFIG, optional | Set to 1 to enable external auth tests |
| E2E_PARENT_EMAIL / E2E_COACH_EMAIL | TEST CONFIG, optional | Isolated fixture identities |
| E2E_PASSWORD | TEST SECRET, optional | Fixture account password |

API startup validates required production secrets and HTTPS origins. No external credentials were supplied during implementation. The unconfigured local API serves only a development catalog and health response; protected features fail closed.

Never add actual secrets to Git, screenshots, sample data, analytics properties, or the web app environment. Restrict scheduler access using its bearer token and host network controls. Configure public API edge rate limiting in addition to the per-account mutation limiter.
