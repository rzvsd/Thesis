import type { ContrarianSignalValue } from "./contrarian-alert-anchor";

export const killSwitchSignalTypes = [
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
] as const;

export type KillSwitchSignalType = (typeof killSwitchSignalTypes)[number];

export const killSwitchDirections = [
  "against_signal",
  "above",
  "below",
  "any"
] as const;

export type KillSwitchDirection = (typeof killSwitchDirections)[number];

export const killSwitchThresholdUnits = ["pct", "count", "score", "days"] as const;

export type KillSwitchThresholdUnit = (typeof killSwitchThresholdUnits)[number];

export const killSwitchRuleStates = ["active", "inactive"] as const;

export type KillSwitchRuleState = (typeof killSwitchRuleStates)[number];

export const killSwitchRuleSources = ["dexter_prompt", "fallback"] as const;

export type KillSwitchRuleSource = (typeof killSwitchRuleSources)[number];

export interface KillSwitchConditionDraft {
  condition_id: string;
  condition_text: string;
  signal_type: KillSwitchSignalType;
  rationale: string;
  threshold_value?: number;
  threshold_unit?: KillSwitchThresholdUnit;
  direction?: KillSwitchDirection;
  prompt_version?: string;
}

export interface KillSwitchRuleItem {
  id: string;
  user_id: string;
  ticker: string;
  report_id?: string;
  signal_value?: ContrarianSignalValue;
  anchor_price?: number;
  condition: KillSwitchConditionDraft;
  state: KillSwitchRuleState;
  source: KillSwitchRuleSource;
  created_at: string;
  updated_at: string;
  deactivated_at?: string;
}

export const killSwitchEvaluationOutcomes = [
  "matched",
  "not_matched",
  "skipped",
  "error"
] as const;

export type KillSwitchEvaluationOutcome = (typeof killSwitchEvaluationOutcomes)[number];

export const killSwitchEvaluationSignalSources = ["daily", "event"] as const;

export type KillSwitchEvaluationSignalSource =
  (typeof killSwitchEvaluationSignalSources)[number];

export interface KillSwitchEvaluationFixture {
  ticker: string;
  signal_type: KillSwitchSignalType;
  value?: number;
  reason_text?: string;
  metadata?: Record<string, string>;
}

export interface KillSwitchEvaluationRequest {
  as_of?: string;
  signal_source?: KillSwitchEvaluationSignalSource;
  trigger_key?: string;
  fixtures?: KillSwitchEvaluationFixture[];
}

export interface KillSwitchEvaluationItem {
  id: string;
  rule_id: string;
  user_id: string;
  ticker: string;
  signal_source: KillSwitchEvaluationSignalSource;
  trigger_key: string;
  outcome: KillSwitchEvaluationOutcome;
  reason_code: string;
  reason_text: string;
  observed_value?: number;
  alert_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KillSwitchEvaluationResponse {
  status: "ok";
  as_of: string;
  signal_source: KillSwitchEvaluationSignalSource;
  trigger_key: string;
  evaluated: number;
  matched: number;
  skipped: number;
  attempted: number;
  delivered: number;
  failed: number;
}

export const killSwitchConditionDraftSchema = {
  $id: "KillSwitchConditionDraft",
  type: "object",
  additionalProperties: false,
  required: [
    "condition_id",
    "condition_text",
    "signal_type",
    "rationale"
  ],
  properties: {
    condition_id: { type: "string", minLength: 1 },
    condition_text: { type: "string", minLength: 1 },
    signal_type: { type: "string", enum: killSwitchSignalTypes },
    rationale: { type: "string", minLength: 1 },
    threshold_value: { type: "number" },
    threshold_unit: { type: "string", enum: killSwitchThresholdUnits },
    direction: { type: "string", enum: killSwitchDirections },
    prompt_version: { type: "string", minLength: 1 }
  }
} as const;

export const killSwitchRuleItemSchema = {
  $id: "KillSwitchRuleItem",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "user_id",
    "ticker",
    "condition",
    "state",
    "source",
    "created_at",
    "updated_at"
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    report_id: { type: "string", minLength: 1 },
    signal_value: { type: "string", enum: ["positive", "neutral", "negative"] },
    anchor_price: { type: "number" },
    condition: { $ref: "KillSwitchConditionDraft" },
    state: { type: "string", enum: killSwitchRuleStates },
    source: { type: "string", enum: killSwitchRuleSources },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    deactivated_at: { type: "string", format: "date-time" }
  }
} as const;

export const killSwitchEvaluationFixtureSchema = {
  $id: "KillSwitchEvaluationFixture",
  type: "object",
  additionalProperties: false,
  required: ["ticker", "signal_type"],
  properties: {
    ticker: { type: "string", minLength: 1 },
    signal_type: { type: "string", enum: killSwitchSignalTypes },
    value: { type: "number" },
    reason_text: { type: "string", minLength: 1 },
    metadata: {
      type: "object",
      additionalProperties: { type: "string" }
    }
  }
} as const;

export const killSwitchEvaluationRequestSchema = {
  $id: "KillSwitchEvaluationRequest",
  type: "object",
  additionalProperties: false,
  properties: {
    as_of: { type: "string", format: "date" },
    signal_source: { type: "string", enum: killSwitchEvaluationSignalSources },
    trigger_key: { type: "string", minLength: 1 },
    fixtures: {
      type: "array",
      items: killSwitchEvaluationFixtureSchema
    }
  }
} as const;

export const killSwitchEvaluationItemSchema = {
  $id: "KillSwitchEvaluationItem",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "rule_id",
    "user_id",
    "ticker",
    "signal_source",
    "trigger_key",
    "outcome",
    "reason_code",
    "reason_text",
    "created_at",
    "updated_at"
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    rule_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    signal_source: { type: "string", enum: killSwitchEvaluationSignalSources },
    trigger_key: { type: "string", minLength: 1 },
    outcome: { type: "string", enum: killSwitchEvaluationOutcomes },
    reason_code: { type: "string", minLength: 1 },
    reason_text: { type: "string", minLength: 1 },
    observed_value: { type: "number" },
    alert_id: { type: "string", minLength: 1 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

