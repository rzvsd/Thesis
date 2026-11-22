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
      'market_pulse_ready',
      'filing_change',
      'pulse_email'
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
      'market_pulse_ready',
      'filing_change',
      'pulse_email'
    )
  );

-- Public read-only links to a Deep Dive (web reader /r/{token}). The token is the only key.
create table if not exists report_shares (
  token text primary key,
  report_id text not null references reports (id) on delete cascade,
  created_by text not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_shares_creator_report
  on report_shares (created_by, report_id);
