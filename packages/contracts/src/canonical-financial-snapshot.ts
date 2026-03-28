export type SnapshotPeriodType = "quarterly" | "annual";

export interface FinancialSegment {
  segment_name: string;
  revenue?: number;
  operating_income?: number;
  [key: string]: string | number | undefined;
}

export interface AnalystEstimates {
  revenue_estimate?: number;
  eps_estimate?: number;
  revenue_beat?: number;
  eps_beat?: number;
  revenue_beat_pct?: number;
  eps_beat_pct?: number;
  num_analysts?: number;
}

export interface GuidanceSnapshot {
  next_period: string;
  revenue_low?: number;
  revenue_high?: number;
  eps_low?: number;
  eps_high?: number;
  guidance_notes?: string;
}

export interface CanonicalFinancialSnapshot {
  snapshot_id: string;
  ticker: string;
  period: string;
  period_type: SnapshotPeriodType;
  fiscal_year: number;
  fiscal_quarter?: number;
  provider: string;
  filing_date?: string;
  retrieved_at: string;
  data: {
    revenue?: number;
    cost_of_revenue?: number;
    gross_profit?: number;
    gross_margin?: number;
    operating_income?: number;
    operating_margin?: number;
    net_income?: number;
    eps?: number;
    eps_diluted?: number;
    ebitda?: number;
    debt_total?: number;
    debt_long_term?: number;
    cash_and_equivalents?: number;
    total_assets?: number;
    total_liabilities?: number;
    shareholders_equity?: number;
    free_cash_flow?: number;
    operating_cash_flow?: number;
    capital_expenditure?: number;
    shares_outstanding?: number;
    depreciation_amortization?: number;
    interest_expense?: number;
    effective_tax_rate?: number;
    [key: string]: number | undefined;
  };
  segments?: FinancialSegment[];
  analyst_estimates?: AnalystEstimates;
  guidance?: GuidanceSnapshot;
  missing_fields: string[];
}

const numberMapSchema = {
  type: "object",
  additionalProperties: { type: "number" }
} as const;

export const canonicalFinancialSnapshotSchema = {
  $id: "CanonicalFinancialSnapshot",
  type: "object",
  additionalProperties: false,
  required: [
    "snapshot_id",
    "ticker",
    "period",
    "period_type",
    "fiscal_year",
    "provider",
    "retrieved_at",
    "data",
    "missing_fields"
  ],
  properties: {
    snapshot_id: { type: "string" },
    ticker: { type: "string" },
    period: { type: "string" },
    period_type: { type: "string", enum: ["quarterly", "annual"] },
    fiscal_year: { type: "number" },
    fiscal_quarter: { type: "number" },
    provider: { type: "string" },
    filing_date: { type: "string" },
    retrieved_at: { type: "string", format: "date-time" },
    data: {
      ...numberMapSchema,
      properties: {
        revenue: { type: "number" },
        cost_of_revenue: { type: "number" },
        gross_profit: { type: "number" },
        gross_margin: { type: "number" },
        operating_income: { type: "number" },
        operating_margin: { type: "number" },
        net_income: { type: "number" },
        eps: { type: "number" },
        eps_diluted: { type: "number" },
        ebitda: { type: "number" },
        debt_total: { type: "number" },
        debt_long_term: { type: "number" },
        cash_and_equivalents: { type: "number" },
        total_assets: { type: "number" },
        total_liabilities: { type: "number" },
        shareholders_equity: { type: "number" },
        free_cash_flow: { type: "number" },
        operating_cash_flow: { type: "number" },
        capital_expenditure: { type: "number" },
        shares_outstanding: { type: "number" },
        depreciation_amortization: { type: "number" },
        interest_expense: { type: "number" },
        effective_tax_rate: { type: "number" }
      }
    },
    segments: {
      type: "array",
      items: {
        type: "object",
        required: ["segment_name"],
        properties: {
          segment_name: { type: "string" },
          revenue: { type: "number" },
          operating_income: { type: "number" }
        },
        additionalProperties: {
          oneOf: [{ type: "string" }, { type: "number" }]
        }
      }
    },
    analyst_estimates: {
      type: "object",
      additionalProperties: false,
      properties: {
        revenue_estimate: { type: "number" },
        eps_estimate: { type: "number" },
        revenue_beat: { type: "number" },
        eps_beat: { type: "number" },
        revenue_beat_pct: { type: "number" },
        eps_beat_pct: { type: "number" },
        num_analysts: { type: "number" }
      }
    },
    guidance: {
      type: "object",
      additionalProperties: false,
      required: ["next_period"],
      properties: {
        next_period: { type: "string" },
        revenue_low: { type: "number" },
        revenue_high: { type: "number" },
        eps_low: { type: "number" },
        eps_high: { type: "number" },
        guidance_notes: { type: "string" }
      }
    },
    missing_fields: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
