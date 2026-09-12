create table public.payment_ledger (
 source_key text primary key,customer_id uuid not null references profiles(id),order_id uuid references orders(id),
 amount_cents integer not null,currency text not null default 'usd',occurred_at timestamptz not null default now()
);
alter table payment_ledger enable row level security;
revoke all on payment_ledger from anon,authenticated;
grant select on payment_ledger to authenticated;
grant all on payment_ledger to service_role;
create policy ledger_read on payment_ledger for select using(customer_id=auth.uid() or is_admin());
create function public.revenue_summary(u uuid) returns jsonb language plpgsql set search_path=public as $$ begin
 if not exists(select 1 from profiles where id=u and role='admin') then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object(
 'revenue_month_cents',coalesce((select sum(amount_cents) from payment_ledger where occurred_at>=date_trunc('month',now())),0),
 'premium_mrr_cents',coalesce((select sum(p.price_cents) from subscriptions s join coaching_products p on p.id=s.product_id where s.status='active'),0),
 'premium_athletes',(select count(distinct athlete_id) from subscriptions where status='active'),
 'lessons_completed',(select count(*) from lesson_bookings where status='completed'),
 'upcoming_bookings',(select count(*) from lesson_bookings where status='confirmed' and starts_at>now()),
 'outstanding_credits',coalesce((select sum(remaining) from service_credits where kind<>'video' and revoked_at is null and (expires_at is null or expires_at>now())),0));
 end $$;
revoke all on function revenue_summary(uuid) from public,anon,authenticated;
grant execute on function revenue_summary(uuid) to service_role;
