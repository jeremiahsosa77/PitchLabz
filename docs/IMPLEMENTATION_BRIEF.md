You are the principal engineer responsible for building **Pitch Lab Athletics** from scratch as a production-ready web application.

You have been given a separate document titled:

**Pitch Lab Athletics — Final Product Requirements Document**

That PRD is the authoritative source of truth for product behavior, architecture, user roles, payments, scheduling, coaching workflows, video workflow, dashboard requirements, security requirements, business rules, and definition of done.

Your job is to implement the application described in that PRD as completely as possible in a single coordinated engineering pass.

Do not reinterpret the product into something substantially different.

Do not redesign the architecture unless a documented technical blocker makes the specified architecture impossible.

Do not simplify away important business logic merely to make the build easier.

The goal is to produce a professional codebase that is as close to production-ready as reasonably possible before human refinement begins.

---

# 1. PRIMARY OBJECTIVE

Build the complete Pitch Lab Athletics V1 application described in the PRD.

The application must include:

* public marketing site
* existing prototype visual recreation
* testimonial / credibility section
* authentication
* parent accounts
* athlete accounts
* parent-managed minor athletes
* multiple athletes per parent
* Jacob's dedicated coach dashboard
* Stripe payments
* Stripe subscriptions
* Premium Coaching
* service credits
* lesson booking
* online and in-person sessions
* availability management
* cancellation and rescheduling logic
* configurable fees
* Premium credit rollover
* Premium capacity control
* video-analysis request workflow
* direct text/email video handoff
* throwing plans
* progress reports
* private coach notes
* customer billing experience
* email notifications
* analytics
* monitoring hooks
* database migrations
* Row Level Security
* automated tests
* developer documentation
* production environment configuration

The application must not store raw customer pitching videos.

The frontend and backend must remain logically and deployably separate even though they live in the same repository.

---

# 2. SOURCE OF TRUTH PRIORITY

When requirements conflict, use this priority:

1. Final PRD
2. This implementation prompt
3. Existing Pitch Lab prototype
4. Reasonable engineering convention

If the prototype conflicts with the PRD:

**The PRD wins for behavior.**

The prototype remains the primary reference for the initial public-site visual appearance.

---

# 3. DO NOT ASK FOR UNNECESSARY CLARIFICATION

Do not stop implementation merely because:

* a production API key is unavailable
* a Stripe account has not yet been connected
* a Supabase project has not yet been created
* final testimonials are unavailable
* final coach credentials/results are unavailable
* a final business address is unavailable
* legal copy has not yet been reviewed

Instead:

* create environment-variable placeholders
* create clearly documented configuration
* use development seed data
* use clearly marked testimonial placeholders
* document launch blockers in `docs/LAUNCH_CHECKLIST.md`

Do not fabricate real customer testimonials, statistics, credentials, or athlete results.

---

# 4. TARGET REPOSITORY ARCHITECTURE

Create a pnpm + Turborepo monorepo.

Use approximately this structure:

```text
pitch-lab/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── contracts/
│   ├── validation/
│   ├── ui/
│   └── config/
│
├── supabase/
│   ├── migrations/
│   ├── tests/
│   └── seed.sql
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── ENVIRONMENT.md
│   ├── TESTING.md
│   ├── DEPLOYMENT.md
│   └── LAUNCH_CHECKLIST.md
│
├── .github/
│   └── workflows/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .gitignore
├── .env.example
└── README.md
```

Do not create two separate repositories.

---

# 5. REQUIRED TECHNOLOGY STACK

Use:

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui when appropriate
* React Hook Form
* Zod

Use TanStack Query only where it adds value.

Prefer server rendering for public content.

Use client components only when interactivity requires them.

---

## Backend

Use:

* Node.js
* TypeScript
* Hono
* Zod
* Stripe Node SDK
* Supabase server SDK

The API must live in `apps/api`.

Do not collapse sensitive server operations into the browser.

---

## Data and Auth

Use:

* Supabase PostgreSQL
* Supabase Auth
* Supabase Row Level Security

Do not use Supabase Storage for pitching videos.

Raw customer pitching videos must never be stored by Pitch Lab V1.

---

## Payments

Use:

* Stripe Checkout
* Stripe Customers
* Stripe Products
* Stripe Prices
* Stripe Subscriptions
* Stripe Billing Portal
* Stripe Webhooks

Never handle raw card details directly.

---

## Email

Use Resend behind an internal email service abstraction.

Do not tightly couple business logic to Resend-specific implementation details.

---

## Monitoring

Prepare Sentry integration.

If actual credentials are unavailable, implement configuration and graceful no-op behavior in development.

---

## Analytics

Prepare PostHog integration.

Never send private athlete data, dates of birth, coaching notes, or sensitive customer content as analytics properties.

---

# 6. ENGINEERING QUALITY BAR

Treat this as production software.

Do not produce:

* toy architecture
* fake production logic
* hardcoded customer IDs
* placeholder payment success
* public customer data
* insecure direct-object references
* giant monolithic files
* arbitrary duplicate utility functions
* untyped API boundaries
* client-side authorization masquerading as security
* TODO-driven core functionality

Some launch configuration may remain incomplete where external credentials are required.

Core product logic should not remain as TODO comments.

---

# 7. TYPESCRIPT RULES

Use strict TypeScript.

Do not:

* disable strict mode
* suppress errors globally
* use `@ts-ignore` unless unavoidable and documented
* use `any` except at unavoidable third-party boundaries

Prefer:

* explicit domain types
* inferred Zod types
* discriminated unions
* typed API contracts
* typed configuration
* exhaustive status handling

---

# 8. SHARED CONTRACTS

Do not duplicate request/response types independently in web and API projects.

Use shared packages.

Recommended pattern:

```text
packages/contracts
packages/validation
```

Use Zod schemas for:

* API request payloads
* route parameters
* configuration
* business settings
* form validation where shared behavior is useful

Frontend validation improves UX.

Backend validation remains authoritative.

---

# 9. DATABASE FIRST

Before building most application flows, create the complete Supabase schema described by the PRD.

Use SQL migrations.

Do not create schema state manually without migrations.

Required business entities include at minimum:

```text
profiles
athletes
coaching_products
orders
subscriptions
service_credits
lesson_bookings
coach_availability
availability_exceptions
video_submissions
video_feedback
throwing_plans
throwing_plan_days
progress_reports
coach_notes
stripe_events
notifications
audit_logs
business_settings
```

Add supporting tables when necessary.

Do not unnecessarily normalize simple configuration into dozens of tables.

---

# 10. ENUMS / STATUS DESIGN

Use consistent enumerated states where appropriate.

Examples include:

## Roles

```text
parent
athlete
coach
admin
```

## Order status

```text
pending
paid
failed
refunded
cancelled
```

## Booking status

```text
pending
confirmed
completed
cancelled
no_show
```

## Video submission status

```text
awaiting_video
received
in_review
completed
closed
```

Keep status transitions deterministic.

Do not rely on arbitrary strings throughout the codebase.

---

# 11. DATABASE CONSTRAINTS

Use the database to enforce important invariants when practical.

Examples:

* valid foreign keys
* nonnegative credit quantities
* unique Stripe event IDs
* unique Stripe subscription references
* valid ownership relationships
* reasonable status constraints
* unique account relationship where required

Do not rely exclusively on application logic for critical integrity.

---

# 12. ROW LEVEL SECURITY

RLS is mandatory.

Create RLS policies alongside schema migrations.

Do not defer RLS until later.

Implement and test policies including:

## Parent

May access:

* own profile
* owned athletes
* relevant bookings
* relevant orders
* relevant credits
* relevant coaching content

May not access another parent's athletes.

---

## Athlete

May access:

* own profile
* own athlete record
* own lessons
* own plans
* own reports
* own video-analysis records

May not access unrelated athletes.

---

## Coach

Jacob may access records necessary to run the coaching business.

---

## Admin

Administrative access must use trusted server-side paths and appropriate authorization.

---

# 13. AUTHENTICATION

Use Supabase Auth.

Implement:

* signup
* login
* logout
* email verification support
* forgot password
* password reset
* protected routes
* session refresh
* role-aware redirects

The signup flow must support:

```text
I'm a parent or guardian
I'm the athlete
```

---

# 14. AGE-AWARE REGISTRATION

Implement the PRD behavior.

## Parent

Parent creates their own account.

Then they create one or more athlete profiles.

---

## Athlete 18+

May independently register and operate their own athlete account.

---

## Athlete 13–17

Do not allow them to become the independent owner of the commercial coaching relationship.

Present an appropriate guardian requirement.

Their athlete login may later be associated with a parent-owned athlete profile.

---

## Under 13

Do not allow independent signup.

Direct the parent/guardian to create and manage the account.

Do not overbuild legal consent systems beyond PRD scope, but structure account relationships safely.

---

# 15. ATHLETE OWNERSHIP

A parent may manage multiple athletes.

An athlete may have:

* one parent owner
* optional athlete login

An adult independent athlete may have no parent owner.

Authorization must distinguish:

* account owner
* athlete
* coach

Do not assume account user = athlete in all cases.

---

# 16. PUBLIC WEBSITE RECREATION

The existing Pitch Lab prototype is the initial visual baseline.

Recreate its visual spirit and composition as closely as possible.

Focus on:

* dark athletic design
* typography hierarchy
* spacing
* hero composition
* navigation
* coach presentation
* program cards
* mobile behavior
* CTA placement
* premium feel

Do not prematurely redesign the brand.

---

# 17. HOMEPAGE CONTENT

Required sections:

1. Header
2. Hero
3. Trust indicators
4. Credibility / testimonial section
5. Jacob coach section
6. Coaching programs
7. CTA section
8. Footer

Use the PRD's current product names, pricing, and positioning.

---

# 18. TESTIMONIAL / CREDIBILITY IMPLEMENTATION

Build this feature in a way that can later be managed from data/configuration.

Include development placeholder entries but clearly mark them as:

```text
PLACEHOLDER — replace before production
```

Do not fabricate:

* velocity gains
* scholarships
* college commitments
* professional experience
* wins
* certifications
* testimonials

The UI should be production-quality even when using placeholder content.

---

# 19. RESPONSIVE REQUIREMENT

Every route must work well on:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px+
```

Do not treat desktop as the only primary experience.

The customer-facing product should feel excellent on a phone.

---

# 20. CUSTOMER DASHBOARD

Create a polished customer dashboard.

It should surface:

* selected athlete
* upcoming session
* lesson credits
* current throwing plan
* video-analysis status
* latest progress report
* Premium status
* recent coaching feedback
* quick actions

Parents with multiple athletes need an athlete switcher.

---

# 21. ATHLETE DASHBOARD

Athlete login should see only permitted athlete information.

Navigation should include relevant views such as:

* overview
* lessons
* plans
* progress
* video analysis

Do not show parent billing controls to minor athlete users unless explicitly authorized.

---

# 22. JACOB'S COACH DASHBOARD

Jacob is the only coach at launch.

Create a high-quality coaching operations dashboard.

Primary route:

```text
/coach
```

Include:

* today's lessons
* upcoming lessons
* video-analysis queue
* Premium athletes
* athlete alerts
* recent activity
* workload indicators
* Premium capacity
* lightweight revenue summary

This dashboard should prioritize operational usefulness over decorative analytics.

---

# 23. COACH ATHLETE WORKSPACE

Route pattern:

```text
/coach/athletes/:id
```

Create a central athlete workspace containing:

* athlete profile
* parent/customer details
* goals
* current program
* credits
* booking history
* video-analysis history
* throwing plans
* progress reports
* coach notes
* subscription state

Jacob should not need to jump between many disconnected pages to understand an athlete.

---

# 24. PRODUCTS

Seed the current four products.

## 1-Hour Session

$40 one time

## Recorded 1-Hour Session

$60 one time

## Premium Coaching

$150 monthly

## Video Data Analysis

$30 one time

Do not hardcode prices into frontend business logic.

Use product data and Stripe mapping.

---

# 25. STRIPE CHECKOUT

Create checkout sessions server-side.

Never accept a client-submitted price as authoritative.

The client may submit a product identifier.

The server resolves:

* Stripe Price
* product
* customer
* athlete
* entitlement behavior

---

# 26. PAYMENT SOURCE OF TRUTH

A Stripe success redirect is not proof of payment.

Only verified Stripe webhook events should mark orders as paid or create paid entitlements.

Implement robust webhook signature verification.

---

# 27. STRIPE WEBHOOKS

Support the relevant events defined by the PRD, including at minimum:

```text
checkout.session.completed
payment_intent.succeeded
payment_intent.payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
charge.refunded
```

Use a durable Stripe-event record.

Each Stripe event ID must be processed at most once.

Webhook handlers must be idempotent.

---

# 28. SERVICE CREDITS

One-time lessons and Premium benefits should create service credits.

Credits must be server-authoritative.

Never let the browser change:

* quantity
* remaining balance
* expiration
* source order
* subscription association

Use oldest-expiring usable credits first.

---

# 29. PREMIUM MONTHLY RULE

Every successfully paid Premium billing cycle grants:

**4 private-training session credits.**

Premium credits remain valid during:

* original billing cycle
* one additional billing cycle

Then they expire.

Build expiration logic clearly and test it.

---

# 30. PREMIUM CAPACITY

Premium requires configurable capacity.

Business setting or product configuration should control the limit.

When full:

* purchase CTA becomes waitlist-oriented
* API prevents additional Premium signup
* existing Premium customers remain unaffected

Do not hardcode a permanent capacity value.

---

# 31. RETENTION DISCOUNT READINESS

Support future retention incentives without implementing a giant promotion engine.

Design the system so Jacob can eventually enable a retention offer such as:

```text
30% off next month
```

Do not automatically enable this behavior in production.

Create simple extensibility rather than complex campaign infrastructure.

---

# 32. BOOKING ARCHITECTURE

Payment and scheduling are separate concepts.

A customer may:

```text
purchase → receive credit → book later
```

Booking must consume or reserve a valid entitlement.

Do not tie a Stripe transaction directly to one calendar slot.

---

# 33. AVAILABILITY

Jacob controls:

* recurring availability
* availability exceptions
* online availability
* in-person availability

Use America/Chicago as the initial business timezone.

Store timestamps consistently, preferably UTC.

Convert for display.

---

# 34. BOOKING DEFAULTS

Seed/configure:

```text
Booking window: 45 days
Minimum advance booking: 12 hours
Free reschedule threshold: 48 hours
Late reschedule fee: $10
Cancellation fee: $10
Premium rollover: 1 month
Video response target: 24 hours
```

All should be configuration-driven where specified in the PRD.

---

# 35. BOOKING CONCURRENCY

Protect against double-booking.

The implementation must not depend on:

```text
customer loads availability
→ slot appears open
→ frontend assumes still available
```

The backend/database must verify availability at write time.

Where appropriate, use:

* transaction
* database constraint
* locking-safe query pattern

Two simultaneous requests must not successfully reserve the same coach slot.

---

# 36. RESCHEDULING

Implement:

## 48+ hours before lesson

Free reschedule.

## Less than 48 hours

Allow reschedule with $10 configurable late fee.

Lesson credit remains intact.

The operation should only complete after required fee payment succeeds where payment is required.

Structure this cleanly.

---

# 37. CANCELLATION

Implement configurable $10 cancellation fee.

Customer retains the lesson credit.

The booking becomes cancelled.

Credit becomes available again.

Jacob can override where needed through trusted coach/admin actions.

---

# 38. NO-SHOW

Default behavior:

* scheduled credit is forfeited
* no extra monetary charge

Jacob may manually restore credit.

Audit that action.

---

# 39. DELIVERY MODES

Support:

```text
online
in_person
either
```

Products and bookings should know allowed/selected delivery mode.

---

# 40. IN-PERSON LOCATION

Do not hardcode a public training address.

Default customer language:

```text
Training location will be coordinated with Coach Jacob after booking.
```

Individual bookings may later store:

* location name
* address
* instructions

Protect private addresses from unrelated users.

---

# 41. ONLINE SESSIONS

Allow Jacob to add:

* meeting URL
* meeting instructions

Do not implement a video-call platform.

External solutions such as FaceTime, Zoom, or Google Meet are acceptable.

---

# 42. VIDEO ANALYSIS

Do not upload raw videos to Pitch Lab infrastructure.

Create a tracked submission workflow.

Customer:

1. purchases analysis if required
2. selects athlete
3. provides context
4. creates submission
5. receives unique reference code
6. chooses Email or Text
7. manually attaches video or customer-controlled share link
8. sends directly to Jacob

Pitch Lab stores metadata only.

---

# 43. VIDEO REFERENCE CODES

Create readable unique references.

Example pattern:

```text
PLA-V-1042
```

Do not rely on this reference as an authorization token.

It is a human-facing correlation ID only.

---

# 44. EMAIL VIDEO HANDOFF

Generate:

* prefilled destination
* prefilled subject
* prefilled body
* reference ID
* athlete name
* instructions

Do not automatically attach local files.

The user's email client handles the actual attachment.

---

# 45. TEXT VIDEO HANDOFF

Where supported, open SMS/iMessage deep link with:

* Jacob's configured business phone number
* reference number
* athlete name
* message instructions

Customer manually attaches the video.

Have a fallback message when deep linking is unsupported.

---

# 46. VIDEO STATUS WORKFLOW

Implement:

```text
awaiting_video
received
in_review
completed
closed
```

Jacob should easily update status.

The dashboard should highlight age of pending reviews.

---

# 47. VIDEO FEEDBACK

Store structured coaching feedback.

At minimum:

* summary
* mechanical notes
* corrective drills
* published timestamp

Notify customer when published.

---

# 48. THROWING PLANS

Implement plan creation and management.

Jacob should be able to:

* create
* edit
* publish
* archive

Customer/athlete should see a simple weekly plan interface.

Support print-friendly styling.

Do not introduce server-side PDF generation unless needed for basic functionality.

---

# 49. PROGRESS REPORTS

Implement monthly progress reports.

Recommended sections:

* overall summary
* wins
* areas to improve
* next focus
* coach notes

Jacob controls publish state.

Customers cannot see unpublished drafts.

---

# 50. COACH NOTES

Coach notes default to private.

Never expose private coach notes to parents or athletes.

If a customer-visible note mode is implemented, authorization must explicitly check visibility.

---

# 51. GAME-DAY SUPPORT

Present Premium's game-day benefit as:

**Game-Day Coaching Support**

Do not imply guaranteed physical attendance.

Use the PRD definition.

---

# 52. BILLING PORTAL

Use Stripe Billing Portal for:

* updating payment method
* billing information
* invoices
* subscription management
* cancellation

Do not recreate these features manually.

---

# 53. SUBSCRIPTION PAYMENT FAILURE

Implement a default three-day configurable grace period.

During grace period:

* flag payment issue
* provide Billing Portal action
* do not delete customer data

Entitlement suspension logic should be clear and documented.

---

# 54. EMAIL NOTIFICATIONS

Create a central notification/email service.

Implement templates for at least:

* welcome
* email verification support
* purchase confirmation
* Premium activation
* payment failure
* lesson booking
* lesson reschedule
* lesson cancellation
* lesson reminder
* video submission instructions
* video received
* video feedback ready
* throwing plan published
* progress report published
* credit expiration warning

If Resend credentials are unavailable, use a development adapter that logs a safe preview without leaking secrets.

---

# 55. NOTIFICATION IDEMPOTENCY

Avoid duplicate transactional messages where feasible.

Example:

A repeated Stripe webhook must not send two identical Premium activation emails.

---

# 56. BUSINESS SETTINGS

Implement business configuration.

At minimum:

```text
business_name
business_email
business_phone
business_timezone
booking_window_days
minimum_booking_notice_hours
free_reschedule_notice_hours
late_reschedule_fee_cents
cancellation_fee_cents
premium_capacity
credit_rollover_months
video_response_target_hours
```

Provide sensible seed defaults from the PRD.

---

# 57. ADMIN / COACH SETTINGS

Jacob should be able to manage appropriate operational settings from the coach/admin application.

Do not make security-sensitive secrets editable through the dashboard.

Environment secrets remain deployment configuration.

---

# 58. REVENUE SUMMARY

Create lightweight revenue/business metrics.

Include:

* revenue this month
* active Premium subscriptions
* Premium MRR
* lessons sold
* video analyses sold
* upcoming bookings
* outstanding credits

Do not build accounting software.

Do not attempt tax accounting.

---

# 59. ANALYTICS EVENTS

Implement a clean analytics wrapper.

Track events such as:

```text
homepage_viewed
program_viewed
testimonial_viewed
signup_started
signup_completed
checkout_started
checkout_completed
lesson_booked
video_analysis_started
premium_started
```

Never include private athlete or health information.

---

# 60. ACCESSIBILITY

Aim for WCAG 2.1 AA.

Implement:

* semantic HTML
* correct heading hierarchy
* keyboard navigation
* visible focus states
* accessible dialogs
* proper labels
* descriptive error text
* sufficient contrast
* alt text
* reduced-motion support

---

# 61. SEO

Implement public-site essentials:

* route metadata
* Open Graph metadata
* sitemap
* robots.txt
* canonical URLs
* semantic structure
* relevant structured data where reasonable

Use local/pitching-development wording naturally.

Do not keyword-stuff.

---

# 62. PERFORMANCE

Avoid unnecessary JS.

Optimize:

* images
* font loading
* public page rendering
* dashboard queries
* large component bundles

Do not fetch authenticated dashboard resources on public pages.

---

# 63. ERROR STATES

Every meaningful interactive screen must have:

* loading state
* empty state
* success state
* recoverable error state

Examples:

* no upcoming lessons
* no athletes
* no available credits
* no video submissions
* no throwing plans
* no progress reports
* Premium full
* Stripe unavailable
* booking conflict
* payment failure

Do not leave users with blank screens.

---

# 64. FORM UX

All forms should include:

* labels
* inline validation
* submission state
* disabled double-submit behavior
* useful error messages
* accessible controls

Do not rely only on toasts for form validation.

---

# 65. API DESIGN

Use:

```text
/api/v1
```

Keep routes resource-oriented.

Use the PRD endpoint suggestions as guidance.

All protected endpoints must enforce authentication and authorization.

Do not trust browser-supplied role or ownership identifiers.

---

# 66. ERROR RESPONSE FORMAT

Use consistent structured errors.

Example:

```json
{
  "error": {
    "code": "BOOKING_UNAVAILABLE",
    "message": "That appointment is no longer available."
  }
}
```

Create stable application error codes.

Do not expose internal stack traces in production responses.

---

# 67. AUDIT LOGS

Track important administrative/coaching actions.

Examples:

```text
booking_cancelled
booking_rescheduled
credit_restored
credit_forfeited
plan_published
report_published
video_marked_received
product_updated
subscription_override
role_changed
```

Audit metadata should be useful but should not duplicate highly sensitive data unnecessarily.

---

# 68. SECURITY

Implement defense in depth.

At minimum:

* RLS
* authenticated API routes
* role authorization
* server-side ownership checks
* Stripe webhook verification
* safe environment management
* validation
* secure CORS configuration
* no secrets in frontend bundles
* safe error handling
* basic rate limiting for sensitive endpoints
* safe logs

---

# 69. RATE LIMITING

Protect at minimum:

* authentication-adjacent API actions where applicable
* checkout session creation
* video submission creation
* reschedule/cancellation payment flows
* password-reset related custom routes if any
* admin mutation abuse paths

Use a pragmatic solution.

Do not introduce Redis unless clearly necessary.

---

# 70. LOGGING

Create structured server logs.

Never log:

* passwords
* Supabase JWTs
* Stripe secrets
* raw card data
* private coaching notes unnecessarily
* customer video content
* full sensitive request bodies

---

# 71. ENVIRONMENT VARIABLES

Create `.env.example`.

Separate client-safe and server-secret variables.

Example categories:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

SUPABASE_URL
SUPABASE_SECRET_KEY

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

RESEND_API_KEY

POSTHOG_*
SENTRY_*

CORS_ORIGIN
```

Validate required server environment at startup.

---

# 72. SEED DATA

Create useful development seed data.

Include:

* Jacob coach account metadata
* parent example
* multiple child athletes
* independent adult athlete
* all four products
* Premium subscription example
* credits
* lesson
* video submission
* throwing plan
* progress report
* placeholder testimonials

Make seeded screens look realistic.

Clearly distinguish fake development content.

---

# 73. TESTING REQUIREMENT

Testing is part of implementation, not an optional cleanup phase.

Use:

* unit tests
* integration tests
* database/RLS tests
* Playwright E2E

Do not claim a flow works without at least appropriate automated coverage for critical behavior.

---

# 74. UNIT TESTS

Cover at minimum:

* Premium credit issuance
* credit expiration
* oldest-credit consumption
* rollover behavior
* Premium capacity
* late reschedule threshold
* cancellation fee calculation
* booking conflict helper logic
* authorization helpers
* subscription entitlement states

---

# 75. INTEGRATION TESTS

Cover:

* Stripe checkout creation
* Stripe webhook idempotency
* successful Premium invoice
* failed subscription payment
* one-time lesson purchase
* booking creation
* booking reschedule
* cancellation
* video-analysis submission
* coach feedback publication

---

# 76. RLS TESTS

Explicitly prove failures.

Examples:

* Parent A cannot access Parent B.
* Parent A cannot access Parent B's athlete.
* Athlete A cannot read Athlete B's plan.
* Minor athlete cannot access parent billing resources.
* Unauthenticated user cannot access protected data.

Positive tests should also confirm valid access works.

---

# 77. PLAYWRIGHT

Implement critical E2E scenarios.

At minimum:

### Parent flow

```text
signup
login
add athlete
purchase lesson
book lesson
view dashboard
```

### Adult athlete flow

```text
signup
purchase coaching
book lesson
```

### Premium flow

```text
subscribe
receive entitlement
see credits
book session
```

### Coach flow

```text
login
view dashboard
open athlete
create plan
publish report
complete video feedback
```

### Booking policy

```text
free reschedule >48h
late reschedule <48h
cancel and restore credit
```

Use Stripe/Supabase test configuration appropriately.

---

# 78. CI

Create GitHub Actions.

On pull request/run:

```text
install
lint
typecheck
unit tests
integration tests
database tests
build
```

If E2E requires unavailable external credentials, document how to run it and provide a CI-ready configuration.

Do not silently skip all critical tests.

---

# 79. README

The root README must explain:

* what Pitch Lab is
* repository architecture
* prerequisites
* installation
* environment setup
* Supabase setup
* Stripe setup
* seed data
* local development
* running tests
* production build
* deployment overview

A competent engineer should be able to clone the repository and understand how to run it without reverse-engineering the codebase.

---

# 80. ARCHITECTURE DOCUMENT

Create:

```text
docs/ARCHITECTURE.md
```

Explain:

* frontend/backend boundary
* authentication model
* authorization model
* RLS strategy
* payment lifecycle
* subscription entitlements
* booking/credit separation
* video handoff
* notification architecture
* major domain entities

---

# 81. API DOCUMENT

Create:

```text
docs/API.md
```

Document important routes.

Include:

* method
* path
* authentication
* request
* response
* common errors

This does not need to be an exhaustive generated OpenAPI system unless convenient.

---

# 82. ENVIRONMENT DOCUMENT

Create:

```text
docs/ENVIRONMENT.md
```

Document every required environment variable.

Clearly indicate:

```text
PUBLIC
SERVER SECRET
OPTIONAL
REQUIRED
```

---

# 83. LAUNCH CHECKLIST

Create:

```text
docs/LAUNCH_CHECKLIST.md
```

Include outstanding human tasks such as:

* create production Supabase project
* configure production Stripe products/prices
* configure webhook endpoint
* enter production keys
* enter Jacob business email
* enter Jacob business phone
* replace testimonial placeholders
* verify Jacob biography/credentials
* add real photos
* review cancellation language
* legal review
* privacy review
* configure production domain
* configure Resend DNS
* configure Sentry
* configure PostHog
* run production security checks
* run live checkout smoke test

---

# 84. DEPLOYMENT

Prepare deployment for approximately:

```text
Web → Vercel
API → Railway / Render / equivalent
Database/Auth → Supabase
Payments → Stripe
Email → Resend
```

Do not hardwire provider-specific assumptions so deeply that changing API hosting becomes difficult.

---

# 85. DO NOT ADD UNREQUESTED INFRASTRUCTURE

Do not add:

* Redis unless actually needed
* Elasticsearch
* Kafka
* RabbitMQ
* Kubernetes
* Docker Swarm
* microservices
* GraphQL
* separate auth service
* custom media pipeline

The application is initially for one coach.

Keep operational complexity proportional to the business.

---

# 86. DESIGN POLISH

Do not stop at functional HTML.

Customer-facing pages must look polished.

Pay attention to:

* vertical rhythm
* typography
* shadows
* hover states
* focus states
* button hierarchy
* card consistency
* navigation
* responsive spacing
* empty states
* skeletons
* subtle transitions

Animations should be restrained.

Avoid flashy or gimmicky motion.

---

# 87. DASHBOARD POLISH

Dashboards should be visually coherent but dense enough to be useful.

Avoid generic "analytics SaaS template" design.

Pitch Lab should still feel like an athletic coaching brand inside authenticated views.

---

# 88. COMPONENTIZATION

Create reusable components when they represent actual repeated concepts.

Examples:

* product card
* athlete selector
* lesson card
* credit badge
* status badge
* empty state
* dashboard panel
* plan day
* report section
* submission status
* coach navigation

Do not create abstraction purely for abstraction's sake.

---

# 89. BUSINESS LOGIC LOCATION

Keep business rules out of React components.

Examples:

* credit expiration
* cancellation policy
* Premium capacity
* payment state
* entitlement checks

belong in:

* services
* domain helpers
* API
* database constraints/policies

React should primarily manage presentation and interaction.

---

# 90. TRANSACTIONAL OPERATIONS

Operations involving multiple related writes should be atomic where practical.

Examples:

```text
booking + consume credit
cancel booking + restore credit
invoice paid + entitlement + four credits
refund + order status update
```

Prevent partially completed business states.

---

# 91. TIME HANDLING

Store timestamps consistently.

Prefer UTC in persistence.

Business timezone defaults to:

```text
America/Chicago
```

Display appropriately.

Test DST-sensitive booking behavior where reasonable.

Do not compare server-local timestamps naïvely.

---

# 92. MONEY HANDLING

Store monetary values as integer cents.

Example:

```text
4000 = $40.00
```

Do not use floating-point dollars for business logic.

---

# 93. TESTIMONIAL PLACEHOLDER RULE

During development only, placeholders may exist.

Use visual content such as:

```text
PLACEHOLDER TESTIMONIAL
Replace with verified Jacob/Pitch Lab customer quote before launch.
```

Do not accidentally make a fake testimonial appear genuine.

---

# 94. LEGAL PLACEHOLDER RULE

Create usable route structure and draft-safe placeholder pages for:

* Privacy
* Terms
* Cancellation
* Refund

Clearly mark legal review as required.

Do not pretend the generated text is legal advice or final approved policy.

---

# 95. PRIVACY FOR MINORS

Minimize collected information.

Do not introduce unnecessary:

* medical records
* school records
* sensitive health fields

Only collect data necessary for the coaching relationship.

---

# 96. FILE STORAGE

Do not store raw pitching video.

Other small assets such as profile/avatar images may use an appropriate storage method if necessary.

Keep private customer files private.

---

# 97. STOP CONDITIONS

Do not stop early because one external integration lacks production credentials.

Complete as much of the system as possible using:

* interfaces
* test mode
* development adapters
* environment placeholders

Only leave a blocking item incomplete when implementation is impossible without a secret or external account action.

Document every such blocker.

---

# 98. NO FALSE COMPLETION

Before saying the implementation is complete, verify:

* the repository builds
* lint passes
* TypeScript passes
* automated tests pass or blocked tests are explicitly documented
* core routes exist
* no known broken imports
* database migrations are coherent
* environment variables are documented
* no secrets are committed
* no raw pitching-video storage exists
* Stripe state is webhook-driven
* RLS exists and has tests

Do not claim tests passed unless they were actually run.

---

# 99. SELF-REVIEW PROCEDURE

After implementation, perform a deliberate review.

Review the codebase for:

## Architecture

* correct package boundaries
* frontend/backend separation
* duplicate logic
* business logic placed correctly

## Security

* secret leakage
* RLS gaps
* IDOR vulnerabilities
* broken role checks
* unsafe admin routes
* unverified Stripe state

## Payments

* duplicate entitlements
* webhook idempotency
* price tampering
* credit duplication

## Scheduling

* double-booking
* timezone issues
* late fee bypass
* credit reuse

## UX

* broken responsive views
* missing states
* inaccessible forms
* confusing customer flows

## Build

* failing scripts
* missing environment docs
* broken production compilation

Fix discovered issues before final completion.

---

# 100. IMPLEMENTATION PHASE ORDER

Work in this sequence unless a dependency requires minor reordering:

```text
1. Repository foundation
2. Shared TypeScript/config
3. Database schema
4. Migrations
5. RLS
6. Seed data
7. API foundation
8. Authentication
9. User/athlete relationships
10. Public prototype recreation
11. Testimonials/credibility
12. Stripe products
13. Checkout
14. Webhooks
15. Orders
16. Subscriptions
17. Service credits
18. Availability
19. Booking
20. Rescheduling/cancellation
21. Customer dashboard
22. Athlete dashboard
23. Jacob coach dashboard
24. Athlete workspace
25. Throwing plans
26. Progress reports
27. Coach notes
28. Video-analysis workflow
29. Email notifications
30. Billing portal
31. Revenue summary
32. Analytics hooks
33. Monitoring hooks
34. Accessibility
35. Responsive audit
36. Tests
37. Documentation
38. CI
39. Production build
40. Final security/self-review
```

---

# 101. PROTOTYPE REPLICA MILESTONE

Once the initial public marketing site accurately recreates the existing Pitch Lab prototype:

Document that as the:

```text
prototype-replica-v1
```

milestone.

If you have Git execution capability, create an appropriate tag only after the replica is actually complete.

If not, document the exact command the human should run.

Do not falsely state that a Git tag exists when it does not.

---

# 102. COST CONSTRAINT

Optimize for low initial operational cost.

Prefer:

* managed platforms
* free/low-cost tiers
* simple database queries
* no raw video storage
* external Stripe billing UI
* browser print instead of custom PDF service
* user's email/text client for video handoff

Do not optimize prematurely for millions of users.

---

# 103. FUTURE EXTENSIBILITY

While implementing V1, avoid assumptions that prevent future:

* additional coaches
* multiple Premium tiers
* high-frequency training packages
* calendar integrations
* SMS
* advanced video workflow
* additional athlete guardians
* AI coach-assistant features

Do not implement these now.

Simply avoid painting the architecture into a corner.

---

# 104. COMPLETION REPORT

At the end of your work, provide a concise but comprehensive implementation report.

Include:

## Completed

List major implemented systems.

## Repository Structure

Summarize major directories.

## Database

List migrations/tables/RLS coverage.

## Integrations

Explain state of:

* Supabase
* Stripe
* Resend
* Sentry
* PostHog

## Tests

Report exactly:

* which test suites were run
* which passed
* which failed
* which could not run and why

## Environment

List remaining human configuration.

## Launch Blockers

List only genuine production blockers.

## Known Limitations

List remaining intentional V1 limitations.

## How to Run

Give the minimum commands needed to:

```text
install
develop
test
build
```

## Next Recommended Step

Identify the single highest-value human review after implementation.

---

# 105. FINAL INSTRUCTION

Build the system.

Do not respond with only:

* a project plan
* pseudocode
* architecture discussion
* a folder tree
* a list of suggested files

Actually create the repository implementation.

Continue through the implementation phases until the application is as complete as possible within the available environment.

When a decision can be safely derived from the PRD, make the decision and proceed.

When production credentials are missing, implement the integration boundary and document configuration rather than stopping.

Prefer a coherent, secure, working V1 over speculative complexity.

The desired result is a codebase that a competent engineer can inspect, configure with real service credentials, test, refine visually, and move toward production without needing to rewrite its core architecture.
