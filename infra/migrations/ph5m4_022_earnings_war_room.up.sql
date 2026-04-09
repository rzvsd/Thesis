alter table if exists notification_preferences
  drop constraint if exists notification_preferences_notification_type_check;
alter table if exists notification_preferences
  add constraint notification_preferences_notification_type_check check (
    notification_type in (
      'earnings_preview',
      'earnings_war_room',
      'contrarian_alert',
      'kill_switch',
      'freshness_decay',
      'morning_exception_briefing',
      'weekly_digest',
      'market_pulse_ready'
    )
  );

alter table if exists alert_ledger
  drop constraint if exists alert_ledger_notification_type_check;
alter table if exists alert_ledger
  add constraint alert_ledger_notification_type_check check (
    notification_type in (
      'earnings_preview',
      'earnings_war_room',
      'contrarian_alert',
      'kill_switch',
      'freshness_decay',
      'morning_exception_briefing',
      'weekly_digest',
      'market_pulse_ready'
    )
  );

create table if not exists war_rooms (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  earnings_event_id text not null,
  event_date date not null,
  state text not null check (
    state in ('preparing', 'ready', 'live', 'post', 'closed', 'degraded', 'failed')
  ),
  current_cadence_min integer not null check (
    current_cadence_min in (15, 30)
  ),
  cadence_state jsonb not null default '{}'::jsonb,
  prepared_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker, earnings_event_id)
);

create index if not exists idx_war_rooms_user_created
  on war_rooms (user_id, created_at desc);
create index if not exists idx_war_rooms_user_ticker
  on war_rooms (user_id, ticker, prepared_at desc);
create index if not exists idx_war_rooms_event
  on war_rooms (earnings_event_id, prepared_at desc);

create table if not exists war_room_timeline_events (
  id text primary key,
  war_room_id text not null references war_rooms (id) on delete cascade,
  phase text not null check (
    phase in ('pre', 'live', 'post')
  ),
  event_type text not null check (
    event_type in (
      'prepared',
      'playbook_updated',
      'live_cycle_completed',
      'cadence_changed',
      'alert_emitted',
      'deep_dive_queued',
      'post_event_closed',
      'failed'
    )
  ),
  reason_text text not null,
  source_refs jsonb not null default '[]'::jsonb,
  alert_ledger_id text references alert_ledger (id) on delete set null,
  report_id text references reports (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_war_room_timeline_events_room_created
  on war_room_timeline_events (war_room_id, created_at desc);
create index if not exists idx_war_room_timeline_events_alert
  on war_room_timeline_events (alert_ledger_id)
  where alert_ledger_id is not null;
