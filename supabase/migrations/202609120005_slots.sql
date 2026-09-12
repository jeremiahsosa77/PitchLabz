create function public.available_slots(day date,mode text) returns table(coach_id uuid,starts_at timestamptz,ends_at timestamptz,delivery_mode text) language sql stable set search_path=public as $$
 select p.id,t,t+interval '1 hour',mode from profiles p cross join business_settings s cross join lateral generate_series(day::timestamp at time zone (s.value->>'business_timezone'),(day+1)::timestamp at time zone (s.value->>'business_timezone')-interval '1 hour',interval '30 minutes') t
 where p.role in ('coach','admin') and slot_available(p.id,t,mode)
 $$;
revoke all on function available_slots(date,text) from public,anon,authenticated;
grant execute on function available_slots(date,text) to service_role;
