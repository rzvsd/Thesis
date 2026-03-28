alter table if exists reports
  add column if not exists fingerprint text null,
  add column if not exists freshness_expires_at timestamptz null;

create index if not exists idx_reports_deep_dive_fingerprint
  on reports (type, ticker, fingerprint, freshness_expires_at, created_at desc);

create index if not exists idx_jobs_report_id_complete
  on jobs (report_id, user_id, status);
