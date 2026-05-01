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
  "llm"
] as const;

export const marketPulseEditorialGenerationStatuses = [
  "generated",
  "disabled",
  "unavailable",
  "rejected"
] as const;

export const marketPulseEditorialGenerationSchema = {
  $id: "MarketPulseEditorialGeneration",
  type: "object",
  additionalProperties: false,
  required: ["mode", "status", "coverage_notes"],
  properties: {
    mode: { enum: marketPulseEditorialGenerationModes },
    status: { enum: marketPulseEditorialGenerationStatuses },
    provider: { enum: ["openrouter"] },
    model: { type: "string" },
    prompt_version: { type: "string" },
    generated_at: { type: "string" },
    source_report_id: { type: "string" },
    coverage_notes: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
