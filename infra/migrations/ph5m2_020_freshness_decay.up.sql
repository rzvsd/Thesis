alter table if exists thesis_monitor_snapshots
  add column if not exists last_deep_dive_at timestamptz;

alter table if exists thesis_monitor_snapshots
  add column if not exists material_events_count integer not null default 0;

alter table if exists thesis_monitor_snapshots
  add column if not exists unreviewed_events_count integer not null default 0;

alter table if exists thesis_monitor_snapshots
  add column if not exists freshness_state text not null default 'stale'
    check (freshness_state in ('current', 'aging', 'stale', 'triggered'));

alter table if exists thesis_monitor_snapshots
  add column if not exists freshness_score numeric not null default 0
    check (freshness_score >= 0 and freshness_score <= 1);

alter table if exists thesis_monitor_snapshots
  add column if not exists kill_switch_triggered_at timestamptz;

alter table if exists thesis_monitor_snapshots
  add column if not exists freshness_reason text not null default 'Freshness has not been computed yet.';

update thesis_monitor_snapshots
   set last_deep_dive_at = coalesce(last_deep_dive_at, report_generated_at),
       freshness_state = case
         when kill_switch_triggered_at is not null then 'triggered'
         when coalesce(last_deep_dive_at, report_generated_at) is null then freshness_state
         when coalesce(last_deep_dive_at, report_generated_at) >= now() - interval '14 days' then 'current'
         when coalesce(last_deep_dive_at, report_generated_at) >= now() - interval '45 days' then 'aging'
         else 'stale'
       end,
       freshness_score = case
         when kill_switch_triggered_at is not null then 0.15
         when coalesce(last_deep_dive_at, report_generated_at) is null then freshness_score
         when coalesce(last_deep_dive_at, report_generated_at) >= now() - interval '14 days' then 0.92
         when coalesce(last_deep_dive_at, report_generated_at) >= now() - interval '45 days' then 0.58
         else 0.24
       end,
       freshness_reason = case
         when length(trim(coalesce(reason, ''))) > 0 then reason
         when coalesce(last_deep_dive_at, report_generated_at) is null
           then 'No completed Deep Dive exists yet for this name.'
         when kill_switch_triggered_at is not null
           then 'Kill-switch conditions fired recently and require review.'
         when coalesce(last_deep_dive_at, report_generated_at) >= now() - interval '14 days'
           then 'Deep Dive baseline imported as current.'
         when coalesce(last_deep_dive_at, report_generated_at) >= now() - interval '45 days'
           then 'Deep Dive baseline imported as aging.'
         else 'Deep Dive baseline imported as stale.'
         else freshness_reason
       end
 where true;

create index if not exists idx_thesis_monitor_snapshots_freshness_state
  on thesis_monitor_snapshots (freshness_state);

create index if not exists idx_thesis_monitor_snapshots_unreviewed_events
  on thesis_monitor_snapshots (unreviewed_events_count desc);

alter table if exists notification_preferences
  drop constraint if exists notification_preferences_notification_type_check;
alter table if exists notification_preferences
  add constraint notification_preferences_notification_type_check check (
    notification_type in (
      'earnings_preview',
      'contrarian_alert',
      'kill_switch',
      'freshness_decay',
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
      'weekly_digest',
      'market_pulse_ready'
    )
  );
