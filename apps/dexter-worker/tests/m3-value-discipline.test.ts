import assert from "node:assert/strict";
import test from "node:test";

import type { CanonicalFinancialSnapshot } from "../../../packages/contracts/src";

import { buildFinancialAnalysis } from "../src/financial-analysis";
import { buildValueDisciplineScorecard } from "../src/value-discipline";

function annualSnapshot(input: {
  id: string;
  fiscalYear: number;
  data: CanonicalFinancialSnapshot["data"];
}): CanonicalFinancialSnapshot {
  return {
    snapshot_id: input.id,
    ticker: "TEST",
    period: `${input.fiscalYear}-FY`,
    period_type: "annual",
    fiscal_year: input.fiscalYear,
    provider: "fixture",
    retrieved_at: "2026-04-20T00:00:00.000Z",
    data: input.data,
    missing_fields: []
  };
}

test("M3 value-discipline classifies quality mega-cap with complete scorecard", () => {
  const snapshots: CanonicalFinancialSnapshot[] = [
    annualSnapshot({
      id: "fy2023",
      fiscalYear: 2023,
      data: {
        revenue: 330_000_000_000,
        gross_margin: 42.1,
        net_income: 88_000_000_000,
        operating_cash_flow: 104_000_000_000,
        debt_total: 115_000_000_000,
        cash_and_equivalents: 62_000_000_000,
        total_assets: 360_000_000_000,
        shares_outstanding: 15_800_000_000
      }
    }),
    annualSnapshot({
      id: "fy2024",
      fiscalYear: 2024,
      data: {
        revenue: 355_000_000_000,
        gross_margin: 43.0,
        net_income: 95_000_000_000,
        operating_cash_flow: 114_000_000_000,
        debt_total: 109_000_000_000,
        cash_and_equivalents: 70_000_000_000,
        total_assets: 372_000_000_000,
        shares_outstanding: 15_600_000_000
      }
    }),
    annualSnapshot({
      id: "fy2025",
      fiscalYear: 2025,
      data: {
        revenue: 382_000_000_000,
        gross_margin: 44.5,
        net_income: 104_000_000_000,
        operating_cash_flow: 128_000_000_000,
        debt_total: 101_000_000_000,
        cash_and_equivalents: 83_000_000_000,
        total_assets: 388_000_000_000,
        shares_outstanding: 15_400_000_000
      }
    })
  ];

  const financialAnalysis = buildFinancialAnalysis(snapshots);
  const scorecard = buildValueDisciplineScorecard({
    ticker: "AAPL",
    snapshots,
    financialAnalysis,
    valuation: {
      fair_value_mid: 215,
      fair_value_low: 190,
      fair_value_high: 240,
      spot_price: 205,
      implied_upside_pct: 4.9,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.025,
        wacc: 0.1
      }
    }
  });

  assert.equal(scorecard.context_label, "quality_mega_cap");
  assert.equal(scorecard.completeness, "complete");
  assert.equal(scorecard.available_signals, 9);
  assert.equal(scorecard.missing_signals.length, 0);
  assert.ok(scorecard.score >= 7);
  assert.equal(scorecard.value_trap_warning.triggered, false);
});

test("M3 value-discipline classifies value/cyclical context", () => {
  const snapshots: CanonicalFinancialSnapshot[] = [
    annualSnapshot({
      id: "fy2023",
      fiscalYear: 2023,
      data: {
        revenue: 58_000_000_000,
        gross_margin: 24.2,
        net_income: 2_900_000_000,
        operating_cash_flow: 4_200_000_000,
        debt_total: 34_000_000_000,
        cash_and_equivalents: 5_000_000_000,
        total_assets: 66_000_000_000,
        shares_outstanding: 2_100_000_000
      }
    }),
    annualSnapshot({
      id: "fy2024",
      fiscalYear: 2024,
      data: {
        revenue: 61_000_000_000,
        gross_margin: 25.0,
        net_income: 3_300_000_000,
        operating_cash_flow: 4_300_000_000,
        debt_total: 33_500_000_000,
        cash_and_equivalents: 5_400_000_000,
        total_assets: 67_000_000_000,
        shares_outstanding: 2_100_000_000
      }
    }),
    annualSnapshot({
      id: "fy2025",
      fiscalYear: 2025,
      data: {
        revenue: 63_000_000_000,
        gross_margin: 25.5,
        net_income: 3_700_000_000,
        operating_cash_flow: 4_600_000_000,
        debt_total: 33_200_000_000,
        cash_and_equivalents: 5_900_000_000,
        total_assets: 69_000_000_000,
        shares_outstanding: 2_090_000_000
      }
    })
  ];

  const financialAnalysis = buildFinancialAnalysis(snapshots);
  const scorecard = buildValueDisciplineScorecard({
    ticker: "VALUE",
    snapshots,
    financialAnalysis
  });

  assert.equal(scorecard.context_label, "value_cyclical");
  assert.ok(scorecard.score >= 5);
  assert.ok(scorecard.interpretation.includes("value/cyclical"));
});

test("M3 value-discipline flags distressed profile and value-trap risk", () => {
  const snapshots: CanonicalFinancialSnapshot[] = [
    annualSnapshot({
      id: "fy2023",
      fiscalYear: 2023,
      data: {
        revenue: 27_000_000_000,
        gross_margin: 30.0,
        net_income: 250_000_000,
        operating_cash_flow: 100_000_000,
        debt_total: 20_000_000_000,
        cash_and_equivalents: 2_000_000_000,
        total_assets: 24_000_000_000,
        shares_outstanding: 1_000_000_000
      }
    }),
    annualSnapshot({
      id: "fy2024",
      fiscalYear: 2024,
      data: {
        revenue: 25_000_000_000,
        gross_margin: 27.5,
        net_income: -450_000_000,
        operating_cash_flow: -200_000_000,
        debt_total: 21_000_000_000,
        cash_and_equivalents: 1_600_000_000,
        total_assets: 23_000_000_000,
        shares_outstanding: 1_030_000_000
      }
    }),
    annualSnapshot({
      id: "fy2025",
      fiscalYear: 2025,
      data: {
        revenue: 23_000_000_000,
        gross_margin: 24.5,
        net_income: -1_200_000_000,
        operating_cash_flow: -900_000_000,
        debt_total: 22_500_000_000,
        cash_and_equivalents: 1_100_000_000,
        total_assets: 22_000_000_000,
        shares_outstanding: 1_080_000_000
      }
    })
  ];

  const financialAnalysis = buildFinancialAnalysis(snapshots);
  const scorecard = buildValueDisciplineScorecard({
    ticker: "DISTRESS",
    snapshots,
    financialAnalysis,
    valuation: {
      fair_value_mid: 18,
      fair_value_low: 8,
      fair_value_high: 28,
      spot_price: 11,
      implied_upside_pct: 63.6,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.02,
        wacc: 0.12
      }
    }
  });

  assert.equal(scorecard.context_label, "distressed");
  assert.equal(scorecard.value_trap_warning.triggered, true);
  assert.ok(scorecard.value_trap_warning.reason_codes.includes("distressed_context"));
  assert.ok(scorecard.does_not_prove.toLowerCase().includes("not a buy or sell"));
});

test("M3 value-discipline returns sparse-data context with explicit missing signals", () => {
  const snapshots: CanonicalFinancialSnapshot[] = [
    annualSnapshot({
      id: "fy2025",
      fiscalYear: 2025,
      data: {
        free_cash_flow: 2_000_000_000
      }
    })
  ];

  const financialAnalysis = buildFinancialAnalysis(snapshots);
  const scorecard = buildValueDisciplineScorecard({
    ticker: "SPARSE",
    snapshots,
    financialAnalysis
  });

  assert.equal(scorecard.context_label, "sparse_data");
  assert.ok(scorecard.available_signals < scorecard.max_score);
  assert.ok(scorecard.missing_signals.length > 0);
  assert.ok(scorecard.completeness !== "complete");
  assert.ok(scorecard.interpretation.toLowerCase().includes("checkpoint"));
});

