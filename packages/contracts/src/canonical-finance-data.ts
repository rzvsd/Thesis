export interface CanonicalFinanceData {
  ticker: string;
  period: string;
  provider: string;
  retrieved_at: string;
  data: {
    revenue?: number;
    gross_margin?: number;
    operating_income?: number;
    net_income?: number;
    eps?: number;
    debt_total?: number;
    cash_and_equivalents?: number;
    free_cash_flow?: number;
    [key: string]: number | undefined;
  };
  missing_fields: string[];
}

export const canonicalFinanceDataSchema = {
  $id: "CanonicalFinanceData",
  type: "object",
  additionalProperties: false,
  required: ["ticker", "period", "provider", "retrieved_at", "data", "missing_fields"],
  properties: {
    ticker: { type: "string" },
    period: { type: "string" },
    provider: { type: "string" },
    retrieved_at: { type: "string" },
    data: {
      type: "object",
      properties: {
        revenue: { type: "number" },
        gross_margin: { type: "number" },
        operating_income: { type: "number" },
        net_income: { type: "number" },
        eps: { type: "number" },
        debt_total: { type: "number" },
        cash_and_equivalents: { type: "number" },
        free_cash_flow: { type: "number" }
      },
      additionalProperties: { type: "number" }
    },
    missing_fields: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
