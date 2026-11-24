import assert from "node:assert/strict";
import test from "node:test";

import { FactIndex, mapAnnualFacts } from "../../src/fact-pack/companyfacts";
import {
  filingsWindow,
  fiscalPeriodOf,
  latestPeriodicFiling,
  periodLabel,
  recentFilings
} from "../../src/fact-pack/submissions";
import { findCik, normalizeSecTicker } from "../../src/fact-pack/ticker-cik";
import { A22, A23, A24, CIK, TICKERS, acmeFacts, acmeSubmissions, euroFacts } from "./sec-samples";

const B = 1_000_000_000;

function acmeYear(year: number) {
  const row = mapAnnualFacts(acmeFacts()).annual.find((entry) => entry.fiscal_year === year);
  assert.ok(row, `expected FY${year}`);
  return row;
}

test("annual rows: one per fiscal year by period end, oldest first, with fiscal years from the reports", () => {
  const mapping = mapAnnualFacts(acmeFacts());
  assert.equal(mapping.taxonomy, "us-gaap");
  assert.equal(mapping.currency, "USD");
  assert.deepEqual(
    mapping.annual.map((row) => [row.fiscal_year, row.period_end]),
    [
      [2021, "2021-09-25"],
      [2022, "2022-09-24"],
      [2023, "2023-09-30"],
      [2024, "2024-09-28"]
    ]
  );
});

test("duplicate comparative columns in later 10-Ks do not move a year's value or its filing", () => {
  const fy2022 = acmeYear(2022);
  assert.equal(fy2022.revenue, 394 * B);
  // The 10-K that first reported FY2022, not the later ones that repeat it.
  assert.equal(fy2022.accession, A22);
  assert.equal(fy2022.filing_date, "2022-10-28");
  assert.equal(fy2022.form, "10-K");
  // Quarter and Q4 columns are never read as a year.
  assert.equal(acmeYear(2024).revenue, 391 * B);
});

test("a restated year takes the latest filed value and the restatement is recorded", () => {
  const mapping = mapAnnualFacts(acmeFacts());
  const fy2023 = mapping.annual.find((row) => row.fiscal_year === 2023)!;
  assert.equal(fy2023.net_income, 96.5 * B);
  assert.equal(fy2023.accession, A23);
  assert.equal(fy2023.filing_date, "2023-11-03");
  assert.deepEqual(mapping.restatements, [
    {
      fiscal_year: 2023,
      field: "net_income",
      concept: "us-gaap:NetIncomeLoss",
      first_value: 97 * B,
      value: 96.5 * B,
      accession: A24,
      form: "10-K",
      filed: "2024-11-01"
    }
  ]);
});

test("per-share values stay as first reported (no split adjustment from a later filing)", () => {
  assert.equal(acmeYear(2022).eps_diluted, 6.11);
  assert.equal(acmeYear(2024).eps_diluted, 6.08);
});

test("revenue concept priority works per year and records the concept used", () => {
  assert.equal(acmeYear(2021).revenue, 365 * B);
  assert.equal(acmeYear(2021).concepts?.revenue, "us-gaap:SalesRevenueNet");
  assert.equal(
    acmeYear(2024).concepts?.revenue,
    "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax"
  );
});

test("gross profit: GrossProfit, else revenue minus cost of revenue, else missing", () => {
  assert.equal(acmeYear(2024).gross_profit, 180 * B);
  assert.equal(acmeYear(2023).gross_profit, (383 - 214) * B);
  assert.match(acmeYear(2023).concepts?.gross_profit ?? "", /- us-gaap:CostOfRevenue$/);
  assert.equal(acmeYear(2022).gross_profit, undefined);
});

test("capex fallback order, never the accrued capex note, and free cash flow", () => {
  assert.equal(acmeYear(2023).capex, 11 * B);
  assert.equal(acmeYear(2023).concepts?.capex, "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment");
  assert.equal(acmeYear(2024).capex, 9.4 * B);
  assert.equal(acmeYear(2024).concepts?.capex, "us-gaap:PaymentsToAcquireProductiveAssets");
  assert.equal(acmeYear(2024).free_cash_flow, 118 * B - 9.4 * B);
  assert.equal(acmeYear(2021).free_cash_flow, undefined);
});

test("debt composition: LongTermDebt + CP; noncurrent + current + CP; DebtCurrent already holds borrowings", () => {
  assert.equal(acmeYear(2023).debt_total, 117 * B);
  assert.equal(acmeYear(2023).concepts?.debt_total, "us-gaap:LongTermDebt + us-gaap:CommercialPaper");
  assert.equal(acmeYear(2024).debt_total, 105 * B);
  assert.equal(acmeYear(2022).debt_total, 120 * B);
  assert.equal(acmeYear(2021).debt_total, undefined);
});

test("shares outstanding: the 10-K cover count, else the balance sheet count; missing concepts stay undefined", () => {
  assert.equal(acmeYear(2024).shares_outstanding, 15.1 * B);
  assert.equal(acmeYear(2024).concepts?.shares_outstanding, "dei:EntityCommonStockSharesOutstanding");
  assert.equal(acmeYear(2023).shares_outstanding, 15.5 * B);
  assert.equal(acmeYear(2022).shares_outstanding, 16 * B);
  assert.equal(acmeYear(2024).buybacks, undefined);
  assert.equal(acmeYear(2024).pretax_income, undefined);
  assert.equal(acmeYear(2024).dividends, 15.2 * B);
});

test("IFRS filer: plain equivalents in the filing currency, payments positive, gaps listed", () => {
  const mapping = mapAnnualFacts(euroFacts());
  assert.equal(mapping.taxonomy, "ifrs-full");
  assert.equal(mapping.currency, "EUR");
  const last = mapping.annual[mapping.annual.length - 1]!;
  assert.equal(last.fiscal_year, 2024);
  assert.equal(last.revenue, 22 * B);
  assert.equal(last.net_income, 2.5 * B);
  assert.equal(last.capex, 1.5 * B);
  assert.equal(last.free_cash_flow, 2.5 * B);
  assert.equal(last.eps_diluted, 1.25);
  assert.ok(mapping.unmapped.includes("debt_total"));
});

test("no usable facts: empty mapping instead of an error", () => {
  const mapping = mapAnnualFacts({ cik: 1, entityName: "Empty", facts: {} });
  assert.equal(mapping.taxonomy, null);
  assert.deepEqual(mapping.annual, []);
});

test("ticker map: class tickers in any spelling, unknown tickers", () => {
  assert.equal(normalizeSecTicker(" brk.b "), "BRK-B");
  for (const spelling of ["BRK.B", "brk/b", "BRK-B", "BRKB", "BRK"]) {
    assert.equal(findCik(TICKERS, spelling)?.cik, "0001067983", spelling);
  }
  assert.equal(findCik(TICKERS, "BRK.A")?.secTicker, "BRK-A");
  assert.equal(findCik(TICKERS, "acme")?.cik, CIK);
  assert.equal(findCik(TICKERS, "ZZZZ"), null);
  assert.equal(findCik(TICKERS, ""), null);
});

test("latest filing: the newest 10-Q/10-K (not an amendment), fiscal period from its own facts", () => {
  const facts = acmeFacts();
  const mapping = mapAnnualFacts(facts);
  const filings = recentFilings(acmeSubmissions(), CIK);
  const latest = latestPeriodicFiling(filings, new FactIndex(facts), mapping.annual);
  assert.ok(latest);
  assert.equal(latest.form, "10-Q");
  assert.equal(latest.period_end, "2024-12-28");
  assert.equal(latest.fiscal_year, 2025);
  assert.equal(latest.fiscal_period, "Q1");
  assert.equal(latest.period_label, "2025-Q1");
  assert.equal(
    latest.url,
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000008/acme-20241228.htm"
  );

  const window = filingsWindow(filings, latest);
  assert.deepEqual(
    window.map((filing) => [filing.form, filing.filing_date]),
    [
      ["10-Q", "2025-01-31"],
      ["8-K", "2025-01-30"],
      ["10-K", "2024-11-01"],
      ["10-Q", "2024-08-02"]
    ]
  );
  assert.equal(window[1]?.items, "2.02,9.01");
});

test("period label: 10-K is YYYY-FY; without own facts the period is counted from the last year end", () => {
  const facts = acmeFacts();
  const mapping = mapAnnualFacts(facts);
  const index = new FactIndex(facts);
  const tenK = recentFilings(acmeSubmissions(), CIK).find((filing) => filing.accession === A24)!;
  const annual = fiscalPeriodOf(tenK, index, mapping.annual);
  assert.deepEqual(annual, { fiscal_year: 2024, fiscal_period: "FY" });
  assert.equal(periodLabel(2024, "FY"), "2024-FY");

  // A 10-Q that company facts do not list yet (SEC updates them a little later).
  const fresh = { form: "10-Q", filing_date: "2025-05-02", period_end: "2025-03-29", accession: "x" };
  assert.deepEqual(fiscalPeriodOf(fresh, index, mapping.annual), { fiscal_year: 2025, fiscal_period: "Q2" });
  // A 10-K newer than every annual row.
  const nextK = { form: "10-K", filing_date: "2025-10-31", period_end: "2025-09-27", accession: "y" };
  assert.deepEqual(fiscalPeriodOf(nextK, index, mapping.annual), { fiscal_year: 2025, fiscal_period: "FY" });
  // With no facts and no annual rows a 10-Q has no known period.
  assert.deepEqual(fiscalPeriodOf(fresh, null, []), null);
});
