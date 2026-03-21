alter table users
  add column if not exists device_token text null;

alter table jobs
  add column if not exists cycle_start timestamptz null,
  add column if not exists cycle_end timestamptz null;

create table if not exists watchlists (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  added_at timestamptz not null,
  unique (user_id, ticker)
);

create index if not exists idx_users_device_token on users (device_token);
create index if not exists idx_jobs_type_cycle_start on jobs (type, cycle_start);
create index if not exists idx_watchlists_user_id on watchlists (user_id);
create index if not exists idx_watchlists_ticker on watchlists (ticker);
