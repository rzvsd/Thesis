// Contract types the Pulse build needs, copied from packages/contracts/src (types only, no JSON schemas).
// Part 2: Market Pulse report, editorial, macro news, morning edition, user research state.
import type {
  AnalysisReportEvidenceContext,
  ConfidenceBlock,
  EvidenceItem,
  MacroStressSnapshot,
  MarketTapePack,
  ReportSection,
  StructuralContextPack,
  ThesisFreshnessState,
  ThesisMonitorState,
} from "./contracts_base.ts";

export type MarketPulseEditorialGenerationMode = "deterministic" | "llm";

export type MarketPulseEditorialGenerationStatus =
  | "generated"
  | "disabled"
  | "unavailable"
  | "rejected";

export interface MarketPulseEditorialGeneration {
  mode: MarketPulseEditorialGenerationMode;
  status: MarketPulseEditorialGenerationStatus;
  provider?: "openrouter";
  model?: string;
  prompt_version?: string;
  generated_at?: string;
  source_report_id?: string;
  coverage_notes: string[];
}

export const marketPulseEditorialGenerationModes = [
  "deterministic",
  "llm",
] as const;

export const marketPulseEditorialGenerationStatuses = [
  "generated",
  "disabled",
  "unavailable",
  "rejected",
] as const;

export type MarketPulseEditorialFreshnessState =
  | "baseline"
  | "new"
  | "updated"
  | "unchanged"
  | "omitted";

export type MarketPulseEditorialItemKind =
  | "market_tape"
  | "macro"
  | "calendar"
  | "company_event"
  | "coverage"
  | "context";

export type MarketPulseEditorialImportance = "high" | "medium" | "low";

export interface MarketPulseEditorialItem {
  kind: MarketPulseEditorialItemKind;
  title: string;
  body: string;
  freshness_state: MarketPulseEditorialFreshnessState;
  importance: MarketPulseEditorialImportance;
  evidence: EvidenceItem[];
}

export interface MarketPulseWatchItem extends MarketPulseEditorialItem {
  watch_date?: string;
}

export interface MarketPulseEditorialIssue {
  issue_id: string;
  headline: string;
  dek: string;
  lead: string;
  prior_cycle_end?: string;
  freshness_state: MarketPulseEditorialFreshnessState;
  in_this_issue: string[];
  what_changed: MarketPulseEditorialItem[];
  why_it_matters: MarketPulseEditorialItem[];
  what_to_watch: MarketPulseWatchItem[];
  signal_vs_noise: MarketPulseEditorialItem[];
  coverage_notes: string[];
  evidence: EvidenceItem[];
}

export const marketPulseEditorialFreshnessStates = [
  "baseline",
  "new",
  "updated",
  "unchanged",
  "omitted",
] as const;

export const marketPulseEditorialItemKinds = [
  "market_tape",
  "macro",
  "calendar",
  "company_event",
  "coverage",
  "context",
] as const;

export const marketPulseEditorialImportanceLevels = [
  "high",
  "medium",
  "low",
] as const;

export type MarketPulseMacroNewsTopic =
  | "geopolitical"
  | "macro_policy"
  | "central_bank"
  | "war_conflict"
  | "trade"
  | "energy"
  | "supply_chain";

export type MarketPulseMacroNewsSeverity = "normal" | "notable" | "shock";

export type MarketPulseMacroNewsConfirmationState =
  | "reported"
  | "corroborated"
  | "official_confirmed";

export type MarketPulseMacroNewsState = "calm" | "watch" | "shock";

export interface MarketPulseMacroNewsItem {
  headline: string;
  source_name: string;
  source_url?: string;
  published_at?: string;
  topic: MarketPulseMacroNewsTopic;
  severity: MarketPulseMacroNewsSeverity;
  confirmation_state: MarketPulseMacroNewsConfirmationState;
  corroboration_count: number;
  affected_regions: string[];
  affected_assets: string[];
  why_it_matters: string;
  evidence: EvidenceItem[];
}

export interface MarketPulseMacroNewsOmission {
  omission_id: string;
  family: "macro_news" | "geopolitical_risk";
  reason_code: string;
  reason_text: string;
  blocking: boolean;
}

export interface MarketPulseMacroNewsPack {
  as_of: string;
  state: MarketPulseMacroNewsState;
  lead: string;
  items: MarketPulseMacroNewsItem[];
  omissions: MarketPulseMacroNewsOmission[];
  coverage_notes: string[];
}

export const marketPulseMacroNewsTopics = [
  "geopolitical",
  "macro_policy",
  "central_bank",
  "war_conflict",
  "trade",
  "energy",
  "supply_chain",
] as const;

export const marketPulseMacroNewsSeverities = ["normal", "notable", "shock"] as const;

export const marketPulseMacroNewsConfirmationStates = [
  "reported",
  "corroborated",
  "official_confirmed",
] as const;

export const marketPulseMacroNewsStates = ["calm", "watch", "shock"] as const;

export type MarketPulseMoveDirection = "up" | "down" | "flat";

export type MarketPulseHeadlineTopic =
  | "market"
  | "macro"
  | "company"
  | "policy"
  | "sector";

export type MarketPulseCatalystCategory =
  | "macro"
  | "fed"
  | "earnings"
  | "company"
  | "market";

export type MarketPulseCatalystImpact = "high" | "medium" | "low";

export interface MarketPulseHeadlineItem {
  headline: string;
  source_name: string;
  source_url?: string;
  published_at?: string;
  topic?: MarketPulseHeadlineTopic;
  evidence: EvidenceItem[];
}

export interface MarketPulsePortfolioRadarRow {
  ticker: string;
  company_name?: string;
  previous_close?: number;
  latest_price?: number;
  change?: number;
  change_pct?: number;
  direction: MarketPulseMoveDirection;
  reason?: string;
  evidence: EvidenceItem[];
}

export interface MarketPulseMarketBoardCard {
  label: string;
  value?: number;
  one_day_change?: number;
  one_day_change_pct?: number;
  five_day_change_pct?: number;
  direction: MarketPulseMoveDirection;
  sparkline?: number[];
  evidence: EvidenceItem[];
}

export interface MarketPulseCatalystItem {
  time_label?: string;
  title: string;
  category: MarketPulseCatalystCategory;
  impact: MarketPulseCatalystImpact;
  evidence: EvidenceItem[];
}

export interface MarketPulseSectorPulseItem {
  label: string;
  change_pct?: number;
  direction: MarketPulseMoveDirection;
  evidence: EvidenceItem[];
}

export interface MarketPulseMorningEdition {
  headline_digest: MarketPulseHeadlineItem[];
  portfolio_radar: MarketPulsePortfolioRadarRow[];
  market_board: MarketPulseMarketBoardCard[];
  today_catalysts: MarketPulseCatalystItem[];
  sector_pulse: MarketPulseSectorPulseItem[];
  coverage_notes: string[];
}

export const marketPulseMoveDirections = ["up", "down", "flat"] as const;

export const marketPulseHeadlineTopics = [
  "market",
  "macro",
  "company",
  "policy",
  "sector",
] as const;

export const marketPulseCatalystCategories = [
  "macro",
  "fed",
  "earnings",
  "company",
  "market",
] as const;

export const marketPulseCatalystImpacts = ["high", "medium", "low"] as const;

export interface MarketPulseSections {
  macro_stress: ReportSection;
  market_tape: ReportSection;
  official_macro_pressure: ReportSection;
  canonical_events: ReportSection;
  bounded_context: ReportSection;
  uncertainty_flags: ReportSection;
  what_changed?: ReportSection;
  why_it_matters?: ReportSection;
  what_to_watch?: ReportSection;
  signal_vs_noise?: ReportSection;
  macro_news?: ReportSection;
  market_board?: ReportSection;
  portfolio_radar?: ReportSection;
  today_catalysts?: ReportSection;
  headline_digest?: ReportSection;
  sector_pulse?: ReportSection;
  no_material_change?: ReportSection;
  market_moves?: ReportSection;
  macro_releases?: ReportSection;
  rates_fx_commodities?: ReportSection;
  news_summary?: ReportSection;
  watchlist_overlay?: ReportSection;
}

export interface MarketPulseReport {
  report_id: string;
  schema_version: string;
  generated_at: string;
  cycle_start: string;
  cycle_end: string;
  macro_stress: MacroStressSnapshot;
  market_tape?: MarketTapePack;
  editorial_issue?: MarketPulseEditorialIssue;
  brief_editorial?: MarketPulseBriefEditorial;
  editorial_generation?: MarketPulseEditorialGeneration;
  macro_news?: MarketPulseMacroNewsPack;
  morning_edition?: MarketPulseMorningEdition;
  context?: AnalysisReportEvidenceContext;
  structural_context?: StructuralContextPack;
  user_research_state?: UserResearchState;
  sections: MarketPulseSections;
  flags: string[];
  confidence: ConfidenceBlock;
}

export interface MarketPulseBriefEditorial {
  the_read?: string;
  what_changed_summary?: string;
  why_it_matters?: string;
  your_names_comment?: string;
  smart_comment?: string;
  morning_line?: string;
  yesterday_comment?: string;
  interesting_bit?: string;
  signal?: string;
  noise?: string;
  morning_story?: string;
  tape_color?: string;
  tape_narrative?: string;
  calendar_narrative?: string;
  headlines_narrative?: string;
  names_narrative?: string;
  one_thing?: string;
  mood?: "confident" | "cautious" | "curious" | "calm";
}

export const userResearchDeltaStates = [
  "unchanged",
  "new_event",
  "macro_context_changed",
  "thesis_freshness_changed",
  "coverage_changed",
  "needs_deep_dive_refresh",
] as const;

export type UserResearchDeltaState = (typeof userResearchDeltaStates)[number];

export const userResearchEvidenceKinds = [
  "report",
  "pulse",
  "monitor_snapshot",
  "market_tape",
  "macro_news",
  "structural_context",
  "calendar_event",
  "canonical_event",
  "headline",
  "holding",
  "watchlist",
] as const;

export type UserResearchEvidenceKind = (typeof userResearchEvidenceKinds)[number];

export const userResearchOmissionFamilies = [
  "watchlist",
  "holding",
  "deep_dive",
  "monitor_snapshot",
  "pulse",
  "market_tape",
  "macro_news",
  "structural_context",
  "calendar",
  "canonical_event",
] as const;

export type UserResearchOmissionFamily = (typeof userResearchOmissionFamilies)[number];

export interface UserResearchEvidenceRef {
  kind: UserResearchEvidenceKind;
  ref_id: string;
  label?: string;
  ticker?: string;
  captured_at?: string;
}

export interface UserResearchHolding {
  ticker: string;
  quantity?: number;
  cost_basis?: number;
  label?: string;
  notes?: string;
  updated_at: string;
}

export interface UserResearchDailyDelta {
  state: UserResearchDeltaState;
  title: string;
  body: string;
  evidence_refs: UserResearchEvidenceRef[];
}

export interface UserResearchOmission {
  family: UserResearchOmissionFamily;
  code: string;
  reason: string;
  ticker?: string;
}

export interface UserResearchNameState {
  ticker: string;
  company_name?: string;
  in_watchlist: boolean;
  holding?: UserResearchHolding;
  monitor_state?: ThesisMonitorState;
  freshness_state?: ThesisFreshnessState;
  latest_report_id?: string;
  latest_report_generated_at?: string;
  latest_pulse_id?: string;
  daily_delta: UserResearchDailyDelta;
  summary: string;
  what_changed: string;
  why_it_matters: string;
  what_to_watch: string;
  evidence_refs: UserResearchEvidenceRef[];
  omissions: UserResearchOmission[];
}

export interface UserResearchState {
  state_id: string;
  user_id: string;
  as_of: string;
  generated_at: string;
  prior_state_id?: string;
  watchlist_tickers: string[];
  holdings: UserResearchHolding[];
  names: UserResearchNameState[];
  omissions: UserResearchOmission[];
  evidence_refs: UserResearchEvidenceRef[];
}
