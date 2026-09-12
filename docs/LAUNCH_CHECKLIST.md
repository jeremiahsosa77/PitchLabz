# Launch checklist

Human review and configuration still required:

- [ ] Create Supabase production project and apply migrations.
- [ ] Create Jacob’s real Auth account and assign `admin` through a trusted operator path.
- [ ] Create production Stripe products and prices; verify Premium is $150/month and the four product mappings are correct.
- [ ] Configure and test the Stripe webhook endpoint and signing secret.
- [ ] Enter Jacob’s business email and phone in business settings.
- [ ] Replace the marked testimonial placeholder with verified customer content.
- [ ] Verify Jacob’s biography, credentials, training claims, photo rights, and business details.
- [ ] Review Privacy, Terms, Cancellation, and Refund drafts with qualified counsel.
- [ ] Review age-aware registration and guardian-consent language for the launch market.
- [ ] Configure the production domain, canonical URL, Open Graph image, and DNS.
- [ ] Verify Resend sender domain and delivery templates.
- [ ] Configure Sentry and PostHog; confirm their privacy settings and event allowlist.
- [ ] Configure the protected notification scheduler and monitor failed jobs.
- [ ] Run staging security checks: RLS, IDOR, role escalation, webhook replay, price tampering, double booking, and refund edge cases.
- [ ] Run a live Stripe test-mode smoke test for one-time, Premium, failed payment, and Billing Portal flows.
- [ ] Confirm no video storage bucket, upload path, thumbnail, or media-processing service exists.
- [ ] Review cancellation and refund behavior with real business policy.
- [ ] Configure backups, alert ownership, and incident contacts.
- [ ] Record the prototype replica milestone as `prototype-replica-v1` after human visual approval.

Do not accept real customers until legal copy, production credentials, webhook delivery, email delivery, security checks, and payment smoke tests are complete.
