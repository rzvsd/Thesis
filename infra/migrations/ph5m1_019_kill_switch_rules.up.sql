create table if not exists kill_switch_rules (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  report_id text null references reports (id) on delete set null,
  signal_value text check (
    signal_value in ('positive', 'neutral', 'negative')
  ),
  anchor_price numeric check (anchor_price > 0),
  condition_id text not null,
  condition_text text not null,
  signal_type text not null check (
    signal_type in (
      'price_move_pct',
      'thesis_state',
      'earnings_event',
      'sec_filing',
      'guidance_revision',
      'management_change',
      'macro_regime',
      'analyst_rerating',
      'news_sentiment',
      'custom'
    )
  ),
  rationale text not null,
  threshold_value numeric,
  threshold_unit text check (
    threshold_unit in ('pct', 'count', 'score', 'days')
  ),
  direction text check (
    direction in ('against_signal', 'above', 'below', 'any')
  ),
  prompt_version text not null,
  state text not null check (
    state in ('active', 'inactive')
  ),
  source text not null check (
    source in ('dexter_prompt', 'fallback')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index if not exists idx_kill_switch_rules_user_ticker_state
  on kill_switch_rules (user_id, ticker, state);
create index if not exists idx_kill_switch_rules_active_created
  on kill_switch_rules (state, created_at desc);
create index if not exists idx_kill_switch_rules_signal_type
  on kill_switch_rules (signal_type);

create table if not exists kill_switch_evaluations (
  id text primary key,
  rule_id text not null references kill_switch_rules (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  signal_source text not null check (
    signal_source in ('daily', 'event')
  ),
  trigger_key text not null,
  outcome text not null check (
    outcome in ('matched', 'not_matched', 'skipped', 'error')
  ),
  reason_code text not null,
  reason_text text not null,
  observed_value numeric,
  alert_id text references alert_ledger (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, signal_source, trigger_key)
);

create index if not exists idx_kill_switch_eval_user_created
  on kill_switch_evaluations (user_id, created_at desc);
create index if not exists idx_kill_switch_eval_trigger
  on kill_switch_evaluations (signal_source, trigger_key, created_at desc);

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
