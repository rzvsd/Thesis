drop index if exists idx_watchlists_ticker;
drop index if exists idx_watchlists_user_id;
drop index if exists idx_jobs_type_cycle_start;
drop index if exists idx_users_device_token;

drop table if exists watchlists;

alter table jobs
  drop column if exists cycle_end,
  drop column if exists cycle_start;

alter table users
  drop column if exists device_token;
