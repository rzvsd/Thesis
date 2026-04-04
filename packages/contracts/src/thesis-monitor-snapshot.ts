export const thesisMonitorStates = [
  "intact",
  "improved",
  "weakened",
  "unresolved"
] as const;

export type ThesisMonitorState = (typeof thesisMonitorStates)[number];

export interface ThesisMonitorSnapshot {
  user_id: string;
  ticker: string;
  state: ThesisMonitorState;
  reason: string;
  score: number;
  report_id?: string;
  report_generated_at?: string;
  report_schema_version?: string;
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
    updated_at: { type: "string", format: "date-time" }
  }
} as const;
