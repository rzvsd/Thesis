create table if not exists user_feedback_queue (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  feedback_type text not null check (
    feedback_type in ('report', 'subscription')
  ),
  code text not null,
  severity text not null check (
    severity in ('normal', 'high', 'blocker')
  ),
  source_surface text not null,
  user_tier text not null check (
    user_tier in ('FREE', 'PRO')
  ),
  report_id text references reports (id) on delete set null,
  ticker text,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  triage_status text not null default 'new' check (
    triage_status in ('new', 'reviewed', 'routed', 'resolved', 'dismissed')
  ),
  route_status text not null default 'pending' check (
    route_status in ('pending', 'routed', 'not_applicable')
  ),
  triage_owner text,
  triaged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_feedback_queue_type_created
  on user_feedback_queue (feedback_type, created_at desc);
create index if not exists idx_user_feedback_queue_triage
  on user_feedback_queue (triage_status, route_status, created_at desc);
create index if not exists idx_user_feedback_queue_user_tier
  on user_feedback_queue (user_tier, created_at desc);
create index if not exists idx_user_feedback_queue_source
  on user_feedback_queue (source_surface, created_at desc);
create index if not exists idx_user_feedback_queue_report
  on user_feedback_queue (report_id, ticker);
