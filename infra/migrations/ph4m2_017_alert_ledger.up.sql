create table if not exists alert_ledger (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  notification_type text not null check (
    notification_type in ('earnings_preview', 'contrarian_alert', 'weekly_digest', 'market_pulse_ready')
  ),
  category text not null check (
    category in ('thesis_drift', 'earnings', 'macro', 'system')
  ),
  route text not null check (
    route in ('today', 'names', 'research', 'inbox', 'you')
  ),
  title text not null,
  body text not null,
  reason_code text not null,
  reason_text text not null,
  delivery_state text not null check (
    delivery_state in ('sent', 'partial_failure')
  ),
  feedback_state text check (
    feedback_state in ('useful', 'not_useful')
  ),
  muted_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_alert_ledger_user_created
  on alert_ledger (user_id, created_at desc);
create index if not exists idx_alert_ledger_user_category_created
  on alert_ledger (user_id, category, created_at desc);
create index if not exists idx_alert_ledger_notification_type_created
  on alert_ledger (notification_type, created_at desc);
