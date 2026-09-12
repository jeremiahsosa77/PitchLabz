# Pitch Lab Athletics

## Final Product Requirements Document

**Version:** 2.0 — Final Pre-Implementation PRD
**Product:** Pitch Lab Athletics
**Reference prototype:** https://pitchlab-coaching.sappy-pig-8554.chatgpt.site/
**Primary coach:** Jacob Sosa
**Launch market:** Youth through college-level baseball pitchers
**Application type:** Responsive production web application
**Primary objective:** Recreate the existing Pitch Lab prototype faithfully, then transform it into a secure, polished coaching platform capable of handling real customers, scheduling, athlete records, and Stripe payments.

---

# 1. Product Vision

Pitch Lab Athletics is a private pitching-development business centered around personalized coaching rather than generic training programs.

The production application should allow Pitch Lab to manage the complete customer lifecycle:

**Discover Pitch Lab → Establish trust → Select coaching → Create account → Add athlete → Pay → Schedule → Train → Receive coaching → Track progress → Continue training**

The platform should feel like a premium baseball coaching business rather than a generic SaaS application.

It should be simple enough for a parent to use from their phone while providing Jacob with a central operating dashboard for his coaching business.

---

# 2. Primary Product Objectives

V1 must accomplish five things exceptionally well:

1. Reproduce the existing prototype's public-facing website.
2. Convert visitors into paying customers.
3. Allow parents and athletes to manage coaching services.
4. Give Jacob a professional operating dashboard.
5. Maintain strong separation between frontend, backend, payments, and customer data.

The product should be inexpensive to operate initially while leaving room to grow.

---

# 3. Product Principles

Development decisions should prioritize:

1. Security
2. Simplicity
3. Customer experience
4. Mobile usability
5. Professional polish
6. Low infrastructure cost
7. Maintainability
8. Speed of implementation
9. Future scalability

Do not introduce enterprise infrastructure before the business requires it.

Avoid:

* microservices
* Kubernetes
* custom authentication
* custom payment processing
* unnecessary databases
* complicated event systems
* premature caching infrastructure
* unnecessary AI features in V1

---

# 4. Final Technology Architecture

Use a **single monorepo containing separate frontend and backend applications**.

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
│   ├── seed.sql
│   └── tests/
│
├── docs/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

The frontend and backend must remain independently deployable.

---

# 5. Technology Stack

## Frontend

Use:

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui where appropriate
* React Hook Form
* Zod
* TanStack Query only where appropriate

## Backend

Use:

* Node.js
* TypeScript
* Hono
* Zod
* Stripe Node SDK
* Supabase server SDK

## Infrastructure

Use:

```text
Authentication  → Supabase Auth
Database        → Supabase PostgreSQL
Payments        → Stripe
Email           → Resend
Monitoring      → Sentry
Analytics       → PostHog
Frontend        → Vercel
Backend         → Railway, Render, or comparable platform
Source Control  → GitHub
```

Video storage is deliberately excluded from Pitch Lab's infrastructure in V1.

---

# 6. User Types

The platform supports four logical roles.

## Parent / Guardian

A customer who manages one or more athletes.

Can:

* maintain their account
* manage athletes
* purchase services
* book lessons
* manage billing
* view athlete coaching information
* initiate video submissions
* receive notifications

Only **one parent/guardian account may own an athlete in V1**.

Multi-parent households are explicitly deferred.

---

# 7. Athlete

Athletes may have their own login.

Athlete access depends on age.

### Adult athlete

An athlete age 18+ may create and control their own account.

They effectively act as both customer and athlete.

### Minor athlete

A minor athlete may have login access, but their athlete profile must be controlled by the registered parent/guardian.

For younger children, the parent may simply manage the athlete without creating an athlete login.

For the initial system:

* athletes under 13 do not independently register
* parent creates/manages the profile
* athletes 13–17 may receive athlete-login access after the parent account exists
* athletes 18+ may independently register

Exact legal language and consent processes should be reviewed before production launch.

---

# 8. Coach

There is exactly one coach at launch:

**Jacob Sosa**

Jacob receives a dedicated Coach Dashboard.

Jacob can:

* see customers
* see athletes
* control availability
* manage bookings
* review coaching history
* manage video-analysis submissions
* create throwing plans
* create progress reports
* write coaching notes
* manage products
* view business metrics
* manage Premium capacity

Architecture should allow additional coaches in the future without requiring major database redesign.

---

# 9. Admin

Jacob also acts as the initial administrator.

The system should nevertheless distinguish:

```text
coach
admin
```

permissions internally.

This prevents the architecture from assuming every future coach has full business administration privileges.

---

# 10. Signup Flow

Signup should begin with:

**Who are you creating this account for?**

Options:

### I'm a parent or guardian

Continue to parent registration.

After account creation:

**Add your athlete**

### I'm the athlete

Ask:

**How old are you?**

If 18+:

Continue with independent athlete account.

If 13–17:

Explain that a parent/guardian account must own the coaching relationship.

If under 13:

Direct the parent/guardian to create the account.

---

# 11. Parent Athlete Management

One parent can manage multiple athletes.

Example:

```text
Sarah Johnson
├── Mason Johnson
├── Luke Johnson
└── Ethan Johnson
```

Every purchase, lesson, plan, report, and video-analysis request should reference a specific athlete.

This prevents ambiguity when a family has multiple athletes.

---

# 12. Public Website

Required public routes:

```text
/
/programs
/about
/login
/signup
/privacy
/terms
```

Possible later routes:

```text
/results
/faq
/contact
```

---

# 13. Visual Direction

The current prototype is the initial design baseline.

V1 should replicate it as closely as reasonably practical before redesign work begins.

Visual characteristics:

* dark athletic aesthetic
* premium
* strong baseball identity
* bold typography
* modern spacing
* clean cards
* restrained motion
* subtle borders
* premium photography
* excellent mobile layout
* confident but non-corporate tone

Avoid making the product look like a generic software dashboard.

---

# 14. Header

Public navigation:

```text
Pitch Lab
Programs
About
Athlete Hub
Book a Lesson
```

Authenticated users should see:

```text
Dashboard
```

instead of login-oriented navigation.

Mobile navigation must be fully implemented.

---

# 15. Hero Section

Primary headline:

**Build the pitcher you're capable of becoming.**

Supporting positioning should emphasize:

* individualized development
* personalized throwing plans
* mechanical improvement
* honest coaching feedback
* measurable progress

Primary CTA:

**View Coaching Plans**

Secondary CTA:

**Explore Athlete Hub**

---

# 16. Credibility / Testimonial Strip

A prominent credibility section is required near the top of the homepage.

It should appear after the hero or immediately before the coaching section.

Purpose:

Answer the visitor's subconscious question:

> Why should I trust this coach with my development or my child's development?

Possible content types:

### Experience

Examples:

* playing experience
* coaching experience
* athlete levels coached
* relevant baseball accomplishments

### Results

Examples:

* athlete velocity improvements
* college commitments
* command improvements
* successful return-to-play stories
* athlete development milestones

Only use measurable claims that Jacob can substantiate.

### Testimonials

Each testimonial should support:

```text
quote
person name
relationship / athlete level
optional photo
optional result
```

Examples:

```text
"Jacob helped my son become much more confident on the mound."

— Parent of High School Pitcher
```

or

```text
"+5 MPH over one offseason"

Athlete development result
```

Do not fabricate testimonials or statistics.

Until real content is provided, development should use clearly marked placeholder data.

---

# 17. Coach Section

Feature Jacob prominently.

Include:

* professional photo
* name
* short biography
* coaching philosophy
* training methodology
* baseball background
* credentials/results when verified

Skill indicators may include:

* Plyo & Mobility
* Command Development
* Bullpen Work
* Video Analysis
* Throwing Programs
* Game Preparation

---

# 18. Coaching Products

Initial products are:

## 1-Hour Session

**$40**

Includes:

* private 60-minute session
* mechanical assessment
* individualized coaching
* drill recommendations

Delivery:

```text
In person or online when appropriate
```

---

# 19. Recorded 1-Hour Session

**$60**

Includes:

* private 60-minute session
* recorded mechanics review
* coach-led breakdown
* personalized drill recommendations

Session may be:

* in person
* remote

depending on arrangement.

---

# 20. Premium Coaching

**$150/month**

Includes:

* four private-training credits per month
* weekly throwing programming
* video feedback
* monthly progress report
* game-day coaching support
* priority coaching relationship

The product card should visually stand out from other products.

---

# 21. Video Data Analysis

**$30 per review**

Includes:

* athlete sends pitching video
* Jacob reviews mechanics
* individualized analysis
* corrective recommendations
* relevant drills

Pitch Lab will **not host the actual video file in V1**.

---

# 22. Product Configuration

Products must not be hardcoded into frontend logic.

Store:

```text
id
slug
name
description
product_type
price_cents
billing_interval
stripe_product_id
stripe_price_id
active
display_order
capacity
benefits
```

Jacob should eventually be able to modify:

* price
* description
* visibility
* benefits
* capacity

through his dashboard.

---

# 23. Athlete Hub

Authenticated customer application lives under:

```text
/app
```

Navigation:

```text
Dashboard
Athletes
Lessons
Video Analysis
Throwing Plans
Progress
Billing
Account
```

Athlete users see only their own athlete information.

Parents may switch between their athletes.

---

# 24. Customer Dashboard

Dashboard should answer:

**What's happening next?**

Display:

### Upcoming lesson

```text
Date
Time
Online / In Person
Status
```

### Available lesson credits

Example:

```text
3 Premium Sessions Available
```

### Current throwing plan

### Video analysis status

### Latest progress report

### Premium subscription status

### Recent coach feedback

Quick actions:

```text
Book Lesson
Send Video
View Plan
Manage Membership
```

---

# 25. Jacob's Coach Dashboard

Route:

```text
/coach
```

The Coach Dashboard should operate like Jacob's daily workspace.

Primary sections:

## Today

* today's sessions
* athlete
* time
* remote/in-person
* session type

## Upcoming

Next several scheduled sessions.

## Video Queue

Video reviews requiring action.

## Premium Athletes

Show:

* remaining monthly credits
* latest throwing plan
* next progress report due
* pending video review

## Athlete Alerts

Examples:

```text
Plan expires tomorrow
Monthly report due
Video awaiting review
3 unused credits approaching expiration
```

## Recent Activity

Examples:

```text
New customer
New Premium subscription
Lesson booked
Lesson rescheduled
Video submitted
Payment failed
```

---

# 26. Coach Navigation

Jacob's navigation:

```text
Dashboard
Calendar
Customers
Athletes
Video Queue
Throwing Plans
Progress Reports
Products
Revenue
Settings
```

---

# 27. Athlete Workspace

Jacob should have one central athlete screen.

Route:

```text
/coach/athletes/:id
```

Show:

### Athlete overview

* name
* age
* level
* school
* graduation year
* throwing arm
* goals

### Parent information

if applicable.

### Coaching status

* active services
* Premium status
* available credits

### Lesson history

### Video-analysis history

### Throwing plans

### Progress reports

### Private coach notes

---

# 28. Account Data Model

Recommended core entities:

```text
profiles
athletes
athlete_access
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

---

# 29. Profiles

```text
profiles

id
auth_user_id
role
first_name
last_name
email
phone
date_of_birth
avatar_url
created_at
updated_at
```

Roles:

```text
parent
athlete
coach
admin
```

---

# 30. Athletes

```text
athletes

id
owner_parent_id
athlete_user_id
first_name
last_name
date_of_birth
graduation_year
school
team
competitive_level
primary_position
throws
height
weight
goals
active
created_at
updated_at
```

Do not collect medical data unless a genuine business requirement emerges.

---

# 31. Athlete Ownership Rules

An athlete may have:

```text
one parent owner
zero or one athlete login
```

An adult independent athlete may have:

```text
owner_parent_id = NULL
athlete_user_id = their own account
```

A parent's athletes must never be visible to another parent.

---

# 32. Payments

Use Stripe exclusively.

Use:

* Stripe Checkout
* Stripe Customers
* Stripe Products
* Stripe Prices
* Stripe Subscriptions
* Stripe Billing Portal
* Stripe Webhooks

Pitch Lab must never store:

* credit-card numbers
* CVC
* raw payment credentials

---

# 33. Checkout Flow

Standard flow:

```text
Select Program
↓
Login / Signup
↓
Select Athlete
↓
Stripe Checkout
↓
Stripe Confirms Payment
↓
Webhook Updates Pitch Lab
↓
Service Becomes Available
```

Never trust the browser's Stripe success redirect as proof of payment.

Stripe webhook confirmation is authoritative.

---

# 34. Orders

```text
orders

id
customer_id
athlete_id
product_id
stripe_checkout_session_id
stripe_payment_intent_id
status
subtotal_cents
discount_cents
total_cents
currency
created_at
updated_at
```

Statuses:

```text
pending
paid
failed
refunded
cancelled
```

---

# 35. Lesson Credits

Payment and booking should remain separate.

Purchasing lessons grants credits.

```text
service_credits

id
customer_id
athlete_id
product_id
order_id
subscription_id
credit_batch
quantity
remaining
issued_at
expires_at
created_at
```

This allows customers to purchase now and schedule later.

---

# 36. Premium Credit Rules

Every successfully paid Premium billing cycle grants:

**4 private-training credits**

Each credit batch remains valid through:

**the original billing month plus one additional billing cycle**

Example:

Credits issued September 10 may be used until approximately November 9.

This gives the customer **one month of rollover**.

Credits do not roll over indefinitely.

Oldest credits should always be consumed first.

---

# 37. Premium Unused-Credit Retention

If customers repeatedly accumulate unused sessions, the application should attempt retention rather than allowing unlimited credit buildup.

Potential trigger:

```text
Customer has 2+ credits approaching expiration
```

Show a message such as:

**You still have training sessions available — keep your momentum going.**

Possible CTA:

**Book Sessions**

The architecture should also support an optional retention discount.

Example:

```text
30% off next Premium billing period
```

However:

* retention discounts must be configurable
* discounts should not automatically trigger every month
* default launch state may be OFF
* Jacob can activate them later
* eligibility should be limited to prevent repeated abuse

Recommended future rule:

One retention discount per customer every six months.

---

# 38. Premium Capacity

Premium Coaching must support a configurable membership capacity.

Reason:

Jacob is one coach and cannot provide unlimited:

* lessons
* throwing plans
* video feedback
* reports
* game-day support

Product fields:

```text
capacity_limit
active_members
waitlist_enabled
```

When capacity is reached:

Replace:

**Join Premium**

with:

**Join Waitlist**

The exact initial capacity should be configurable from Jacob's dashboard instead of hardcoded.

---

# 39. Future High-Frequency Coaching

The architecture should allow future products such as:

```text
Unlimited Private Training
Daily Pitching Development
Elite Monthly Package
Offseason Intensive
```

Do not build these in V1.

The product/entitlement system must simply avoid assuming every package contains exactly four sessions.

---

# 40. Lesson Types

Lesson delivery mode:

```text
in_person
online
either
```

Products may specify allowable delivery modes.

Customer chooses during booking when applicable.

---

# 41. In-Person Location

Because Jacob may arrange location individually, do not require a permanent public training facility.

For in-person bookings:

Display:

**Training location will be coordinated with Coach Jacob after booking.**

Jacob can later assign:

```text
location_name
address
instructions
```

to an individual booking.

Exact private addresses should only be shown to relevant booked customers.

---

# 42. Online Sessions

Remote lessons should allow Jacob to provide:

```text
meeting_url
meeting_instructions
```

after booking.

The platform does not need to host video calls.

Use an external platform such as:

* FaceTime
* Zoom
* Google Meet

depending on Jacob's preference.

---

# 43. Coach Availability

Jacob controls available coaching windows.

```text
coach_availability

id
coach_id
day_of_week
start_time
end_time
delivery_mode
active
```

Exceptions:

```text
availability_exceptions

id
coach_id
date
start_time
end_time
available
reason
```

Examples:

* vacation
* tournament
* holiday
* personal commitment

---

# 44. Booking Window

Recommended V1 policy:

Customers can book up to:

**45 days in advance**

Minimum advance booking:

**12 hours**

Both should be configurable.

Why:

45 days gives customers reasonable planning visibility without requiring Jacob to publish his schedule months ahead.

---

# 45. Rescheduling Policy

Recommended launch policy:

### 48+ hours before session

Free reschedule.

### Less than 48 hours

Customer may reschedule but pays a:

**$10 late-rescheduling fee**

Lesson credit is retained.

Fee should be configurable.

---

# 46. Cancellation Policy

Cancellation incurs a small administrative fee while allowing the customer to retain the lesson credit.

Recommended V1:

**$10 cancellation fee**

The underlying lesson credit returns to the customer's balance.

This prevents Pitch Lab from keeping the entire lesson value while still discouraging casual calendar blocking.

---

# 47. No-Show Policy

Recommended:

A customer who does not attend and provides no prior notice:

* loses the scheduled lesson credit

No additional monetary fee is necessary.

This avoids awkwardly charging a customer twice while still protecting Jacob's time.

Jacob may manually restore a credit when circumstances justify it.

---

# 48. Booking Conflict Prevention

The backend must prevent:

* duplicate bookings
* overlapping appointments
* booking unavailable times
* booking without entitlement/payment
* using one credit twice

Booking creation must occur transactionally.

Never depend only on frontend availability checks.

---

# 49. Video Philosophy

Pitch Lab does **not store customer pitching videos in V1**.

This reduces:

* storage expense
* video infrastructure
* privacy exposure
* bandwidth cost
* media-processing requirements

The application instead manages the **video-analysis workflow**, not the video file itself.

---

# 50. Video Submission Workflow

Customer selects:

**Send Video for Analysis**

Step 1:

Choose athlete.

Step 2:

Enter optional context:

```text
What would you like Jacob to look at?
Pitch type
Recent concern
Game/practice context
Additional notes
```

Step 3:

Pitch Lab creates a submission record.

Example:

```text
PLA-V-1042
```

Step 4:

Customer chooses:

```text
Send by Text
Send by Email
```

---

# 51. Text Submission

On supported mobile devices:

Launch an SMS/iMessage composer addressed to Jacob's business number.

Prefilled message:

```text
Pitch Lab Video Submission
Reference: PLA-V-1042
Athlete: Mason Johnson

I've attached the pitching video for this analysis request.
```

The customer attaches the video manually before sending.

Pitch Lab does not access or store the attachment.

---

# 52. Email Submission

Launch the customer's email application.

Subject:

```text
Pitch Lab Video Submission — PLA-V-1042
```

Body includes:

```text
Athlete
Submission reference
Customer notes
Instructions to attach the video
```

Customer attaches the video through their email client.

The application does not attempt to attach the video automatically.

---

# 53. Large Video Considerations

Email providers frequently impose attachment-size restrictions.

Therefore the submission instructions should allow customers to send:

* attached video
* iCloud link
* Google Drive link
* Dropbox link
* similar customer-controlled sharing link

Pitch Lab does not need to integrate with those providers in V1.

---

# 54. Video Submission Records

Store metadata only.

```text
video_submissions

id
reference_code
customer_id
athlete_id
order_id
submission_channel
customer_notes
status
submitted_at
received_at
reviewed_at
created_at
updated_at
```

Do **not** store:

```text
video file
video copy
video thumbnail
```

---

# 55. Video Status

Possible states:

```text
awaiting_video
received
in_review
completed
closed
```

Jacob manually clicks:

**Mark Video Received**

after receiving it through text/email.

---

# 56. Video Feedback

Pitch Lab may store Jacob's feedback because text coaching information is far smaller and easier to secure than raw video.

```text
video_feedback

id
submission_id
coach_id
summary
mechanical_notes
drill_recommendations
published_at
created_at
updated_at
```

Customer receives notification:

**Your Pitch Lab video analysis is ready.**

---

# 57. Video Turnaround

Premium program currently advertises approximately:

**24-hour video feedback**

The dashboard should help Jacob see submissions approaching the target.

Example:

```text
Received 19 hours ago
5 hours remaining in response target
```

Do not make automated guarantees during weekends/holidays unless Jacob explicitly wants that policy.

---

# 58. Throwing Plans

Premium athletes receive throwing programming.

```text
throwing_plans

id
athlete_id
coach_id
title
description
start_date
end_date
status
created_at
updated_at
```

Plan days:

```text
throwing_plan_days

id
plan_id
date
title
instructions
intensity
notes
display_order
```

Optional structured fields:

```text
drill
sets
reps
distance
intensity
```

---

# 59. Throwing Plan UX

Customer sees a simple weekly layout.

Example:

```text
MON
Recovery Throw

TUE
High Intent Bullpen

WED
Mobility / Recovery

THU
Command Work

FRI
Long Toss

SAT
Game / Bullpen

SUN
Rest
```

Mobile usability is essential.

---

# 60. Printable Plans

V1 should provide:

**Print / Save as PDF**

through print-friendly browser styling.

Do not build a dedicated PDF-generation service unless later required.

---

# 61. Progress Reports

Premium athletes receive monthly reports.

```text
progress_reports

id
athlete_id
coach_id
report_period
summary
wins
areas_to_improve
next_focus
coach_notes
published_at
created_at
updated_at
```

Recommended sections:

### This Month

Overall coaching summary.

### What's Improving

2–5 clear observations.

### Next Focus

Specific goals.

### Coach Notes

Additional individualized feedback.

---

# 62. Progress Report PDF

V1 should make reports print-friendly.

Dedicated downloadable generated PDFs are not required initially.

Add later if customers frequently request them.

---

# 63. Game-Day Coaching Support

Define Premium's vague "live game-day coaching" benefit professionally as:

**Game-Day Coaching Support**

Includes, by arrangement:

* pre-game pitching plan
* warm-up guidance
* opponent/game approach discussion
* post-game feedback
* phone/text support
* remote coaching conversation
* occasional in-person game attendance when explicitly arranged

It does **not** automatically promise Jacob will physically attend every game.

Public wording should make this clear.

---

# 64. Private Coach Notes

Jacob needs private notes unavailable to athlete/parent accounts.

```text
coach_notes

id
athlete_id
coach_id
content
visibility
created_at
updated_at
```

Visibility:

```text
private
customer_visible
```

Default:

```text
private
```

---

# 65. Notifications

Initial notification method:

**Email**

Notifications include:

* welcome
* verify email
* password reset
* payment confirmation
* Premium membership started
* Premium payment failed
* lesson booked
* lesson rescheduled
* lesson cancelled
* lesson reminder
* video-submission instructions
* video received
* video feedback ready
* throwing plan published
* progress report published
* credit expiration warning

---

# 66. Optional SMS

Actual application-generated SMS is out of scope for V1.

The "Text Jacob" video workflow uses the customer's phone messaging application through a deep link.

This avoids introducing Twilio or another SMS provider initially.

SMS notifications may be introduced later.

---

# 67. Reminder Timing

Recommended lesson reminders:

```text
24 hours before
2 hours before
```

For sessions booked within 24 hours:

Only send the relevant remaining reminder.

---

# 68. Premium Credit Expiration Reminders

Send/display reminders approximately:

```text
14 days before expiration
7 days before expiration
2 days before expiration
```

Primary CTA:

**Book My Session**

---

# 69. Billing

Customer Billing page should show:

* current membership
* payment status
* lesson purchases
* available credits
* credit expiration
* receipts/invoices
* Manage Subscription button

Use Stripe Billing Portal for:

* payment-method changes
* billing details
* invoices
* subscription cancellation

Do not recreate those features.

---

# 70. Stripe Webhooks

At minimum process:

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

All webhook signatures must be verified.

Processing must be idempotent.

---

# 71. Stripe Events Table

```text
stripe_events

id
stripe_event_id
event_type
processing_status
received_at
processed_at
error
```

A Stripe event must never grant benefits twice.

---

# 72. Premium Entitlement Creation

When a Premium invoice is successfully paid:

1. Verify Stripe webhook.
2. Verify subscription.
3. Create monthly Premium entitlement.
4. Issue four lesson credits.
5. Set expiration date.
6. Activate coaching-plan access.
7. Record billing period.
8. Send confirmation.

---

# 73. Failed Premium Payment

When payment fails:

Do not instantly delete customer data.

Show:

**Payment issue**

Provide:

**Update Payment Method**

via Stripe Billing Portal.

Entitlements should follow a configurable grace period before suspension.

Recommended:

**3 days**

---

# 74. Customer Cancellation

Premium customers may cancel through Stripe Billing Portal.

Default:

```text
cancel_at_period_end = true
```

Customer maintains access through the paid period.

Valid lesson credits maintain their normal expiration date.

---

# 75. Refunds

Recommended launch policy:

### Coaching already completed

Normally non-refundable.

### Accidental duplicate payment

Refundable.

### Pitch Lab cancellation

Full refund or restored credit at Jacob's discretion.

### Customer cancellation

Customer keeps lesson credit according to cancellation rules, so the original purchase is generally not refunded.

Jacob should be able to manually issue exceptions.

The final legal wording should be reviewed before launch.

---

# 76. Coach Revenue Dashboard

Jacob should see lightweight business metrics:

```text
Revenue this month
Premium MRR
Active Premium athletes
Lessons sold
Lessons completed
Video analyses sold
Upcoming bookings
Outstanding credits
```

Do not build full accounting software.

Stripe remains the authoritative financial transaction source.

---

# 77. Database Security

Enable Row Level Security on customer-accessible Supabase tables.

Core rules:

Parent:

* sees own profile
* sees owned athletes
* sees relevant orders
* sees relevant bookings
* sees athlete coaching records

Athlete:

* sees only own athlete record
* sees own lessons
* sees own plans
* sees own reports
* sees own video-analysis results

Jacob:

* sees all coaching/customer records required for his job

Admin:

* full permitted administrative access

---

# 78. Backend Separation

The frontend must never possess:

```text
Stripe secret key
Stripe webhook secret
Supabase privileged server key
Resend secret
administrative credentials
```

Sensitive business operations occur through the API.

---

# 79. API Structure

Base:

```text
/api/v1
```

Example endpoints:

```text
GET    /me

GET    /athletes
POST   /athletes
GET    /athletes/:id
PATCH  /athletes/:id

GET    /products

POST   /checkout/session
POST   /billing/portal

GET    /credits

GET    /bookings
POST   /bookings
POST   /bookings/:id/reschedule
POST   /bookings/:id/cancel

GET    /video-submissions
POST   /video-submissions
GET    /video-submissions/:id

GET    /plans
GET    /reports

POST   /webhooks/stripe
```

Coach:

```text
GET    /coach/dashboard
GET    /coach/calendar
GET    /coach/customers
GET    /coach/athletes
GET    /coach/athletes/:id

GET    /coach/video-submissions
PATCH  /coach/video-submissions/:id
POST   /coach/video-submissions/:id/feedback

POST   /coach/throwing-plans
PATCH  /coach/throwing-plans/:id
POST   /coach/progress-reports

GET    /coach/products
PATCH  /coach/products/:id

GET    /coach/settings
PATCH  /coach/settings
```

---

# 80. Input Validation

All external input must use Zod schemas shared between appropriate layers.

Never trust:

* URL IDs
* role sent from browser
* customer ID sent from browser
* price sent from browser
* credit quantities sent from browser
* payment status sent from browser

Prices and permissions are resolved server-side.

---

# 81. Error Handling

Standard structure:

```json
{
  "error": {
    "code": "BOOKING_UNAVAILABLE",
    "message": "That appointment is no longer available."
  }
}
```

Never expose:

* database errors
* stack traces
* credentials
* internal IDs unnecessarily

---

# 82. Business Settings

Create configurable settings.

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

Launch defaults:

```text
business_timezone              America/Chicago
booking_window_days            45
minimum_booking_notice_hours   12
free_reschedule_notice_hours   48
late_reschedule_fee            $10
cancellation_fee               $10
credit_rollover_months         1
video_response_target_hours    24
```

---

# 83. Analytics

Track anonymous/public funnel events:

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

Never send:

* athlete names
* birth dates
* private notes
* coaching feedback

to analytics.

---

# 84. Conversion Analytics

Important conversion metrics:

```text
Visitor → Programs
Programs → Signup
Signup → Checkout
Checkout → Purchase
Purchase → Booking
One-time customer → Premium
Premium retention
```

The testimonial/credibility section should be measurable to determine whether it contributes to conversion.

---

# 85. SEO

Public site should target relevant local and pitching-development searches.

Requirements:

* metadata
* Open Graph
* sitemap
* robots.txt
* canonical URLs
* semantic HTML
* organization/local business structured data where appropriate

Potential searches:

```text
pitching coach Corpus Christi
baseball pitching lessons Corpus Christi
pitching development Corpus Christi
youth pitching coach
private pitching lessons
```

Do not keyword-stuff pages.

---

# 86. Accessibility

Target WCAG 2.1 AA.

Requirements:

* semantic HTML
* keyboard navigation
* focus indicators
* accessible dialogs
* proper labels
* sufficient contrast
* descriptive validation
* alt text
* reduced-motion compatibility

---

# 87. Mobile Requirements

The entire product must work from a smartphone.

Priority widths:

```text
320
375
390
430
768
1024
1280
1440+
```

Critical mobile workflows:

* signup
* checkout
* athlete creation
* booking
* viewing plans
* submitting video instructions
* reading coaching feedback
* managing subscription

---

# 88. Performance Targets

Public pages target:

```text
Lighthouse Performance     90+
Accessibility              95+
Best Practices             95+
SEO                        95+
```

Use optimized images.

Avoid unnecessary JavaScript.

Do not fetch dashboard data on public marketing pages.

---

# 89. Monitoring

Use Sentry for:

* frontend exceptions
* backend exceptions
* failed requests
* payment integration errors

Never send:

* secrets
* private coaching notes
* customer videos
* unnecessary sensitive customer content

to monitoring.

---

# 90. Audit Logging

Track major administrative actions.

```text
audit_logs

id
actor_user_id
action
resource_type
resource_id
metadata
created_at
```

Examples:

```text
booking_cancelled
credit_restored
report_published
plan_updated
video_marked_received
subscription_override
product_price_changed
role_changed
```

---

# 91. Privacy

Because Pitch Lab serves minors, collect the minimum information necessary.

Avoid unnecessary collection of:

* medical history
* detailed health information
* school records
* sensitive personal data

Private athlete information must never be publicly accessible.

Legal pages required before production:

```text
Privacy Policy
Terms of Service
Cancellation Policy
Refund Policy
```

These should receive professional legal review before real customers use the platform.

---

# 92. Development Environments

Required:

```text
local
staging
production
```

Production customer records should never be used as test data.

Stripe test mode must be used outside production.

---

# 93. Seed Data

Development environment should include:

### Coach

Jacob Sosa

### Parent

Example parent.

### Athletes

At least two example athletes.

### Adult athlete

One independent athlete account.

### Products

All four programs.

### Activity

* upcoming lesson
* available credits
* Premium membership
* pending video analysis
* active throwing plan
* completed progress report
* testimonial placeholders

This allows developers/Astra to see realistic screens immediately.

---

# 94. Testing

Required layers:

## Unit tests

Test:

* credit expiration
* rollover logic
* entitlement creation
* late fee calculations
* booking conflict logic
* authorization helpers
* Premium capacity

## Integration tests

Test:

* Stripe checkout
* webhook handling
* subscription lifecycle
* booking creation
* rescheduling
* cancellation
* video-submission record creation

## Database security tests

Test RLS explicitly.

Parent A must never read Parent B's athlete.

Athlete A must never read Athlete B's records.

## End-to-end

Use Playwright.

Critical journeys:

```text
Parent signup
Add child
Purchase lesson
Book lesson

Adult athlete signup
Purchase coaching
Book lesson

Premium checkout
Receive credits
Book Premium session

Reschedule >48h
Reschedule <48h

Start video-analysis request

Jacob login
View athlete
Publish plan
Publish report
Complete video feedback

Manage Stripe subscription
```

---

# 95. CI/CD

Pull request pipeline:

```text
pnpm install
lint
typecheck
unit tests
integration tests
database tests
production build
```

Only validated code reaches production.

---

# 96. Git Strategy

Initial important milestone:

**Complete prototype replica**

Create Git tag:

```text
prototype-replica-v1
```

Do this before substantially redesigning the current marketing site.

This preserves Jacob's original concept permanently.

---

# 97. V1 Required Features

V1 includes:

### Marketing

* prototype recreation
* hero
* coach section
* credibility/testimonials
* programs
* responsive navigation
* conversion CTAs
* legal pages

### Authentication

* parent signup
* adult-athlete signup
* minor-athlete relationship
* login
* logout
* email verification
* password reset

### Athlete Management

* multiple athletes per parent
* athlete login
* athlete profiles

### Payments

* Stripe Checkout
* one-time purchases
* Premium subscriptions
* webhooks
* Billing Portal
* credits

### Scheduling

* availability
* bookings
* online/in-person
* rescheduling
* cancellation
* fees
* conflict protection

### Coaching

* throwing plans
* progress reports
* coach notes
* athlete history

### Video

* video-analysis purchase
* submission records
* email/text handoff
* status tracking
* written coach feedback

### Jacob Dashboard

* calendar
* customers
* athletes
* video queue
* plans
* reports
* products
* Premium capacity
* revenue summary

### Infrastructure

* RLS
* audit logging
* analytics
* monitoring
* email notifications
* testing
* CI/CD

---

# 98. Explicitly Out of Scope

Do not build in V1:

* native mobile apps
* video hosting
* video streaming
* automatic biomechanical analysis
* AI coaching
* SMS infrastructure
* live in-app chat
* Zoom integration
* Google Calendar sync
* Apple Calendar sync
* multiple parents per athlete
* multiple coaches
* teams
* organizations
* referral system
* full CRM
* accounting platform
* social network
* public athlete profiles
* leaderboards
* Rapsodo integration
* TrackMan integration
* wearable integrations
* advanced promotional engine

Architecture should allow several of these later.

---

# 99. Future Features

Potential V2/V3 features:

### Additional Coaches

Role-based assignment and revenue splitting.

### Multiple Training Packages

Including high-frequency/private-daily training.

### Calendar Integration

Google/Apple calendar synchronization.

### SMS Notifications

Automated reminders.

### AI Coach Assistant

Draft:

* progress reports
* throwing plans
* video-feedback notes

Jacob approves all customer-facing output.

### Advanced Video

Customer-controlled cloud links or purpose-built media storage.

### Coach Mobile App

Only after web usage justifies development.

---

# 100. Astra Implementation Rules

When this PRD is supplied to GPT Astra, Astra should be instructed to treat it as authoritative.

It must not invent alternative architecture unless technically necessary.

## Astra must:

* use the specified monorepo
* keep frontend/backend separated
* use TypeScript throughout
* use shared schemas/contracts
* create database migrations
* create RLS policies
* write seed data
* build responsive states
* build loading states
* build empty states
* build error states
* validate all requests
* enforce authorization server-side
* verify Stripe webhooks
* write tests alongside features
* preserve prototype styling
* use real integrations where credentials are available
* clearly document required environment variables

## Astra must not:

* disable TypeScript errors
* rely on `any`
* expose privileged Supabase credentials
* expose Stripe secrets
* trust browser-supplied prices
* trust browser-supplied roles
* make private tables publicly readable
* store user videos
* hardcode a single athlete
* hardcode arbitrary user IDs
* fabricate testimonials
* fabricate coaching statistics
* fake payment success
* create mock production endpoints
* bypass authorization because a page is hidden
* redesign the existing prototype before replica milestone

---

# 101. Recommended Astra Build Sequence

Build in this order:

### Phase 1 — Foundation

```text
Monorepo
Shared TypeScript config
Linting
Formatting
Environment validation
Supabase client structure
API structure
```

### Phase 2 — Database

```text
Schema
Migrations
RLS
Seed data
Database tests
```

### Phase 3 — Authentication

```text
Parent signup
Athlete signup
Login
Relationships
Authorization
```

### Phase 4 — Prototype Replica

Recreate the current public Pitch Lab site.

Add credibility/testimonial component with placeholder content clearly marked as placeholder.

Create:

```text
prototype-replica-v1
```

Git milestone.

### Phase 5 — Stripe

```text
Products
Checkout
Webhooks
Orders
Subscriptions
Billing Portal
Service credits
```

### Phase 6 — Scheduling

```text
Availability
Bookings
Delivery modes
Conflicts
Rescheduling
Cancellation
Fees
```

### Phase 7 — Dashboards

```text
Customer dashboard
Athlete dashboard
Jacob dashboard
```

### Phase 8 — Coaching

```text
Throwing plans
Progress reports
Coach notes
```

### Phase 9 — Video Workflow

```text
Video-analysis purchase
Submission ticket
Email handoff
Text handoff
Coach queue
Feedback
```

### Phase 10 — Notifications

Transactional email.

### Phase 11 — Polish

```text
Responsive audit
Accessibility
SEO
Performance
Animations
Error states
Empty states
```

### Phase 12 — Validation

```text
Unit tests
Integration tests
Playwright
RLS tests
Stripe test-mode flows
Security review
```

---

# 102. Definition of Done

Pitch Lab V1 is complete when all of the following are true.

## Marketing

* homepage closely reproduces prototype
* Jacob's credibility is clearly established
* verified testimonials/results can be added without code changes
* mobile experience is polished

## Accounts

* parent can register
* adult athlete can register
* parent can manage multiple athletes
* athlete can have appropriate login
* unauthorized users cannot cross accounts

## Commerce

* every product can be purchased
* Premium renews
* Stripe webhook controls payment state
* credits are correctly created
* rollover works
* expiration works
* Billing Portal works

## Scheduling

* Jacob can set availability
* customers can book
* online/in-person works
* double booking is impossible
* cancellation and rescheduling rules work
* late fees work

## Coaching

* Jacob can manage athletes
* publish throwing plans
* publish progress reports
* maintain private coaching notes

## Video

* customer can create video-analysis submission
* email/text handoff works
* Pitch Lab stores no raw video
* Jacob can mark received
* Jacob can publish feedback

## Security

* RLS passes
* secrets remain server-side
* Stripe signatures are verified
* privileged actions are protected
* cross-customer access tests fail correctly

## Quality

* production build succeeds
* Playwright critical flows pass
* mobile views are complete
* no significant console errors
* analytics work
* error monitoring works

---

# 103. Final Architecture

```text
                    ┌─────────────────────┐
                    │      CUSTOMER       │
                    │ Parent / Athlete    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Next.js Frontend  │
                    │      apps/web       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   TypeScript API    │
                    │      apps/api       │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼──────────────────┐
           │                   │                  │
           ▼                   ▼                  ▼
     ┌───────────┐       ┌───────────┐      ┌───────────┐
     │ Supabase  │       │  Stripe   │      │  Resend   │
     │Auth + DB  │       │ Payments  │      │   Email   │
     └───────────┘       └───────────┘      └───────────┘

                               │
                               │ Video handoff only
                               ▼
                    ┌─────────────────────┐
                    │ Jacob's Email/Phone │
                    │ User sends directly│
                    └─────────────────────┘
```

The application stores:

* customer information
* athlete profiles
* bookings
* payments metadata
* service credits
* plans
* reports
* coaching feedback
* submission status

The application does **not** store:

* card information
* raw pitching videos

---

# 104. Final Product Position

Pitch Lab V1 should not merely be a website with Stripe attached.

It should function as a compact operating system for Jacob's coaching business.

For customers, it should make Pitch Lab feel established, credible, organized, and easy to work with.

For Jacob, it should reduce administrative work and make it immediately obvious:

* who he is coaching
* when he is coaching them
* what they purchased
* how many sessions remain
* which videos need attention
* which athletes need new plans
* which reports are due
* how the business is performing

The system should remain small and inexpensive enough for one coach while using an architecture capable of supporting a substantially larger Pitch Lab business later.
