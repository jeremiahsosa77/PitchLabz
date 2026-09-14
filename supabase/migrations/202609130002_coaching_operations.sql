-- Read-only coaching entitlement projection: no parent billing details are exposed.
create function public.coaching_status(u uuid)
returns table(athlete_id uuid,premium_active boolean) language sql stable set search_path=public as $$
 select a.id,premium_access(a.id) from athletes a
 where a.active and (a.owner_parent_id=u or a.athlete_user_id=u or exists(select 1 from profiles where id=u and role in ('coach','admin')))
 order by a.id limit 500
$$;
revoke all on function coaching_status(uuid) from public,anon,authenticated;
grant execute on function coaching_status(uuid) to service_role;

create function public.premium_capacity_status()
returns table(product_id uuid,capacity integer,occupied integer) language sql stable set search_path=public as $$
 select p.id,coalesce(p.capacity,(s.value->>'premium_capacity')::int),
 ((select count(*) from subscriptions sub where sub.product_id=p.id and sub.status not in ('canceled','incomplete_expired'))+
 (select count(*) from orders o where o.product_id=p.id and o.status='pending' and not exists(
 select 1 from subscriptions sub where sub.product_id=o.product_id and sub.athlete_id=o.athlete_id and sub.status not in ('canceled','incomplete_expired'))))::integer
 from coaching_products p cross join business_settings s where p.product_type='premium'
$$;
revoke all on function premium_capacity_status() from public,anon,authenticated;
grant execute on function premium_capacity_status() to service_role;

-- Video state, audit and customer notification commit together.
create function public.set_video_status(u uuid,vid uuid,new_status text) returns video_submissions language plpgsql set search_path=public as $$
declare v video_submissions; begin
 if not exists(select 1 from profiles where id=u and role in ('coach','admin')) then raise exception 'FORBIDDEN'; end if;
 select * into v from video_submissions where id=vid for update;
 if v.id is null then raise exception 'NOT_FOUND'; end if;
 if v.status=new_status then return v; end if;
 if not ((new_status='received' and v.status='awaiting_video') or (new_status='in_review' and v.status='received') or (new_status='closed' and v.status in ('awaiting_video','received','in_review','completed'))) then raise exception 'INVALID_VIDEO_STATE'; end if;
 update video_submissions set status=new_status,received_at=case when new_status='received' then now() else received_at end where id=vid returning * into v;
 perform audit(u,'video_'||new_status,'video_submissions',vid);
 if new_status='received' then perform notify_customer(v.customer_id,'video_received','video-received:'||vid); end if;
 return v; end $$;
revoke all on function set_video_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function set_video_status(uuid,uuid,text) to service_role;

create or replace function public.reserve_order(u uuid,a uuid,pid uuid,req uuid) returns orders language plpgsql set search_path=public as $$
declare p coaching_products; o orders; cap integer; occupied integer; begin
 perform assert_owner(u,a);
 select * into p from coaching_products where id=pid and active for update;
 if p.id is null or p.stripe_price_id is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
 select * into o from orders where request_id=req; if o.id is not null then if o.customer_id<>u or o.athlete_id<>a or o.product_id<>pid then raise exception 'FORBIDDEN'; end if; return o; end if;
 if p.product_type='premium' then
 if exists(select 1 from subscriptions where athlete_id=a and status not in ('canceled','incomplete_expired')) then raise exception 'ALREADY_SUBSCRIBED'; end if;
 cap:=coalesce(p.capacity,(select (value->>'premium_capacity')::int from business_settings));
 -- A hold is released by Stripe's expiration webhook, never by a local clock. This prevents overselling when a paid webhook is delayed.
 select pcs.occupied into occupied from premium_capacity_status() pcs where pcs.product_id=pid;
 if occupied>=cap then raise exception 'PREMIUM_FULL'; end if; end if;
 insert into orders(customer_id,athlete_id,product_id,request_id,total_cents) values(u,a,pid,req,p.price_cents) returning * into o; return o;
end $$;

