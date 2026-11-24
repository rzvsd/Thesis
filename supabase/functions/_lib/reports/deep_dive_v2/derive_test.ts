import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.13";
import { cagr, derive, type Derived } from "./derive.ts";
import type { AnnualFacts } from "./fact_pack.ts";
import { sampleAppleFacts } from "./testdata_apple.ts";

const B = 1e9;

function bridgeSum(d: Derived): number {
  return (d.epsBridge?.steps ?? []).reduce((s, x) => s + x.value, 0);
}

function assertShape(d: Derived) {
  const n = d.years.length;
  for (
    const a of [
      d.revenue,
      d.netIncome,
      d.fcf,
      d.ocf,
      d.eps,
      d.shares,
      d.grossMargin,
      d.opMargin,
      d.netMargin,
      d.fcfMargin,
      d.cash,
      d.debt,
      d.netCash,
      d.buybacks,
      d.dividends,
      d.taxRate,
      d.labels,
    ]
  ) assertEquals(a.length, n);
  assertEquals(d.checks.length, 4);
  assertEquals(d.checks.map((c) => c.key), ["revenue_growth", "op_margin", "fcf_conversion", "share_count"]);
  assertEquals(d.scorecard.map((s) => s.key), ["profitability", "growth", "health", "returns"]);
  for (const s of d.scorecard) {
    if (s.score !== null) {
      assert(s.score >= 0 && s.score <= 10);
      assertEquals(Math.round(s.score * 10) / 10, s.score);
    }
    assert(s.basis.length > 0);
  }
  for (const c of d.checks) {
    assert(Number.isFinite(c.threshold));
    if (c.current === null) assertEquals(c.passes, null);
    assert(c.why.length > 0);
  }
  // Page text rules: no em dashes, no exclamation marks, no advice words.
  const text = JSON.stringify([d.scorecard, d.checks, d.epsBridge, d.dcf?.scenarios.map((s) => s.label)]);
  assert(!/[—!]/.test(text), text);
  assert(
    !/\b(buy|sell|hold|upside|downside|target|cheap|expensive|undervalued|overvalued|recommend|should)\b/i
      .test(text),
  );
}

// The Apple-like series from the task: revenue, net income and split-adjusted diluted shares only.
const REV = [233.7, 215.6, 229.2, 265.6, 260.2, 274.5, 365.8, 394.3, 383.3, 391.0, 416.2];
const NI = [53.4, 45.7, 48.4, 59.5, 55.3, 57.4, 94.7, 99.8, 97.0, 93.7, 112.0];
const DIL = [23.17, 22.00, 21.01, 19.82, 18.60, 17.53, 16.86, 16.33, 15.81, 15.41, 15.00];
function appleLike(): AnnualFacts[] {
  return REV.map((r, i) => ({
    fiscal_year: 2015 + i,
    period_end: `${2015 + i}-09-30`,
    revenue: r * B,
    net_income: NI[i] * B,
    shares_diluted: DIL[i] * B,
  }));
}

Deno.test("Apple-like 11-year series: growth, shares and fallbacks", () => {
  const d = derive(appleLike());
  assertShape(d);
  assertEquals(d.years[0], 2015);
  assertEquals(d.labels[10], "FY2025");
  assertEquals(d.latest.fiscal_year, 2025);
  assertEquals(d.prior?.fiscal_year, 2024);
  assertEquals(d.first.fiscal_year, 2015);
  assertAlmostEquals(d.growth.revenueYoY as number, (416.2 / 391.0 - 1) * 100, 1e-9);
  assertAlmostEquals(d.growth.revenueCagrAll as number, (Math.pow(416.2 / 233.7, 1 / 10) - 1) * 100, 1e-9);
  assertAlmostEquals(d.growth.revenueCagr5 as number, (Math.pow(416.2 / 274.5, 1 / 5) - 1) * 100, 1e-9);
  // Shares fall back to diluted when outstanding is missing.
  assertEquals(d.shares[0], 23.17 * B);
  assertAlmostEquals(d.sharesChangeAll as number, (15.0 / 23.17 - 1) * 100, 1e-9);
  assertAlmostEquals(d.sharesChange1y as number, (15.0 / 15.41 - 1) * 100, 1e-9);
  // EPS falls back to net income / diluted shares, rounded to cents.
  assertEquals(d.eps[0], 2.30);
  assertEquals(d.eps[10], 7.47);
  assertEquals(d.eps[9], 6.08);
  assertAlmostEquals(d.growth.epsCagrAll as number, (Math.pow(7.47 / 2.30, 1 / 10) - 1) * 100, 1e-9);
  assertAlmostEquals(d.netMargin[10] as number, 112.0 / 416.2 * 100, 1e-9);
  // No cash flow, margins or balance sheet: those stay null, nothing is invented.
  assertEquals(d.fcf.every((v) => v === null), true);
  assertEquals(d.grossMargin[10], null);
  assertEquals(d.netCash[10], null);
  assertEquals(d.growth.fcfCagr5, null);
  assertEquals(d.cashReturn5.ratio, null);
  assertEquals(d.epsBridge, null);
  assertEquals(d.dcf, null);
  // Growth scores from revenue CAGR; the rest are not disclosed.
  const growth = d.scorecard.find((s) => s.key === "growth");
  assertEquals(growth?.score, Math.round(((d.growth.revenueCagrAll as number) + 5) / 20 * 100) / 10);
  assertEquals(d.scorecard.find((s) => s.key === "profitability")?.score, null);
  // Revenue check uses the revenue CAGR fallback for the base growth: 8.7 - 4.
  const rc = d.checks[0];
  assertEquals(rc.threshold, 4.7);
  assertEquals(rc.passes, true);
  assertEquals(d.checks[1].passes, null);
  assertEquals(d.checks[2].passes, null);
  assertEquals(d.checks[3].passes, true);
});

Deno.test("sample Apple facts: the full set of derived numbers", () => {
  const d = derive(sampleAppleFacts());
  assertShape(d);
  assertAlmostEquals(d.grossMargin[10] as number, 195.201 / 416.161 * 100, 1e-9);
  assertAlmostEquals(
    d.marginChange1y.gross as number,
    195.201 / 416.161 * 100 - 180.683 / 391.035 * 100,
    1e-9,
  );
  assertAlmostEquals(d.fcf[10] as number, (111.482 - 12.715) * B, 1);
  assertAlmostEquals(d.cash[10] as number, (35.934 + 96.486) * B, 1);
  assertAlmostEquals(d.netCash[10] as number, (35.934 + 96.486 - 98.657) * B, 1);
  assertAlmostEquals(d.taxRate[9] as number, 29.749 / 123.485 * 100, 1e-9);
  assertAlmostEquals(d.growth.fcfYoY as number, ((111.482 - 12.715) / (118.254 - 9.447) - 1) * 100, 1e-9);
  // Cash returned over FY2021-FY2025.
  assertAlmostEquals(d.cashReturn5.fcf as number, 511.554 * B, 1);
  assertAlmostEquals(d.cashReturn5.buybacks as number, 438.583 * B, 1);
  assertAlmostEquals(d.cashReturn5.dividends as number, 74.988 * B, 1);
  assertAlmostEquals(d.cashReturn5.ratio as number, (438.583 + 74.988) / 511.554, 1e-9);
  assertAlmostEquals(d.fcfToNetIncomeAll.ratio as number, 882.192 / 816.854, 1e-9);
  // EPS bridge from 6.08 to 7.47, steps sum exactly to the change.
  const br = d.epsBridge;
  assert(br);
  assertEquals([br.from, br.to], [6.08, 7.47]);
  assertAlmostEquals(bridgeSum(d), 7.47 - 6.08, 1e-9);
  const keys = br.steps.map((s) => s.key);
  assertEquals(keys.slice(0, 4), ["sales", "margin", "tax", "shares"]);
  const byKey = Object.fromEntries(br.steps.map((s) => [s.key, s.value]));
  assert(byKey.tax > 0.6, "the FY2024 tax charge dropping out does much of the work");
  assert(byKey.sales > 0 && byKey.shares > 0);
  for (const s of br.steps) assertEquals(Math.round(s.value * 100) / 100, s.value);
  // Scorecard and checks.
  const score = Object.fromEntries(d.scorecard.map((s) => [s.key, s.score]));
  assertEquals(score.profitability, Math.round(Math.min(10, (133.05 / 416.161 * 100) / 35 * 10) * 10) / 10);
  assertEquals(score.health, 10);
  assertEquals(score.returns, 10);
  assert(d.checks.every((c) => c.passes === true));
  assertEquals(d.checks[3].direction, "below");
  // DCF uses the 5-year FCF CAGR rounded to one decimal.
  assert(d.dcf);
  assertEquals(d.dcf.scenarios[1].growth, Math.round((d.growth.fcfCagr5 as number) * 10) / 10);
  assertEquals(d.checks[0].threshold, Math.round((d.dcf.scenarios[1].growth - 4) * 10) / 10);
  assertEquals(d.dcf.shares, d.shares[10]);
  assertAlmostEquals(
    d.dcf.baseFcf,
    ((d.fcf[8] as number) + (d.fcf[9] as number) + (d.fcf[10] as number)) / 3,
    1,
  );
});

Deno.test("EPS bridge omits 'other' when the steps already add up", () => {
  const facts: AnnualFacts[] = [
    {
      fiscal_year: 2024,
      period_end: "2024-12-31",
      revenue: 1000,
      operating_income: 200,
      pretax_income: 200,
      income_tax: 40,
      net_income: 160,
      shares_diluted: 100,
      eps_diluted: 1.6,
    },
    {
      fiscal_year: 2025,
      period_end: "2025-12-31",
      revenue: 1100,
      operating_income: 242,
      pretax_income: 242,
      income_tax: 48.4,
      net_income: 193.6,
      shares_diluted: 80,
      eps_diluted: 2.42,
    },
  ];
  const d = derive(facts);
  assertShape(d);
  const br = d.epsBridge;
  assert(br);
  assertEquals(br.steps.map((s) => s.key), ["sales", "margin", "tax", "shares"]);
  assertEquals(br.steps.map((s) => s.value), [0.16, 0.18, 0, 0.48]);
  assertAlmostEquals(bridgeSum(d), 0.82, 1e-9);
});

Deno.test("EPS bridge labels follow the sign and still sum exactly", () => {
  const facts: AnnualFacts[] = [
    {
      fiscal_year: 2024,
      period_end: "2024-12-31",
      revenue: 1000,
      operating_income: 200,
      pretax_income: 210,
      income_tax: 30,
      net_income: 180,
      shares_diluted: 100,
      eps_diluted: 1.8,
    },
    {
      fiscal_year: 2025,
      period_end: "2025-12-31",
      revenue: 900,
      operating_income: 150,
      pretax_income: 140,
      income_tax: 35,
      net_income: 105,
      shares_diluted: 110,
      eps_diluted: 0.95,
    },
  ];
  const d = derive(facts);
  const br = d.epsBridge;
  assert(br);
  const labels = Object.fromEntries(br.steps.map((s) => [s.key, s.label]));
  assertEquals(labels.sales, "Lower sales");
  assertEquals(labels.margin, "Narrower margin");
  assertEquals(labels.tax, "Higher tax rate");
  assertEquals(labels.shares, "More shares");
  assertAlmostEquals(bridgeSum(d), 0.95 - 1.8, 1e-9);
});

Deno.test("sparse two-year data", () => {
  const facts: AnnualFacts[] = [
    { fiscal_year: 2024, period_end: "2024-06-30", revenue: 50e6, net_income: 2e6, shares_outstanding: 10e6 },
    {
      fiscal_year: 2025,
      period_end: "2025-06-30",
      revenue: 60e6,
      net_income: 3e6,
      shares_outstanding: 10.5e6,
      operating_income: 6e6,
      cash: 8e6,
      debt_total: 2e6,
    },
  ];
  const d = derive(facts);
  assertShape(d);
  assertAlmostEquals(d.growth.revenueYoY as number, 20, 1e-9);
  assertAlmostEquals(d.growth.revenueCagrAll as number, 20, 1e-9);
  assertEquals(d.growth.revenueCagr5, null);
  assertEquals(d.growth.fcfCagr5, null);
  assertEquals(d.cashReturn5, { fcf: null, buybacks: null, dividends: null, ratio: null });
  assertEquals(d.dcf, null);
  assertEquals(d.netCash, [null, 6e6]);
  assertEquals(d.scorecard.find((s) => s.key === "health")?.score, 10);
  assertEquals(d.scorecard.find((s) => s.key === "profitability")?.score, 2.9); // 10% margin
  assertEquals(d.scorecard.find((s) => s.key === "growth")?.score, 10); // 20% a year, capped
  // Base growth falls back to the revenue CAGR (20, clamped to 15): line at 11.
  assertEquals(d.checks[0].threshold, 11);
  assertEquals(d.checks[0].passes, true);
  // No earlier operating margin: the margin line cannot be set, so the check is not counted.
  assertEquals(d.checks[1].passes, null);
  assertEquals(d.checks[1].current, null);
  assertEquals(d.checks[2].passes, null);
  assertAlmostEquals(d.checks[3].current as number, 5, 1e-9);
  assertEquals(d.checks[3].passes, false);
});

Deno.test("loss-maker with negative free cash flow has no DCF", () => {
  const facts: AnnualFacts[] = [2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => ({
    fiscal_year: y,
    period_end: `${y}-12-31`,
    revenue: (100 + 20 * i) * 1e6,
    gross_profit: (30 + 5 * i) * 1e6,
    operating_income: (-40 + 2 * i) * 1e6,
    pretax_income: (-42 + 2 * i) * 1e6,
    income_tax: 0,
    net_income: (-42 + 2 * i) * 1e6,
    operating_cash_flow: (-30 + i) * 1e6,
    capex: 10e6,
    cash: 200e6 - 40e6 * i,
    debt_total: 150e6,
    shares_outstanding: (50 + 5 * i) * 1e6,
  }));
  const d = derive(facts);
  assertShape(d);
  assertEquals(d.dcf, null);
  assertEquals(d.fcf[5], -35e6);
  assertEquals(d.growth.fcfCagr5, null);
  assertEquals(d.growth.fcfYoY, null);
  assertEquals(d.growth.netIncomeYoY, null);
  assertEquals(d.epsBridge, null); // prior pretax loss
  assertEquals(d.fcfToNetIncomeAll.ratio, null);
  assertEquals(d.cashReturn5.ratio, null);
  assertEquals(d.scorecard.find((s) => s.key === "profitability")?.score, 0);
  assertEquals(d.scorecard.find((s) => s.key === "health")?.score, 0); // net debt, negative FCF
  assertEquals(d.checks[2].passes, null);
  assertEquals(d.checks[3].passes, false); // shares rose 9%
  // eps fallback from net income / shares.
  assertEquals(d.eps[0], round2(-42 / 50));
});

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

Deno.test("health band scales net debt in years of free cash flow", () => {
  const facts: AnnualFacts[] = [{
    fiscal_year: 2025,
    period_end: "2025-12-31",
    operating_cash_flow: 120,
    capex: 20,
    cash: 50,
    debt_total: 250,
  }];
  const d = derive(facts);
  assertEquals(d.scorecard.find((s) => s.key === "health")?.score, 5); // 2 years of FCF
  assert(d.scorecard[2].basis.includes("2.0 years"));
});

Deno.test("missing fields everywhere: nulls, never a throw", () => {
  const facts: AnnualFacts[] = [2021, 2022, 2023, 2024, 2025].map((y) => ({
    fiscal_year: y,
    period_end: `${y}-12-31`,
  }));
  const d = derive(facts);
  assertShape(d);
  for (
    const a of [
      d.revenue,
      d.netIncome,
      d.fcf,
      d.ocf,
      d.eps,
      d.shares,
      d.grossMargin,
      d.opMargin,
      d.netMargin,
      d.fcfMargin,
      d.cash,
      d.debt,
      d.netCash,
      d.buybacks,
      d.dividends,
      d.taxRate,
    ]
  ) assert(a.every((v) => v === null));
  assertEquals(Object.values(d.growth).every((v) => v === null), true);
  assertEquals(d.sharesChange1y, null);
  assertEquals(d.sharesChangeAll, null);
  assertEquals(d.marginChange1y, { gross: null, op: null });
  assertEquals(d.cashReturn5, { fcf: null, buybacks: null, dividends: null, ratio: null });
  assertEquals(d.fcfToNetIncomeAll, { fcf: null, netIncome: null, ratio: null });
  assertEquals(d.epsBridge, null);
  assertEquals(d.dcf, null);
  assert(d.scorecard.every((s) => s.score === null));
  assert(d.checks.every((c) => c.passes === null && c.current === null));
  assertEquals(d.checks[0].threshold, 0);
});

Deno.test("empty, unsorted, duplicated and junk input", () => {
  const empty = derive([]);
  assertShape(empty);
  assertEquals(empty.years, []);
  assertEquals(empty.prior, null);
  assertEquals(empty.dcf, null);
  const junk = derive(null as unknown as AnnualFacts[]);
  assertEquals(junk.years, []);

  const d = derive([
    { fiscal_year: 2025, period_end: "2025-12-31", revenue: 120 },
    { fiscal_year: 2023, period_end: "2023-12-31", revenue: 100 },
    { fiscal_year: 2024, period_end: "2024-12-31", revenue: 90 },
    { fiscal_year: 2024, period_end: "2024-12-31", revenue: 110 },
    { fiscal_year: "x", period_end: "" } as unknown as AnnualFacts,
    { fiscal_year: 2022, period_end: "2022-12-31", revenue: NaN },
  ]);
  assertEquals(d.years, [2022, 2023, 2024, 2025]);
  assertEquals(d.revenue, [null, 100, 110, 120]);
  assertAlmostEquals(d.growth.revenueCagrAll as number, (Math.pow(1.2, 1 / 2) - 1) * 100, 1e-9);
  assertEquals(d.scorecard[1].basis.includes("from FY2023 to FY2025"), true);
});

Deno.test("cagr only between positive endpoints", () => {
  assertAlmostEquals(cagr(100, 121, 2) as number, 10, 1e-9);
  assertEquals(cagr(-100, 121, 2), null);
  assertEquals(cagr(100, -121, 2), null);
  assertEquals(cagr(0, 121, 2), null);
  assertEquals(cagr(100, 121, 0), null);
  assertEquals(cagr(null, 121, 2), null);
});

Deno.test("scorecard bands clamp to 0 and 10", () => {
  const d = derive([
    { fiscal_year: 2015, period_end: "2015-12-31", revenue: 1000 },
    { fiscal_year: 2025, period_end: "2025-12-31", revenue: 300, operating_income: 200 },
  ]);
  assertEquals(d.scorecard[0].score, 10); // 66.7% margin
  assertEquals(d.scorecard[1].score, 0); // about -11% a year
  assert(d.scorecard[1].basis.includes("−"));
});

Deno.test("operating margin line comes from the years before the latest, so it can trip", () => {
  const row = (y: number, op: number): AnnualFacts => ({
    fiscal_year: y,
    period_end: `${y}-12-31`,
    revenue: 100,
    operating_income: op,
  });
  const d = derive([row(2021, 30), row(2022, 32), row(2023, 34), row(2024, 34), row(2025, 25)]);
  const c = d.checks[1];
  assertEquals(c.threshold, 29.5); // average 32.5 over FY2021 to FY2024, minus 3
  assertEquals(c.current, 25);
  assertEquals(c.passes, false);
  assert(c.why.includes("FY2021 to FY2024"));
  // A missing buyback year means the five-year sum and the payout ratio are not disclosed.
  const e = derive([2021, 2022, 2023, 2024, 2025].map((y) => ({
    fiscal_year: y,
    period_end: `${y}-12-31`,
    revenue: 100,
    operating_cash_flow: 20,
    capex: 5,
    dividends: 3,
    buybacks: y === 2023 ? undefined : 4,
  })));
  assertEquals(e.cashReturn5.buybacks, null);
  assertEquals(e.cashReturn5.dividends, 15);
  assertEquals(e.cashReturn5.ratio, null);
});

Deno.test("a skipped fiscal year gives no one-year change, no EPS bridge and no model", () => {
  // FY2020, FY2022, FY2025: the row before FY2025 is FY2022, which is not "the year before".
  const row = (y: number, rev: number): AnnualFacts => ({
    fiscal_year: y,
    period_end: `${y}-12-31`,
    revenue: rev * B,
    gross_profit: rev * 0.4 * B,
    operating_income: rev * 0.2 * B,
    pretax_income: rev * 0.2 * B,
    income_tax: rev * 0.04 * B,
    net_income: rev * 0.16 * B,
    eps_diluted: rev * 0.016,
    operating_cash_flow: rev * 0.25 * B,
    capex: rev * 0.05 * B,
    cash: 50 * B,
    debt_total: 10 * B,
    shares_outstanding: (12 - y + 2020) * B,
    shares_diluted: (12 - y + 2020) * B,
  });
  const d = derive([row(2020, 100), row(2022, 200), row(2025, 300)]);
  assertShape(d);
  assertEquals(d.years, [2020, 2022, 2025]);
  assertEquals(d.prior, null);
  assertEquals(d.priorIndex, null);
  assertEquals(d.growth.revenueYoY, null); // not 50% "on the year"
  assertEquals(d.growth.netIncomeYoY, null);
  assertEquals(d.growth.epsYoY, null);
  assertEquals(d.growth.fcfYoY, null);
  assertEquals(d.sharesChange1y, null);
  assertEquals(d.marginChange1y, { gross: null, op: null });
  assertEquals(d.epsBridge, null);
  assertEquals(d.dcf, null); // three rows, but not three straight years
  const sales = d.checks.find((c) => c.key === "revenue_growth");
  assertEquals(sales?.current, null);
  assertEquals(sales?.passes, null);
  assert(sales?.why.startsWith("Not disclosed: needs sales for FY2025 and the fiscal year before it."));
  assertEquals(d.checks.find((c) => c.key === "share_count")?.passes, null);
  // Multi-year figures still use the real distance in years.
  assertAlmostEquals(d.growth.revenueCagrAll as number, (Math.pow(3, 1 / 5) - 1) * 100, 1e-9);
  // The margin line averages only years within five of the latest.
  const op = d.checks.find((c) => c.key === "op_margin");
  assert(op?.why.includes("FY2020 to FY2022"));

  // With the year before on record, the same history gives the one-year change and the bridge again.
  const e = derive([row(2020, 100), row(2022, 200), row(2024, 250), row(2025, 300)]);
  assertEquals(e.prior?.fiscal_year, 2024);
  assertEquals(e.priorIndex, 2);
  assertAlmostEquals(e.growth.revenueYoY as number, 20, 1e-9);
  assert(e.epsBridge);
  // FY2022, FY2024, FY2025 are not three straight years either.
  assertEquals(e.dcf, null);
  const f = derive([row(2020, 100), row(2023, 220), row(2024, 250), row(2025, 300)]);
  assert(f.dcf, "three straight years end at the latest");
});
