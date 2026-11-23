-- M0 baseline for the Thesis serverless rebuild (Supabase, Postgres 17).
--
-- What this file does:
-- * It creates the whole product schema in a private schema called "app", not "public".
--   The tables, columns, constraints and indexes match infra/migrations 001-034 as applied
--   in the order of apps/product-api/src/migrations.ts. The app code uses unqualified
--   table names, so the server role finds them through its search_path.
-- * Auth follows ADR 3 (Supabase Auth). users.id stays text and will hold the Supabase
--   auth uid as text. users.password_hash is now nullable. users.auth_user_id links the
--   row to auth.users and is deleted with it. The other auth tables are unchanged; M1 maps them.
-- * Row level security is on for every table in "app", with no policies. Nobody but the
--   owner and roles with BYPASSRLS can read or write rows.
-- * The public API roles (anon, authenticated) and PUBLIC get no access to "app" at all.
-- * thesis_api is the server-side role the API connects as. It has BYPASSRLS. Its password
--   is set outside the repo and lives only in Supabase secrets; the public keys never get it.
-- * thesis_jobs is the role for background jobs. It gets schema usage only; M3 grants tables.
-- * app.rate_limits is a small table kept for later rate limiting.
-- * The scenario_stress_templates seed rows from migration 025 are included.
--
-- The file is plain SQL and safe to run twice.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;


-- 1. Tables (columns identical to infra/migrations 001-034, except users).

create table if not exists app.account_action_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    purpose text NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    CONSTRAINT account_action_tokens_purpose_check CHECK ((purpose = ANY (ARRAY['password_reset'::text, 'account_deletion'::text])))
);
create table if not exists app.alert_ledger (
    id text NOT NULL,
    user_id text NOT NULL,
    notification_type text NOT NULL,
    category text NOT NULL,
    route text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    reason_code text NOT NULL,
    reason_text text NOT NULL,
    delivery_state text NOT NULL,
    feedback_state text,
    muted_at timestamp with time zone,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    detail_body text,
    CONSTRAINT alert_ledger_category_check CHECK ((category = ANY (ARRAY['thesis_drift'::text, 'earnings'::text, 'macro'::text, 'system'::text]))),
    CONSTRAINT alert_ledger_delivery_state_check CHECK ((delivery_state = ANY (ARRAY['sent'::text, 'partial_failure'::text]))),
    CONSTRAINT alert_ledger_feedback_state_check CHECK ((feedback_state = ANY (ARRAY['useful'::text, 'not_useful'::text]))),
    CONSTRAINT alert_ledger_notification_type_check CHECK ((notification_type = ANY (ARRAY['earnings_preview'::text, 'earnings_war_room'::text, 'contrarian_alert'::text, 'kill_switch'::text, 'freshness_decay'::text, 'morning_exception_briefing'::text, 'cross_name_propagation'::text, 'weekly_digest'::text, 'market_pulse_ready'::text, 'filing_change'::text, 'pulse_email'::text]))),
    CONSTRAINT alert_ledger_route_check CHECK ((route = ANY (ARRAY['today'::text, 'names'::text, 'research'::text, 'inbox'::text, 'you'::text])))
);
create table if not exists app.audit_events (
    id text NOT NULL,
    user_id text,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL
);
create table if not exists app.calendar_events (
    id text NOT NULL,
    ticker text NOT NULL,
    event_type text NOT NULL,
    event_date date NOT NULL,
    event_time text,
    provider text NOT NULL,
    retrieved_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    timing_state text DEFAULT 'estimated'::text NOT NULL,
    source_state text DEFAULT 'derived'::text NOT NULL,
    source_ref jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason_text text DEFAULT ''::text NOT NULL,
    CONSTRAINT calendar_events_event_time_check CHECK ((event_time = ANY (ARRAY['before_market'::text, 'after_market'::text, 'during_market'::text]))),
    CONSTRAINT calendar_events_event_type_check CHECK ((event_type = ANY (ARRAY['earnings'::text, 'dividend'::text, 'split'::text]))),
    CONSTRAINT calendar_events_source_state_check CHECK ((source_state = ANY (ARRAY['official'::text, 'first_party'::text, 'derived'::text, 'mixed'::text, 'conflicting'::text]))),
    CONSTRAINT calendar_events_timing_state_check CHECK ((timing_state = ANY (ARRAY['estimated'::text, 'confirmed'::text, 'actual'::text])))
);
create table if not exists app.call_artifacts (
    artifact_id text NOT NULL,
    ticker text NOT NULL,
    event_id text,
    context_id text,
    source_url text NOT NULL,
    source_domain text NOT NULL,
    artifact_type text NOT NULL,
    completeness_state text NOT NULL,
    rights jsonb NOT NULL,
    payload jsonb NOT NULL,
    retrieved_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.canonical_events (
    id text NOT NULL,
    family text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    title text NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    source_state text NOT NULL,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    missing_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    retrieved_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.contrarian_alert_anchors (
    id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    report_id text,
    signal_value text NOT NULL,
    anchor_price numeric NOT NULL,
    anchored_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contrarian_alert_anchors_anchor_price_check CHECK ((anchor_price > (0)::numeric)),
    CONSTRAINT contrarian_alert_anchors_signal_value_check CHECK ((signal_value = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])))
);
create table if not exists app.conviction_insight_cards (
    insight_id text NOT NULL,
    user_id text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    insight_type text NOT NULL,
    status text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_journal_entry_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT conviction_insight_status_check CHECK ((status = ANY (ARRAY['generated'::text, 'degraded'::text, 'failed'::text]))),
    CONSTRAINT conviction_insight_type_check CHECK ((insight_type = 'monthly_coherence'::text))
);
create table if not exists app.conviction_journal_entries (
    journal_entry_id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    event_type text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    event_at timestamp with time zone NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    thesis_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    report_id text,
    alert_ledger_id text,
    war_room_id text,
    monitor_snapshot_key text,
    opposite_case_id text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT conviction_journal_event_type_check CHECK ((event_type = ANY (ARRAY['deep_dive_generated'::text, 'kill_switch_alert_fired'::text, 'freshness_decay_alert_fired'::text, 'earnings_war_room_closed'::text, 'cross_name_alert_fired'::text, 'alert_feedback_recorded'::text, 'opposite_case_generated'::text]))),
    CONSTRAINT conviction_journal_source_type_check CHECK ((source_type = ANY (ARRAY['report'::text, 'alert_ledger'::text, 'war_room'::text, 'monitor_snapshot'::text, 'opposite_case'::text])))
);
create table if not exists app.deep_dive_daily_usage (
    user_id text NOT NULL,
    usage_date date NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deep_dive_daily_usage_request_count_check CHECK ((request_count >= 0))
);
create table if not exists app.fear_greed_daily (
    id text NOT NULL,
    market_date date NOT NULL,
    score numeric(5,2) NOT NULL,
    label text NOT NULL,
    sub_scores jsonb NOT NULL,
    missing_inputs jsonb DEFAULT '[]'::jsonb NOT NULL,
    calculated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.financial_snapshots (
    snapshot_id text NOT NULL,
    ticker text NOT NULL,
    period text NOT NULL,
    period_type text NOT NULL,
    fiscal_year integer NOT NULL,
    fiscal_quarter integer,
    provider text NOT NULL,
    filing_date text,
    retrieved_at timestamp with time zone NOT NULL,
    data jsonb NOT NULL,
    segments jsonb,
    analyst_estimates jsonb,
    guidance jsonb,
    missing_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_snapshots_check CHECK ((((period_type = 'annual'::text) AND (fiscal_quarter IS NULL)) OR ((period_type = 'quarterly'::text) AND ((fiscal_quarter >= 1) AND (fiscal_quarter <= 4))))),
    CONSTRAINT financial_snapshots_missing_fields_check CHECK ((jsonb_typeof(missing_fields) = 'array'::text)),
    CONSTRAINT financial_snapshots_period_type_check CHECK ((period_type = ANY (ARRAY['quarterly'::text, 'annual'::text])))
);
create table if not exists app.first_party_context_items (
    context_id text NOT NULL,
    ticker text NOT NULL,
    event_id text,
    source_url text NOT NULL,
    source_domain text NOT NULL,
    page_type text NOT NULL,
    fetch_state text NOT NULL,
    rights jsonb NOT NULL,
    payload jsonb NOT NULL,
    retrieved_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.jobs (
    id text NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    user_id text,
    ticker text,
    report_id text,
    created_at timestamp with time zone NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    cycle_start timestamp with time zone,
    cycle_end timestamp with time zone,
    CONSTRAINT jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'complete'::text, 'failed'::text]))),
    CONSTRAINT jobs_type_check CHECK ((type = ANY (ARRAY['deep_dive'::text, 'market_pulse'::text])))
);
create table if not exists app.kill_switch_evaluations (
    id text NOT NULL,
    rule_id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    signal_source text NOT NULL,
    trigger_key text NOT NULL,
    outcome text NOT NULL,
    reason_code text NOT NULL,
    reason_text text NOT NULL,
    observed_value numeric,
    alert_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kill_switch_evaluations_outcome_check CHECK ((outcome = ANY (ARRAY['matched'::text, 'not_matched'::text, 'skipped'::text, 'error'::text]))),
    CONSTRAINT kill_switch_evaluations_signal_source_check CHECK ((signal_source = ANY (ARRAY['daily'::text, 'event'::text])))
);
create table if not exists app.kill_switch_rules (
    id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    report_id text,
    signal_value text,
    anchor_price numeric,
    condition_id text NOT NULL,
    condition_text text NOT NULL,
    signal_type text NOT NULL,
    rationale text NOT NULL,
    threshold_value numeric,
    threshold_unit text,
    direction text,
    prompt_version text NOT NULL,
    state text NOT NULL,
    source text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    CONSTRAINT kill_switch_rules_anchor_price_check CHECK ((anchor_price > (0)::numeric)),
    CONSTRAINT kill_switch_rules_direction_check CHECK ((direction = ANY (ARRAY['against_signal'::text, 'above'::text, 'below'::text, 'any'::text]))),
    CONSTRAINT kill_switch_rules_signal_type_check CHECK ((signal_type = ANY (ARRAY['price_move_pct'::text, 'thesis_state'::text, 'earnings_event'::text, 'sec_filing'::text, 'guidance_revision'::text, 'management_change'::text, 'macro_regime'::text, 'analyst_rerating'::text, 'news_sentiment'::text, 'custom'::text]))),
    CONSTRAINT kill_switch_rules_signal_value_check CHECK ((signal_value = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text]))),
    CONSTRAINT kill_switch_rules_source_check CHECK ((source = ANY (ARRAY['dexter_prompt'::text, 'fallback'::text]))),
    CONSTRAINT kill_switch_rules_state_check CHECK ((state = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT kill_switch_rules_threshold_unit_check CHECK ((threshold_unit = ANY (ARRAY['pct'::text, 'count'::text, 'score'::text, 'days'::text])))
);
create table if not exists app.name_relationships (
    relationship_id text NOT NULL,
    user_id text NOT NULL,
    source_ticker text NOT NULL,
    target_ticker text NOT NULL,
    relationship_type text NOT NULL,
    confidence numeric NOT NULL,
    state text NOT NULL,
    source_report_id text NOT NULL,
    prompt_version text NOT NULL,
    evidence_text text NOT NULL,
    rationale text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    suppressed_at timestamp with time zone,
    CONSTRAINT name_relationships_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT name_relationships_relationship_type_check CHECK ((relationship_type = ANY (ARRAY['supplier'::text, 'competitor'::text, 'partner'::text, 'sector'::text]))),
    CONSTRAINT name_relationships_state_check CHECK ((state = ANY (ARRAY['active'::text, 'suppressed'::text, 'inactive'::text])))
);
create table if not exists app.notification_preferences (
    id text NOT NULL,
    user_id text NOT NULL,
    notification_type text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quiet_until timestamp with time zone,
    CONSTRAINT notification_preferences_notification_type_check CHECK ((notification_type = ANY (ARRAY['earnings_preview'::text, 'earnings_war_room'::text, 'contrarian_alert'::text, 'kill_switch'::text, 'freshness_decay'::text, 'morning_exception_briefing'::text, 'cross_name_propagation'::text, 'weekly_digest'::text, 'market_pulse_ready'::text, 'filing_change'::text, 'pulse_email'::text])))
);
create table if not exists app.opposite_case_reports (
    opposite_case_id text NOT NULL,
    user_id text NOT NULL,
    source_report_id text NOT NULL,
    ticker text NOT NULL,
    prompt_version text NOT NULL,
    thesis_summary text NOT NULL,
    opposite_case_summary text NOT NULL,
    key_points jsonb DEFAULT '[]'::jsonb NOT NULL,
    shared_evidence_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    decisive_factors jsonb DEFAULT '[]'::jsonb NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);
create table if not exists app.report_notes (
    report_id text NOT NULL,
    user_id text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.report_shares (
    token text NOT NULL,
    report_id text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.reports (
    id text NOT NULL,
    job_id text NOT NULL,
    type text NOT NULL,
    ticker text,
    schema_version text NOT NULL,
    artifact_key text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    fingerprint text,
    freshness_expires_at timestamp with time zone,
    llm_usage jsonb,
    CONSTRAINT reports_type_check CHECK ((type = ANY (ARRAY['deep_dive'::text, 'market_pulse'::text])))
);
create table if not exists app.scenario_stress_impacts (
    scenario_impact_id text NOT NULL,
    scenario_run_id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    impact_level text NOT NULL,
    thesis_break_likelihood text NOT NULL,
    stress_score numeric NOT NULL,
    rationale text NOT NULL,
    evidence_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT scenario_stress_impacts_level_check CHECK ((impact_level = ANY (ARRAY['none'::text, 'watch'::text, 'elevated'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT scenario_stress_impacts_likelihood_check CHECK ((thesis_break_likelihood = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'very_high'::text]))),
    CONSTRAINT scenario_stress_impacts_stress_score_check CHECK (((stress_score >= (0)::numeric) AND (stress_score <= (1)::numeric)))
);
create table if not exists app.scenario_stress_rule_suggestions (
    scenario_rule_suggestion_id text NOT NULL,
    scenario_run_id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    signal_type text NOT NULL,
    direction text NOT NULL,
    condition_text text NOT NULL,
    rationale text NOT NULL,
    confidence numeric NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT scenario_stress_rule_suggestions_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT scenario_stress_rule_suggestions_direction_check CHECK ((direction = ANY (ARRAY['against_signal'::text, 'above'::text, 'below'::text, 'any'::text]))),
    CONSTRAINT scenario_stress_rule_suggestions_signal_type_check CHECK ((signal_type = ANY (ARRAY['price_move_pct'::text, 'thesis_state'::text, 'earnings_event'::text, 'sec_filing'::text, 'guidance_revision'::text, 'management_change'::text, 'macro_regime'::text, 'analyst_rerating'::text, 'news_sentiment'::text, 'custom'::text])))
);
create table if not exists app.scenario_stress_runs (
    scenario_run_id text NOT NULL,
    user_id text NOT NULL,
    scenario_id text NOT NULL,
    status text NOT NULL,
    run_mode text NOT NULL,
    as_of date NOT NULL,
    total_names integer NOT NULL,
    impacted_names integer NOT NULL,
    critical_names integer NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone NOT NULL,
    CONSTRAINT scenario_stress_runs_critical_names_check CHECK ((critical_names >= 0)),
    CONSTRAINT scenario_stress_runs_impacted_names_check CHECK ((impacted_names >= 0)),
    CONSTRAINT scenario_stress_runs_mode_check CHECK ((run_mode = 'manual'::text)),
    CONSTRAINT scenario_stress_runs_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'degraded'::text, 'failed'::text]))),
    CONSTRAINT scenario_stress_runs_total_names_check CHECK ((total_names >= 0))
);
create table if not exists app.scenario_stress_templates (
    scenario_id text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    hypothesis text NOT NULL,
    display_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scenario_stress_templates_id_check CHECK ((scenario_id = ANY (ARRAY['rates_higher_for_longer'::text, 'recession_in_6m'::text, 'usd_up_10'::text, 'ai_hype_burst'::text, 'oil_120_spike'::text])))
);
create table if not exists app.sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    family_id text NOT NULL,
    parent_session_id text,
    replaced_by_session_id text,
    revoked_reason text
);
create table if not exists app.subscriptions (
    user_id text NOT NULL,
    tier text DEFAULT 'FREE'::text NOT NULL,
    revenuecat_app_user_id text,
    billing_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_tier_check CHECK ((tier = ANY (ARRAY['FREE'::text, 'PRO'::text])))
);
create table if not exists app.thesis_monitor_snapshots (
    user_id text NOT NULL,
    ticker text NOT NULL,
    state text NOT NULL,
    reason text NOT NULL,
    score numeric NOT NULL,
    report_id text,
    report_generated_at timestamp with time zone,
    report_schema_version text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_deep_dive_at timestamp with time zone,
    material_events_count integer DEFAULT 0 NOT NULL,
    unreviewed_events_count integer DEFAULT 0 NOT NULL,
    freshness_state text DEFAULT 'stale'::text NOT NULL,
    freshness_score numeric DEFAULT 0 NOT NULL,
    kill_switch_triggered_at timestamp with time zone,
    freshness_reason text DEFAULT 'Freshness has not been computed yet.'::text NOT NULL,
    CONSTRAINT thesis_monitor_snapshots_freshness_score_check CHECK (((freshness_score >= (0)::numeric) AND (freshness_score <= (1)::numeric))),
    CONSTRAINT thesis_monitor_snapshots_freshness_state_check CHECK ((freshness_state = ANY (ARRAY['current'::text, 'aging'::text, 'stale'::text, 'triggered'::text]))),
    CONSTRAINT thesis_monitor_snapshots_score_check CHECK (((score >= (0)::numeric) AND (score <= (1)::numeric))),
    CONSTRAINT thesis_monitor_snapshots_state_check CHECK ((state = ANY (ARRAY['intact'::text, 'improved'::text, 'weakened'::text, 'unresolved'::text])))
);
create table if not exists app.ticker_coverage (
    ticker text NOT NULL,
    snapshot_count integer DEFAULT 0 NOT NULL,
    transcript_count integer DEFAULT 0 NOT NULL,
    latest_period text,
    earliest_period text,
    has_guidance boolean DEFAULT false NOT NULL,
    has_estimates boolean DEFAULT false NOT NULL,
    last_synced_at timestamp with time zone NOT NULL,
    last_sync_status text NOT NULL,
    backfill_tier integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticker_coverage_backfill_tier_check CHECK ((backfill_tier = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT ticker_coverage_last_sync_status_check CHECK ((last_sync_status = ANY (ARRAY['success'::text, 'partial'::text, 'failed'::text]))),
    CONSTRAINT ticker_coverage_snapshot_count_check CHECK ((snapshot_count >= 0)),
    CONSTRAINT ticker_coverage_transcript_count_check CHECK ((transcript_count >= 0))
);
create table if not exists app.ticker_registry (
    symbol text NOT NULL,
    company_name text NOT NULL,
    exchange text NOT NULL,
    listing_status text NOT NULL,
    is_supported boolean DEFAULT true NOT NULL,
    source_feed text NOT NULL,
    source_updated_at timestamp with time zone NOT NULL,
    last_synced_at timestamp with time zone NOT NULL,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ticker_registry_exchange_check CHECK ((exchange = ANY (ARRAY['NASDAQ'::text, 'NYSE'::text]))),
    CONSTRAINT ticker_registry_listing_status_check CHECK ((listing_status = ANY (ARRAY['active'::text, 'delisted'::text, 'suspended'::text])))
);
create table if not exists app.transcripts (
    transcript_id text NOT NULL,
    ticker text NOT NULL,
    period text NOT NULL,
    fiscal_year integer NOT NULL,
    fiscal_quarter integer NOT NULL,
    call_date text,
    provider text NOT NULL,
    retrieved_at timestamp with time zone NOT NULL,
    body_text text NOT NULL,
    word_count integer NOT NULL,
    is_complete boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transcripts_fiscal_quarter_check CHECK (((fiscal_quarter >= 1) AND (fiscal_quarter <= 4))),
    CONSTRAINT transcripts_word_count_check CHECK ((word_count >= 0))
);
create table if not exists app.user_devices (
    id text NOT NULL,
    user_id text NOT NULL,
    installation_id text NOT NULL,
    device_token text NOT NULL,
    platform text DEFAULT 'android'::text NOT NULL,
    last_seen_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    invalidated_at timestamp with time zone,
    invalidation_reason text
);
create table if not exists app.user_email_preferences (
    user_id text NOT NULL,
    email_opt_out boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.user_feedback_queue (
    id text NOT NULL,
    user_id text NOT NULL,
    feedback_type text NOT NULL,
    code text NOT NULL,
    severity text NOT NULL,
    source_surface text NOT NULL,
    user_tier text NOT NULL,
    report_id text,
    ticker text,
    message text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    triage_status text DEFAULT 'new'::text NOT NULL,
    route_status text DEFAULT 'pending'::text NOT NULL,
    triage_owner text,
    triaged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_feedback_queue_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['report'::text, 'subscription'::text]))),
    CONSTRAINT user_feedback_queue_route_status_check CHECK ((route_status = ANY (ARRAY['pending'::text, 'routed'::text, 'not_applicable'::text]))),
    CONSTRAINT user_feedback_queue_severity_check CHECK ((severity = ANY (ARRAY['normal'::text, 'high'::text, 'blocker'::text]))),
    CONSTRAINT user_feedback_queue_triage_status_check CHECK ((triage_status = ANY (ARRAY['new'::text, 'reviewed'::text, 'routed'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT user_feedback_queue_user_tier_check CHECK ((user_tier = ANY (ARRAY['FREE'::text, 'PRO'::text])))
);
create table if not exists app.user_google_identities (
    user_id text NOT NULL,
    google_subject text NOT NULL,
    email text NOT NULL,
    linked_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
create table if not exists app.user_research_holdings (
    user_id text NOT NULL,
    ticker text NOT NULL,
    quantity numeric,
    cost_basis numeric,
    label text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.user_research_states (
    state_id text NOT NULL,
    user_id text NOT NULL,
    as_of date NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    state jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
create table if not exists app.users (
    id text NOT NULL,
    email text NOT NULL,
    password_hash text,  -- nullable: Supabase Auth owns passwords (ADR 3)
    verified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    device_token text,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    failed_login_window_started_at timestamp with time zone,
    locked_until timestamp with time zone,
    auth_user_id uuid
);
create table if not exists app.verification_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone
);
create table if not exists app.war_room_timeline_events (
    id text NOT NULL,
    war_room_id text NOT NULL,
    phase text NOT NULL,
    event_type text NOT NULL,
    reason_text text NOT NULL,
    source_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    alert_ledger_id text,
    report_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT war_room_timeline_events_event_type_check CHECK ((event_type = ANY (ARRAY['prepared'::text, 'playbook_updated'::text, 'live_cycle_completed'::text, 'cadence_changed'::text, 'alert_emitted'::text, 'deep_dive_queued'::text, 'post_event_closed'::text, 'failed'::text]))),
    CONSTRAINT war_room_timeline_events_phase_check CHECK ((phase = ANY (ARRAY['pre'::text, 'live'::text, 'post'::text])))
);
create table if not exists app.war_rooms (
    id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    earnings_event_id text NOT NULL,
    event_date date NOT NULL,
    state text NOT NULL,
    current_cadence_min integer NOT NULL,
    cadence_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    prepared_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT war_rooms_current_cadence_min_check CHECK ((current_cadence_min = ANY (ARRAY[15, 30]))),
    CONSTRAINT war_rooms_state_check CHECK ((state = ANY (ARRAY['preparing'::text, 'ready'::text, 'live'::text, 'post'::text, 'closed'::text, 'degraded'::text, 'failed'::text])))
);
create table if not exists app.watchlists (
    id text NOT NULL,
    user_id text NOT NULL,
    ticker text NOT NULL,
    added_at timestamp with time zone NOT NULL
);

-- 2. Primary keys, unique and check constraints.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'account_action_tokens_pkey' and conrelid = 'app.account_action_tokens'::regclass) then
    alter table app.account_action_tokens add constraint account_action_tokens_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'account_action_tokens_token_hash_key' and conrelid = 'app.account_action_tokens'::regclass) then
    alter table app.account_action_tokens add constraint account_action_tokens_token_hash_key UNIQUE (token_hash);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_ledger_pkey' and conrelid = 'app.alert_ledger'::regclass) then
    alter table app.alert_ledger add constraint alert_ledger_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_events_pkey' and conrelid = 'app.audit_events'::regclass) then
    alter table app.audit_events add constraint audit_events_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_pkey' and conrelid = 'app.calendar_events'::regclass) then
    alter table app.calendar_events add constraint calendar_events_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_ticker_event_type_event_date_key' and conrelid = 'app.calendar_events'::regclass) then
    alter table app.calendar_events add constraint calendar_events_ticker_event_type_event_date_key UNIQUE (ticker, event_type, event_date);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'call_artifacts_pkey' and conrelid = 'app.call_artifacts'::regclass) then
    alter table app.call_artifacts add constraint call_artifacts_pkey PRIMARY KEY (artifact_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'canonical_events_pkey' and conrelid = 'app.canonical_events'::regclass) then
    alter table app.canonical_events add constraint canonical_events_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contrarian_alert_anchors_pkey' and conrelid = 'app.contrarian_alert_anchors'::regclass) then
    alter table app.contrarian_alert_anchors add constraint contrarian_alert_anchors_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_insight_cards_dedupe' and conrelid = 'app.conviction_insight_cards'::regclass) then
    alter table app.conviction_insight_cards add constraint conviction_insight_cards_dedupe UNIQUE (user_id, period_start, period_end, insight_type);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_insight_cards_pkey' and conrelid = 'app.conviction_insight_cards'::regclass) then
    alter table app.conviction_insight_cards add constraint conviction_insight_cards_pkey PRIMARY KEY (insight_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_journal_entries_dedupe' and conrelid = 'app.conviction_journal_entries'::regclass) then
    alter table app.conviction_journal_entries add constraint conviction_journal_entries_dedupe UNIQUE (user_id, event_type, source_type, source_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_journal_entries_pkey' and conrelid = 'app.conviction_journal_entries'::regclass) then
    alter table app.conviction_journal_entries add constraint conviction_journal_entries_pkey PRIMARY KEY (journal_entry_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deep_dive_daily_usage_pkey' and conrelid = 'app.deep_dive_daily_usage'::regclass) then
    alter table app.deep_dive_daily_usage add constraint deep_dive_daily_usage_pkey PRIMARY KEY (user_id, usage_date);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fear_greed_daily_market_date_key' and conrelid = 'app.fear_greed_daily'::regclass) then
    alter table app.fear_greed_daily add constraint fear_greed_daily_market_date_key UNIQUE (market_date);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fear_greed_daily_pkey' and conrelid = 'app.fear_greed_daily'::regclass) then
    alter table app.fear_greed_daily add constraint fear_greed_daily_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'financial_snapshots_pkey' and conrelid = 'app.financial_snapshots'::regclass) then
    alter table app.financial_snapshots add constraint financial_snapshots_pkey PRIMARY KEY (snapshot_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'financial_snapshots_ticker_period_period_type_key' and conrelid = 'app.financial_snapshots'::regclass) then
    alter table app.financial_snapshots add constraint financial_snapshots_ticker_period_period_type_key UNIQUE (ticker, period, period_type);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'first_party_context_items_pkey' and conrelid = 'app.first_party_context_items'::regclass) then
    alter table app.first_party_context_items add constraint first_party_context_items_pkey PRIMARY KEY (context_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_pkey' and conrelid = 'app.jobs'::regclass) then
    alter table app.jobs add constraint jobs_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_evaluations_pkey' and conrelid = 'app.kill_switch_evaluations'::regclass) then
    alter table app.kill_switch_evaluations add constraint kill_switch_evaluations_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_evaluations_rule_id_signal_source_trigger_key_key' and conrelid = 'app.kill_switch_evaluations'::regclass) then
    alter table app.kill_switch_evaluations add constraint kill_switch_evaluations_rule_id_signal_source_trigger_key_key UNIQUE (rule_id, signal_source, trigger_key);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_rules_pkey' and conrelid = 'app.kill_switch_rules'::regclass) then
    alter table app.kill_switch_rules add constraint kill_switch_rules_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'name_relationships_pkey' and conrelid = 'app.name_relationships'::regclass) then
    alter table app.name_relationships add constraint name_relationships_pkey PRIMARY KEY (relationship_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notification_preferences_pkey' and conrelid = 'app.notification_preferences'::regclass) then
    alter table app.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notification_preferences_user_id_notification_type_key' and conrelid = 'app.notification_preferences'::regclass) then
    alter table app.notification_preferences add constraint notification_preferences_user_id_notification_type_key UNIQUE (user_id, notification_type);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'opposite_case_reports_dedupe' and conrelid = 'app.opposite_case_reports'::regclass) then
    alter table app.opposite_case_reports add constraint opposite_case_reports_dedupe UNIQUE (user_id, source_report_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'opposite_case_reports_pkey' and conrelid = 'app.opposite_case_reports'::regclass) then
    alter table app.opposite_case_reports add constraint opposite_case_reports_pkey PRIMARY KEY (opposite_case_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'report_notes_pkey' and conrelid = 'app.report_notes'::regclass) then
    alter table app.report_notes add constraint report_notes_pkey PRIMARY KEY (report_id, user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'report_shares_pkey' and conrelid = 'app.report_shares'::regclass) then
    alter table app.report_shares add constraint report_shares_pkey PRIMARY KEY (token);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_pkey' and conrelid = 'app.reports'::regclass) then
    alter table app.reports add constraint reports_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_impacts_pkey' and conrelid = 'app.scenario_stress_impacts'::regclass) then
    alter table app.scenario_stress_impacts add constraint scenario_stress_impacts_pkey PRIMARY KEY (scenario_impact_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_rule_suggestions_pkey' and conrelid = 'app.scenario_stress_rule_suggestions'::regclass) then
    alter table app.scenario_stress_rule_suggestions add constraint scenario_stress_rule_suggestions_pkey PRIMARY KEY (scenario_rule_suggestion_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_runs_pkey' and conrelid = 'app.scenario_stress_runs'::regclass) then
    alter table app.scenario_stress_runs add constraint scenario_stress_runs_pkey PRIMARY KEY (scenario_run_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_templates_pkey' and conrelid = 'app.scenario_stress_templates'::regclass) then
    alter table app.scenario_stress_templates add constraint scenario_stress_templates_pkey PRIMARY KEY (scenario_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_pkey' and conrelid = 'app.sessions'::regclass) then
    alter table app.sessions add constraint sessions_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_pkey' and conrelid = 'app.subscriptions'::regclass) then
    alter table app.subscriptions add constraint subscriptions_pkey PRIMARY KEY (user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_revenuecat_app_user_id_key' and conrelid = 'app.subscriptions'::regclass) then
    alter table app.subscriptions add constraint subscriptions_revenuecat_app_user_id_key UNIQUE (revenuecat_app_user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'thesis_monitor_snapshots_pkey' and conrelid = 'app.thesis_monitor_snapshots'::regclass) then
    alter table app.thesis_monitor_snapshots add constraint thesis_monitor_snapshots_pkey PRIMARY KEY (user_id, ticker);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ticker_coverage_pkey' and conrelid = 'app.ticker_coverage'::regclass) then
    alter table app.ticker_coverage add constraint ticker_coverage_pkey PRIMARY KEY (ticker);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ticker_registry_pkey' and conrelid = 'app.ticker_registry'::regclass) then
    alter table app.ticker_registry add constraint ticker_registry_pkey PRIMARY KEY (symbol);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transcripts_pkey' and conrelid = 'app.transcripts'::regclass) then
    alter table app.transcripts add constraint transcripts_pkey PRIMARY KEY (transcript_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transcripts_ticker_period_key' and conrelid = 'app.transcripts'::regclass) then
    alter table app.transcripts add constraint transcripts_ticker_period_key UNIQUE (ticker, period);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_devices_pkey' and conrelid = 'app.user_devices'::regclass) then
    alter table app.user_devices add constraint user_devices_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_devices_user_id_installation_id_key' and conrelid = 'app.user_devices'::regclass) then
    alter table app.user_devices add constraint user_devices_user_id_installation_id_key UNIQUE (user_id, installation_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_email_preferences_pkey' and conrelid = 'app.user_email_preferences'::regclass) then
    alter table app.user_email_preferences add constraint user_email_preferences_pkey PRIMARY KEY (user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_feedback_queue_pkey' and conrelid = 'app.user_feedback_queue'::regclass) then
    alter table app.user_feedback_queue add constraint user_feedback_queue_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_google_identities_google_subject_key' and conrelid = 'app.user_google_identities'::regclass) then
    alter table app.user_google_identities add constraint user_google_identities_google_subject_key UNIQUE (google_subject);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_google_identities_pkey' and conrelid = 'app.user_google_identities'::regclass) then
    alter table app.user_google_identities add constraint user_google_identities_pkey PRIMARY KEY (user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_research_holdings_pkey' and conrelid = 'app.user_research_holdings'::regclass) then
    alter table app.user_research_holdings add constraint user_research_holdings_pkey PRIMARY KEY (user_id, ticker);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_research_states_pkey' and conrelid = 'app.user_research_states'::regclass) then
    alter table app.user_research_states add constraint user_research_states_pkey PRIMARY KEY (state_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_research_states_user_id_as_of_key' and conrelid = 'app.user_research_states'::regclass) then
    alter table app.user_research_states add constraint user_research_states_user_id_as_of_key UNIQUE (user_id, as_of);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_email_key' and conrelid = 'app.users'::regclass) then
    alter table app.users add constraint users_email_key UNIQUE (email);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_pkey' and conrelid = 'app.users'::regclass) then
    alter table app.users add constraint users_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'verification_tokens_pkey' and conrelid = 'app.verification_tokens'::regclass) then
    alter table app.verification_tokens add constraint verification_tokens_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'verification_tokens_token_hash_key' and conrelid = 'app.verification_tokens'::regclass) then
    alter table app.verification_tokens add constraint verification_tokens_token_hash_key UNIQUE (token_hash);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_room_timeline_events_pkey' and conrelid = 'app.war_room_timeline_events'::regclass) then
    alter table app.war_room_timeline_events add constraint war_room_timeline_events_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_rooms_pkey' and conrelid = 'app.war_rooms'::regclass) then
    alter table app.war_rooms add constraint war_rooms_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_rooms_user_id_ticker_earnings_event_id_key' and conrelid = 'app.war_rooms'::regclass) then
    alter table app.war_rooms add constraint war_rooms_user_id_ticker_earnings_event_id_key UNIQUE (user_id, ticker, earnings_event_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'watchlists_pkey' and conrelid = 'app.watchlists'::regclass) then
    alter table app.watchlists add constraint watchlists_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'watchlists_user_id_ticker_key' and conrelid = 'app.watchlists'::regclass) then
    alter table app.watchlists add constraint watchlists_user_id_ticker_key UNIQUE (user_id, ticker);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_auth_user_id_key' and conrelid = 'app.users'::regclass) then
    alter table app.users add constraint users_auth_user_id_key UNIQUE (auth_user_id);
  end if;
end $$;

-- 3. Foreign keys.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'account_action_tokens_user_id_fkey' and conrelid = 'app.account_action_tokens'::regclass) then
    alter table app.account_action_tokens add constraint account_action_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_ledger_user_id_fkey' and conrelid = 'app.alert_ledger'::regclass) then
    alter table app.alert_ledger add constraint alert_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_events_user_id_fkey' and conrelid = 'app.audit_events'::regclass) then
    alter table app.audit_events add constraint audit_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contrarian_alert_anchors_report_id_fkey' and conrelid = 'app.contrarian_alert_anchors'::regclass) then
    alter table app.contrarian_alert_anchors add constraint contrarian_alert_anchors_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contrarian_alert_anchors_user_id_fkey' and conrelid = 'app.contrarian_alert_anchors'::regclass) then
    alter table app.contrarian_alert_anchors add constraint contrarian_alert_anchors_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_insight_cards_user_id_fkey' and conrelid = 'app.conviction_insight_cards'::regclass) then
    alter table app.conviction_insight_cards add constraint conviction_insight_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_journal_entries_alert_ledger_id_fkey' and conrelid = 'app.conviction_journal_entries'::regclass) then
    alter table app.conviction_journal_entries add constraint conviction_journal_entries_alert_ledger_id_fkey FOREIGN KEY (alert_ledger_id) REFERENCES app.alert_ledger(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_journal_entries_report_id_fkey' and conrelid = 'app.conviction_journal_entries'::regclass) then
    alter table app.conviction_journal_entries add constraint conviction_journal_entries_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_journal_entries_user_id_fkey' and conrelid = 'app.conviction_journal_entries'::regclass) then
    alter table app.conviction_journal_entries add constraint conviction_journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conviction_journal_entries_war_room_id_fkey' and conrelid = 'app.conviction_journal_entries'::regclass) then
    alter table app.conviction_journal_entries add constraint conviction_journal_entries_war_room_id_fkey FOREIGN KEY (war_room_id) REFERENCES app.war_rooms(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deep_dive_daily_usage_user_id_fkey' and conrelid = 'app.deep_dive_daily_usage'::regclass) then
    alter table app.deep_dive_daily_usage add constraint deep_dive_daily_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_user_id_fkey' and conrelid = 'app.jobs'::regclass) then
    alter table app.jobs add constraint jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_evaluations_alert_id_fkey' and conrelid = 'app.kill_switch_evaluations'::regclass) then
    alter table app.kill_switch_evaluations add constraint kill_switch_evaluations_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES app.alert_ledger(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_evaluations_rule_id_fkey' and conrelid = 'app.kill_switch_evaluations'::regclass) then
    alter table app.kill_switch_evaluations add constraint kill_switch_evaluations_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES app.kill_switch_rules(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_evaluations_user_id_fkey' and conrelid = 'app.kill_switch_evaluations'::regclass) then
    alter table app.kill_switch_evaluations add constraint kill_switch_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_rules_report_id_fkey' and conrelid = 'app.kill_switch_rules'::regclass) then
    alter table app.kill_switch_rules add constraint kill_switch_rules_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kill_switch_rules_user_id_fkey' and conrelid = 'app.kill_switch_rules'::regclass) then
    alter table app.kill_switch_rules add constraint kill_switch_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'name_relationships_source_report_id_fkey' and conrelid = 'app.name_relationships'::regclass) then
    alter table app.name_relationships add constraint name_relationships_source_report_id_fkey FOREIGN KEY (source_report_id) REFERENCES app.reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'name_relationships_user_id_fkey' and conrelid = 'app.name_relationships'::regclass) then
    alter table app.name_relationships add constraint name_relationships_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notification_preferences_user_id_fkey' and conrelid = 'app.notification_preferences'::regclass) then
    alter table app.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'opposite_case_reports_source_report_id_fkey' and conrelid = 'app.opposite_case_reports'::regclass) then
    alter table app.opposite_case_reports add constraint opposite_case_reports_source_report_id_fkey FOREIGN KEY (source_report_id) REFERENCES app.reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'opposite_case_reports_user_id_fkey' and conrelid = 'app.opposite_case_reports'::regclass) then
    alter table app.opposite_case_reports add constraint opposite_case_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'report_notes_report_id_fkey' and conrelid = 'app.report_notes'::regclass) then
    alter table app.report_notes add constraint report_notes_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'report_notes_user_id_fkey' and conrelid = 'app.report_notes'::regclass) then
    alter table app.report_notes add constraint report_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'report_shares_created_by_fkey' and conrelid = 'app.report_shares'::regclass) then
    alter table app.report_shares add constraint report_shares_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'report_shares_report_id_fkey' and conrelid = 'app.report_shares'::regclass) then
    alter table app.report_shares add constraint report_shares_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_job_id_fkey' and conrelid = 'app.reports'::regclass) then
    alter table app.reports add constraint reports_job_id_fkey FOREIGN KEY (job_id) REFERENCES app.jobs(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_impacts_scenario_run_id_fkey' and conrelid = 'app.scenario_stress_impacts'::regclass) then
    alter table app.scenario_stress_impacts add constraint scenario_stress_impacts_scenario_run_id_fkey FOREIGN KEY (scenario_run_id) REFERENCES app.scenario_stress_runs(scenario_run_id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_impacts_user_id_fkey' and conrelid = 'app.scenario_stress_impacts'::regclass) then
    alter table app.scenario_stress_impacts add constraint scenario_stress_impacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_rule_suggestions_scenario_run_id_fkey' and conrelid = 'app.scenario_stress_rule_suggestions'::regclass) then
    alter table app.scenario_stress_rule_suggestions add constraint scenario_stress_rule_suggestions_scenario_run_id_fkey FOREIGN KEY (scenario_run_id) REFERENCES app.scenario_stress_runs(scenario_run_id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_rule_suggestions_user_id_fkey' and conrelid = 'app.scenario_stress_rule_suggestions'::regclass) then
    alter table app.scenario_stress_rule_suggestions add constraint scenario_stress_rule_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_runs_scenario_id_fkey' and conrelid = 'app.scenario_stress_runs'::regclass) then
    alter table app.scenario_stress_runs add constraint scenario_stress_runs_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES app.scenario_stress_templates(scenario_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scenario_stress_runs_user_id_fkey' and conrelid = 'app.scenario_stress_runs'::regclass) then
    alter table app.scenario_stress_runs add constraint scenario_stress_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_parent_session_id_fkey' and conrelid = 'app.sessions'::regclass) then
    alter table app.sessions add constraint sessions_parent_session_id_fkey FOREIGN KEY (parent_session_id) REFERENCES app.sessions(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_replaced_by_session_id_fkey' and conrelid = 'app.sessions'::regclass) then
    alter table app.sessions add constraint sessions_replaced_by_session_id_fkey FOREIGN KEY (replaced_by_session_id) REFERENCES app.sessions(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_user_id_fkey' and conrelid = 'app.sessions'::regclass) then
    alter table app.sessions add constraint sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_user_id_fkey' and conrelid = 'app.subscriptions'::regclass) then
    alter table app.subscriptions add constraint subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'thesis_monitor_snapshots_report_id_fkey' and conrelid = 'app.thesis_monitor_snapshots'::regclass) then
    alter table app.thesis_monitor_snapshots add constraint thesis_monitor_snapshots_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'thesis_monitor_snapshots_user_id_fkey' and conrelid = 'app.thesis_monitor_snapshots'::regclass) then
    alter table app.thesis_monitor_snapshots add constraint thesis_monitor_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_devices_user_id_fkey' and conrelid = 'app.user_devices'::regclass) then
    alter table app.user_devices add constraint user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_email_preferences_user_id_fkey' and conrelid = 'app.user_email_preferences'::regclass) then
    alter table app.user_email_preferences add constraint user_email_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_feedback_queue_report_id_fkey' and conrelid = 'app.user_feedback_queue'::regclass) then
    alter table app.user_feedback_queue add constraint user_feedback_queue_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_feedback_queue_user_id_fkey' and conrelid = 'app.user_feedback_queue'::regclass) then
    alter table app.user_feedback_queue add constraint user_feedback_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_google_identities_user_id_fkey' and conrelid = 'app.user_google_identities'::regclass) then
    alter table app.user_google_identities add constraint user_google_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_research_holdings_user_id_fkey' and conrelid = 'app.user_research_holdings'::regclass) then
    alter table app.user_research_holdings add constraint user_research_holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_research_states_user_id_fkey' and conrelid = 'app.user_research_states'::regclass) then
    alter table app.user_research_states add constraint user_research_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'verification_tokens_user_id_fkey' and conrelid = 'app.verification_tokens'::regclass) then
    alter table app.verification_tokens add constraint verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_room_timeline_events_alert_ledger_id_fkey' and conrelid = 'app.war_room_timeline_events'::regclass) then
    alter table app.war_room_timeline_events add constraint war_room_timeline_events_alert_ledger_id_fkey FOREIGN KEY (alert_ledger_id) REFERENCES app.alert_ledger(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_room_timeline_events_report_id_fkey' and conrelid = 'app.war_room_timeline_events'::regclass) then
    alter table app.war_room_timeline_events add constraint war_room_timeline_events_report_id_fkey FOREIGN KEY (report_id) REFERENCES app.reports(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_room_timeline_events_war_room_id_fkey' and conrelid = 'app.war_room_timeline_events'::regclass) then
    alter table app.war_room_timeline_events add constraint war_room_timeline_events_war_room_id_fkey FOREIGN KEY (war_room_id) REFERENCES app.war_rooms(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'war_rooms_user_id_fkey' and conrelid = 'app.war_rooms'::regclass) then
    alter table app.war_rooms add constraint war_rooms_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'watchlists_user_id_fkey' and conrelid = 'app.watchlists'::regclass) then
    alter table app.watchlists add constraint watchlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_auth_user_id_fkey' and conrelid = 'app.users'::regclass) then
    alter table app.users add constraint users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;

-- 4. Indexes.

create index if not exists call_artifacts_event_idx on app.call_artifacts USING btree (event_id) WHERE (event_id IS NOT NULL);
create index if not exists call_artifacts_ticker_retrieved_idx on app.call_artifacts USING btree (ticker, retrieved_at DESC);
create index if not exists canonical_events_family_occurred_idx on app.canonical_events USING btree (family, occurred_at DESC);
create index if not exists canonical_events_subject_occurred_idx on app.canonical_events USING btree (subject_type, subject_id, occurred_at DESC);
create index if not exists conviction_insight_cards_user_generated_idx on app.conviction_insight_cards USING btree (user_id, generated_at DESC);
create index if not exists conviction_journal_entries_user_event_idx on app.conviction_journal_entries USING btree (user_id, event_at DESC);
create index if not exists conviction_journal_entries_user_ticker_event_idx on app.conviction_journal_entries USING btree (user_id, ticker, event_at DESC);
create index if not exists first_party_context_items_event_idx on app.first_party_context_items USING btree (event_id) WHERE (event_id IS NOT NULL);
create index if not exists first_party_context_items_ticker_retrieved_idx on app.first_party_context_items USING btree (ticker, retrieved_at DESC);
create index if not exists idx_account_action_tokens_user_purpose on app.account_action_tokens USING btree (user_id, purpose);
create index if not exists idx_alert_ledger_notification_type_created on app.alert_ledger USING btree (notification_type, created_at DESC);
create index if not exists idx_alert_ledger_user_category_created on app.alert_ledger USING btree (user_id, category, created_at DESC);
create index if not exists idx_alert_ledger_user_created on app.alert_ledger USING btree (user_id, created_at DESC);
create index if not exists idx_audit_events_created_at on app.audit_events USING btree (created_at);
create index if not exists idx_calendar_events_event_date on app.calendar_events USING btree (event_date);
create index if not exists idx_calendar_events_ticker_event_date on app.calendar_events USING btree (ticker, event_date);
create index if not exists idx_calendar_events_ticker_type_state_date on app.calendar_events USING btree (ticker, event_type, timing_state, event_date);
create index if not exists idx_contrarian_alert_anchors_active_expires on app.contrarian_alert_anchors USING btree (is_active, expires_at);
create index if not exists idx_contrarian_alert_anchors_ticker on app.contrarian_alert_anchors USING btree (ticker);
create index if not exists idx_contrarian_alert_anchors_user_id on app.contrarian_alert_anchors USING btree (user_id);
create index if not exists idx_deep_dive_daily_usage_date on app.deep_dive_daily_usage USING btree (usage_date);
create index if not exists idx_fear_greed_daily_calculated_at on app.fear_greed_daily USING btree (calculated_at);
create index if not exists idx_fear_greed_daily_market_date on app.fear_greed_daily USING btree (market_date);
create index if not exists idx_financial_snapshots_ticker on app.financial_snapshots USING btree (ticker);
create index if not exists idx_financial_snapshots_ticker_fiscal_year on app.financial_snapshots USING btree (ticker, fiscal_year);
create index if not exists idx_financial_snapshots_ticker_period on app.financial_snapshots USING btree (ticker, period);
create index if not exists idx_jobs_report_id_complete on app.jobs USING btree (report_id, user_id, status);
create index if not exists idx_jobs_status on app.jobs USING btree (status);
create index if not exists idx_jobs_type_cycle_start on app.jobs USING btree (type, cycle_start);
create index if not exists idx_jobs_user_id on app.jobs USING btree (user_id);
create index if not exists idx_kill_switch_eval_trigger on app.kill_switch_evaluations USING btree (signal_source, trigger_key, created_at DESC);
create index if not exists idx_kill_switch_eval_user_created on app.kill_switch_evaluations USING btree (user_id, created_at DESC);
create index if not exists idx_kill_switch_rules_active_created on app.kill_switch_rules USING btree (state, created_at DESC);
create index if not exists idx_kill_switch_rules_signal_type on app.kill_switch_rules USING btree (signal_type);
create index if not exists idx_kill_switch_rules_user_ticker_state on app.kill_switch_rules USING btree (user_id, ticker, state);
create index if not exists idx_name_relationships_report on app.name_relationships USING btree (source_report_id);
create index if not exists idx_name_relationships_source_active on app.name_relationships USING btree (source_ticker, confidence DESC, updated_at) WHERE (state = 'active'::text);
create index if not exists idx_name_relationships_user_target on app.name_relationships USING btree (user_id, target_ticker, updated_at DESC);
create index if not exists idx_name_relationships_user_updated on app.name_relationships USING btree (user_id, updated_at DESC);
create index if not exists idx_notification_preferences_quiet_until on app.notification_preferences USING btree (notification_type, quiet_until);
create index if not exists idx_notification_preferences_type_enabled on app.notification_preferences USING btree (notification_type, enabled);
create index if not exists idx_notification_preferences_user_id on app.notification_preferences USING btree (user_id);
create index if not exists idx_report_notes_report_id on app.report_notes USING btree (report_id);
create index if not exists idx_report_notes_user_id on app.report_notes USING btree (user_id);
create index if not exists idx_report_shares_creator_report on app.report_shares USING btree (created_by, report_id);
create index if not exists idx_reports_deep_dive_fingerprint on app.reports USING btree (type, ticker, fingerprint, freshness_expires_at, created_at DESC);
create index if not exists idx_reports_job_id on app.reports USING btree (job_id);
create index if not exists idx_sessions_family_id on app.sessions USING btree (family_id);
create index if not exists idx_sessions_user_id on app.sessions USING btree (user_id);
create index if not exists idx_subscriptions_revenuecat_app_user_id on app.subscriptions USING btree (revenuecat_app_user_id);
create index if not exists idx_subscriptions_tier on app.subscriptions USING btree (tier);
create index if not exists idx_thesis_monitor_snapshots_freshness_state on app.thesis_monitor_snapshots USING btree (freshness_state);
create index if not exists idx_thesis_monitor_snapshots_state on app.thesis_monitor_snapshots USING btree (state);
create index if not exists idx_thesis_monitor_snapshots_unreviewed_events on app.thesis_monitor_snapshots USING btree (unreviewed_events_count DESC);
create index if not exists idx_thesis_monitor_snapshots_updated_at on app.thesis_monitor_snapshots USING btree (updated_at DESC);
create index if not exists idx_thesis_monitor_snapshots_user on app.thesis_monitor_snapshots USING btree (user_id);
create index if not exists idx_ticker_registry_company_name_lower on app.ticker_registry USING btree (lower(company_name));
create index if not exists idx_ticker_registry_exchange on app.ticker_registry USING btree (exchange);
create index if not exists idx_ticker_registry_supported on app.ticker_registry USING btree (is_supported);
create index if not exists idx_transcripts_ticker on app.transcripts USING btree (ticker);
create index if not exists idx_transcripts_ticker_period on app.transcripts USING btree (ticker, period);
create UNIQUE index if not exists idx_user_devices_active_token on app.user_devices USING btree (device_token) WHERE (invalidated_at IS NULL);
create index if not exists idx_user_devices_user_active on app.user_devices USING btree (user_id) WHERE (invalidated_at IS NULL);
create index if not exists idx_user_feedback_queue_report on app.user_feedback_queue USING btree (report_id, ticker);
create index if not exists idx_user_feedback_queue_source on app.user_feedback_queue USING btree (source_surface, created_at DESC);
create index if not exists idx_user_feedback_queue_triage on app.user_feedback_queue USING btree (triage_status, route_status, created_at DESC);
create index if not exists idx_user_feedback_queue_type_created on app.user_feedback_queue USING btree (feedback_type, created_at DESC);
create index if not exists idx_user_feedback_queue_user_tier on app.user_feedback_queue USING btree (user_tier, created_at DESC);
create index if not exists idx_user_google_identities_subject on app.user_google_identities USING btree (google_subject);
create index if not exists idx_user_research_holdings_user on app.user_research_holdings USING btree (user_id);
create index if not exists idx_user_research_states_user_as_of on app.user_research_states USING btree (user_id, as_of DESC);
create index if not exists idx_users_device_token on app.users USING btree (device_token);
create index if not exists idx_users_locked_until on app.users USING btree (locked_until);
create index if not exists idx_verification_tokens_hash on app.verification_tokens USING btree (token_hash);
create index if not exists idx_war_room_timeline_events_alert on app.war_room_timeline_events USING btree (alert_ledger_id) WHERE (alert_ledger_id IS NOT NULL);
create index if not exists idx_war_room_timeline_events_room_created on app.war_room_timeline_events USING btree (war_room_id, created_at DESC);
create index if not exists idx_war_rooms_event on app.war_rooms USING btree (earnings_event_id, prepared_at DESC);
create index if not exists idx_war_rooms_user_created on app.war_rooms USING btree (user_id, created_at DESC);
create index if not exists idx_war_rooms_user_ticker on app.war_rooms USING btree (user_id, ticker, prepared_at DESC);
create index if not exists idx_watchlists_ticker on app.watchlists USING btree (ticker);
create index if not exists idx_watchlists_user_id on app.watchlists USING btree (user_id);
create index if not exists opposite_case_reports_user_generated_idx on app.opposite_case_reports USING btree (user_id, generated_at DESC);
create index if not exists scenario_stress_impacts_run_idx on app.scenario_stress_impacts USING btree (scenario_run_id, stress_score DESC, ticker);
create index if not exists scenario_stress_rule_suggestions_run_idx on app.scenario_stress_rule_suggestions USING btree (scenario_run_id, confidence DESC, ticker);
create index if not exists scenario_stress_runs_user_created_idx on app.scenario_stress_runs USING btree (user_id, created_at DESC);

-- 5. Rate limit table for later use.

create table if not exists app.rate_limits (
    key text not null,
    window_start timestamp with time zone not null,
    count integer not null default 0,
    primary key (key, window_start)
);

-- 6. Row level security on every table, with no policies (deny by default).

alter table app.account_action_tokens enable row level security;
alter table app.alert_ledger enable row level security;
alter table app.audit_events enable row level security;
alter table app.calendar_events enable row level security;
alter table app.call_artifacts enable row level security;
alter table app.canonical_events enable row level security;
alter table app.contrarian_alert_anchors enable row level security;
alter table app.conviction_insight_cards enable row level security;
alter table app.conviction_journal_entries enable row level security;
alter table app.deep_dive_daily_usage enable row level security;
alter table app.fear_greed_daily enable row level security;
alter table app.financial_snapshots enable row level security;
alter table app.first_party_context_items enable row level security;
alter table app.jobs enable row level security;
alter table app.kill_switch_evaluations enable row level security;
alter table app.kill_switch_rules enable row level security;
alter table app.name_relationships enable row level security;
alter table app.notification_preferences enable row level security;
alter table app.opposite_case_reports enable row level security;
alter table app.rate_limits enable row level security;
alter table app.report_notes enable row level security;
alter table app.report_shares enable row level security;
alter table app.reports enable row level security;
alter table app.scenario_stress_impacts enable row level security;
alter table app.scenario_stress_rule_suggestions enable row level security;
alter table app.scenario_stress_runs enable row level security;
alter table app.scenario_stress_templates enable row level security;
alter table app.sessions enable row level security;
alter table app.subscriptions enable row level security;
alter table app.thesis_monitor_snapshots enable row level security;
alter table app.ticker_coverage enable row level security;
alter table app.ticker_registry enable row level security;
alter table app.transcripts enable row level security;
alter table app.user_devices enable row level security;
alter table app.user_email_preferences enable row level security;
alter table app.user_feedback_queue enable row level security;
alter table app.user_google_identities enable row level security;
alter table app.user_research_holdings enable row level security;
alter table app.user_research_states enable row level security;
alter table app.users enable row level security;
alter table app.verification_tokens enable row level security;
alter table app.war_room_timeline_events enable row level security;
alter table app.war_rooms enable row level security;
alter table app.watchlists enable row level security;

-- 7. Seed data (from ph5m7_025_scenario_stress).

insert into app.scenario_stress_templates (
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
on conflict (scenario_id) do nothing;

-- 8. Lock out PUBLIC and the Supabase API roles.

revoke all on schema app from public, anon, authenticated;
revoke all on all tables in schema app from public, anon, authenticated;
revoke all on all sequences in schema app from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
-- These apply to objects the migration role creates later in "app".
-- Note: Postgres cannot take away a global default (such as EXECUTE for PUBLIC on new
-- functions) per schema, so new functions in "app" still need an explicit revoke.
alter default privileges in schema app revoke all on tables from public, anon, authenticated;
alter default privileges in schema app revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app revoke all on functions from public, anon, authenticated;

-- 9. Server roles.

-- thesis_api: the API's server-side role. RLS is on with no policies, and RLS applies to
-- every role that is not the owner, so a plain role could not read any row. This role
-- gets BYPASSRLS instead. It stays NOLOGIN here; the login and password are set outside
-- the repo, and the password lives only in Supabase secrets.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'thesis_api') then
    create role thesis_api nologin bypassrls;
  end if;
end $$;
alter role thesis_api set search_path = app, extensions, public;

grant usage on schema app to thesis_api;
grant select, insert, update, delete on all tables in schema app to thesis_api;
grant usage, select on all sequences in schema app to thesis_api;
grant execute on all functions in schema app to thesis_api;
alter default privileges in schema app grant select, insert, update, delete on tables to thesis_api;
alter default privileges in schema app grant usage, select on sequences to thesis_api;
alter default privileges in schema app grant execute on functions to thesis_api;

-- thesis_jobs: the background job role. Schema usage only for now; M3 grants each table.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'thesis_jobs') then
    create role thesis_jobs nologin bypassrls;
  end if;
end $$;
grant usage on schema app to thesis_jobs;

