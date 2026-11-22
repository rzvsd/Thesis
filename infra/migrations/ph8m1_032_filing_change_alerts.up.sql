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
      'filing_change'
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
      'filing_change'
    )
  );

-- Full "what changed" text. title + body stay the headline-only version.
alter table if exists alert_ledger
  add column if not exists detail_body text;

create table if not exists user_email_preferences (
  user_id text primary key references users (id) on delete cascade,
  email_opt_out boolean not null default false,
  updated_at timestamptz not null default now()
);
