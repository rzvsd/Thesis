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

// Small hand-made company facts for the edge cases below. Values are plain numbers.
type Fact = Parameters<typeof mapAnnualFacts>[0]["facts"][string][string]["units"][string][number];
const tenK = (fact: Partial<Fact> & Pick<Fact, "end" | "val" | "accn" | "filed">): Fact => ({
  fp: "FY",
  form: "10-K",
  ...fact
});
const year = (y: number) => ({ start: `${y}-01-01`, end: `${y}-12-31` });
const money = (...facts: Fact[]) => ({ units: { USD: facts } });

test("a later 10-K that re-tags a year under another concept wins over concept priority (ASC 606)", () => {
  const mapping = mapAnnualFacts({
    cik: 1,
    entityName: "Switch",
    facts: {
      "us-gaap": {
        Revenues: money(
          tenK({ ...year(2016), val: 1000, accn: "K16", fy: 2016, filed: "2017-02-20" }),
          tenK({ ...year(2016), val: 1000, accn: "K17", fy: 2017, filed: "2018-02-20" }),
          tenK({ ...year(2017), val: 1100, accn: "K17", fy: 2017, filed: "2018-02-20" })
        ),
        RevenueFromContractWithCustomerExcludingAssessedTax: money(
          tenK({ ...year(2016), val: 950, accn: "K18", fy: 2018, filed: "2019-02-20" }),
          tenK({ ...year(2017), val: 1040, accn: "K18", fy: 2018, filed: "2019-02-20" }),
          tenK({ ...year(2018), val: 1200, accn: "K18", fy: 2018, filed: "2019-02-20" })
        )
      }
    }
  });
  assert.deepEqual(
    mapping.annual.map((row) => [row.fiscal_year, row.revenue, row.accession]),
    [
      [2016, 950, "K16"],
      [2017, 1040, "K17"],
      [2018, 1200, "K18"]
    ]
  );
  assert.equal(
    mapping.annual[1]?.concepts?.revenue,
    "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax"
  );
  assert.deepEqual(mapping.restatements[1], {
    fiscal_year: 2017,
    field: "revenue",
    concept: "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
    first_concept: "us-gaap:Revenues",
    first_value: 1100,
    value: 1040,
    accession: "K18",
    form: "10-K",
    filed: "2019-02-20"
  });
  assert.equal(mapping.restatements.length, 2);
});

test("a 10-K/A of the same year updates EPS with net income; a later year's 10-K only shows the split", () => {
  const mapping = mapAnnualFacts({
    cik: 1,
    entityName: "Amend",
    facts: {
      "us-gaap": {
        NetIncomeLoss: money(
          tenK({ ...year(2024), val: 60, accn: "K24", fy: 2024, filed: "2025-02-20" }),
          tenK({ ...year(2024), val: 40, accn: "K24A", fy: 2024, form: "10-K/A", filed: "2025-06-01" }),
          tenK({ ...year(2025), val: 70, accn: "K25", fy: 2025, filed: "2026-02-20" })
        ),
        EarningsPerShareDiluted: {
          units: {
            "USD/shares": [
              tenK({ ...year(2024), val: 0.6, accn: "K24", fy: 2024, filed: "2025-02-20" }),
              tenK({ ...year(2024), val: 0.4, accn: "K24A", fy: 2024, form: "10-K/A", filed: "2025-06-01" }),
              // After a 2-for-1 split the FY2025 10-K shows FY2024 at half.
              tenK({ ...year(2024), val: 0.2, accn: "K25", fy: 2025, filed: "2026-02-20" }),
              tenK({ ...year(2025), val: 0.35, accn: "K25", fy: 2025, filed: "2026-02-20" })
            ]
          }
        }
      }
    }
  });
  const fy2024 = mapping.annual.find((row) => row.fiscal_year === 2024)!;
  assert.equal(fy2024.net_income, 40);
  // The amendment's 0.4 is the reported value (the 0.6 to 0.4 change moved with net income, so it is no split);
  // the FY2025 10-K's 0.2 is evidence of a 2-for-1 split, so FY2024 is shown on the FY2025 basis.
  assert.equal(fy2024.eps_diluted, 0.2);
  assert.deepEqual(fy2024.as_reported, { eps_diluted: 0.4 });
  assert.deepEqual(
    mapping.splits.map((split) => [split.ratio, split.effective_fiscal_year, split.evidence]),
    [[2, 2025, "restatement"]]
  );
  assert.deepEqual(
    mapping.restatements.filter((change) => change.fiscal_year === 2024).map((change) => [change.field, change.value]),
    [
      ["net_income", 40],
      ["eps_diluted", 0.4]
    ]
  );
});

test("a mis-tagged fy (10-K for 2025 tagged 2024) never gives two rows with one fiscal year", () => {
  const revenue = [2021, 2022, 2023, 2024].map((y) =>
    tenK({ ...year(y), val: y, accn: `K${y}`, fy: y, filed: `${y + 1}-02-20` })
  );
  revenue.push(tenK({ ...year(2025), val: 2025, accn: "K2025", fy: 2024, filed: "2026-02-20" }));
  const facts = { cik: 1, entityName: "Mistag", facts: { "us-gaap": { Revenues: money(...revenue) } } };
  const mapping = mapAnnualFacts(facts);
  assert.deepEqual(
    mapping.annual.map((row) => [row.fiscal_year, row.period_end]),
    [2021, 2022, 2023, 2024, 2025].map((y) => [y, `${y}-12-31`])
  );
  // The latest filing label follows the annual row, not the mis-tagged fy.
  const filing = { form: "10-K", filing_date: "2026-02-20", period_end: "2025-12-31", accession: "K2025" };
  assert.deepEqual(fiscalPeriodOf(filing, new FactIndex(facts), mapping.annual), {
    fiscal_year: 2025,
    fiscal_period: "FY"
  });

  // Only two years, one of them mis-tagged: no majority, but fiscal years still go up.
  const two = mapAnnualFacts({
    cik: 1,
    entityName: "Two",
    facts: { "us-gaap": { Revenues: money(revenue[3]!, revenue[4]!) } }
  });
  assert.deepEqual(two.annual.map((row) => row.fiscal_year), [2024, 2025]);
});

test("20-F cover share count dated at the period end is used", () => {
  const mapping = mapAnnualFacts({
    cik: 1,
    entityName: "Foreign",
    facts: {
      "ifrs-full": {
        Revenue: { units: { EUR: [tenK({ ...year(2024), val: 5, accn: "F24", fy: 2024, form: "20-F", filed: "2025-03-20" })] } }
      },
      dei: {
        EntityCommonStockSharesOutstanding: {
          units: { shares: [tenK({ end: "2024-12-31", val: 77, accn: "F24", fy: 2024, form: "20-F", filed: "2025-03-20" })] }
        }
      }
    }
  });
  assert.equal(mapping.annual[0]?.shares_outstanding, 77);
});

test("a filer that moved from US GAAP to IFRS is read in IFRS", () => {
  const ifrs = [2020, 2021, 2022].map((y) =>
    tenK({ ...year(y), val: y, accn: `F${y}`, fy: y, form: "20-F", filed: `${y + 1}-04-01` })
  );
  const mapping = mapAnnualFacts({
    cik: 1,
    entityName: "Mover",
    facts: {
      "us-gaap": { Revenues: money(tenK({ ...year(2019), val: 1, accn: "K19", fy: 2019, filed: "2020-03-01" })) },
      "ifrs-full": { Revenue: { units: { EUR: ifrs } } }
    }
  });
  assert.equal(mapping.taxonomy, "ifrs-full");
  assert.deepEqual(mapping.annual.map((row) => row.fiscal_year), [2020, 2021, 2022]);
});

test("debt: short-term borrowings, else commercial paper (never both); restated debt is recorded", () => {
  const at = (val: number, accn: string, filed: string) => tenK({ end: "2024-12-31", val, accn, fy: 2024, filed });
  const facts = (extra: Record<string, ReturnType<typeof money>>) => ({
    cik: 1,
    entityName: "Debt",
    facts: {
      "us-gaap": {
        Revenues: money(tenK({ ...year(2024), val: 1, accn: "K24", fy: 2024, filed: "2025-02-20" })),
        LongTermDebtNoncurrent: money(at(700, "K24", "2025-02-20"), at(690, "K25", "2026-02-20")),
        LongTermDebtCurrent: money(at(30, "K24", "2025-02-20")),
        CommercialPaper: money(at(10, "K24", "2025-02-20")),
        ...extra
      }
    }
  });
  const both = mapAnnualFacts(facts({ ShortTermBorrowings: money(at(15, "K24", "2025-02-20")) }));
  assert.equal(both.annual[0]?.debt_total, 690 + 30 + 15);
  assert.equal(
    both.annual[0]?.concepts?.debt_total,
    "us-gaap:LongTermDebtNoncurrent + us-gaap:LongTermDebtCurrent + us-gaap:ShortTermBorrowings"
  );
  assert.deepEqual(
    both.restatements.map((change) => [change.field, change.concept, change.first_value, change.value]),
    [["debt_total", "us-gaap:LongTermDebtNoncurrent", 700, 690]]
  );
  const paperOnly = mapAnnualFacts(facts({}));
  assert.equal(paperOnly.annual[0]?.debt_total, 690 + 30 + 10);
});
