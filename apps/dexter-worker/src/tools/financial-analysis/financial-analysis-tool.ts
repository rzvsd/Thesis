import type { CanonicalFinancialSnapshot } from "../../../../../packages/contracts/src";
import type { DexterToolResult, DexterToolRuntimeConfig } from "../tool-contract";
import { buildToolOmission } from "../tool-errors";
import { evidenceFromToolFinding } from "../tool-evidence";
import { runDexterTool } from "../tool-runner";
import { percentChange, percentRatio, safeDivide } from "./ratio-checker";

export interface FinancialAnalysisToolInput {
  ticker: string;
  latest?: CanonicalFinancialSnapshot;
  priorQuarter?: CanonicalFinancialSnapshot;
  yearAgo?: CanonicalFinancialSnapshot;
}

export interface FinancialAnalysisMetric {
  metric:
    | "revenue_growth_yoy"
    | "revenue_growth_qoq"
    | "gross_margin"
    | "operating_margin"
    | "free_cash_flow_margin"
    | "cash_conversion"
    | "debt_to_equity";
  value?: number;
  unit: "pct" | "ratio" | "number";
  state: "available" | "missing" | "invalid";
  explanation: string;
}

export interface FinancialAnalysisToolData {
  metrics: FinancialAnalysisMetric[];
  red_flags: Array<{
    code: string;
    detail: string;
    severity: "high" | "medium" | "low";
  }>;
}

export async function runFinancialAnalysisTool(
  input: FinancialAnalysisToolInput,
  config: DexterToolRuntimeConfig
): Promise<DexterToolResult<FinancialAnalysisToolData>> {
  return runDexterTool(
    "financial_analysis",
    {
      enabled: config.toolsEnabled && config.financialAnalysisToolEnabled,
      timeoutMs: config.toolTimeoutMs
    },
    async () => buildFinancialAnalysisToolResult(input)
  );
}

export async function buildFinancialAnalysisToolResult(
  input: FinancialAnalysisToolInput,
  generatedAt = new Date().toISOString()
): Promise<DexterToolResult<FinancialAnalysisToolData>> {
  const metrics = buildMetrics(input);
  const redFlags = buildRedFlags(metrics);
  const omissions = metrics
    .filter((metric) => metric.state !== "available")
    .map((metric) =>
      buildToolOmission({
        family: metric.metric,
        reason_code: metric.state === "missing" ? "insufficient_input" : "schema_mismatch",
        reason_text: metric.explanation
      })
    );
  const evidence = [
    evidenceFromToolFinding({
      toolName: "financial_analysis",
      sourceFamily: "financial_data",
      title: `${input.ticker} deterministic financial validator`,
      excerpt: summarizeMetrics(metrics),
      retrievedAt: generatedAt,
      customerSafe: true
    })
  ];

  return {
    tool_name: "financial_analysis",
    ok: metrics.some((metric) => metric.state === "available"),
    generated_at: generatedAt,
    data: {
      metrics,
      red_flags: redFlags
    },
    evidence,
    omissions,
    confidence: omissions.length === 0 ? "high" : "medium",
    visibility: "customer_metadata",
    customer_safe: true,
    notes: redFlags.map((flag) => flag.detail)
  };
}

function buildMetrics(input: FinancialAnalysisToolInput): FinancialAnalysisMetric[] {
  const latest = input.latest?.data;
  const prior = input.priorQuarter?.data;
  const yearAgo = input.yearAgo?.data;
  return [
    metric("revenue_growth_yoy", percentChange(latest?.revenue, yearAgo?.revenue), "pct", "latest and year-ago revenue"),
    metric("revenue_growth_qoq", percentChange(latest?.revenue, prior?.revenue), "pct", "latest and prior-quarter revenue"),
    metric(
      "gross_margin",
      latest?.gross_margin ?? percentRatio(latest?.gross_profit, latest?.revenue),
      "pct",
      "gross profit and revenue"
    ),
    metric(
      "operating_margin",
      latest?.operating_margin ?? percentRatio(latest?.operating_income, latest?.revenue),
      "pct",
      "operating income and revenue"
    ),
    metric("free_cash_flow_margin", percentRatio(latest?.free_cash_flow, latest?.revenue), "pct", "free cash flow and revenue"),
    metric("cash_conversion", safeDivide(latest?.free_cash_flow, latest?.net_income), "ratio", "free cash flow and net income"),
    metric("debt_to_equity", safeDivide(latest?.debt_total, latest?.shareholders_equity), "ratio", "debt and shareholders equity")
  ];
}

function metric(
  metricName: FinancialAnalysisMetric["metric"],
  value: number | undefined,
  unit: FinancialAnalysisMetric["unit"],
  requiredInputs: string
): FinancialAnalysisMetric {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      metric: metricName,
      unit,
      state: "missing",
      explanation: `${metricName} was not computed because ${requiredInputs} were unavailable or unusable.`
    };
  }
  return {
    metric: metricName,
    value,
    unit,
    state: "available",
    explanation: `${metricName} computed from ${requiredInputs}.`
  };
}

function buildRedFlags(metrics: FinancialAnalysisMetric[]): FinancialAnalysisToolData["red_flags"] {
  const byMetric = new Map(metrics.map((metric) => [metric.metric, metric]));
  const flags: FinancialAnalysisToolData["red_flags"] = [];
  const yoy = byMetric.get("revenue_growth_yoy")?.value;
  if (typeof yoy === "number" && yoy < -10) {
    flags.push({
      code: "revenue_contraction",
      detail: "Revenue declined more than 10% year over year.",
      severity: "high"
    });
  }
  const operatingMargin = byMetric.get("operating_margin")?.value;
  if (typeof operatingMargin === "number" && operatingMargin < 0) {
    flags.push({
      code: "negative_operating_margin",
      detail: "Operating margin is negative in the latest period.",
      severity: "medium"
    });
  }
  const debtToEquity = byMetric.get("debt_to_equity")?.value;
  if (typeof debtToEquity === "number" && debtToEquity > 2) {
    flags.push({
      code: "high_debt_to_equity",
      detail: "Debt-to-equity is above 2.0.",
      severity: "medium"
    });
  }
  return flags;
}

function summarizeMetrics(metrics: FinancialAnalysisMetric[]): string {
  return metrics
    .map((metric) => `${metric.metric}: ${metric.state === "available" ? metric.value?.toFixed(2) : metric.state}`)
    .join("; ");
}
