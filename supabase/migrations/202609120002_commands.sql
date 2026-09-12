create function public.assert_owner(u uuid,a uuid) returns void language plpgsql set search_path=public as $$ begin if not owns_athlete(u,a) then raise exception 'FORBIDDEN'; end if; end $$;
create function public.audit(u uuid,action text,resource text,rid uuid) returns void language sql set search_path=public as $$ insert into audit_logs(actor_user_id,action,resource_type,resource_id) values(u,action,resource,rid) $$;
create function public.notify_customer(u uuid,kind text,key text) returns void language sql set search_path=public as $$ insert into notifications(customer_id,template,dedupe_key) values(u,kind,key) on conflict(dedupe_key) do nothing $$;
create function public.onboard(u uuid,p jsonb,email_address text) returns profiles language plpgsql set search_path=public as $$
declare r profiles; dob date := (p->>'date_of_birth')::date; begin
 if p->>'role' not in ('parent','athlete') or dob>current_date-interval '18 years' then raise exception 'ADULT_ACCOUNT_REQUIRED'; end if;
 insert into profiles(id,role,first_name,last_name,email,date_of_birth) values(u,p->>'role',p->>'first_name',p->>'last_name',email_address,dob) on conflict(id) do nothing;
 select * into r from profiles where id=u;
 if r.role='athlete' then insert into athletes(athlete_user_id,first_name,last_name,date_of_birth,competitive_level,throws) values(u,r.first_name,r.last_name,dob,'adult','R') on conflict(athlete_user_id) do nothing; end if;
 perform notify_customer(u,'welcome','welcome:'||u); return r;
end $$;
create function public.validate_athlete_owner() returns trigger language plpgsql set search_path=public as $$ begin
 if new.date_of_birth>current_date then raise exception 'INVALID_BIRTH_DATE'; end if;
 if new.owner_parent_id is not null and not exists(select 1 from profiles where id=new.owner_parent_id and role='parent') then raise exception 'GUARDIAN_REQUIRED'; end if;
 if new.owner_parent_id is null and new.date_of_birth>current_date-interval '18 years' then raise exception 'GUARDIAN_REQUIRED'; end if;
 if new.athlete_user_id is not null and (new.date_of_birth>current_date-interval '13 years' or not exists(select 1 from profiles where id=new.athlete_user_id and role='athlete')) then raise exception 'ATHLETE_LOGIN_NOT_ALLOWED'; end if;
 return new; end $$;
create trigger athlete_owner before insert or update on athletes for each row execute function validate_athlete_owner();

create function public.slot_available(coach uuid,starts timestamptz,mode text,exclude_booking uuid default null) returns boolean language plpgsql stable set search_path=public as $$
declare cfg jsonb; local_start timestamp; local_end timestamp; begin
 select value into cfg from business_settings;
 local_start:=starts at time zone (cfg->>'business_timezone'); local_end:=(starts+interval '1 hour') at time zone (cfg->>'business_timezone');
 if starts<now()+make_interval(hours=>(cfg->>'minimum_booking_notice_hours')::int) or starts>now()+make_interval(days=>(cfg->>'booking_window_days')::int) or local_start::date<>local_end::date then return false; end if;
 if not exists(select 1 from profiles where id=coach and role in ('coach','admin')) then return false; end if;
 if exists(select 1 from availability_exceptions e where e.coach_id=coach and not e.available and e.date=local_start::date and e.start_time<local_end::time and e.end_time>local_start::time) then return false; end if;
 if not exists(select 1 from coach_availability a where a.coach_id=coach and a.active and a.day_of_week=extract(dow from local_start) and a.start_time<=local_start::time and a.end_time>=local_end::time and a.delivery_mode in (mode,'either')) and not exists(select 1 from availability_exceptions e where e.coach_id=coach and e.available and e.date=local_start::date and e.start_time<=local_start::time and e.end_time>=local_end::time) then return false; end if;
 return not exists(select 1 from lesson_bookings b where b.coach_id=coach and b.status='confirmed' and b.id is distinct from exclude_booking and b.starts_at<starts+interval '1 hour' and b.ends_at>starts);
end $$;
create function public.guard_booking_overlap() returns trigger language plpgsql set search_path=public as $$ begin
 perform pg_advisory_xact_lock(hashtextextended(new.coach_id::text,0));
 if new.status='confirmed' and exists(select 1 from lesson_bookings b where b.coach_id=new.coach_id and b.status='confirmed' and b.id<>new.id and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'BOOKING_UNAVAILABLE'; end if;
 return new; end $$;
create trigger booking_overlap before insert or update on lesson_bookings for each row execute function guard_booking_overlap();
create function public.book_lesson(u uuid,p jsonb) returns lesson_bookings language plpgsql set search_path=public as $$
declare cr service_credits; b lesson_bookings; a uuid:=(p->>'athlete_id')::uuid; coach uuid:=(p->>'coach_id')::uuid; starts timestamptz:=(p->>'starts_at')::timestamptz; begin
 perform assert_owner(u,a); perform pg_advisory_xact_lock(hashtextextended(coach::text,0));
 if not slot_available(coach,starts,p->>'delivery_mode') then raise exception 'BOOKING_UNAVAILABLE'; end if;
 select c.* into cr from service_credits c join coaching_products cp on cp.id=c.product_id where c.athlete_id=a and c.kind=p->>'kind' and c.remaining>0 and c.revoked_at is null and (c.expires_at is null or c.expires_at>starts) and cp.delivery_mode in (p->>'delivery_mode','either') order by c.issued_at,c.expires_at nulls last,c.id limit 1 for update of c;
 if cr.id is null then raise exception 'NO_CREDITS'; end if;
 update service_credits set remaining=remaining-1 where id=cr.id;
 insert into lesson_bookings(customer_id,athlete_id,coach_id,credit_id,starts_at,ends_at,delivery_mode) values(u,a,coach,cr.id,starts,starts+interval '1 hour',p->>'delivery_mode') returning * into b;
 perform notify_customer(u,'lesson_booked','booked:'||b.id); return b;
end $$;
create function public.prepare_booking_change(u uuid,bid uuid,action_name text,target timestamptz,req uuid) returns booking_changes language plpgsql set search_path=public as $$
declare b lesson_bookings; c booking_changes; cfg jsonb; fee integer; begin
 select * into b from lesson_bookings where id=bid for update; perform assert_owner(u,b.athlete_id);
 select * into c from booking_changes where request_id=req; if c.id is not null then if c.customer_id<>u or c.booking_id<>bid then raise exception 'FORBIDDEN'; end if; return c; end if;
 if b.status<>'confirmed' or b.starts_at<=now() then raise exception 'INVALID_BOOKING_STATE'; end if;
 select value into cfg from business_settings;
 if action_name='cancel' then fee:=(cfg->>'cancellation_fee_cents')::int;
 elsif action_name='reschedule' then
 fee:=case when b.starts_at>=now()+make_interval(hours=>(cfg->>'free_reschedule_notice_hours')::int) then 0 else (cfg->>'late_reschedule_fee_cents')::int end;
 if not slot_available(b.coach_id,target,b.delivery_mode,b.id) or exists(select 1 from service_credits where id=b.credit_id and (revoked_at is not null or expires_at<=target)) then raise exception 'BOOKING_UNAVAILABLE'; end if;
 else raise exception 'INVALID_ACTION'; end if;
 update booking_changes set status='expired' where booking_id=bid and status='pending' and expires_at<now();
 insert into booking_changes(request_id,booking_id,customer_id,action,target_start,booking_version,fee_cents) values(req,bid,u,action_name,target,b.version,fee) returning * into c;
 return c; end $$;
create function public.apply_booking_change(cid uuid,paid boolean default false) returns booking_changes language plpgsql set search_path=public as $$
declare c booking_changes; b lesson_bookings; begin
 select * into c from booking_changes where id=cid for update;
 if c.status='applied' or c.status='paid_conflict' then return c; end if;
 if c.fee_cents>0 and not paid then raise exception 'PAYMENT_REQUIRED'; end if;
 select * into b from lesson_bookings where id=c.booking_id for update;
 perform pg_advisory_xact_lock(hashtextextended(b.coach_id::text,0));
 if b.status<>'confirmed' or b.version<>c.booking_version or b.starts_at<=now() or (c.action='reschedule' and (not slot_available(b.coach_id,c.target_start,b.delivery_mode,b.id) or exists(select 1 from service_credits where id=b.credit_id and (revoked_at is not null or expires_at<=c.target_start)))) then
 if paid then update booking_changes set status='paid_conflict' where id=cid returning * into c; perform audit(null,'paid_booking_conflict','booking_changes',cid); perform notify_customer(c.customer_id,'booking_action_required','change-conflict:'||cid); return c;
 else raise exception 'BOOKING_UNAVAILABLE'; end if; end if;
 if c.action='cancel' then
 update lesson_bookings set status='cancelled',version=version+1,credit_restored_at=now() where id=b.id;
 update service_credits set remaining=least(quantity,remaining+1) where id=b.credit_id and revoked_at is null;
 else update lesson_bookings set starts_at=c.target_start,ends_at=c.target_start+interval '1 hour',version=version+1,location_name=null,address=null,meeting_url=null,instructions=null where id=b.id; end if;
 update booking_changes set status='applied' where id=cid returning * into c;
 perform audit(c.customer_id,'booking_'||c.action,'lesson_bookings',b.id);
 perform notify_customer(c.customer_id,'lesson_'||c.action,'change:'||cid); return c;
end $$;
create function public.create_video(u uuid,p jsonb) returns video_submissions language plpgsql set search_path=public as $$
declare a uuid:=(p->>'athlete_id')::uuid; cr service_credits; v video_submissions; begin
 perform assert_owner(u,a);
 if not premium_access(a) then
 select * into cr from service_credits where athlete_id=a and kind='video' and remaining>0 and revoked_at is null and (expires_at is null or expires_at>now()) order by issued_at,id limit 1 for update;
 if cr.id is null then raise exception 'NO_CREDITS'; end if;
 update service_credits set remaining=remaining-1 where id=cr.id; end if;
 insert into video_submissions(customer_id,athlete_id,credit_id,submission_channel,customer_notes) values(u,a,cr.id,p->>'submission_channel',p->>'customer_notes') returning * into v;
 perform notify_customer(u,'video_instructions','video:'||v.id); return v; end $$;
create function public.reserve_order(u uuid,a uuid,pid uuid,req uuid) returns orders language plpgsql set search_path=public as $$
declare p coaching_products; o orders; cap integer; occupied integer; begin
 perform assert_owner(u,a);
 select * into p from coaching_products where id=pid and active for update;
 if p.id is null or p.stripe_price_id is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
 select * into o from orders where request_id=req; if o.id is not null then if o.customer_id<>u or o.athlete_id<>a or o.product_id<>pid then raise exception 'FORBIDDEN'; end if; return o; end if;
 if p.product_type='premium' then
 if exists(select 1 from subscriptions where athlete_id=a and status not in ('canceled','incomplete_expired')) then raise exception 'ALREADY_SUBSCRIBED'; end if;
 cap:=coalesce(p.capacity,(select (value->>'premium_capacity')::int from business_settings));
 -- A hold is released by Stripe's expiration webhook, never by a local clock. This prevents overselling when a paid webhook is delayed.
 select (select count(*) from subscriptions where product_id=pid and status not in ('canceled','incomplete_expired'))+(select count(*) from orders where product_id=pid and status='pending') into occupied;
 if occupied>=cap then raise exception 'PREMIUM_FULL'; end if; end if;
 insert into orders(customer_id,athlete_id,product_id,request_id,total_cents) values(u,a,pid,req,p.price_cents) returning * into o; return o;
end $$;

-- All commands accept an API-authenticated actor; never expose these as public RPCs.
do $$ declare r record; begin
 for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('assert_owner','audit','notify_customer','onboard','slot_available','book_lesson','prepare_booking_change','apply_booking_change','create_video','reserve_order') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig);
 execute format('grant execute on function %s to service_role',r.sig);
 end loop; end $$;
