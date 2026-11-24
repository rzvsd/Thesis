-- M2: one Deep Dive per company per filing (Razvan, 2026-11-24). When another customer's Deep Dive for the
-- same ticker is already open, a new request does not start a second run: its job follows the open one and
-- receives a copy of that report when it completes. Additive only.
alter table app.jobs add column if not exists follows_job_id text references app.jobs(id) on delete set null;
create index if not exists idx_jobs_follows_job_id on app.jobs (follows_job_id) where follows_job_id is not null;
-- Finds the open run for a ticker that a new request can follow.
create index if not exists idx_jobs_open_ticker on app.jobs (ticker, created_at)
  where type = 'deep_dive' and status in ('queued', 'running') and follows_job_id is null;

-- The stale sweep leaves a follower alone unless the job it follows failed: while that run is open the
-- follower waits on it, and once it completes the api attaches the report copy. Otherwise unchanged.
create or replace function app.sweep_stale_deep_dive_jobs()
returns integer
language sql
security invoker
set search_path = app, pg_temp
as $$
  with failed as (
    update app.jobs j
       set status = 'failed',
           started_at = coalesce(j.started_at, now()),
           completed_at = now(),
           error_message = case
             when j.status = 'running' then 'Deep Dive runner stopped before finishing. Please retry.'
             else 'Deep Dive could not start. Please retry.'
           end
     where j.type = 'deep_dive'
       and (
         (j.status = 'running' and coalesce(j.started_at, j.created_at) < now() - interval '11 minutes')
         or (j.status = 'queued' and j.created_at < now() - interval '15 minutes')
       )
       and not exists (
         select 1 from app.jobs leader
          where leader.id = j.follows_job_id and leader.status <> 'failed'
       )
    returning 1
  )
  select count(*)::integer from failed;
$$;
revoke all on function app.sweep_stale_deep_dive_jobs() from public, anon, authenticated;
