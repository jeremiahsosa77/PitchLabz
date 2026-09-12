import { writeFileSync } from "node:fs";
import { catalog, defaults } from "../packages/config/src/index";
const quote = (s: unknown) => `'${String(s).replaceAll("'", "''")}'`;
const products = catalog
  .map(
    (p) =>
      `insert into coaching_products(id,slug,name,description,product_type,price_cents,billing_interval,display_order,benefits,credits_per_cycle) values('${p.id}',${quote(p.slug)},${quote(p.name)},${quote(p.description)},'${p.product_type}',${p.price_cents},${p.billing_interval ? quote(p.billing_interval) : "null"},${p.display_order},${quote(JSON.stringify(p.benefits))}::jsonb,${p.product_type === "premium" ? 4 : 1});`,
  )
  .join("\n");
writeFileSync(
  "supabase/seed.sql",
  `-- DEVELOPMENT ONLY. Never apply this seed to production. Fictional families and training content.
insert into business_settings(value) values(${quote(JSON.stringify(defaults))}::jsonb);
${products}
-- Local-only credentials: PitchLabDemo!2026. Addresses are reserved .test domains.
insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,aud,role)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,email,crypt('PitchLabDemo!2026',gen_salt('bf')),now(),'{}','{}',now(),now(),'authenticated','authenticated'
from (values (1,'parent-a@example.test'),(2,'parent-b@example.test'),(3,'adult@example.test'),(4,'coach@example.test'),(5,'minor@example.test')) u(n,email);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email),'email',now(),now() from auth.users where email like '%@example.test';
insert into profiles(id,role,first_name,last_name,email,date_of_birth) values
('20000000-0000-4000-8000-000000000001','parent','Sarah','Johnson','parent-a@example.test','1985-02-10'),
('20000000-0000-4000-8000-000000000002','parent','Taylor','Reed','parent-b@example.test','1980-04-12'),
('20000000-0000-4000-8000-000000000003','athlete','Alex','Morgan','adult@example.test','2000-08-08'),
('20000000-0000-4000-8000-000000000004','admin','Jacob','Sosa','coach@example.test','1990-01-01'),
('20000000-0000-4000-8000-000000000005','athlete','Mason','Johnson','minor@example.test','2010-05-10');
insert into athletes(id,owner_parent_id,athlete_user_id,first_name,last_name,date_of_birth,competitive_level,throws,goals) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','Mason','Johnson','2010-05-10','high_school','R','Example: build a consistent delivery.'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',null,'Luke','Johnson','2014-03-22','youth','L','Example: develop confidence.'),
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',null,'Jordan','Reed','2011-06-20','high_school','R','Example: develop command.'),
('30000000-0000-4000-8000-000000000004',null,'20000000-0000-4000-8000-000000000003','Alex','Morgan','2000-08-08','adult','R','Example: refine mechanics.');
insert into subscriptions(id,customer_id,athlete_id,product_id,stripe_subscription_id,status,current_period_start,current_period_end) values
('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','sub_development_fixture','active',now()-interval '7 days',now()+interval '23 days');
insert into service_credits(id,customer_id,athlete_id,product_id,subscription_id,credit_batch,kind,quantity,remaining,expires_at) values
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000001','demo-premium','lesson',4,3,now()+interval '53 days');
insert into coach_availability(coach_id,day_of_week,start_time,end_time,delivery_mode) select '20000000-0000-4000-8000-000000000004',n,'08:00','20:00','either' from generate_series(0,6) n;
insert into lesson_bookings(customer_id,athlete_id,coach_id,credit_id,starts_at,ends_at,delivery_mode)
values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001',(current_date+3+time '16:00') at time zone 'America/Chicago',(current_date+3+time '17:00') at time zone 'America/Chicago','in_person');
insert into video_submissions(customer_id,athlete_id,submission_channel,customer_notes,status,received_at) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','email','Example request: review delivery from the stretch.','in_review',now()-interval '14 hours');
insert into throwing_plans(id,athlete_id,coach_id,title,description,start_date,end_date,status) values('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','Build a consistent foundation','Development fixture only. Not an individualized training prescription.',current_date,current_date+6,'published');
insert into throwing_plan_days(plan_id,date,title,instructions,intensity,display_order) select '60000000-0000-4000-8000-000000000001',current_date+n,'Example day '||(n+1),'Review your assigned work with your coach before training.','low',n from generate_series(0,6) n;
insert into progress_reports(athlete_id,coach_id,report_period,summary,wins,areas_to_improve,next_focus,coach_notes,published_at) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',current_date,'Example report: purposeful development.','Consistent preparation.','Continue command work.','Build a repeatable routine.','Development content only.',now());
insert into coach_notes(athlete_id,coach_id,content) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','Private development fixture. Must never reach customer accounts.');
`,
);
