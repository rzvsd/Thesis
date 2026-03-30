create table if not exists notification_preferences (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'earnings_preview',
      'contrarian_alert',
      'weekly_digest',
      'market_pulse_ready'
    )
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notification_type)
);

create index if not exists idx_notification_preferences_user_id on notification_preferences (user_id);
create index if not exists idx_notification_preferences_type_enabled on notification_preferences (notification_type, enabled);
