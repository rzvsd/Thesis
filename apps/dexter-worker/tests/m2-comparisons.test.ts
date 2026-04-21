import assert from "node:assert/strict";
import test from "node:test";

import type { CanonicalFinancialSnapshot } from "../../../packages/contracts/src";

import { buildComparisons } from "../src/comparisons";
import { computeDeterministicDcf } from "../src/dcf";
import { buildFinancialAnalysis } from "../src/financial-analysis";

function snapshot(input: {
  id: string;
  period: string;
  fiscalYear: number;
  fiscalQuarter?: number;
  periodType: "quarterly" | "annual";
  data: CanonicalFinancialSnapshot["data"];
}): CanonicalFinancialSnapshot {
  return {
    snapshot_id: input.id,
    ticker: "AAPL",
    period: input.period,
    period_type: input.periodType,
    fiscal_year: input.fiscalYear,
    fiscal_quarter: input.fiscalQuarter,
    provider: "fixture",
    retrieved_at: "2026-03-28T00:00:00.000Z",
    data: input.data,
    missing_fields: []
  };
}

test("comparison module computes QoQ and YoY deltas when snapshots are available", () => {
  const latest = snapshot({
    id: "q4",
    period: "2025-Q4",
    fiscalYear: 2025,
    fiscalQuarter: 4,
    periodType: "quarterly",
    data: {
      revenue: 100,
      eps: 5,
      net_income: 10,
      operating_margin: 20,
      free_cash_flow: 8
    }
  });
  const prior = snapshot({
    id: "q3",
    period: "2025-Q3",
    fiscalYear: 2025,
    fiscalQuarter: 3,
    periodType: "quarterly",
    data: {
      revenue: 80,
      eps: 4,
      net_income: 8,
      operating_margin: 18,
      free_cash_flow: 7
    }
  });
  const yearAgo = snapshot({
    id: "q4-2024",
    period: "2024-Q4",
    fiscalYear: 2024,
    fiscalQuarter: 4,
    periodType: "quarterly",
    data: {
      revenue: 70,
      eps: 3,
      net_income: 7,
      operating_margin: 16,
      free_cash_flow: 6
    }
  });

  const block = buildComparisons({
    latest,
    priorQuarter: prior,
    yearAgo
  });

  const qoqRevenue = block.qoq.find((entry) => entry.metric === "revenue");
  assert.ok(qoqRevenue);
  assert.equal(qoqRevenue.direction, "up");
  assert.equal(qoqRevenue.absolute_change, 20);
  assert.equal(qoqRevenue.percent_change, 25);

  const yoyRevenue = block.yoy.find((entry) => entry.metric === "revenue");
  assert.ok(yoyRevenue);
  assert.equal(yoyRevenue.direction, "up");
  assert.equal(yoyRevenue.absolute_change, 30);
});

test("deterministic DCF returns valuation when annual free-cash-flow history is sufficient", () => {
  const result = computeDeterministicDcf({
    snapshots: [
      snapshot({
        id: "fy2023",
        period: "2023-FY",
        fiscalYear: 2023,
        periodType: "annual",
        data: {
          free_cash_flow: 70000000000,
          shares_outstanding: 7000000000,
          effective_tax_rate: 0.2
        }
      }),
      snapshot({
        id: "fy2024",
        period: "2024-FY",
        fiscalYear: 2024,
        periodType: "annual",
        data: {
          free_cash_flow: 76000000000,
          shares_outstanding: 7000000000,
          effective_tax_rate: 0.2
        }
      }),
      snapshot({
        id: "fy2025",
        period: "2025-FY",
        fiscalYear: 2025,
        periodType: "annual",
        data: {
          free_cash_flow: 82000000000,
          shares_outstanding: 7000000000,
          effective_tax_rate: 0.19
        }
      })
    ],
    spotPrice: 180
  });

  assert.ok(result.valuation);
  assert.equal(result.valuation?.assumptions.methodology, "deterministic_dcf");
  assert.ok((result.valuation?.fair_value_mid ?? 0) > 0);
});

test("deterministic DCF degrades when there is not enough annual free-cash-flow history", () => {
  const result = computeDeterministicDcf({
    snapshots: [
      snapshot({
        id: "fy2025",
        period: "2025-FY",
        fiscalYear: 2025,
        periodType: "annual",
        data: {
          free_cash_flow: 82000000000,
          shares_outstanding: 7000000000
        }
      })
    ]
  });

  assert.equal(result.valuation, undefined);
  assert.match(result.degradedReason ?? "", /At least 3 annual free-cash-flow points/);
});

test("financial analysis builds deterministic tables and metrics from complete annual history", () => {
  const analysis = buildFinancialAnalysis([
    snapshot({
      id: "fy2021",
      period: "2021-FY",
      fiscalYear: 2021,
      periodType: "annual",
      data: {
        revenue: 300_000_000_000,
        gross_margin: 41.2,
        operating_margin: 31.1,
        net_income: 90_000_000_000,
        free_cash_flow: 95_000_000_000,
        debt_total: 140_000_000_000,
        cash_and_equivalents: 80_000_000_000,
        shares_outstanding: 16_200_000_000,
        operating_cash_flow: 110_000_000_000,
        shareholders_equity: 70_000_000_000,
        total_assets: 350_000_000_000
      }
    }),
    snapshot({
      id: "fy2022",
      period: "2022-FY",
      fiscalYear: 2022,
      periodType: "annual",
      data: {
        revenue: 325_000_000_000,
        gross_margin: 42.1,
        operating_margin: 31.8,
        net_income: 96_000_000_000,
        free_cash_flow: 101_000_000_000,
        debt_total: 138_000_000_000,
        cash_and_equivalents: 84_000_000_000,
        shares_outstanding: 16_050_000_000,
        operating_cash_flow: 116_000_000_000,
        shareholders_equity: 75_000_000_000,
        total_assets: 360_000_000_000
      }
    }),
    snapshot({
      id: "fy2023",
      period: "2023-FY",
      fiscalYear: 2023,
      periodType: "annual",
      data: {
        revenue: 346_000_000_000,
        gross_margin: 43.4,
        operating_margin: 32.5,
        net_income: 104_000_000_000,
        free_cash_flow: 111_000_000_000,
        debt_total: 132_000_000_000,
        cash_and_equivalents: 90_000_000_000,
        shares_outstanding: 15_950_000_000,
        operating_cash_flow: 126_000_000_000,
        shareholders_equity: 83_000_000_000,
        total_assets: 372_000_000_000
      }
    }),
    snapshot({
      id: "q4-2025",
      period: "2025-Q4",
      fiscalYear: 2025,
      fiscalQuarter: 4,
      periodType: "quarterly",
      data: {
        revenue: 100_000_000_000,
        gross_margin: 44.2,
        operating_margin: 33.1,
        net_income: 26_000_000_000,
        free_cash_flow: 24_000_000_000,
        debt_total: 130_000_000_000,
        cash_and_equivalents: 95_000_000_000,
        shares_outstanding: 15_900_000_000
      }
    })
  ]);

  assert.equal(analysis.annual_history.length, 3);
  assert.equal(analysis.quarterly_history.length, 1);
  assert.ok(analysis.trend_metrics.some((metric) =>
    metric.key === "revenue_cagr_3y_pct" &&
    metric.status === "available"
  ));
  assert.ok(analysis.trend_metrics.some((metric) =>
    metric.key === "share_count_change_3y_pct" &&
    metric.direction === "improving"
  ));
  assert.ok(analysis.quality_metrics.some((metric) =>
    metric.key === "cash_conversion_latest" &&
    metric.status === "available"
  ));
  assert.equal(analysis.omissions.length, 0);
});

test("financial analysis emits omissions instead of fabricating sparse metrics", () => {
  const analysis = buildFinancialAnalysis([
    snapshot({
      id: "fy2025",
      period: "2025-FY",
      fiscalYear: 2025,
      periodType: "annual",
      data: {
        free_cash_flow: 50_000_000_000
      }
    }),
    snapshot({
      id: "q4-2025",
      period: "2025-Q4",
      fiscalYear: 2025,
      fiscalQuarter: 4,
      periodType: "quarterly",
      data: {
        revenue: 20_000_000_000
      }
    })
  ]);

  assert.equal(analysis.annual_history.length, 1);
  assert.ok(analysis.trend_metrics.some((metric) =>
    metric.key === "revenue_cagr_3y_pct" &&
    metric.status === "omitted"
  ));
  assert.ok(analysis.quality_metrics.some((metric) =>
    metric.key === "cash_conversion_latest" &&
    metric.status === "omitted"
  ));
  assert.ok(analysis.omissions.some((omission) => omission.code === "annual_history_insufficient"));
  assert.ok(analysis.omissions.some((omission) => omission.code === "free_cash_flow_trend_missing"));
});
