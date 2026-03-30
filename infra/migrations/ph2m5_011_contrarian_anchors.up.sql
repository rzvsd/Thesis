create table if not exists contrarian_alert_anchors (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  report_id text null references reports (id) on delete set null,
  signal_value text not null check (signal_value in ('positive', 'neutral', 'negative')),
  anchor_price numeric not null check (anchor_price > 0),
  anchored_at timestamptz not null,
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contrarian_alert_anchors_user_id on contrarian_alert_anchors (user_id);
create index if not exists idx_contrarian_alert_anchors_ticker on contrarian_alert_anchors (ticker);
create index if not exists idx_contrarian_alert_anchors_active_expires on contrarian_alert_anchors (is_active, expires_at);
