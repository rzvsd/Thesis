-- M3: keep the database small (audit N1). Delete audit rows older than 90 days, every night at 03:15 UTC.
-- Runs inside Postgres with pg_cron, so it costs no Actions minutes. The coordinator gave M3 this job.
create extension if not exists pg_cron;

-- cron.schedule with a job name replaces an existing job of that name, so this is safe to apply twice.
select cron.schedule(
  'm3-trim-audit-events',
  '15 3 * * *',
  $$delete from app.audit_events where created_at < now() - interval '90 days'$$
);
