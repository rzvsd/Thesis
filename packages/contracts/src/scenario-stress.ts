import type { KillSwitchDirection, KillSwitchSignalType } from "./kill-switch-rule";

export const scenarioStressTemplateIds = [
  "rates_higher_for_longer",
  "recession_in_6m",
  "usd_up_10",
  "ai_hype_burst",
  "oil_120_spike"
] as const;

export type ScenarioStressTemplateId = (typeof scenarioStressTemplateIds)[number];

export const scenarioStressRunModes = ["manual"] as const;

export type ScenarioStressRunMode = (typeof scenarioStressRunModes)[number];

export const scenarioStressRunStatuses = ["completed", "degraded", "failed"] as const;

export type ScenarioStressRunStatus = (typeof scenarioStressRunStatuses)[number];

export const scenarioStressImpactLevels = [
  "none",
  "watch",
  "elevated",
  "high",
  "critical"
] as const;

export type ScenarioStressImpactLevel = (typeof scenarioStressImpactLevels)[number];

export const scenarioStressThesisBreakLikelihoods = [
  "low",
  "moderate",
  "high",
  "very_high"
] as const;

export type ScenarioStressThesisBreakLikelihood =
  (typeof scenarioStressThesisBreakLikelihoods)[number];

export interface ScenarioStressRouteTarget {
  open_tab: "research";
  scenario_id: ScenarioStressTemplateId;
  scenario_run_id: string;
  ticker?: string;
  rule_id?: string;
}

export interface ScenarioStressTemplate {
  scenario_id: ScenarioStressTemplateId;
  title: string;
  summary: string;
  hypothesis: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScenarioStressTemplateListResponse {
  data: ScenarioStressTemplate[];
}

export interface ScenarioStressRunRequest {
  scenario_id: ScenarioStressTemplateId;
  as_of?: string;
}

export interface ScenarioStressRunHeader {
  scenario_run_id: string;
  scenario_id: ScenarioStressTemplateId;
  user_id: string;
  status: ScenarioStressRunStatus;
  run_mode: ScenarioStressRunMode;
  as_of: string;
  total_names: number;
  impacted_names: number;
  critical_names: number;
  summary: string;
  route: ScenarioStressRouteTarget;
  created_at: string;
  completed_at: string;
}

export interface ScenarioStressImpact {
  scenario_impact_id: string;
  scenario_run_id: string;
  user_id: string;
  ticker: string;
  impact_level: ScenarioStressImpactLevel;
  thesis_break_likelihood: ScenarioStressThesisBreakLikelihood;
  stress_score: number;
  rationale: string;
  evidence_refs: string[];
  route: ScenarioStressRouteTarget;
  created_at: string;
}

export interface ScenarioStressRuleSuggestion {
  scenario_rule_suggestion_id: string;
  scenario_run_id: string;
  user_id: string;
  ticker: string;
  signal_type: KillSwitchSignalType;
  direction: KillSwitchDirection;
  condition_text: string;
  rationale: string;
  confidence: number;
  route: ScenarioStressRouteTarget;
  created_at: string;
}

export interface ScenarioStressRunDetail {
  run: ScenarioStressRunHeader;
  impacts: ScenarioStressImpact[];
  rule_suggestions: ScenarioStressRuleSuggestion[];
}

export interface ScenarioStressRunResponse {
  data: ScenarioStressRunDetail;
}

export const scenarioStressRouteTargetSchema = {
  $id: "ScenarioStressRouteTarget",
  type: "object",
  additionalProperties: false,
  required: ["open_tab", "scenario_id", "scenario_run_id"],
  properties: {
    open_tab: { type: "string", enum: ["research"] },
    scenario_id: { type: "string", enum: scenarioStressTemplateIds },
    scenario_run_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    rule_id: { type: "string", minLength: 1 }
  }
} as const;

export const scenarioStressTemplateSchema = {
  $id: "ScenarioStressTemplate",
  type: "object",
  additionalProperties: false,
  required: [
    "scenario_id",
    "title",
    "summary",
    "hypothesis",
    "active",
    "created_at",
    "updated_at"
  ],
  properties: {
    scenario_id: { type: "string", enum: scenarioStressTemplateIds },
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    hypothesis: { type: "string", minLength: 1 },
    active: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const scenarioStressRunRequestSchema = {
  $id: "ScenarioStressRunRequest",
  type: "object",
  additionalProperties: false,
  required: ["scenario_id"],
  properties: {
    scenario_id: { type: "string", enum: scenarioStressTemplateIds },
    as_of: { type: "string", format: "date" }
  }
} as const;

export const scenarioStressRunHeaderSchema = {
  $id: "ScenarioStressRunHeader",
  type: "object",
  additionalProperties: false,
  required: [
    "scenario_run_id",
    "scenario_id",
    "user_id",
    "status",
    "run_mode",
    "as_of",
    "total_names",
    "impacted_names",
    "critical_names",
    "summary",
    "route",
    "created_at",
    "completed_at"
  ],
  properties: {
    scenario_run_id: { type: "string", minLength: 1 },
    scenario_id: { type: "string", enum: scenarioStressTemplateIds },
    user_id: { type: "string", minLength: 1 },
    status: { type: "string", enum: scenarioStressRunStatuses },
    run_mode: { type: "string", enum: scenarioStressRunModes },
    as_of: { type: "string", format: "date" },
    total_names: { type: "integer", minimum: 0 },
    impacted_names: { type: "integer", minimum: 0 },
    critical_names: { type: "integer", minimum: 0 },
    summary: { type: "string", minLength: 1 },
    route: { $ref: "ScenarioStressRouteTarget" },
    created_at: { type: "string", format: "date-time" },
    completed_at: { type: "string", format: "date-time" }
  }
} as const;

export const scenarioStressImpactSchema = {
  $id: "ScenarioStressImpact",
  type: "object",
  additionalProperties: false,
  required: [
    "scenario_impact_id",
    "scenario_run_id",
    "user_id",
    "ticker",
    "impact_level",
    "thesis_break_likelihood",
    "stress_score",
    "rationale",
    "evidence_refs",
    "route",
    "created_at"
  ],
  properties: {
    scenario_impact_id: { type: "string", minLength: 1 },
    scenario_run_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    impact_level: { type: "string", enum: scenarioStressImpactLevels },
    thesis_break_likelihood: {
      type: "string",
      enum: scenarioStressThesisBreakLikelihoods
    },
    stress_score: { type: "number", minimum: 0, maximum: 1 },
    rationale: { type: "string", minLength: 1 },
    evidence_refs: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    route: { $ref: "ScenarioStressRouteTarget" },
    created_at: { type: "string", format: "date-time" }
  }
} as const;

export const scenarioStressRuleSuggestionSchema = {
  $id: "ScenarioStressRuleSuggestion",
  type: "object",
  additionalProperties: false,
  required: [
    "scenario_rule_suggestion_id",
    "scenario_run_id",
    "user_id",
    "ticker",
    "signal_type",
    "direction",
    "condition_text",
    "rationale",
    "confidence",
    "route",
    "created_at"
  ],
  properties: {
    scenario_rule_suggestion_id: { type: "string", minLength: 1 },
    scenario_run_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    signal_type: {
      type: "string",
      enum: [
        "price_move_pct",
        "thesis_state",
        "earnings_event",
        "sec_filing",
        "guidance_revision",
        "management_change",
        "macro_regime",
        "analyst_rerating",
        "news_sentiment",
        "custom"
      ]
    },
    direction: { type: "string", enum: ["against_signal", "above", "below", "any"] },
    condition_text: { type: "string", minLength: 1 },
    rationale: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    route: { $ref: "ScenarioStressRouteTarget" },
    created_at: { type: "string", format: "date-time" }
  }
} as const;
