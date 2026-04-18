import type { ValuationAssumptions } from "./analysis-report";

export interface ScenarioOverrides {
  terminal_growth_rate?: number;
  wacc?: number;
  projection_years?: number;
}

export interface ScenarioRequest {
  overrides: ScenarioOverrides;
}

export interface ScenarioInputOmission {
  omission_code: string;
  omission_text: string;
  affects_fields: string[];
}

export interface ScenarioValuationSnapshot {
  fair_value_mid?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  spot_price?: number;
  implied_upside_pct?: number;
  assumptions: ValuationAssumptions;
  degraded_reason?: string;
  omissions?: ScenarioInputOmission[];
}

export interface ScenarioResponse {
  report_id: string;
  deterministic_model: "phase6_deterministic_v1";
  base: ScenarioValuationSnapshot;
  scenario: ScenarioValuationSnapshot;
  omissions: ScenarioInputOmission[];
}

export const scenarioRequestSchema = {
  $id: "ScenarioRequest",
  type: "object",
  additionalProperties: false,
  required: ["overrides"],
  properties: {
    overrides: {
      type: "object",
      additionalProperties: false,
      properties: {
        terminal_growth_rate: { type: "number" },
        wacc: { type: "number" },
        projection_years: { type: "number" }
      }
    }
  }
} as const;

