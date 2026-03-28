drop index if exists idx_jobs_report_id_complete;
drop index if exists idx_reports_deep_dive_fingerprint;

alter table if exists reports
  drop column if exists freshness_expires_at,
  drop column if exists fingerprint;
