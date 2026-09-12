# Deployment

Deploy the web and API separately from the same repository.

1. Create Supabase staging and production projects. Apply migrations in order; apply the seed only to the disposable local project.
2. Create Stripe test products/prices in staging by editing the seeded catalog through the admin workspace, then create production products/prices after the business copy and prices are approved.
3. Configure one Stripe webhook endpoint at `/api/v1/webhooks/stripe` for Checkout, PaymentIntent, subscription, invoice, refund, and Checkout expiration events. Store the endpoint signing secret in the API environment.
4. Deploy `apps/api` to Railway, Render, or another Node host. The API build is `pnpm --filter @pitch/api build`; start with `pnpm --filter @pitch/api start`.
5. Deploy `apps/web` to Vercel. Set its public Supabase and API values at build time. The web build is `pnpm --filter @pitch/web build`.
6. Configure the protected notification job to call `POST /api/v1/jobs/notifications` every five minutes using `JOB_SECRET`. Check Resend sender-domain verification before enabling customer mail.
7. Configure Sentry with PII disabled and PostHog with anonymous events only. Verify that no athlete names, birth dates, notes, or video content appear in either service.
8. Run a live smoke test in Stripe test mode: parent signup, guardian athlete, one-time checkout, webhook credit, booking, free reschedule, late-fee change, cancellation restore, Premium invoice, video handoff, coach publication, and Billing Portal.

The app requires HTTPS origins in production and rejects live Stripe keys in development or test. Keep `SUPABASE_SECRET_KEY`, Stripe secrets, Resend keys, Sentry server DSN, and the job token on the API host only. Configure the reverse proxy to preserve the raw webhook body and forward `Stripe-Signature` unchanged.

Scale follow-ups: paginate list endpoints past 500 records, add a durable job runner if notification volume grows, reconcile abandoned Checkout holds from Stripe, and add a dedicated refund workflow for partial refunds or already-booked credits. These are intentional V1 operational boundaries.
