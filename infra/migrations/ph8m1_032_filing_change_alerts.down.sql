drop table if exists user_email_preferences;

alter table if exists alert_ledger
  drop column if exists detail_body;

delete from alert_ledger where notification_type = 'filing_change';
delete from notification_preferences where notification_type = 'filing_change';

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
