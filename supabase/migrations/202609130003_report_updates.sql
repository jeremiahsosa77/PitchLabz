-- Complete draft editing/publication while preserving report identity and notification dedupe.
create or replace function public.save_coaching(u uuid,kind text,p jsonb,rid uuid default null) returns uuid language plpgsql set search_path=public as $$
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
 if rid is null then
 insert into progress_reports(athlete_id,coach_id,report_period,summary,wins,areas_to_improve,next_focus,coach_notes,published_at)
 values(a,u,(p->>'report_period')::date,p->>'summary',p->>'wins',p->>'areas_to_improve',p->>'next_focus',p->>'coach_notes',case when (p->>'publish')::boolean then now() end) returning id into result_id;
 else
 update progress_reports set report_period=(p->>'report_period')::date,summary=p->>'summary',wins=p->>'wins',areas_to_improve=p->>'areas_to_improve',next_focus=p->>'next_focus',coach_notes=p->>'coach_notes',
 published_at=case when (p->>'publish')::boolean then coalesce(published_at,now()) end
 where id=rid and athlete_id=a returning id into result_id;
 if result_id is null then raise exception 'NOT_FOUND'; end if;
 end if;
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

