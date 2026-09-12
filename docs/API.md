# API

Base path: `/api/v1`. JSON requests only, maximum body 256 KiB. Protected endpoints require `Authorization: Bearer <Supabase access token>` and a verified email. UUIDs and payloads are validated with shared Zod schemas; unknown mutation fields are rejected.

Successful read responses generally use `{ "data": ... }`. Checkout/portal responses use `{ "url": "https://..." }`. Errors use `{ "error": { "code": "BOOKING_UNAVAILABLE", "message": "..." } }` without database detail or stack traces.

## Customer endpoints

| Method/path | Auth | Request / result |
| --- | --- | --- |
| GET `/products` | Public | Active catalog, public capacity status |
| GET `/me` | Verified account | Persisted profile |
| POST `/onboarding` | Verified auth | role parent/athlete, first_name, last_name, date_of_birth; adult owner only |
| PATCH `/me` | Account | first_name, last_name, phone |
| GET `/hub` | Account | RLS-filtered workspace resources; private drafts/notes filtered by database |
| GET `/athletes` | Account | Accessible athlete list |
| GET `/athletes/:id` | Account | Accessible athlete |
| POST `/athletes` | Parent | first_name, last_name, date_of_birth, competitive_level, throws, goals, optional school/graduation_year |
| PATCH `/athletes/:id` | Owner | Same profile fields; ownership/login IDs cannot be supplied |
| POST `/athletes/:id/invite` | Guardian owner | email; returns a private invitation URL |
| POST `/invites/accept` | Verified auth | token; establishes invited athlete login |
| POST `/checkout/session` | Adult owner | athlete_id, product_id, request_id UUID; price resolved server-side |
| POST `/billing/portal` | Adult owner | Empty object; returns Stripe Portal URL |
| POST `/waitlist` | Owner | athlete_id, product_id |
| GET `/credits` | Account | Accessible service credit batches |
| GET `/availability?date=YYYY-MM-DD&delivery_mode=in_person` | Account | Business-local day's available UTC slots |
| GET `/bookings` | Account | Accessible lessons |
| POST `/bookings` | Owner | athlete_id, coach_id, starts_at ISO offset timestamp, delivery_mode, kind lesson/recorded_lesson |
| POST `/bookings/:id/reschedule` | Owner | starts_at, request_id; returns applied status or fee Checkout URL |
| POST `/bookings/:id/cancel` | Owner | request_id; fee checkout or applied status |
| GET `/video-submissions` | Account | Accessible metadata and published feedback |
| GET `/video-submissions/:id` | Account | Accessible submission and feedback |
| POST `/video-submissions` | Owner | athlete_id, customer_notes, submission_channel email/sms; requires credit or Premium |
| GET `/plans` | Account | Published plans and days (staff can read drafts) |
| GET `/reports` | Account | Published reports (staff can read drafts) |

Common errors: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `VALIDATION_ERROR` 400, `ONBOARDING_REQUIRED` 409, `NO_CREDITS` 409, `BOOKING_UNAVAILABLE` 409, `PREMIUM_FULL` 409, `RATE_LIMITED` 429, `NOT_CONFIGURED` 503. Some constraint failures deliberately return a generic recoverable database error to avoid disclosing internal state.

## Coach/admin endpoints

| Method/path | Permission | Request / result |
| --- | --- | --- |
| GET `/coach/customers` | Coach/admin | Customer directory |
| GET `/coach/activity` | Coach/admin | Recent audit actions |
| GET `/coach/revenue` | Admin | Ledger revenue and operational counts |
| GET/POST `/coach/availability` | Coach/admin | Weekly windows; day_of_week 0–6, start/end HH:mm, delivery_mode, active |
| DELETE `/coach/availability/:id` | Owning coach | Delete window; booked sessions remain |
| GET/POST `/coach/exceptions` | Coach/admin | date, start_time, end_time, available, reason |
| POST `/coach/throwing-plans` | Coach/admin | athlete_id, title, description, date range, status, days array |
| PATCH `/coach/throwing-plans/:id` | Coach/admin | Replace plan and days transactionally |
| POST `/coach/progress-reports` | Coach/admin | athlete_id, report_period, summary, wins, areas_to_improve, next_focus, coach_notes, publish |
| PATCH `/coach/video-submissions/:id` | Coach/admin | received/in_review/closed status; allowed transitions enforced |
| POST `/coach/video-submissions/:id/feedback` | Coach/admin | summary, mechanical_notes, drill_recommendations, publish |
| POST `/coach/notes` | Coach/admin | athlete_id, content, visibility; default private |
| PATCH `/coach/bookings/:id` | Coach/admin | location_name, address, instructions, HTTPS meeting_url |
| POST `/coach/bookings/:id/action` | Coach/admin | completed/no_show/restore; state/time guards apply |
| PATCH `/coach/settings` | Admin | Full validated settings object |
| PATCH `/coach/products/:id` | Admin | name, description, price_cents, active, benefits, capacity; creates Stripe price if changed |

Coach dashboards reuse `/hub`; they do not require duplicate read endpoints for every navigation section. Product and settings reads are included in the authorized hub response.

## Infrastructure endpoints

`POST /webhooks/stripe` verifies `Stripe-Signature` over the raw body. Supported events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, payment_intent.succeeded, payment_intent.payment_failed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed, charge.refunded. Ignored event types return success without entitlements.

`POST /jobs/notifications` requires `Authorization: Bearer JOB_SECRET`. Schedule every 5 minutes. It enqueues due reminders, claims pending messages and delivers through Resend. Supabase owns auth verification/reset email, not this endpoint.

`GET /health` is outside the versioned base and returns liveness plus whether Supabase is configured. It is not a full dependency health probe.
