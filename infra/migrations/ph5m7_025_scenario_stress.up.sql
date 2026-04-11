create table if not exists scenario_stress_templates (
  scenario_id text primary key,
  title text not null,
  summary text not null,
  hypothesis text not null,
  display_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scenario_stress_templates_id_check check (
    scenario_id in (
      'rates_higher_for_longer',
      'recession_in_6m',
      'usd_up_10',
      'ai_hype_burst',
      'oil_120_spike'
    )
  )
);

insert into scenario_stress_templates (
  scenario_id,
  title,
  summary,
  hypothesis,
  display_order,
  is_active
)
values
  (
    'rates_higher_for_longer',
    'Rates Stay Higher for Longer',
    'Stress-tests valuation durability if discount rates remain elevated.',
    'Higher discount rates can compress valuation multiples for duration-sensitive theses.',
    1,
    true
  ),
  (
    'recession_in_6m',
    'Recession in 6 Months',
    'Evaluates revenue and margin fragility under demand contraction.',
    'A broad slowdown can challenge cyclical demand assumptions across followed names.',
    2,
    true
  ),
  (
    'usd_up_10',
    'USD Strengthens 10%',
    'Assesses translation and competitiveness pressure from a stronger dollar.',
    'Foreign revenue translation pressure can weaken globally exposed thesis assumptions.',
    3,
    true
  ),
  (
    'ai_hype_burst',
    'AI Hype Cycle Bursts',
    'Examines downside if AI spending and sentiment reset sharply.',
    'AI-linked narratives can break quickly when adoption or monetization disappoints.',
    4,
    true
  ),
  (
    'oil_120_spike',
    'Oil Spikes to $120',
    'Measures cost and demand pressure from a rapid energy shock.',
    'Energy-sensitive cost structures can invalidate margin and demand assumptions.',
    5,
    true
  )
on conflict (scenario_id) do update set
  title = excluded.title,
  summary = excluded.summary,
  hypothesis = excluded.hypothesis,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists scenario_stress_runs (
  scenario_run_id text primary key,
  user_id text not null references users(id) on delete cascade,
  scenario_id text not null references scenario_stress_templates(scenario_id),
  status text not null,
  run_mode text not null,
  as_of date not null,
  total_names integer not null check (total_names >= 0),
  impacted_names integer not null check (impacted_names >= 0),
  critical_names integer not null check (critical_names >= 0),
  summary text not null,
  created_at timestamptz not null,
  completed_at timestamptz not null,
  constraint scenario_stress_runs_status_check check (
    status in ('completed', 'degraded', 'failed')
  ),
  constraint scenario_stress_runs_mode_check check (
    run_mode in ('manual')
  )
);

create index if not exists scenario_stress_runs_user_created_idx
  on scenario_stress_runs (user_id, created_at desc);

create table if not exists scenario_stress_impacts (
  scenario_impact_id text primary key,
  scenario_run_id text not null references scenario_stress_runs(scenario_run_id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  impact_level text not null,
  thesis_break_likelihood text not null,
  stress_score numeric not null check (stress_score >= 0 and stress_score <= 1),
  rationale text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  constraint scenario_stress_impacts_level_check check (
    impact_level in ('none', 'watch', 'elevated', 'high', 'critical')
  ),
  constraint scenario_stress_impacts_likelihood_check check (
    thesis_break_likelihood in ('low', 'moderate', 'high', 'very_high')
  )
);

create index if not exists scenario_stress_impacts_run_idx
  on scenario_stress_impacts (scenario_run_id, stress_score desc, ticker asc);

create table if not exists scenario_stress_rule_suggestions (
  scenario_rule_suggestion_id text primary key,
  scenario_run_id text not null references scenario_stress_runs(scenario_run_id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  signal_type text not null,
  direction text not null,
  condition_text text not null,
  rationale text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null,
  constraint scenario_stress_rule_suggestions_signal_type_check check (
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
  constraint scenario_stress_rule_suggestions_direction_check check (
    direction in ('against_signal', 'above', 'below', 'any')
  )
);

create index if not exists scenario_stress_rule_suggestions_run_idx
  on scenario_stress_rule_suggestions (scenario_run_id, confidence desc, ticker asc);
