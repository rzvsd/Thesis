export const thesisMonitorStates = [
  "intact",
  "improved",
  "weakened",
  "unresolved"
] as const;

export type ThesisMonitorState = (typeof thesisMonitorStates)[number];

export const thesisFreshnessStates = [
  "current",
  "aging",
  "stale",
  "triggered"
] as const;

export type ThesisFreshnessState = (typeof thesisFreshnessStates)[number];

export interface ThesisMonitorSnapshot {
  user_id: string;
  ticker: string;
  state: ThesisMonitorState;
  reason: string;
  score: number;
  report_id?: string;
  report_generated_at?: string;
  report_schema_version?: string;
  last_deep_dive_at?: string;
  material_events_count: number;
  unreviewed_events_count: number;
  freshness_state: ThesisFreshnessState;
  freshness_score: number;
  kill_switch_triggered_at?: string;
  freshness_reason: string;
  updated_at: string;
}

export const thesisMonitorSnapshotSchema = {
  $id: "ThesisMonitorSnapshot",
  type: "object",
  additionalProperties: false,
  required: [
    "user_id",
    "ticker",
    "state",
    "reason",
    "score",
    "material_events_count",
    "unreviewed_events_count",
    "freshness_state",
    "freshness_score",
    "freshness_reason",
    "updated_at"
  ],
  properties: {
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    state: {
      type: "string",
      enum: [...thesisMonitorStates]
    },
    reason: { type: "string", minLength: 1 },
    score: { type: "number", minimum: 0, maximum: 1 },
    report_id: { type: "string", minLength: 1 },
    report_generated_at: { type: "string", format: "date-time" },
    report_schema_version: { type: "string", minLength: 1 },
    last_deep_dive_at: { type: "string", format: "date-time" },
    material_events_count: { type: "integer", minimum: 0 },
    unreviewed_events_count: { type: "integer", minimum: 0 },
    freshness_state: {
      type: "string",
      enum: [...thesisFreshnessStates]
    },
    freshness_score: { type: "number", minimum: 0, maximum: 1 },
    kill_switch_triggered_at: { type: "string", format: "date-time" },
    freshness_reason: { type: "string", minLength: 1 },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;
