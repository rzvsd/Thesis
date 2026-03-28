export type FearGreedLabel =
  | "extreme_fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme_greed";

export interface FearGreedSubScore {
  input_name: string;
  provider: string;
  available: boolean;
  weight: number;
  normalized_score?: number;
  raw_value?: number;
  retrieved_at?: string;
  notes?: string;
}

export interface FearGreedSnapshot {
  id: string;
  market_date: string;
  score: number;
  label: FearGreedLabel;
  sub_scores: FearGreedSubScore[];
  missing_inputs: string[];
  calculated_at: string;
}

export const fearGreedSubScoreSchema = {
  $id: "FearGreedSubScore",
  type: "object",
  additionalProperties: false,
  required: ["input_name", "provider", "available", "weight"],
  properties: {
    input_name: { type: "string" },
    provider: { type: "string" },
    available: { type: "boolean" },
    weight: { type: "number", minimum: 0, maximum: 1 },
    normalized_score: { type: "number", minimum: 0, maximum: 100 },
    raw_value: { type: "number" },
    retrieved_at: { type: "string", format: "date-time" },
    notes: { type: "string" }
  }
} as const;

export const fearGreedSnapshotSchema = {
  $id: "FearGreedSnapshot",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "market_date",
    "score",
    "label",
    "sub_scores",
    "missing_inputs",
    "calculated_at"
  ],
  properties: {
    id: { type: "string" },
    market_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    score: { type: "number", minimum: 0, maximum: 100 },
    label: {
      type: "string",
      enum: ["extreme_fear", "fear", "neutral", "greed", "extreme_greed"]
    },
    sub_scores: {
      type: "array",
      items: fearGreedSubScoreSchema
    },
    missing_inputs: {
      type: "array",
      items: { type: "string" }
    },
    calculated_at: { type: "string", format: "date-time" }
  }
} as const;
