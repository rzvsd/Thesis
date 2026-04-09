drop index if exists idx_thesis_monitor_snapshots_unreviewed_events;
drop index if exists idx_thesis_monitor_snapshots_freshness_state;

alter table if exists thesis_monitor_snapshots
  drop column if exists freshness_reason;

alter table if exists thesis_monitor_snapshots
  drop column if exists kill_switch_triggered_at;

alter table if exists thesis_monitor_snapshots
  drop column if exists freshness_score;

alter table if exists thesis_monitor_snapshots
  drop column if exists freshness_state;

alter table if exists thesis_monitor_snapshots
  drop column if exists unreviewed_events_count;

alter table if exists thesis_monitor_snapshots
  drop column if exists material_events_count;

alter table if exists thesis_monitor_snapshots
  drop column if exists last_deep_dive_at;

alter table if exists notification_preferences
  drop constraint if exists notification_preferences_notification_type_check;
alter table if exists notification_preferences
  add constraint notification_preferences_notification_type_check check (
    notification_type in (
      'earnings_preview',
      'contrarian_alert',
      'kill_switch',
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
      'weekly_digest',
      'market_pulse_ready'
    )
  );
