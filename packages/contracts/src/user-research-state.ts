import type { ThesisFreshnessState, ThesisMonitorState } from "./thesis-monitor-snapshot";

export const userResearchDeltaStates = [
  "unchanged",
  "new_event",
  "macro_context_changed",
  "thesis_freshness_changed",
  "coverage_changed",
  "needs_deep_dive_refresh"
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
  "watchlist"
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
  "canonical_event"
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

export const userResearchEvidenceRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "ref_id"],
  properties: {
    kind: { enum: userResearchEvidenceKinds },
    ref_id: { type: "string" },
    label: { type: "string" },
    ticker: { type: "string" },
    captured_at: { type: "string" }
  }
} as const;

export const userResearchHoldingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticker", "updated_at"],
  properties: {
    ticker: { type: "string" },
    quantity: { type: "number" },
    cost_basis: { type: "number" },
    label: { type: "string" },
    notes: { type: "string" },
    updated_at: { type: "string" }
  }
} as const;

export const userResearchDailyDeltaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["state", "title", "body", "evidence_refs"],
  properties: {
    state: { enum: userResearchDeltaStates },
    title: { type: "string" },
    body: { type: "string" },
    evidence_refs: {
      type: "array",
      items: userResearchEvidenceRefSchema
    }
  }
} as const;

export const userResearchOmissionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["family", "code", "reason"],
  properties: {
    family: { enum: userResearchOmissionFamilies },
    code: { type: "string" },
    reason: { type: "string" },
    ticker: { type: "string" }
  }
} as const;

export const userResearchNameStateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "ticker",
    "in_watchlist",
    "daily_delta",
    "summary",
    "what_changed",
    "why_it_matters",
    "what_to_watch",
    "evidence_refs",
    "omissions"
  ],
  properties: {
    ticker: { type: "string" },
    company_name: { type: "string" },
    in_watchlist: { type: "boolean" },
    holding: userResearchHoldingSchema,
    monitor_state: {
      enum: ["intact", "improved", "weakened", "unresolved"]
    },
    freshness_state: {
      enum: ["current", "aging", "stale", "triggered"]
    },
    latest_report_id: { type: "string" },
    latest_report_generated_at: { type: "string" },
    latest_pulse_id: { type: "string" },
    daily_delta: userResearchDailyDeltaSchema,
    summary: { type: "string" },
    what_changed: { type: "string" },
    why_it_matters: { type: "string" },
    what_to_watch: { type: "string" },
    evidence_refs: {
      type: "array",
      items: userResearchEvidenceRefSchema
    },
    omissions: {
      type: "array",
      items: userResearchOmissionSchema
    }
  }
} as const;

export const userResearchStateSchema = {
  $id: "UserResearchState",
  type: "object",
  additionalProperties: false,
  required: [
    "state_id",
    "user_id",
    "as_of",
    "generated_at",
    "watchlist_tickers",
    "holdings",
    "names",
    "omissions",
    "evidence_refs"
  ],
  properties: {
    state_id: { type: "string" },
    user_id: { type: "string" },
    as_of: { type: "string" },
    generated_at: { type: "string" },
    prior_state_id: { type: "string" },
    watchlist_tickers: {
      type: "array",
      items: { type: "string" }
    },
    holdings: {
      type: "array",
      items: userResearchHoldingSchema
    },
    names: {
      type: "array",
      items: userResearchNameStateSchema
    },
    omissions: {
      type: "array",
      items: userResearchOmissionSchema
    },
    evidence_refs: {
      type: "array",
      items: userResearchEvidenceRefSchema
    }
  }
} as const;

