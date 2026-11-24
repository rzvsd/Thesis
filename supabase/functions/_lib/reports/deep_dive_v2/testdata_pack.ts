// SAMPLE DATA, for tests and previews only. Fact packs built from testdata_apple.ts (approximate Apple figures) and
// two made-up companies: a small loss-maker and a bank-like filer with no gross profit. Not sources: never show
// them as real data on a live page. Accession numbers are placeholders.

import type { AnnualFacts, FactPack, FilingRef } from "./fact_pack.ts";
import { sampleAppleFacts } from "./testdata_apple.ts";

const SEC_SOURCES = [
  { name: "SEC XBRL company facts", url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json" },
  { name: "SEC submissions", url: "https://data.sec.gov/submissions/CIK0000320193.json" },
];

const APPLE_CONCEPTS: Record<string, string> = {
  revenue: "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
  gross_profit: "us-gaap:GrossProfit",
  operating_income: "us-gaap:OperatingIncomeLoss",
  net_income: "us-gaap:NetIncomeLoss",
  eps_diluted: "us-gaap:EarningsPerShareDiluted",
  operating_cash_flow: "us-gaap:NetCashProvidedByUsedInOperatingActivities",
  capex: "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",
  buybacks: "us-gaap:PaymentsForRepurchaseOfCommonStock",
  dividends: "us-gaap:PaymentsOfDividends",
  cash: "us-gaap:CashAndCashEquivalentsAtCarryingValue",
  debt_total: "us-gaap:LongTermDebt",
  shares_outstanding: "dei:EntityCommonStockSharesOutstanding",
};

const acc = (n: number) => `0000000000-25-${String(n).padStart(6, "0")}`;

const APPLE_FILINGS: FilingRef[] = [
  { form: "10-K", filing_date: "2025-10-31", period_end: "2025-09-27", accession: acc(1) },
  { form: "8-K", filing_date: "2025-10-30", accession: acc(2), items: "2.02,9.01" },
  { form: "10-Q", filing_date: "2025-08-01", period_end: "2025-06-28", accession: acc(3) },
  { form: "8-K", filing_date: "2025-07-31", accession: acc(4), items: "2.02,9.01" },
  { form: "8-K", filing_date: "2025-05-12", accession: acc(5), items: "8.01,9.01" },
  { form: "10-Q", filing_date: "2025-05-02", period_end: "2025-03-29", accession: acc(6) },
  { form: "8-K", filing_date: "2025-05-01", accession: acc(7), items: "2.02,9.01" },
  { form: "8-K", filing_date: "2025-02-25", accession: acc(8), items: "5.07" },
  { form: "10-Q", filing_date: "2025-01-31", period_end: "2024-12-28", accession: acc(9) },
  { form: "8-K", filing_date: "2025-01-30", accession: acc(10), items: "2.02,9.01" },
];

/** SAMPLE: the AAPL fact pack (FY2015 to FY2025, 10-K filed 2025-10-31, no price at filing). */
export function sampleApplePack(): FactPack {
  const annual = sampleAppleFacts();
  annual[annual.length - 1].concepts = { ...APPLE_CONCEPTS };
  return {
    version: 1,
    source: "sec_companyfacts",
    ticker: "AAPL",
    cik: "0000320193",
    entity_name: "Apple Inc.",
    currency: "USD",
    fiscal_year_end: "0927",
    sic: "3571",
    sic_description: "Electronic computers",
    state_of_incorporation: "CA",
    retrieved_at: "2025-11-01T06:00:00.000Z",
    latest_filing: {
      form: "10-K",
      filing_date: "2025-10-31",
      period_end: "2025-09-27",
      accession: acc(1),
      fiscal_year: 2025,
      fiscal_period: "FY",
      period_label: "2025-FY",
    },
    annual,
    filings: APPLE_FILINGS.map((f) => ({ ...f })),
    price_at_filing: null,
    missing: ["segments", "regions", "owners", "price_at_filing"],
    sources: SEC_SOURCES.map((s) => ({ ...s })),
  };
}

/** SAMPLE: a stored report around a fact pack, the shape the runner writes. */
export function sampleReport(pack: FactPack, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    report_id: "sample-report",
    job_id: "sample-job",
    schema_version: "2.0",
    type: "deep_dive",
    ticker: pack.ticker,
    issuer: { name: pack.entity_name, exchange: "NASDAQ" },
    generated_at: "2025-11-01T08:00:00.000Z",
    sample: true,
    fact_pack: pack,
    ...extra,
  };
}

const B = 1e9;
const M = 1e6;

/** SAMPLE: a made-up small company with three loss-making years and growing sales. */
export function sampleLossmakerPack(): FactPack {
  const rows: Array<[number, number, number, number, number, number, number, number]> = [
    // year, revenue, gross, operating, net, ocf, capex, cash  (dollars)
    [2023, 42 * M, 18 * M, -31 * M, -29 * M, -24 * M, 3 * M, 160 * M],
    [2024, 61 * M, 28 * M, -26 * M, -24 * M, -19 * M, 4 * M, 122 * M],
    [2025, 83 * M, 40 * M, -18 * M, -17 * M, -9 * M, 5 * M, 98 * M],
  ];
  const annual: AnnualFacts[] = rows.map(([y, rev, gp, op, ni, ocf, capex, cash], i) => ({
    fiscal_year: y,
    period_end: `${y}-12-31`,
    filing_date: `${y + 1}-03-0${i + 2}`,
    form: "10-K",
    revenue: rev,
    gross_profit: gp,
    operating_income: op,
    pretax_income: op + 2 * M,
    income_tax: 0,
    net_income: ni,
    eps_diluted: Math.round((ni / ((48 + i * 3) * M)) * 100) / 100,
    operating_cash_flow: ocf,
    capex,
    free_cash_flow: ocf - capex,
    stock_comp: (6 + i) * M,
    cash,
    debt_total: 20 * M,
    shares_outstanding: (48 + i * 3) * M,
    shares_diluted: (48 + i * 3) * M,
  }));
  return {
    version: 1,
    source: "sec_companyfacts",
    ticker: "LOSS",
    cik: "0000000001",
    entity_name: "Example Loss Co <Sample>",
    currency: "USD",
    fiscal_year_end: "1231",
    sic: "7372",
    sic_description: "Prepackaged software",
    retrieved_at: "2026-03-05T06:00:00.000Z",
    latest_filing: {
      form: "10-K",
      filing_date: "2026-03-04",
      period_end: "2025-12-31",
      accession: acc(101),
      fiscal_year: 2025,
      fiscal_period: "FY",
      period_label: "2025-FY",
    },
    annual,
    filings: [
      { form: "10-K", filing_date: "2026-03-04", period_end: "2025-12-31", accession: acc(101) },
      { form: "8-K", filing_date: "2026-02-26", accession: acc(102), items: "2.02,9.01" },
      { form: "8-K", filing_date: "2025-11-20", accession: acc(103), items: "5.02" },
    ],
    price_at_filing: null,
    missing: ["segments", "regions", "owners", "price_at_filing"],
    sources: [{
      name: "SEC XBRL company facts",
      url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
    }],
  };
}

/** SAMPLE: a made-up bank-like filer: no gross profit, net debt, a stored price at filing. */
export function sampleBankPack(): FactPack {
  const annual: AnnualFacts[] = [];
  for (let k = 0; k < 6; k++) {
    const y = 2020 + k;
    const rev = (40 + k * 2.5) * B;
    annual.push({
      fiscal_year: y,
      period_end: `${y}-12-31`,
      filing_date: `${y + 1}-02-2${k % 9}`,
      form: "10-K",
      revenue: rev,
      operating_income: rev * (0.34 + k * 0.004),
      pretax_income: rev * (0.34 + k * 0.004),
      income_tax: rev * 0.07,
      net_income: rev * (0.27 + k * 0.004),
      operating_cash_flow: rev * 0.3,
      capex: 1.2 * B,
      buybacks: (6 + k) * B,
      dividends: 5 * B,
      cash: (90 + k) * B,
      debt_total: (240 - k * 4) * B,
      shares_outstanding: (3.2 - k * 0.05) * B,
      shares_diluted: (3.25 - k * 0.05) * B,
    });
  }
  return {
    version: 1,
    source: "sec_companyfacts",
    ticker: "BANK",
    cik: "0000000002",
    entity_name: "Example Bank Corp",
    currency: "USD",
    fiscal_year_end: "1231",
    sic: "6021",
    sic_description: "National commercial banks",
    retrieved_at: "2026-02-28T06:00:00.000Z",
    latest_filing: {
      form: "10-K",
      filing_date: "2026-02-27",
      period_end: "2025-12-31",
      accession: acc(201),
      fiscal_year: 2025,
      fiscal_period: "FY",
      period_label: "2025-FY",
    },
    annual,
    filings: [{ form: "10-K", filing_date: "2026-02-27", period_end: "2025-12-31", accession: acc(201) }],
    price_at_filing: { value: 61.5, date: "2026-02-27", source: "sample" },
    missing: ["segments", "regions", "owners"],
    sources: [{
      name: "SEC XBRL company facts",
      url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000002.json",
    }],
  };
}

/**
 * SAMPLE: a made-up flat business (same sales and profit every year) whose share count moves in FY2025.
 * "split_listed": a 4-for-1 split the pack lists, rows already on the FY2025 basis (as the runner writes them).
 * "split_raw": the same split with rows as each year's report gave them and no splits list (a legacy pack).
 * "issue": a real 30% share issue in FY2025, no split.
 */
export function sampleSharesPack(mode: "split_listed" | "split_raw" | "issue"): FactPack {
  const annual: AnnualFacts[] = [2021, 2022, 2023, 2024, 2025].map((y) => {
    const latest = y === 2025;
    const reported = mode === "issue" ? (latest ? 104 * M : 80 * M) : latest ? 320 * M : 80 * M;
    const shares = mode === "split_listed" ? 320 * M : reported;
    const row: AnnualFacts = {
      fiscal_year: y,
      period_end: `${y}-12-31`,
      filing_date: `${y + 1}-02-20`,
      form: "10-K",
      revenue: 1 * B,
      gross_profit: 0.4 * B,
      operating_income: 0.2 * B,
      pretax_income: 0.2 * B,
      income_tax: 0.04 * B,
      net_income: 0.16 * B,
      eps_diluted: Math.round((0.16 * B / shares) * 100) / 100,
      operating_cash_flow: 0.25 * B,
      capex: 0.05 * B,
      free_cash_flow: 0.2 * B,
      cash: 0.5 * B,
      debt_total: 0.1 * B,
      shares_outstanding: shares,
      shares_diluted: shares,
    };
    if (mode === "split_listed" && !latest) {
      row.as_reported = { eps_diluted: 2, shares_diluted: 80 * M, shares_outstanding: 80 * M };
    }
    return row;
  });
  return {
    version: 1,
    source: "sec_companyfacts",
    ticker: "SPLT",
    cik: "0000000003",
    entity_name: "Example Split Co",
    currency: "USD",
    fiscal_year_end: "1231",
    retrieved_at: "2026-02-21T06:00:00.000Z",
    latest_filing: {
      form: "10-K",
      filing_date: "2026-02-20",
      period_end: "2025-12-31",
      accession: acc(301),
      fiscal_year: 2025,
      fiscal_period: "FY",
      period_label: "2025-FY",
    },
    annual,
    ...(mode === "split_listed"
      ? {
        splits: [{
          ratio: 4,
          effective_fiscal_year: 2025,
          evidence: "restatement" as const,
          concept: "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",
          accession: acc(301),
          filed: "2026-02-20",
        }],
      }
      : {}),
    filings: [{ form: "10-K", filing_date: "2026-02-20", period_end: "2025-12-31", accession: acc(301) }],
    price_at_filing: null,
    missing: ["segments", "regions", "owners", "price_at_filing"],
    sources: [{
      name: "SEC XBRL company facts",
      url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000003.json",
    }],
  };
}
