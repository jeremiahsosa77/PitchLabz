# Implementation status

The repository contains a working V1 foundation and reviewable development previews.

Completed: responsive public marketing site based on the supplied prototype; hero, coach section, product catalog, trust placeholder, legal routes, metadata, sitemap and robots; Supabase schema and RLS; parent, adult athlete, guardian invitation and minor ownership rules; shared contracts and Zod validation; Hono API; server-side Stripe Checkout and Billing Portal boundaries; webhook signature verification and idempotent order/subscription/credit handling; Premium rollover and grace-period policy; capacity and waitlist; UTC/DST-aware availability; transactional booking, rescheduling, cancellation, no-show and restore-credit logic; metadata-only video handoff; plans, reports, coach notes, notifications, revenue ledger, Sentry and PostHog hooks; local fixtures; CI; documentation; and browser previews.

The read-only previews are available at `/preview` and `/preview/coach`. They use fictional data, intentionally disable mutations and never create Stripe sessions. Connected customer and coach routes fail closed until Supabase is configured.

Intentional limitations: one guardian owner per athlete, one launch coach, no hosted pitching video, no in-app SMS or chat, no calendar sync, no AI analysis, no dedicated PDF service, no automated retention discount, bounded 500-row reads, and no production service credentials in this workspace. Partial-refund resolution and abandoned-checkout reconciliation require operator workflows before the business scales.

Verification record: 21 unit/API tests passed; 26 database/RLS/transaction checks passed; lint, TypeScript, API build, and Next.js production build passed; and 12 Playwright browser tests passed across desktop/mobile and required widths. Live staging tests are documented and gated in `tests/e2e/live.spec.ts`.
