export interface CanonicalMacroData {
  indicator: string;
  value: number;
  unit: string;
  period: string;
  provider: string;
  retrieved_at: string;
  category?: string;
  missing_fields: string[];
}

export const canonicalMacroDataSchema = {
  $id: "CanonicalMacroData",
  type: "object",
  additionalProperties: false,
  required: [
    "indicator",
    "value",
    "unit",
    "period",
    "provider",
    "retrieved_at",
    "missing_fields"
  ],
  properties: {
    indicator: { type: "string" },
    value: { type: "number" },
    unit: { type: "string" },
    period: { type: "string" },
    provider: { type: "string" },
    retrieved_at: { type: "string" },
    category: { type: "string" },
    missing_fields: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
