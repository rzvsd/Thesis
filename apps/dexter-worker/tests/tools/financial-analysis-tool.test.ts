import assert from "node:assert/strict";
import test from "node:test";

import type { CanonicalFinancialSnapshot } from "../../../../packages/contracts/src";
import {
  buildFinancialAnalysisToolResult,
  runFinancialAnalysisTool
} from "../../src/tools/financial-analysis/financial-analysis-tool";
import { loadConfig } from "../../src/config";

function snapshot(
  ticker: string,
  period: string,
  data: CanonicalFinancialSnapshot["data"]
): CanonicalFinancialSnapshot {
  return {
    snapshot_id: `${ticker}-${period}`,
    ticker,
    period,
    period_type: "quarterly",
    fiscal_year: 2026,
    fiscal_quarter: 1,
    provider: "fixture",
    retrieved_at: "2026-05-01T00:00:00.000Z",
    data,
    missing_fields: []
  };
}

test("financial validator computes growth, margins, and evidence", async () => {
  const result = await buildFinancialAnalysisToolResult({
    ticker: "AAPL",
    latest: snapshot("AAPL", "2026Q1", {
      revenue: 120,
      gross_profit: 60,
      operating_income: 36,
      net_income: 30,
      free_cash_flow: 24,
      debt_total: 50,
      shareholders_equity: 100
    }),
    priorQuarter: snapshot("AAPL", "2025Q4", { revenue: 100 }),
    yearAgo: snapshot("AAPL", "2025Q1", { revenue: 80 })
  }, "2026-05-01T00:00:00.000Z");

  const metrics = new Map(result.data?.metrics.map((metric) => [metric.metric, metric]));
  assert.equal(result.ok, true);
  assert.equal(metrics.get("revenue_growth_yoy")?.value, 50);
  assert.equal(metrics.get("revenue_growth_qoq")?.value, 20);
  assert.equal(metrics.get("gross_margin")?.value, 50);
  assert.equal(metrics.get("operating_margin")?.value, 30);
  assert.equal(metrics.get("free_cash_flow_margin")?.value, 20);
  assert.equal(metrics.get("cash_conversion")?.value, 0.8);
  assert.equal(metrics.get("debt_to_equity")?.value, 0.5);
  assert.equal(result.evidence.length, 1);
});

test("financial validator omits missing and zero-denominator metrics", async () => {
  const result = await buildFinancialAnalysisToolResult({
    ticker: "ZERO",
    latest: snapshot("ZERO", "2026Q1", {
      revenue: 0,
      net_income: 0,
      free_cash_flow: 10,
      debt_total: 10,
      shareholders_equity: 0
    }),
    priorQuarter: snapshot("ZERO", "2025Q4", { revenue: 0 })
  }, "2026-05-01T00:00:00.000Z");

  assert.ok((result.omissions.length ?? 0) > 0);
  assert.ok(result.data?.metrics.some((metric) => metric.state === "missing"));
  assert.ok(!result.data?.metrics.some((metric) => metric.value === 0 && metric.state === "missing"));
});

test("financial validator disabled mode returns omission", async () => {
  const result = await runFinancialAnalysisTool(
    { ticker: "AAPL" },
    loadConfig({
      ...process.env,
      DEXTER_TOOLS_ENABLED: "false",
      DEXTER_FINANCIAL_ANALYSIS_TOOL_ENABLED: "true"
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.omissions[0]?.reason_code, "disabled");
});
