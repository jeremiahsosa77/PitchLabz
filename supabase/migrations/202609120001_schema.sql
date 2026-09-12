create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('parent','athlete','coach','admin')),
 first_name text not null, last_name text not null, email text not null,
 phone text, date_of_birth date, stripe_customer_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.athletes (
 id uuid primary key default gen_random_uuid(), owner_parent_id uuid references profiles(id),
 athlete_user_id uuid unique references profiles(id), first_name text not null, last_name text not null,
 date_of_birth date not null, graduation_year integer, school text, team text,
 competitive_level text not null default 'youth', throws text not null check(throws in ('R','L','S')),
 goals text not null default '', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(owner_parent_id is not null or athlete_user_id is not null)
);
create index athletes_owner on athletes(owner_parent_id);
create table public.athlete_access (
 id uuid primary key default gen_random_uuid(), athlete_id uuid not null references athletes(id),
 invited_email text not null, invited_by uuid not null references profiles(id),
 token_hash text unique not null, expires_at timestamptz not null, accepted_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.coaching_products (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, description text not null,
 product_type text not null check(product_type in ('lesson','recorded_lesson','premium','video')),
 price_cents integer not null check(price_cents>=50), billing_interval text check(billing_interval='month'),
 stripe_product_id text, stripe_price_id text, active boolean not null default true, display_order integer not null default 0,
 capacity integer check(capacity>=0), benefits jsonb not null default '[]',
 credits_per_cycle integer not null default 1 check(credits_per_cycle>0),
 delivery_mode text not null default 'either' check(delivery_mode in ('in_person','online','either')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_settings (id boolean primary key default true check(id), value jsonb not null, updated_at timestamptz not null default now());
create table public.orders (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references profiles(id), athlete_id uuid not null references athletes(id),
 product_id uuid not null references coaching_products(id), request_id uuid not null unique,
 stripe_checkout_session_id text unique, stripe_payment_intent_id text unique,
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded','cancelled')),
 total_cents integer not null check(total_cents>=0), currency text not null default 'usd',
 checkout_expires_at timestamptz not null default now()+interval '30 minutes',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references profiles(id), athlete_id uuid not null references athletes(id),
 product_id uuid not null references coaching_products(id), stripe_subscription_id text unique not null,
 status text not null, current_period_start timestamptz not null, current_period_end timestamptz not null,
 cancel_at_period_end boolean not null default false, payment_failed_at timestamptz,
 last_event_at bigint not null default 0, created_at timestamptz not null default now()
);
create table public.service_credits (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references profiles(id), athlete_id uuid not null references athletes(id),
 product_id uuid not null references coaching_products(id), order_id uuid references orders(id), subscription_id uuid references subscriptions(id),
 credit_batch text unique not null, kind text not null check(kind in ('lesson','recorded_lesson','video')),
 quantity integer not null check(quantity>0), remaining integer not null check(remaining>=0 and remaining<=quantity),
 issued_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index credits_athlete on service_credits(athlete_id,issued_at);
create table public.coach_availability (
 id uuid primary key default gen_random_uuid(), coach_id uuid not null references profiles(id),
 day_of_week integer not null check(day_of_week between 0 and 6), start_time time not null, end_time time not null,
 delivery_mode text not null check(delivery_mode in ('online','in_person','either')), active boolean not null default true,
 check(end_time>start_time)
);
create table public.availability_exceptions (
 id uuid primary key default gen_random_uuid(), coach_id uuid not null references profiles(id), date date not null,
 start_time time not null,end_time time not null,available boolean not null,reason text,
 check(end_time>start_time)
);
create table public.lesson_bookings (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references profiles(id), athlete_id uuid not null references athletes(id),
 coach_id uuid not null references profiles(id), credit_id uuid not null references service_credits(id),
 starts_at timestamptz not null, ends_at timestamptz not null,
 delivery_mode text not null check(delivery_mode in ('online','in_person')),
 status text not null default 'confirmed' check(status in ('confirmed','completed','cancelled','no_show')),
 location_name text, address text, instructions text, meeting_url text, credit_restored_at timestamptz,
 version integer not null default 1, created_at timestamptz not null default now(),
 check(ends_at=starts_at+interval '1 hour')
);
create index bookings_coach_time on lesson_bookings(coach_id,starts_at);
create table public.booking_changes (
 id uuid primary key default gen_random_uuid(), request_id uuid unique not null, booking_id uuid not null references lesson_bookings(id),
 customer_id uuid not null references profiles(id), action text not null check(action in ('reschedule','cancel')),
 target_start timestamptz, booking_version integer not null, fee_cents integer not null check(fee_cents>=0),
 status text not null default 'pending' check(status in ('pending','applied','paid_conflict','expired')),
 stripe_checkout_session_id text unique, stripe_payment_intent_id text unique,
 expires_at timestamptz not null default now()+interval '30 minutes', created_at timestamptz not null default now()
);
create unique index one_pending_change on booking_changes(booking_id) where status='pending';
create sequence public.video_reference start 1001;
create table public.video_submissions (
 id uuid primary key default gen_random_uuid(), reference_code text not null unique default 'PLA-V-'||nextval('video_reference'),
 customer_id uuid not null references profiles(id), athlete_id uuid not null references athletes(id), credit_id uuid references service_credits(id),
 submission_channel text not null check(submission_channel in ('sms','email')), customer_notes text not null default '',
 status text not null default 'awaiting_video' check(status in ('awaiting_video','received','in_review','completed','closed')),
 received_at timestamptz, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.video_feedback (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references video_submissions(id),coach_id uuid not null references profiles(id),
 summary text not null,mechanical_notes text not null,drill_recommendations text not null,published_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.throwing_plans (
 id uuid primary key default gen_random_uuid(),athlete_id uuid not null references athletes(id),coach_id uuid not null references profiles(id),
 title text not null,description text not null,start_date date not null,end_date date not null,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(),check(end_date>=start_date)
);
create table public.throwing_plan_days (
 id uuid primary key default gen_random_uuid(),plan_id uuid not null references throwing_plans(id) on delete cascade,
 date date not null,title text not null,instructions text not null,intensity text not null,display_order integer not null default 0
);
create table public.progress_reports (
 id uuid primary key default gen_random_uuid(),athlete_id uuid not null references athletes(id),coach_id uuid not null references profiles(id),
 report_period date not null,summary text not null,wins text not null,areas_to_improve text not null,next_focus text not null,
 coach_notes text not null,published_at timestamptz,created_at timestamptz not null default now()
);
create table public.coach_notes (
 id uuid primary key default gen_random_uuid(),athlete_id uuid not null references athletes(id),coach_id uuid not null references profiles(id),
 content text not null,visibility text not null default 'private' check(visibility in ('private','customer_visible')),created_at timestamptz not null default now()
);
create table public.stripe_events (stripe_event_id text primary key,event_type text not null,processing_status text not null default 'processed',received_at timestamptz not null default now(),processed_at timestamptz not null default now());
create table public.notifications (
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references profiles(id),dedupe_key text not null unique,
 template text not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(), sent_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.audit_logs (id uuid primary key default gen_random_uuid(),actor_user_id uuid references profiles(id),action text not null,resource_type text not null,resource_id uuid,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.waitlist (id uuid primary key default gen_random_uuid(),customer_id uuid not null references profiles(id),athlete_id uuid not null references athletes(id),product_id uuid not null references coaching_products(id),created_at timestamptz not null default now(),unique(athlete_id,product_id));

create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('coach','admin')) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create function public.can_read_athlete(a uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from athletes where id=a and (owner_parent_id=auth.uid() or athlete_user_id=auth.uid())) or is_staff() $$;
create function public.owns_athlete(u uuid,a uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from athletes where id=a and active and (owner_parent_id=u or (owner_parent_id is null and athlete_user_id=u and date_of_birth<=current_date-interval '18 years'))) $$;
create function public.premium_access(a uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from subscriptions s where athlete_id=a and ((status in ('active','trialing') and current_period_end>now()) or (status='past_due' and payment_failed_at+make_interval(days=>coalesce((select (value->>'payment_grace_days')::int from business_settings),3))>now()))) $$;

do $$ declare t text; begin
 foreach t in array array['profiles','athletes','athlete_access','coaching_products','business_settings','orders','subscriptions','service_credits','coach_availability','availability_exceptions','lesson_bookings','booking_changes','video_submissions','video_feedback','throwing_plans','throwing_plan_days','progress_reports','coach_notes','stripe_events','notifications','audit_logs','waitlist'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on coaching_products to anon;
create policy products_read on coaching_products for select using(active or is_staff());
create policy profiles_read on profiles for select using(id=auth.uid() or is_staff());
create policy athletes_read on athletes for select using(can_read_athlete(id));
create policy settings_read on business_settings for select to authenticated using(true);
create policy availability_read on coach_availability for select to authenticated using(true);
create policy exceptions_read on availability_exceptions for select using(is_staff());
create policy bookings_read on lesson_bookings for select using(can_read_athlete(athlete_id));
create policy credits_read on service_credits for select using(can_read_athlete(athlete_id));
create policy videos_read on video_submissions for select using(can_read_athlete(athlete_id));
create policy feedback_read on video_feedback for select using(is_staff() or (published_at is not null and exists(select 1 from video_submissions s where s.id=submission_id and can_read_athlete(s.athlete_id))));
create policy plans_read on throwing_plans for select using(is_staff() or (status='published' and can_read_athlete(athlete_id)));
create policy days_read on throwing_plan_days for select using(exists(select 1 from throwing_plans p where p.id=plan_id));
create policy reports_read on progress_reports for select using(is_staff() or (published_at is not null and can_read_athlete(athlete_id)));
create policy notes_read on coach_notes for select using(is_staff() or (visibility='customer_visible' and can_read_athlete(athlete_id)));
do $$ declare t text; begin
 foreach t in array array['orders','subscriptions','booking_changes','waitlist'] loop
 execute format('create policy billing_read on %I for select using (customer_id=auth.uid() or is_admin())',t);
 end loop; end $$;
create policy notifications_read on notifications for select using(customer_id=auth.uid() or is_admin());
create policy audit_read on audit_logs for select using(is_staff());
create policy invites_read on athlete_access for select using(invited_by=auth.uid());
-- No direct client writes, including for coaches. Validated API commands own all mutations.
revoke all on function owns_athlete(uuid,uuid) from public,anon,authenticated;
revoke all on function premium_access(uuid) from public,anon,authenticated;
grant execute on function owns_athlete(uuid,uuid),premium_access(uuid) to service_role;
