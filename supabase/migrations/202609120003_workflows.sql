create function public.process_stripe_event(eid text,etype text,p jsonb) returns text language plpgsql set search_path=public as $$
declare o orders; prod coaching_products; sub subscriptions; c booking_changes; qty integer; exp timestamptz; invoice_key text; begin
 insert into stripe_events(stripe_event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return 'duplicate'; end if;
 if p->>'change_id' is not null and p->>'paid'='true' then
 select * into c from booking_changes where id=(p->>'change_id')::uuid for update;
 if c.id is null or c.fee_cents<>(p->>'amount')::int or p->>'currency'<>'usd' then raise exception 'PAYMENT_MISMATCH'; end if;
 update booking_changes set stripe_payment_intent_id=p->>'payment_intent' where id=c.id;
 insert into payment_ledger(source_key,customer_id,amount_cents) values('fee:'||c.id,c.customer_id,c.fee_cents) on conflict do nothing;
 perform apply_booking_change(c.id,true); return 'processed'; end if;
 if p->>'order_id' is not null then select * into o from orders where id=(p->>'order_id')::uuid for update;
 elsif p->>'payment_intent' is not null then select * into o from orders where stripe_payment_intent_id=p->>'payment_intent' for update; end if;
 if o.id is null then return 'ignored'; end if;
 if etype='checkout.session.expired' then update orders set status='cancelled',updated_at=now() where id=o.id and status='pending'; return 'processed'; end if;
 select * into prod from coaching_products where id=o.product_id;
 if etype='charge.refunded' then
 -- Conservatively freeze unused credits on any refund; an admin can resolve partial refunds.
 update orders set status='refunded',updated_at=now() where id=o.id;
 update service_credits set remaining=0,revoked_at=now() where order_id=o.id;
 if p->>'refund_amount' is not null then insert into payment_ledger(source_key,customer_id,order_id,amount_cents) values('refund:'||(p->>'charge_id'),o.customer_id,o.id,-(p->>'refund_amount')::int) on conflict(source_key) do update set amount_cents=least(payment_ledger.amount_cents,excluded.amount_cents); end if;
 perform audit(null,'refund_received','orders',o.id); return 'processed'; end if;
 if p->>'subscription_id' is not null then
 insert into subscriptions(customer_id,athlete_id,product_id,stripe_subscription_id,status,current_period_start,current_period_end,cancel_at_period_end,last_event_at)
 values(o.customer_id,o.athlete_id,o.product_id,p->>'subscription_id',p->>'subscription_status',(p->>'period_start')::timestamptz,(p->>'period_end')::timestamptz,coalesce((p->>'cancel_at_period_end')::boolean,false),(p->>'event_created')::bigint)
 on conflict(stripe_subscription_id) do update set status=excluded.status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,last_event_at=excluded.last_event_at
 where subscriptions.last_event_at<=excluded.last_event_at returning * into sub;
 if sub.id is null then select * into sub from subscriptions where stripe_subscription_id=p->>'subscription_id'; end if;
 if etype='invoice.payment_failed' and sub.last_event_at<=(p->>'event_created')::bigint then
 update subscriptions set payment_failed_at=coalesce(payment_failed_at,now()) where id=sub.id;
 perform notify_customer(o.customer_id,'payment_failed','failed:'||(p->>'invoice_id')); end if;
 end if;
 if etype='payment_intent.payment_failed' and o.status='pending' then update orders set status='failed' where id=o.id; end if;
 if p->>'paid'='true' then
 if o.status='refunded' then return 'ignored'; end if;
 if prod.product_type<>'premium' then
 if (p->>'amount')::int<>o.total_cents or p->>'currency'<>'usd' then raise exception 'PAYMENT_MISMATCH'; end if;
 update orders set status='paid',stripe_payment_intent_id=coalesce(p->>'payment_intent',stripe_payment_intent_id),updated_at=now() where id=o.id;
 insert into payment_ledger(source_key,customer_id,order_id,amount_cents) values('order:'||o.id,o.customer_id,o.id,o.total_cents) on conflict do nothing;
 insert into service_credits(customer_id,athlete_id,product_id,order_id,credit_batch,kind,quantity,remaining)
 values(o.customer_id,o.athlete_id,o.product_id,o.id,'order:'||o.id,prod.product_type,prod.credits_per_cycle,prod.credits_per_cycle) on conflict(credit_batch) do nothing;
 perform notify_customer(o.customer_id,'purchase_confirmation','paid:'||o.id);
 elsif etype='invoice.paid' and p->>'grant_cycle'='true' and sub.id is not null then
 invoice_key:='invoice:'||(p->>'invoice_id'); qty:=prod.credits_per_cycle;
 insert into payment_ledger(source_key,customer_id,order_id,amount_cents) values(invoice_key,o.customer_id,o.id,coalesce((p->>'amount')::int,o.total_cents)) on conflict do nothing;
 exp:=(p->>'period_end')::timestamptz+make_interval(months=>(select (value->>'credit_rollover_months')::int from business_settings));
 insert into service_credits(customer_id,athlete_id,product_id,order_id,subscription_id,credit_batch,kind,quantity,remaining,expires_at)
 values(o.customer_id,o.athlete_id,o.product_id,o.id,sub.id,invoice_key,'lesson',qty,qty,exp) on conflict(credit_batch) do nothing;
 update orders set status='paid',updated_at=now() where id=o.id;
 if sub.last_event_at<=(p->>'event_created')::bigint then update subscriptions set payment_failed_at=null where id=sub.id; end if;
 perform notify_customer(o.customer_id,'premium_started',invoice_key); end if; end if;
 return 'processed'; end $$;

create function public.save_coaching(u uuid,kind text,p jsonb,rid uuid default null) returns uuid language plpgsql set search_path=public as $$
declare a uuid; recipient uuid; result_id uuid; d jsonb; old_status text; begin
 if not exists(select 1 from profiles where id=u and role in ('coach','admin')) then raise exception 'FORBIDDEN'; end if;
 a:=(p->>'athlete_id')::uuid;
 if kind='plan' then
 if rid is null then insert into throwing_plans(athlete_id,coach_id,title,description,start_date,end_date,status) values(a,u,p->>'title',p->>'description',(p->>'start_date')::date,(p->>'end_date')::date,p->>'status') returning id into result_id;
 else update throwing_plans set title=p->>'title',description=p->>'description',start_date=(p->>'start_date')::date,end_date=(p->>'end_date')::date,status=p->>'status' where id=rid and athlete_id=a returning id into result_id; delete from throwing_plan_days where plan_id=result_id; end if;
 if result_id is null then raise exception 'NOT_FOUND'; end if;
 for d in select * from jsonb_array_elements(p->'days') loop
 if (d->>'date')::date<(p->>'start_date')::date or (d->>'date')::date>(p->>'end_date')::date then raise exception 'INVALID_PLAN_DAY'; end if;
 insert into throwing_plan_days(plan_id,date,title,instructions,intensity) values(result_id,(d->>'date')::date,d->>'title',d->>'instructions',d->>'intensity'); end loop;
 elsif kind='report' then
 insert into progress_reports(athlete_id,coach_id,report_period,summary,wins,areas_to_improve,next_focus,coach_notes,published_at) values(a,u,(p->>'report_period')::date,p->>'summary',p->>'wins',p->>'areas_to_improve',p->>'next_focus',p->>'coach_notes',case when (p->>'publish')::boolean then now() end) returning id into result_id;
 elsif kind='feedback' then
 select athlete_id,status into a,old_status from video_submissions where id=rid for update;
 if a is null or old_status='closed' then raise exception 'INVALID_VIDEO_STATE'; end if;
 insert into video_feedback(submission_id,coach_id,summary,mechanical_notes,drill_recommendations,published_at) values(rid,u,p->>'summary',p->>'mechanical_notes',p->>'drill_recommendations',case when (p->>'publish')::boolean then now() end)
 on conflict(submission_id) do update set summary=excluded.summary,mechanical_notes=excluded.mechanical_notes,drill_recommendations=excluded.drill_recommendations,published_at=excluded.published_at returning id into result_id;
 if (p->>'publish')::boolean then update video_submissions set status='completed',reviewed_at=now() where id=rid; end if;
 else raise exception 'INVALID_ACTION'; end if;
 select coalesce(owner_parent_id,athlete_user_id) into recipient from athletes where id=a;
 perform audit(u,kind||'_saved',kind,result_id);
 if p->>'status'='published' or p->>'publish'='true' then perform notify_customer(recipient,kind||'_published',kind||':'||result_id); end if;
 return result_id; end $$;

create function public.coach_booking_action(u uuid,bid uuid,action_name text) returns void language plpgsql set search_path=public as $$
declare b lesson_bookings; begin
 if not exists(select 1 from profiles where id=u and role in ('coach','admin')) then raise exception 'FORBIDDEN'; end if;
 select * into b from lesson_bookings where id=bid for update; if b.id is null then raise exception 'NOT_FOUND'; end if;
 if action_name in ('completed','no_show') and b.status='confirmed' and b.ends_at<=now() then update lesson_bookings set status=action_name,version=version+1 where id=bid;
 elsif action_name='restore' and b.credit_restored_at is null then
 update service_credits set remaining=least(quantity,remaining+1) where id=b.credit_id and revoked_at is null;
 update lesson_bookings set status='cancelled',credit_restored_at=now(),version=version+1 where id=bid;
 else raise exception 'INVALID_BOOKING_STATE'; end if;
 perform audit(u,'booking_'||action_name,'lesson_bookings',bid); end $$;

create function public.accept_athlete_invite(u uuid,email_address text,hash text) returns uuid language plpgsql set search_path=public as $$
declare i athlete_access; a athletes; begin
 select * into i from athlete_access where token_hash=hash and lower(invited_email)=lower(email_address) and expires_at>now() and accepted_at is null for update;
 if i.id is null then raise exception 'INVITE_INVALID'; end if;
 select * into a from athletes where id=i.athlete_id for update;
 if a.athlete_user_id is not null or a.date_of_birth>current_date-interval '13 years' then raise exception 'ATHLETE_LOGIN_NOT_ALLOWED'; end if;
 if exists(select 1 from profiles where id=u) then raise exception 'ACCOUNT_ALREADY_EXISTS'; end if;
 insert into profiles(id,role,first_name,last_name,email,date_of_birth) values(u,'athlete',a.first_name,a.last_name,email_address,a.date_of_birth);
 update athletes set athlete_user_id=u where id=a.id;
 update athlete_access set accepted_at=now() where id=i.id; perform audit(i.invited_by,'athlete_login_linked','athletes',a.id); return a.id; end $$;

create function public.enqueue_reminders() returns void language plpgsql set search_path=public as $$
declare b lesson_bookings; c service_credits; hours integer; days integer; begin
 for hours in select unnest(array[24,2]) loop
 for b in select * from lesson_bookings where status='confirmed' and starts_at>now() and starts_at<=now()+make_interval(hours=>hours) and created_at<=starts_at-make_interval(hours=>hours) loop
 perform notify_customer(b.customer_id,'lesson_reminder','reminder:'||b.id||':'||b.version||':'||hours); end loop; end loop;
 for days in select unnest(array[14,7,2]) loop
 for c in select * from service_credits where remaining>0 and revoked_at is null and expires_at>now() and expires_at<=now()+make_interval(days=>days) and expires_at>now()+make_interval(days=>days-1) loop
 perform notify_customer(c.customer_id,'credit_expiration','expiry:'||c.id||':'||days); end loop; end loop; end $$;
create function public.claim_notifications() returns setof notifications language sql set search_path=public as $$
 update notifications set status='sending',attempts=attempts+1,available_at=now()+interval '10 minutes' where id in (select id from notifications where ((status in ('pending','failed') and attempts<8) or status='sending') and available_at<=now() order by created_at limit 20 for update skip locked) returning * $$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('process_stripe_event','save_coaching','coach_booking_action','accept_athlete_invite','enqueue_reminders','claim_notifications') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig); execute format('grant execute on function %s to service_role',r.sig);
 end loop; end $$;
grant usage,select on all sequences in schema public to service_role;
