export const macroStressStates = [
  "stable",
  "mixed",
  "elevated",
  "insufficient_data"
] as const;

export type MacroStressState = (typeof macroStressStates)[number];

export const macroStressPressureLevels = [
  "low",
  "medium",
  "high",
  "unknown"
] as const;

export type MacroStressPressureLevel = (typeof macroStressPressureLevels)[number];

export const macroStressCategories = [
  "rates",
  "inflation",
  "labor",
  "growth",
  "energy"
] as const;

export type MacroStressCategory = (typeof macroStressCategories)[number];

export const macroStressSourceStates = [
  "official",
  "partial",
  "missing"
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

export const macroStressInputSchema = {
  $id: "MacroStressInput",
  type: "object",
  additionalProperties: false,
  required: [
    "registry_id",
    "label",
    "category",
    "pressure",
    "source_state",
    "reason"
  ],
  properties: {
    registry_id: { type: "string", minLength: 1 },
    label: { type: "string", minLength: 1 },
    category: {
      type: "string",
      enum: macroStressCategories
    },
    pressure: {
      type: "string",
      enum: macroStressPressureLevels
    },
    source_state: {
      type: "string",
      enum: macroStressSourceStates
    },
    value: { type: "number" },
    unit: { type: "string" },
    period: { type: "string" },
    reason: { type: "string", minLength: 1 },
    source_name: { type: "string" },
    retrieved_at: { type: "string", format: "date-time" }
  }
} as const;

export const macroStressOmissionSchema = {
  $id: "MacroStressOmission",
  type: "object",
  additionalProperties: false,
  required: ["registry_id", "reason_code", "reason_text"],
  properties: {
    registry_id: { type: "string", minLength: 1 },
    reason_code: { type: "string", minLength: 1 },
    reason_text: { type: "string", minLength: 1 }
  }
} as const;

export const macroStressSnapshotSchema = {
  $id: "MacroStressSnapshot",
  type: "object",
  additionalProperties: false,
  required: [
    "snapshot_id",
    "as_of",
    "generated_at",
    "state",
    "summary",
    "no_material_change",
    "inputs",
    "omissions"
  ],
  properties: {
    snapshot_id: { type: "string", minLength: 1 },
    as_of: { type: "string", format: "date" },
    generated_at: { type: "string", format: "date-time" },
    state: {
      type: "string",
      enum: macroStressStates
    },
    summary: { type: "string", minLength: 1 },
    no_material_change: { type: "boolean" },
    inputs: {
      type: "array",
      items: { $ref: "MacroStressInput" }
    },
    omissions: {
      type: "array",
      items: { $ref: "MacroStressOmission" }
    }
  }
} as const;
