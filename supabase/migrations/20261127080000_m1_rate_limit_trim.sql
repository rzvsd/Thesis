-- M1, audit S13: app.rate_limits gets one row per caller, route and window and was never cleaned.
-- Delete rows whose window started more than a day ago, every night at 03:25 UTC (after the audit trim).
-- The longest window in use is one hour (email_send), so a day keeps every live counter.
-- Runs inside Postgres with pg_cron, so it costs no Actions minutes.
create extension if not exists pg_cron;

-- cron.schedule with a job name replaces an existing job of that name, so this is safe to apply twice.
select cron.schedule(
  'm1-trim-rate-limits',
  '25 3 * * *',
  $$delete from app.rate_limits where window_start < now() - interval '1 day'$$
);
