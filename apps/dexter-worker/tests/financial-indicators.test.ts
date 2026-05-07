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
