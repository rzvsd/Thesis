create table if not exists thesis_monitor_snapshots (
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  state text not null check (
    state in ('intact', 'improved', 'weakened', 'unresolved')
  ),
  reason text not null,
  score numeric not null check (score >= 0 and score <= 1),
  report_id text references reports (id) on delete set null,
  report_generated_at timestamptz,
  report_schema_version text,
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

create index if not exists idx_thesis_monitor_snapshots_user on thesis_monitor_snapshots (user_id);
create index if not exists idx_thesis_monitor_snapshots_state on thesis_monitor_snapshots (state);
create index if not exists idx_thesis_monitor_snapshots_updated_at on thesis_monitor_snapshots (updated_at desc);
