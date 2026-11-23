// Contract types the Pulse build needs, copied from packages/contracts/src (types only, no JSON schemas).
// Part 1: evidence, sections, official sources, canonical events, first-party context, tape, structural, macro.

export const evidenceRightsClasses = [
  "official_public",
  "first_party_public",
  "licensed",
  "user_provided",
  "unknown",
  "prohibited",
] as const;

export type EvidenceRightsClass = (typeof evidenceRightsClasses)[number];

export const evidenceDisplayModes = [
  "full_text_allowed",
  "excerpt_only",
  "headline_only",
  "link_only",
  "internal_only_not_user_visible",
] as const;

export type EvidenceDisplayMode = (typeof evidenceDisplayModes)[number];

export const evidenceSourceRanks = [
  "official",
  "first_party",
  "allowlisted_context",
  "third_party",
  "unknown",
] as const;

export type EvidenceSourceRank = (typeof evidenceSourceRanks)[number];

export interface EvidenceRightsMetadata {
  rights_class: EvidenceRightsClass;
  display_mode: EvidenceDisplayMode;
  source_rank: EvidenceSourceRank;
  source_type: string;
  can_store_full_text: boolean;
  can_display_excerpt: boolean;
  can_display_link: boolean;
  policy_reason: string;
  reviewed_at: string;
  review_expires_at?: string;
}

export type EvidenceSourceType =
  | "filing"
  | "article"
  | "financial_data"
  | "macro_data";

export interface EvidenceItem {
  evidence_id: string;
  source_type: EvidenceSourceType;
  source_name: string;
  excerpt: string;
  retrieved_at: string;
  url?: string;
}

export type ReportSectionStatus =
  | "complete"
  | "data_incomplete"
  | "data_unavailable"
  | "failed";

export interface ReportSection {
  section_id: string;
  title: string;
  body: string;
  status: ReportSectionStatus;
  evidence: EvidenceItem[];
}

export const officialSourceFamilies = [
  "sec_edgar",
  "treasury",
  "bls",
  "bea",
  "eia",
  "fred",
  "world_bank",
  "imf",
] as const;

export type OfficialSourceFamily = (typeof officialSourceFamilies)[number];

export const officialRetrievalStatuses = [
  "fresh",
  "partial",
  "stale",
  "unavailable",
] as const;

export type OfficialRetrievalStatus = (typeof officialRetrievalStatuses)[number];

export const officialMissingFieldReasons = [
  "not_reported",
  "not_applicable",
  "source_unavailable",
  "parser_unsupported",
  "outside_seed_scope",
] as const;

export type OfficialMissingFieldReason = (typeof officialMissingFieldReasons)[number];

export interface OfficialSourceReference {
  source_id: string;
  source_family: OfficialSourceFamily;
  source_name: string;
  source_url: string;
  agency: string;
  agency_series_id?: string;
}

export interface OfficialRetrievalMetadata {
  source: OfficialSourceReference;
  retrieved_at: string;
  retrieval_status: OfficialRetrievalStatus;
  source_period?: string;
  source_revision?: string;
}

export interface OfficialMissingFieldState {
  field: string;
  reason: OfficialMissingFieldReason;
  source_id?: string;
  message: string;
}

export const canonicalEventFamilies = [
  "filing_posted",
  "macro_release_published",
] as const;

export type CanonicalEventFamily = (typeof canonicalEventFamilies)[number];

export const canonicalEventSourceStates = [
  "official",
  "partial",
  "missing",
] as const;

export type CanonicalEventSourceState = (typeof canonicalEventSourceStates)[number];

export interface CanonicalEvent {
  id: string;
  family: CanonicalEventFamily;
  subject_type: "ticker" | "macro_series";
  subject_id: string;
  title: string;
  occurred_at: string;
  source_state: CanonicalEventSourceState;
  source: OfficialRetrievalMetadata;
  retrieved_at: string;
  missing_fields: OfficialMissingFieldState[];
  metadata: Record<string, unknown>;
}

export const firstPartyPageTypes = [
  "investor_relations",
  "earnings_release",
  "press_release",
  "presentation",
  "webcast",
  "sec_filing_reference",
  "supplemental_material",
  "newsroom",
] as const;

export type FirstPartyPageType = (typeof firstPartyPageTypes)[number];

export const firstPartyFetchStates = [
  "fetched",
  "rejected_unapproved_domain",
  "rejected_undefined_rights",
  "source_unavailable",
  "parser_unsupported",
  "skipped_outside_policy",
] as const;

export type FirstPartyContextFetchState = (typeof firstPartyFetchStates)[number];

export interface FirstPartySourceRegistryEntry {
  registry_entry_id: string;
  ticker: string;
  issuer_name: string;
  domain: string;
  allowed_paths: string[];
  page_types: FirstPartyPageType[];
  default_rights: EvidenceRightsMetadata;
  owner: string;
  reviewed_at: string;
  review_expires_at?: string;
  active: boolean;
}

export interface FirstPartyContextItem {
  context_id: string;
  ticker: string;
  event_id?: string;
  registry_entry_id: string;
  source_url: string;
  source_domain: string;
  page_type: FirstPartyPageType;
  title: string;
  summary: string;
  excerpt?: string;
  retrieved_at: string;
  published_at?: string;
  content_hash: string;
  fetch_state: FirstPartyContextFetchState;
  rights: EvidenceRightsMetadata;
  artifact_ids: string[];
  metadata: Record<string, unknown>;
}

export const marketTapeCoverageStates = ["full", "partial", "limited"] as const;

export type MarketTapeCoverageState = (typeof marketTapeCoverageStates)[number];

export const marketTapeDirections = ["up", "down", "flat"] as const;

export type MarketTapeDirection = (typeof marketTapeDirections)[number];

export const marketTapeInstrumentFamilies = [
  "core_index",
  "volatility",
  "rates",
  "commodity",
  "currency",
  "credit",
  "sector",
] as const;

export type MarketTapeInstrumentFamily = (typeof marketTapeInstrumentFamilies)[number];

export interface MarketTapeMove {
  instrument_id: string;
  label: string;
  family: MarketTapeInstrumentFamily;
  period: string;
  value?: number;
  previous_value?: number;
  daily_change?: number;
  daily_change_pct?: number;
  unit?: string;
  direction: MarketTapeDirection;
  retrieval: OfficialRetrievalMetadata;
  missing_fields: Array<Record<string, unknown>>;
}

export interface MarketTapeSectorLeadership {
  basket_id: string;
  leaders: MarketTapeMove[];
  laggards: MarketTapeMove[];
  spread_pct?: number;
  notable: boolean;
  note?: string;
}

export interface MarketTapePack {
  as_of: string;
  coverage_state: MarketTapeCoverageState;
  summary: string;
  indices: MarketTapeMove[];
  sector_leadership?: MarketTapeSectorLeadership;
  cross_asset: MarketTapeMove[];
  retrievals: OfficialRetrievalMetadata[];
  omissions: Array<{
    omission_id: string;
    family: MarketTapeInstrumentFamily | "registry";
    instrument_id?: string;
    reason_code: string;
    reason_text: string;
    blocking: boolean;
  }>;
}

export const structuralContextCoverageStates = ["full", "partial", "limited"] as const;

export type StructuralContextCoverageState = (typeof structuralContextCoverageStates)[number];

export const structuralContextSubjectTypes = ["issuer", "market_pulse"] as const;

export type StructuralContextSubjectType = (typeof structuralContextSubjectTypes)[number];

export const structuralContextFamilies = [
  "gdp_level",
  "gdp_per_capita",
  "population",
  "trade_openness",
  "debt_context",
  "inequality",
  "logistics",
  "infrastructure",
  "education",
  "energy_access",
  "sector_mix",
  "gdp_growth_outlook",
  "inflation_regime",
  "fiscal_balance",
  "public_debt",
  "fx_reserves",
  "current_account",
] as const;

export type StructuralContextFamily = (typeof structuralContextFamilies)[number];

export interface StructuralContextIssuerMetadata {
  name?: string;
  exchange?: string;
  currency?: string;
  domicile_country?: string;
  region?: string;
  sector?: string;
  industry?: string;
}

export interface StructuralContextObservation {
  observation_id: string;
  family: StructuralContextFamily;
  label: string;
  summary: string;
  geography: string;
  period: string;
  source_family: OfficialSourceFamily;
  retrieval: OfficialRetrievalMetadata;
  missing_fields: Array<Record<string, unknown>>;
  value?: number;
  unit?: string;
}

export interface StructuralContextOmission {
  omission_id: string;
  family: StructuralContextFamily | "registry";
  source_family: OfficialSourceFamily;
  reason_code: string;
  reason_text: string;
  blocking: boolean;
}

export interface StructuralContextPack {
  subject_type: StructuralContextSubjectType;
  subject_id: string;
  as_of: string;
  coverage_state: StructuralContextCoverageState;
  summary: string;
  issuer_metadata?: StructuralContextIssuerMetadata;
  observations: StructuralContextObservation[];
  omissions: StructuralContextOmission[];
  retrievals: OfficialRetrievalMetadata[];
}

export const macroStressStates = [
  "stable",
  "mixed",
  "elevated",
  "insufficient_data",
] as const;

export type MacroStressState = (typeof macroStressStates)[number];

export const macroStressPressureLevels = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type MacroStressPressureLevel = (typeof macroStressPressureLevels)[number];

export const macroStressCategories = [
  "rates",
  "inflation",
  "labor",
  "growth",
  "energy",
] as const;

export type MacroStressCategory = (typeof macroStressCategories)[number];

export const macroStressSourceStates = [
  "official",
  "partial",
  "missing",
] as const;

export type MacroStressSourceState = (typeof macroStressSourceStates)[number];

export interface MacroStressInput {
  registry_id: string;
  label: string;
  category: MacroStressCategory;
  pressure: MacroStressPressureLevel;
  source_state: MacroStressSourceState;
  value?: number;
  unit?: string;
  period?: string;
  reason: string;
  source_name?: string;
  retrieved_at?: string;
}

export interface MacroStressOmission {
  registry_id: string;
  reason_code: string;
  reason_text: string;
}

export interface MacroStressSnapshot {
  snapshot_id: string;
  as_of: string;
  generated_at: string;
  state: MacroStressState;
  summary: string;
  no_material_change: boolean;
  inputs: MacroStressInput[];
  omissions: MacroStressOmission[];
}

export const analysisReportSourceStates = [
  "official",
  "bounded_context",
  "partial",
  "missing",
] as const;

export type AnalysisReportSourceState = (typeof analysisReportSourceStates)[number];

export interface AnalysisReportOmission {
  omission_code: string;
  omission_text: string;
  affects_sections: string[];
}

export interface AnalysisReportEvidenceContext {
  source_state: AnalysisReportSourceState;
  generated_at: string;
  rights: EvidenceRightsMetadata[];
  omissions: AnalysisReportOmission[];
}

export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient_data";

export interface ConfidenceBlock {
  score: number;
  label: ConfidenceLabel;
  limiting_factors: string[];
}

export const thesisMonitorStates = ["intact", "improved", "weakened", "unresolved"] as const;
export type ThesisMonitorState = (typeof thesisMonitorStates)[number];
export const thesisFreshnessStates = ["current", "aging", "stale", "triggered"] as const;
export type ThesisFreshnessState = (typeof thesisFreshnessStates)[number];
