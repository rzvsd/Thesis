create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  verified_at timestamptz null,
  created_at timestamptz not null
);

create table if not exists verification_tokens (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null
);

create table if not exists jobs (
  id text primary key,
  type text not null check (type in ('deep_dive', 'market_pulse')),
  status text not null check (status in ('queued', 'running', 'complete', 'failed')),
  user_id text null references users (id) on delete set null,
  ticker text null,
  report_id text null,
  created_at timestamptz not null,
  started_at timestamptz null,
  completed_at timestamptz null,
  error_message text null
);

create table if not exists reports (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  type text not null check (type in ('deep_dive', 'market_pulse')),
  ticker text null,
  schema_version text not null,
  artifact_key text not null,
  created_at timestamptz not null,
  is_current boolean not null default true
);

create table if not exists audit_events (
  id text primary key,
  user_id text null references users (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create index if not exists idx_verification_tokens_hash on verification_tokens (token_hash);
create index if not exists idx_sessions_user_id on sessions (user_id);
create index if not exists idx_jobs_user_id on jobs (user_id);
create index if not exists idx_jobs_status on jobs (status);
create index if not exists idx_reports_job_id on reports (job_id);
create index if not exists idx_audit_events_created_at on audit_events (created_at);
