create extension if not exists btree_gist;
alter table lesson_bookings add constraint no_overlapping_lessons exclude using gist (coach_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status='confirmed');
create index subscriptions_athlete on subscriptions(athlete_id);
create index orders_customer on orders(customer_id);
create index bookings_athlete on lesson_bookings(athlete_id);
create index plans_athlete on throwing_plans(athlete_id);
create index reports_athlete on progress_reports(athlete_id);
create index video_athlete on video_submissions(athlete_id);
