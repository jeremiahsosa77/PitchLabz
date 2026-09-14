-- Forward-only payment hardening. Review legacy pending subscriptions before rollout.
alter table orders add column stripe_price_id text;
update orders o set stripe_price_id=p.stripe_price_id from coaching_products p where p.id=o.product_id;
create function public.snapshot_order_price() returns trigger language plpgsql set search_path=public as $$
begin select stripe_price_id into new.stripe_price_id from coaching_products where id=new.product_id; return new; end $$;
create trigger order_price_snapshot before insert on orders for each row execute function snapshot_order_price();

create table public.payment_reviews (
 id uuid primary key default gen_random_uuid(), stripe_event_id text not null unique references stripe_events(stripe_event_id),
 order_id uuid references orders(id), reason text not null, charge_id text, amount_cents integer,
 resolved_at timestamptz, resolution text, created_at timestamptz not null default now()
);
alter table payment_reviews enable row level security;
revoke all on payment_reviews from anon,authenticated;
grant select on payment_reviews to authenticated;
grant all on payment_reviews to service_role;
create policy payment_reviews_admin on payment_reviews for select using(is_admin());

create or replace function public.process_stripe_event(eid text,etype text,p jsonb) returns text language plpgsql set search_path=public as $$
declare o orders; prod coaching_products; sub subscriptions; c booking_changes; qty integer; exp timestamptz; invoice_key text; begin
 insert into stripe_events(stripe_event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return 'duplicate'; end if;
 if p->>'change_id' is not null and p->>'paid'='true' then
 select * into c from booking_changes where id=(p->>'change_id')::uuid for update;
 if c.id is null or c.fee_cents is distinct from (p->>'amount')::int or p->>'currency' is distinct from 'usd' then raise exception 'PAYMENT_MISMATCH'; end if;
 update booking_changes set stripe_payment_intent_id=p->>'payment_intent' where id=c.id;
 insert into payment_ledger(source_key,customer_id,amount_cents) values('fee:'||c.id,c.customer_id,c.fee_cents) on conflict do nothing;
 perform apply_booking_change(c.id,true); return 'processed'; end if;
 if p->>'order_id' is not null then select * into o from orders where id=(p->>'order_id')::uuid for update;
 elsif p->>'payment_intent' is not null then select * into o from orders where stripe_payment_intent_id=p->>'payment_intent' for update; end if;
 if etype='charge.refunded' then
 -- Refund amounts are cumulative per charge; ledger updates never double count.
 if o.id is not null and p->>'refund_amount' is not null then
 insert into payment_ledger(source_key,customer_id,order_id,amount_cents)
 values('refund:'||(p->>'charge_id'),o.customer_id,o.id,-(p->>'refund_amount')::int)
 on conflict(source_key) do update set amount_cents=least(payment_ledger.amount_cents,excluded.amount_cents);
 end if;
 if o.id is null or p->>'full_refund' is distinct from 'true'
 or (p->>'refund_amount')::int is distinct from o.total_cents
 or exists(select 1 from coaching_products where id=o.product_id and product_type='premium') then
 insert into payment_reviews(stripe_event_id,order_id,reason,charge_id,amount_cents)
 values(eid,o.id,case when o.id is null then 'unmatched_refund' else 'manual_refund' end,p->>'charge_id',(p->>'refund_amount')::int);
 perform audit(null,'refund_review_required','orders',o.id);
 return 'review_required';
 end if;
 update orders set status='refunded',updated_at=now() where id=o.id;
 update service_credits set remaining=0,revoked_at=coalesce(revoked_at,now()) where order_id=o.id;
 if exists(select 1 from lesson_bookings b join service_credits cr on cr.id=b.credit_id where cr.order_id=o.id and b.status in ('confirmed','completed','no_show')) then
 insert into payment_reviews(stripe_event_id,order_id,reason,charge_id,amount_cents)
 values(eid,o.id,'refund_with_booked_credit',p->>'charge_id',(p->>'refund_amount')::int);
 end if;
 perform audit(null,'full_refund_received','orders',o.id); return 'processed';
 end if;
 if o.id is null then return 'ignored'; end if;
 if etype='checkout.session.expired' then update orders set status='cancelled',updated_at=now() where id=o.id and status='pending'; return 'processed'; end if;
 select * into prod from coaching_products where id=o.product_id;
 if p->>'subscription_id' is not null then
 if prod.product_type<>'premium' or o.stripe_price_id is null
 or p->>'subscription_price_id' is distinct from o.stripe_price_id
 or (etype='invoice.paid' and p->>'grant_cycle'='true' and
 (p->>'invoice_price_id' is distinct from o.stripe_price_id or p->>'currency' is distinct from 'usd'
 or (p->>'amount')::int is distinct from o.total_cents or p->>'invoice_id' is null
 or p->>'period_start' is null or p->>'period_end' is null
 or (p->>'period_end')::timestamptz <= (p->>'period_start')::timestamptz)) then raise exception 'PAYMENT_MISMATCH'; end if;
 insert into subscriptions(customer_id,athlete_id,product_id,stripe_subscription_id,status,current_period_start,current_period_end,cancel_at_period_end,last_event_at)
 values(o.customer_id,o.athlete_id,o.product_id,p->>'subscription_id',p->>'subscription_status',coalesce(p->>'subscription_period_start',p->>'period_start')::timestamptz,coalesce(p->>'subscription_period_end',p->>'period_end')::timestamptz,coalesce((p->>'cancel_at_period_end')::boolean,false),(p->>'event_created')::bigint)
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
 if (p->>'amount')::int is distinct from o.total_cents or p->>'currency' is distinct from 'usd' then raise exception 'PAYMENT_MISMATCH'; end if;
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

