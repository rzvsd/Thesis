alter table if exists notification_preferences
  drop constraint if exists notification_preferences_notification_type_check;
alter table if exists notification_preferences
  add constraint notification_preferences_notification_type_check check (
    notification_type in (
      'earnings_preview',
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
      'contrarian_alert',
      'kill_switch',
      'freshness_decay',
      'morning_exception_briefing',
      'weekly_digest',
      'market_pulse_ready'
    )
  );
