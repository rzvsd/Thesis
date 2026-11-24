// SAMPLE DATA, for tests and previews only. Approximate public Apple Inc. 10-K figures for FY2015 to FY2025,
// rounded and in places simplified. Not a source: never show it as real data on a live page.
// - Per-share and share figures are adjusted for the 2020 four-for-one split.
// - short_term_investments holds current plus non-current marketable securities, so cash + short_term_investments
//   is the "cash and securities" figure the mockup uses (net cash about $34B in FY2025).
// - debt_total = commercial paper + current and non-current term debt.
// - No accession numbers: the sample does not point to real filings.

import type { AnnualFacts } from "./fact_pack.ts";

// Columns, money in $ billions, shares in billions:
// year, period_end, filing_date, revenue, gross_profit, operating_income, pretax_income, income_tax, net_income,
// eps_diluted, operating_cash_flow, capex, buybacks, dividends, stock_comp, cash, short_term_investments,
// debt_total, shares_outstanding, shares_diluted, equity, total_assets
type Row = [
  number,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// deno-fmt-ignore
const ROWS: Row[] = [
  [2015, "2015-09-26", "2015-10-28", 233.715, 93.626, 71.230, 72.515, 19.121, 53.394, 2.30, 81.266, 11.247, 35.253, 11.561, 3.586, 21.120, 184.546, 64.462, 22.31, 23.17, 119.355, 290.479],
  [2016, "2016-09-24", "2016-10-26", 215.639, 84.263, 60.024, 61.372, 15.685, 45.687, 2.08, 65.824, 12.734, 29.722, 12.150, 4.210, 20.484, 217.101, 87.032, 21.34, 22.00, 128.249, 321.686],
  [2017, "2017-09-30", "2017-11-03", 229.234, 88.186, 61.344, 64.089, 15.738, 48.351, 2.30, 63.598, 12.451, 32.900, 12.769, 4.840, 20.289, 248.606, 115.680, 20.50, 21.01, 134.047, 375.319],
  [2018, "2018-09-29", "2018-11-05", 265.595, 101.839, 70.898, 72.903, 13.372, 59.531, 3.00, 77.434, 13.313, 72.738, 13.712, 5.340, 25.913, 211.187, 114.483, 19.02, 19.82, 107.147, 365.725],
  [2019, "2019-09-28", "2019-10-31", 260.174, 98.392, 63.930, 65.737, 10.481, 55.256, 2.97, 69.391, 10.495, 66.897, 14.119, 6.068, 48.844, 157.054, 108.047, 17.77, 18.60, 90.488, 338.516],
  [2020, "2020-09-26", "2020-10-30", 274.515, 104.956, 66.288, 67.091, 9.680, 57.411, 3.28, 80.674, 7.309, 72.358, 14.081, 6.829, 38.016, 153.814, 112.436, 16.98, 17.53, 65.339, 323.888],
  [2021, "2021-09-25", "2021-10-29", 365.817, 152.836, 108.949, 109.207, 14.527, 94.680, 5.61, 104.038, 11.085, 85.971, 14.467, 7.906, 34.940, 155.576, 124.719, 16.43, 16.86, 63.090, 351.002],
  [2022, "2022-09-24", "2022-10-28", 394.328, 170.782, 119.437, 119.103, 19.300, 99.803, 6.11, 122.151, 10.708, 89.402, 14.841, 9.038, 23.646, 145.463, 120.069, 15.94, 16.33, 50.672, 352.755],
  [2023, "2023-09-30", "2023-11-03", 383.285, 169.148, 114.301, 113.736, 16.741, 96.995, 6.13, 110.543, 10.959, 77.550, 15.025, 10.833, 29.965, 132.134, 111.088, 15.55, 15.81, 62.146, 352.583],
  [2024, "2024-09-28", "2024-11-01", 391.035, 180.683, 123.216, 123.485, 29.749, 93.736, 6.08, 118.254, 9.447, 94.949, 15.234, 11.688, 29.943, 126.707, 106.629, 15.12, 15.41, 56.950, 364.980],
  [2025, "2025-09-27", "2025-10-31", 416.161, 195.201, 133.050, 132.729, 20.719, 112.010, 7.47, 111.482, 12.715, 90.711, 15.421, 12.863, 35.934, 96.486, 98.657, 14.78, 15.00, 73.733, 359.241],
];

const B = 1e9;
const money = (billions: number): number => Math.round(billions * B);

/** SAMPLE: Apple-like annual facts for FY2015 to FY2025, oldest first, in dollars. A fresh copy on every call. */
export function sampleAppleFacts(): AnnualFacts[] {
  return ROWS.map((r) => {
    const [
      year,
      periodEnd,
      filingDate,
      rev,
      gp,
      op,
      pt,
      tax,
      ni,
      eps,
      ocf,
      capex,
      bb,
      div,
      sbc,
      cash,
      sti,
      debt,
    ] = r;
    const [sharesOut, sharesDil, equity, assets] = [r[18], r[19], r[20], r[21]];
    return {
      fiscal_year: year,
      period_end: periodEnd,
      filing_date: filingDate,
      form: "10-K",
      revenue: money(rev),
      gross_profit: money(gp),
      operating_income: money(op),
      pretax_income: money(pt),
      income_tax: money(tax),
      net_income: money(ni),
      eps_diluted: eps,
      operating_cash_flow: money(ocf),
      capex: money(capex),
      free_cash_flow: money(ocf) - money(capex),
      buybacks: money(bb),
      dividends: money(div),
      stock_comp: money(sbc),
      cash: money(cash),
      short_term_investments: money(sti),
      debt_total: money(debt),
      shares_outstanding: Math.round(sharesOut * B),
      shares_diluted: Math.round(sharesDil * B),
      equity: money(equity),
      total_assets: money(assets),
    };
  });
}
