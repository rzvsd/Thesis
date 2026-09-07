import assert from "node:assert/strict";
import test from "node:test";

import type { CanonicalFinancialSnapshot } from "../../../packages/contracts/src";

import { loadConfig } from "../src/config";
import { buildFinancialIndicators } from "../src/financial-indicators";

function annual(year: number, data: CanonicalFinancialSnapshot["data"]): CanonicalFinancialSnapshot {
  return {
    snapshot_id: `TEST-${year}`,
    ticker: "TEST",
    period: `${year}-FY`,
    period_type: "annual",
    fiscal_year: year,
    provider: "fixture",
    retrieved_at: "2026-05-01T00:00:00.000Z",
    data,
    missing_fields: []
  };
}

function quarter(year: number, fiscalQuarter: number, data: CanonicalFinancialSnapshot["data"]): CanonicalFinancialSnapshot {
  return {
    snapshot_id: `TEST-${year}-Q${fiscalQuarter}`,
    ticker: "TEST",
    period: `${year}-Q${fiscalQuarter}`,
    period_type: "quarterly",
    fiscal_year: year,
    fiscal_quarter: fiscalQuarter,
    provider: "fixture",
    retrieved_at: "2026-05-01T00:00:00.000Z",
    data,
    missing_fields: []
  };
}

const baseFinancials = [
  annual(2025, {
    revenue: 200,
    gross_profit: 140,
    gross_margin: 70,
    operating_income: 80,
    operating_margin: 40,
    net_income: 50,
    eps_diluted: 5,
    ebitda: 90,
    debt_total: 30,
    cash_and_equivalents: 50,
    total_assets: 300,
    shareholders_equity: 160,
    free_cash_flow: 45,
    operating_cash_flow: 55,
    capital_expenditure: -10,
    shares_outstanding: 10
  }),
  annual(2024, {
    revenue: 180,
    gross_margin: 68,
    operating_margin: 36,
    net_income: 42,
    eps_diluted: 4.2,
    free_cash_flow: 38,
    shares_outstanding: 10.1
  }),
  annual(2022, {
    revenue: 135,
    gross_margin: 62,
    operating_margin: 28,
    net_income: 28,
    eps_diluted: 2.8,
    free_cash_flow: 25,
    debt_total: 35,
    shares_outstanding: 10.4
  }),
  annual(2020, {
    revenue: 100,
    gross_margin: 60,
    operating_margin: 25,
    net_income: 20,
    eps_diluted: 2,
    free_cash_flow: 18,
    debt_total: 40,
    shares_outstanding: 10.8
  })
];

test("financial indicators compute valuation and quality metrics when price is available", async () => {
  const block = await buildFinancialIndicators({
    ticker: "TEST",
    generatedAt: "2026-05-01T00:00:00.000Z",
    latest: baseFinancials[0],
    financials: baseFinancials,
    spotPrice: 100,
    fixtureMode: true
  }, loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: "true" }));

  const byId = new Map([
    ...block.valuation,
    ...block.profitability,
    ...block.cash_flow_quality,
    ...block.capital_allocation
  ].map((entry) => [entry.indicator_id, entry]));

  assert.equal(byId.get("pe_ratio")?.value, 20);
  assert.equal(byId.get("ps_ratio")?.value, 5);
  assert.equal(byId.get("fcf_yield")?.value, 4.5);
  assert.equal(byId.get("gross_margin")?.value, 70);
  assert.equal(byId.get("cash_conversion")?.value, 0.9);
  assert.ok((byId.get("share_count_change_5y")?.value ?? 0) < 0);
  assert.ok(block.value_classification.classification !== "insufficient_data");
  assert.equal(block.evidence.some((entry) => entry.evidence_id.endsWith("spot-price")), true);
  assert.equal(block.price_reference?.price_kind, "fixture");
  assert.ok((block.benchmarks?.length ?? 0) > 0);
  assert.ok((block.education?.length ?? 0) > 0);
});

test("financial indicators omit price-dependent metrics when price is missing", async () => {
  const block = await buildFinancialIndicators({
    ticker: "TEST",
    generatedAt: "2026-05-01T00:00:00.000Z",
    latest: baseFinancials[0],
    financials: baseFinancials,
    fixtureMode: true
  }, loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: "true" }));

  assert.equal(block.valuation.find((entry) => entry.indicator_id === "pe_ratio")?.state, "missing");
  assert.equal(block.profitability.find((entry) => entry.indicator_id === "gross_margin")?.value, 70);
  assert.ok(block.omissions.some((omission) => omission.reason_code === "missing_price"));
  assert.equal(block.price_reference, undefined);
});

test("financial indicators do not convert missing denominators into zero", async () => {
  const block = await buildFinancialIndicators({
    ticker: "TEST",
    generatedAt: "2026-05-01T00:00:00.000Z",
    latest: annual(2025, { revenue: 0, net_income: 10, free_cash_flow: 5 }),
    financials: [annual(2025, { revenue: 0, net_income: 10, free_cash_flow: 5 })],
    spotPrice: 100,
    fixtureMode: true
  }, loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: "true" }));

  assert.equal(block.cash_flow_quality.find((entry) => entry.indicator_id === "fcf_margin")?.state, "missing");
  assert.ok(!block.cash_flow_quality.some((entry) => entry.state === "missing" && entry.value === 0));
});

test("financial indicators use true TTM flow metrics when four quarters exist", async () => {
  const quarters = [
    quarter(2026, 1, {
      revenue: 60,
      gross_profit: 42,
      operating_income: 25,
      net_income: 15,
      eps_diluted: 1.5,
      ebitda: 28,
      free_cash_flow: 12,
      operating_cash_flow: 15,
      capital_expenditure: -3,
      interest_expense: -1,
      effective_tax_rate: 0.2,
      debt_total: 30,
      cash_and_equivalents: 50,
      total_assets: 300,
      shareholders_equity: 160,
      shares_outstanding: 10
    }),
    quarter(2025, 4, { revenue: 55, gross_profit: 38, operating_income: 22, net_income: 13, eps_diluted: 1.3, ebitda: 25, free_cash_flow: 11, operating_cash_flow: 14, capital_expenditure: -3, interest_expense: -1, effective_tax_rate: 0.2 }),
    quarter(2025, 3, { revenue: 50, gross_profit: 34, operating_income: 20, net_income: 12, eps_diluted: 1.2, ebitda: 23, free_cash_flow: 10, operating_cash_flow: 13, capital_expenditure: -3, interest_expense: -1, effective_tax_rate: 0.2 }),
    quarter(2025, 2, { revenue: 45, gross_profit: 30, operating_income: 18, net_income: 10, eps_diluted: 1, ebitda: 21, free_cash_flow: 9, operating_cash_flow: 12, capital_expenditure: -3, interest_expense: -1, effective_tax_rate: 0.2 })
  ];
  const block = await buildFinancialIndicators({
    ticker: "TEST",
    generatedAt: "2026-05-01T00:00:00.000Z",
    latest: quarters[0],
    financials: [...quarters, ...baseFinancials],
    spotPrice: 100,
    fixtureMode: true
  }, loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: "true" }));

  assert.equal(block.basis, "mixed");
  assert.deepEqual(block.calculation_basis?.ttm_periods, ["2026-Q1", "2025-Q4", "2025-Q3", "2025-Q2"]);
  assert.equal(block.valuation.find((entry) => entry.indicator_id === "pe_ratio")?.value, 20);
  assert.equal(block.valuation.find((entry) => entry.indicator_id === "ps_ratio")?.value, 4.76);
  assert.equal(block.profitability.find((entry) => entry.indicator_id === "roic")?.state, "available");
  assert.equal(block.balance_sheet.find((entry) => entry.indicator_id === "interest_coverage")?.value, 21.25);
});

test("financial indicators classify weak cheap companies as value trap risk", async () => {
  const weakFinancials = [
    annual(2025, {
      revenue: 70,
      operating_income: 5,
      net_income: 4,
      eps_diluted: 4,
      free_cash_flow: 2,
      ebitda: 6,
      debt_total: 140,
      cash_and_equivalents: 5,
      shareholders_equity: 40,
      total_assets: 220,
      shares_outstanding: 10
    }),
    annual(2020, {
      revenue: 120,
      operating_income: 18,
      net_income: 12,
      eps_diluted: 12,
      free_cash_flow: 20,
      debt_total: 80,
      shareholders_equity: 80,
      shares_outstanding: 9
    })
  ];

  const block = await buildFinancialIndicators({
    ticker: "TEST",
    generatedAt: "2026-05-01T00:00:00.000Z",
    latest: weakFinancials[0],
    financials: weakFinancials,
    spotPrice: 40,
    fixtureMode: true
  }, loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: "true" }));

  assert.equal(block.valuation.find((entry) => entry.indicator_id === "pe_ratio")?.value, 10);
  assert.equal(block.value_classification.classification, "value_trap_risk");
  assert.ok(block.value_classification.trap_warnings.length > 0);
});
