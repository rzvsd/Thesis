create table if not exists conviction_journal_entries (
  journal_entry_id text primary key,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  event_type text not null,
  source_type text not null,
  source_id text not null,
  event_at timestamptz not null,
  title text not null,
  summary text not null,
  thesis_snapshot jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  report_id text references reports(id) on delete set null,
  alert_ledger_id text references alert_ledger(id) on delete set null,
  war_room_id text references war_rooms(id) on delete set null,
  monitor_snapshot_key text,
  opposite_case_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint conviction_journal_event_type_check check (
    event_type in (
      'deep_dive_generated',
      'kill_switch_alert_fired',
      'freshness_decay_alert_fired',
      'earnings_war_room_closed',
      'cross_name_alert_fired',
      'alert_feedback_recorded',
      'opposite_case_generated'
    )
  ),
  constraint conviction_journal_source_type_check check (
    source_type in (
      'report',
      'alert_ledger',
      'war_room',
      'monitor_snapshot',
      'opposite_case'
    )
  ),
  constraint conviction_journal_entries_dedupe unique (
    user_id,
    event_type,
    source_type,
    source_id
  )
);

create index if not exists conviction_journal_entries_user_event_idx
  on conviction_journal_entries (user_id, event_at desc);

create index if not exists conviction_journal_entries_user_ticker_event_idx
  on conviction_journal_entries (user_id, ticker, event_at desc);

create table if not exists conviction_insight_cards (
  insight_id text primary key,
  user_id text not null references users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  insight_type text not null,
  status text not null,
  title text not null,
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  source_journal_entry_ids jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint conviction_insight_type_check check (
    insight_type in ('monthly_coherence')
  ),
  constraint conviction_insight_status_check check (
    status in ('generated', 'degraded', 'failed')
  ),
  constraint conviction_insight_cards_dedupe unique (
    user_id,
    period_start,
    period_end,
    insight_type
  )
);

create index if not exists conviction_insight_cards_user_generated_idx
  on conviction_insight_cards (user_id, generated_at desc);

create table if not exists opposite_case_reports (
  opposite_case_id text primary key,
  user_id text not null references users(id) on delete cascade,
  source_report_id text not null references reports(id) on delete cascade,
  ticker text not null,
  prompt_version text not null,
  thesis_summary text not null,
  opposite_case_summary text not null,
  key_points jsonb not null default '[]'::jsonb,
  shared_evidence_refs jsonb not null default '[]'::jsonb,
  decisive_factors jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null,
  constraint opposite_case_reports_dedupe unique (user_id, source_report_id)
);

create index if not exists opposite_case_reports_user_generated_idx
  on opposite_case_reports (user_id, generated_at desc);
