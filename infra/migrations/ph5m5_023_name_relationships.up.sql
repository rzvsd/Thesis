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
      'cross_name_propagation',
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
      'cross_name_propagation',
      'weekly_digest',
      'market_pulse_ready'
    )
  );

create table if not exists name_relationships (
  relationship_id text primary key,
  user_id text not null references users (id) on delete cascade,
  source_ticker text not null,
  target_ticker text not null,
  relationship_type text not null check (
    relationship_type in ('supplier', 'competitor', 'partner', 'sector')
  ),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  state text not null check (state in ('active', 'suppressed', 'inactive')),
  source_report_id text not null references reports (id) on delete cascade,
  prompt_version text not null,
  evidence_text text not null,
  rationale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suppressed_at timestamptz
);

create index if not exists idx_name_relationships_user_updated
  on name_relationships (user_id, updated_at desc);
create index if not exists idx_name_relationships_source_active
  on name_relationships (source_ticker, confidence desc, updated_at asc)
  where state = 'active';
create index if not exists idx_name_relationships_user_target
  on name_relationships (user_id, target_ticker, updated_at desc);
create index if not exists idx_name_relationships_report
  on name_relationships (source_report_id);
