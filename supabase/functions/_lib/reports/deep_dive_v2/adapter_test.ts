import { assertAlmostEquals, assertEquals, assertStrictEquals } from "jsr:@std/assert@1.0.13";
import { asOfDate, legacyAnnual, readReportFacts } from "./adapter.ts";
import { sampleApplePack, sampleBankPack, sampleReport } from "./testdata_pack.ts";

Deno.test("readReportFacts reads a fact pack report", () => {
  const f = readReportFacts(sampleReport(sampleApplePack()));
  assertEquals(f.mode, "fact_pack");
  assertEquals(f.ticker, "AAPL");
  assertEquals(f.name, "Apple Inc.");
  assertEquals(f.annual.length, 11);
  assertEquals(f.latestFiling?.form, "10-K");
  assertEquals(f.latestFiling?.fiscalPeriod, "FY");
  assertEquals(f.price, null);
  assertEquals(f.filings[0].filing_date, "2025-10-31"); // newest first
  assertEquals(f.sample, true);
  assertEquals(asOfDate(f), "2025-10-31");
});

Deno.test("readReportFacts keeps a valid price at filing and drops a bad one", () => {
  assertEquals(readReportFacts(sampleReport(sampleBankPack())).price?.value, 61.5);
  const pack = sampleBankPack();
  pack.price_at_filing = { value: -3, date: "2026-02-27", source: "x" };
  assertEquals(readReportFacts(sampleReport(pack)).price, null);
});

Deno.test("legacyAnnual maps percent margins and money in units", () => {
  const rows = legacyAnnual([
    {
      period: "2025-FY",
      period_type: "annual",
      fiscal_year: 2025,
      revenue: 200,
      gross_margin: 40,
      operating_margin: 10,
    },
    { period: "2025-Q3", period_type: "quarterly", fiscal_year: 2025, revenue: 50 },
    {
      period: "2024-FY",
      period_type: "annual",
      fiscal_year: 2024,
      revenue: 100,
      net_income: 7,
      cash_and_equivalents: 9,
    },
  ]);
  assertEquals(rows.map((r) => r.fiscal_year), [2024, 2025]);
  assertEquals(rows[1].gross_profit, 80);
  assertEquals(rows[1].operating_income, 20);
  assertEquals(rows[0].cash, 9);
  assertEquals(rows[0].net_income, 7);
  assertStrictEquals(rows[0].gross_profit, undefined);
});

Deno.test("legacyAnnual reads fraction margins from old fixtures", () => {
  const rows = legacyAnnual([{
    period_type: "annual",
    fiscal_year: 2025,
    revenue: 1000,
    gross_margin: 0.45,
  }]);
  assertEquals(Math.round(rows[0].gross_profit as number), 450);
});

Deno.test("readReportFacts maps a legacy report and never throws on junk", () => {
  const f = readReportFacts({
    ticker: "aapl",
    issuer: { name: "Apple Inc.", exchange: "NASDAQ" },
    financial_analysis: { annual_history: [{ period_type: "annual", fiscal_year: 2025, revenue: 5 }] },
    filing_intelligence: { latest_filing: { form: "10-K", period: "2025-FY", fiscal_year: 2025 } },
    name_relationships: [{ target_ticker: "TSM", relationship_type: "supplier" }, { target_ticker: "TSM" }],
  });
  assertEquals(f.mode, "legacy");
  assertEquals(f.ticker, "AAPL");
  assertEquals(f.latestFiling?.fiscalPeriod, "FY");
  assertEquals(f.relationships, [{ name: "TSM", kind: "supplier" }]);
  assertEquals(f.missing.includes("price_at_filing"), true);
  for (const junk of [null, 3, "x", [], { fact_pack: { version: 2 } }]) {
    const j = readReportFacts(junk);
    assertEquals(j.annual, []);
  }
});

Deno.test("legacyAnnual keeps thin percent margins as percents when net profit says so", () => {
  const rows = legacyAnnual([
    { period_type: "annual", fiscal_year: 2024, revenue: 100e9, operating_margin: 0.8, net_income: 0.5e9 },
    { period_type: "annual", fiscal_year: 2025, revenue: 105e9, operating_margin: 0.9, net_income: 0.55e9 },
  ]);
  assertAlmostEquals(rows[0].operating_income as number, 0.008 * 100e9, 1);
  assertAlmostEquals(rows[1].operating_income as number, 0.009 * 105e9, 1);
  // Fractions that match the net margin are still read as fractions.
  const frac = legacyAnnual([
    { period_type: "annual", fiscal_year: 2025, revenue: 100, operating_margin: 0.3, net_income: 24 },
  ]);
  assertEquals(frac[0].operating_income, 30);
});

Deno.test("readReportFacts defangs the chart-link token and drops non-string 8-K items", () => {
  const pack = sampleApplePack();
  pack.entity_name = "Evil [[ref:biz-sales]] Inc.";
  pack.filings = [
    { form: "8-K", filing_date: "2025-01-01", accession: "a", items: 202 as unknown as string },
    { form: "8-K [[ref:x]]", filing_date: "2025-02-01", accession: "b", items: "2.02,[[ref:y]]" },
  ];
  const f = readReportFacts(sampleReport(pack));
  assertEquals(f.name.includes("[[ref:"), false);
  assertEquals(f.filings.find((x) => x.accession === "a")?.items, undefined);
  assertEquals(JSON.stringify(f.filings).includes("[[ref:"), false);
});
