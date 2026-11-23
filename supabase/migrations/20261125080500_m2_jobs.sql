-- M2 Deep Dive pipeline: job dispatch columns, global dispatch cap, stale-job sweep.
-- Additive only (AGENTS rule 8). Touches only tables M2 owns: jobs, plus the new deep_dive_dispatch_daily.

-- Dispatch bookkeeping on the existing jobs table.
--   attempts       how many times a runner was started for this job
--   dispatched_at  when the last runner was started
--   run_url        the Actions run that claimed the job (set at claim)
--   checked_at     last time the poll-time sweeper asked the runner host about this job
alter table app.jobs add column if not exists attempts integer not null default 0;
alter table app.jobs add column if not exists dispatched_at timestamp with time zone;
alter table app.jobs add column if not exists run_url text;
alter table app.jobs add column if not exists checked_at timestamp with time zone;

-- POST /jobs looks for the user's open job for the same ticker (H1), and the sweep looks for old open jobs.
create index if not exists idx_jobs_open_user_ticker
  on app.jobs (user_id, ticker, created_at desc)
  where status in ('queued', 'running');

-- Global daily cap on runner dispatches (C2). One row per UTC day.
create table if not exists app.deep_dive_dispatch_daily (
  usage_date date primary key,
  dispatch_count integer not null default 0 check (dispatch_count >= 0),
  updated_at timestamp with time zone not null default now()
);
alter table app.deep_dive_dispatch_daily enable row level security;
revoke all on app.deep_dive_dispatch_daily from public, anon, authenticated;

-- Sweep for jobs nobody polls (C1). The app's GET /jobs/:id does the same check sooner.
-- Running longer than 11 minutes: the runner's 10-minute timeout has passed, so it is gone.
-- Queued longer than 15 minutes: every re-dispatch has had its chance.
create or replace function app.sweep_stale_deep_dive_jobs()
returns integer
language sql
security invoker
set search_path = app, pg_temp
as $$
  with failed as (
    update app.jobs
       set status = 'failed',
           started_at = coalesce(started_at, now()),
           completed_at = now(),
           error_message = case
             when status = 'running' then 'Deep Dive runner stopped before finishing. Please retry.'
             else 'Deep Dive could not start. Please retry.'
           end
     where type = 'deep_dive'
       and (
         (status = 'running' and coalesce(started_at, created_at) < now() - interval '11 minutes')
         or (status = 'queued' and created_at < now() - interval '15 minutes')
       )
    returning 1
  )
  select count(*)::integer from failed;
$$;
revoke all on function app.sweep_stale_deep_dive_jobs() from public, anon, authenticated;

-- pg_cron runs the sweep every 10 minutes. No GitHub Actions cron (D7).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'm2-sweep-stale-deep-dive-jobs') then
      perform cron.unschedule('m2-sweep-stale-deep-dive-jobs');
    end if;
    perform cron.schedule(
      'm2-sweep-stale-deep-dive-jobs',
      '*/10 * * * *',
      'select app.sweep_stale_deep_dive_jobs()'
    );
  else
    raise notice 'pg_cron not available; stale-job sweep not scheduled';
  end if;
end $$;
