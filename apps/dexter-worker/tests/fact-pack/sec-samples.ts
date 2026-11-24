// Hand-written excerpts of SEC JSON in the real shapes (see the header comments of src/fact-pack/*.ts).
// The company is made up ("Acme Devices", CIK 320193 reused so URLs look real); the numbers are small and round
// so each test can state what it expects. Values are in dollars (units USD), not millions.
import type { CompanyFactsJson, XbrlFact } from "../../src/fact-pack/companyfacts";
import type { SubmissionsJson } from "../../src/fact-pack/submissions";
import type { CompanyTickersJson } from "../../src/fact-pack/ticker-cik";

export const CIK = "0000320193";
const B = 1_000_000_000;

export const TICKERS: CompanyTickersJson = {
  "0": { cik_str: 320193, ticker: "ACME", title: "Acme Devices Inc." },
  "1": { cik_str: 1067983, ticker: "BRK-B", title: "BERKSHIRE HATHAWAY INC" },
  "2": { cik_str: 1067983, ticker: "BRK-A", title: "BERKSHIRE HATHAWAY INC" },
  "3": { cik_str: 1000001, ticker: "EURO", title: "Euro Holdings N.V." }
};

// Accessions: the three 10-Ks, a 10-Q and the next quarter.
export const A22 = "0000320193-22-000108";
export const A23 = "0000320193-23-000106";
export const A24 = "0000320193-24-000123";
export const Q125 = "0000320193-25-000008";

// Fiscal years end on the last Saturday of September (52/53 weeks).
const FY = {
  2021: { start: "2020-09-27", end: "2021-09-25" },
  2022: { start: "2021-09-26", end: "2022-09-24" },
  2023: { start: "2022-09-25", end: "2023-09-30" },
  2024: { start: "2023-10-01", end: "2024-09-28" }
} as const;

const filed = { [A22]: "2022-10-28", [A23]: "2023-11-03", [A24]: "2024-11-01", [Q125]: "2025-01-31" };
const fyOf = { [A22]: 2022, [A23]: 2023, [A24]: 2024, [Q125]: 2025 };

type Accn = typeof A22 | typeof A23 | typeof A24 | typeof Q125;

/** A duration fact for a fiscal year, as filed in `accn`. */
function dur(year: keyof typeof FY, val: number, accn: Accn): XbrlFact {
  return {
    start: FY[year].start,
    end: FY[year].end,
    val,
    accn,
    fy: fyOf[accn],
    fp: accn === Q125 ? "Q1" : "FY",
    form: accn === Q125 ? "10-Q" : "10-K",
    filed: filed[accn]
  };
}

/** A balance sheet fact at a fiscal year end. */
function inst(year: keyof typeof FY, val: number, accn: Accn): XbrlFact {
  return { end: FY[year].end, val, accn, fy: fyOf[accn], fp: "FY", form: "10-K", filed: filed[accn] };
}

const usd = (...facts: XbrlFact[]) => ({ units: { USD: facts } });

export function acmeFacts(): CompanyFactsJson {
  return {
    cik: 320193,
    entityName: "Acme Devices Inc.",
    facts: {
      dei: {
        EntityCommonStockSharesOutstanding: {
          label: "Entity Common Stock, Shares Outstanding",
          units: {
            shares: [
              { end: "2023-10-20", val: 15.5 * B, accn: A23, fy: 2023, fp: "FY", form: "10-K", filed: filed[A23] },
              { end: "2024-10-18", val: 15.1 * B, accn: A24, fy: 2024, fp: "FY", form: "10-K", filed: filed[A24] },
              { end: "2025-01-17", val: 15.0 * B, accn: Q125, fy: 2025, fp: "Q1", form: "10-Q", filed: filed[Q125] }
            ]
          }
        }
      },
      "us-gaap": {
        // FY2021 was tagged with the old revenue concept only (in the FY2022 10-K as a comparative).
        SalesRevenueNet: usd(dur(2021, 365 * B, A22)),
        RevenueFromContractWithCustomerExcludingAssessedTax: usd(
          dur(2022, 394 * B, A22),
          // Duplicate comparative columns in later 10-Ks, same values.
          dur(2022, 394 * B, A23),
          dur(2022, 394 * B, A24),
          dur(2023, 383 * B, A23),
          dur(2023, 383 * B, A24),
          dur(2024, 391 * B, A24),
          // A Q4 three-month column in the 10-K and a quarter in the 10-Q: never annual values.
          { start: "2024-06-30", end: "2024-09-28", val: 95 * B, accn: A24, fy: 2024, fp: "FY", form: "10-K", filed: filed[A24] },
          { start: "2024-09-29", end: "2024-12-28", val: 124 * B, accn: Q125, fy: 2025, fp: "Q1", form: "10-Q", filed: filed[Q125] }
        ),
        GrossProfit: usd(dur(2024, 180 * B, A24)),
        CostOfRevenue: usd(dur(2023, 214 * B, A23), dur(2023, 214 * B, A24)),
        OperatingIncomeLoss: usd(dur(2022, 119 * B, A22), dur(2023, 114 * B, A23), dur(2024, 123 * B, A24)),
        NetIncomeLoss: usd(
          dur(2021, 94 * B, A22),
          dur(2022, 99.8 * B, A22),
          dur(2022, 99.8 * B, A23),
          // FY2023 first reported as 97.0B, restated in the FY2024 10-K as 96.5B.
          dur(2023, 97.0 * B, A23),
          dur(2023, 96.5 * B, A24),
          dur(2024, 93.7 * B, A24)
        ),
        EarningsPerShareDiluted: {
          units: {
            "USD/shares": [
              dur(2022, 6.11, A22),
              // The FY2024 10-K shows FY2022 after a 4-for-1 split. Per-share values stay as first reported.
              dur(2022, 1.53, A24),
              dur(2023, 6.13, A23),
              dur(2024, 6.08, A24)
            ]
          }
        },
        NetCashProvidedByUsedInOperatingActivities: usd(
          dur(2022, 122 * B, A22),
          dur(2023, 110 * B, A23),
          dur(2024, 118 * B, A24)
        ),
        PaymentsToAcquirePropertyPlantAndEquipment: usd(dur(2022, 10.7 * B, A22), dur(2023, 11 * B, A23)),
        // FY2024 capex only under the fallback concept.
        PaymentsToAcquireProductiveAssets: usd(dur(2024, 9.4 * B, A24)),
        // A non-cash note that must never be read as capex.
        CapitalExpendituresIncurredButNotYetPaid: usd(dur(2024, 50 * B, A24)),
        PaymentsOfDividends: usd(dur(2024, 15.2 * B, A24)),
        ShareBasedCompensation: usd(dur(2024, 11.7 * B, A24)),
        CashAndCashEquivalentsAtCarryingValue: usd(inst(2023, 29.9 * B, A23), inst(2024, 29.9 * B, A24)),
        MarketableSecuritiesCurrent: usd(inst(2024, 35.2 * B, A24)),
        // Debt FY2024: noncurrent + current portion + commercial paper = 85 + 10 + 10.
        LongTermDebtNoncurrent: usd(inst(2022, 99 * B, A22), inst(2024, 85 * B, A24)),
        LongTermDebtCurrent: usd(inst(2024, 10 * B, A24)),
        CommercialPaper: usd(inst(2023, 6 * B, A23), inst(2024, 10 * B, A24)),
        // Debt FY2023: LongTermDebt (includes the current portion) + commercial paper = 111 + 6.
        LongTermDebt: usd(inst(2023, 111 * B, A23)),
        // Debt FY2022: noncurrent + DebtCurrent; short-term borrowings are already inside DebtCurrent.
        DebtCurrent: usd(inst(2022, 21 * B, A22)),
        ShortTermBorrowings: usd(inst(2022, 5 * B, A22)),
        CommonStockSharesOutstanding: { units: { shares: [inst(2022, 16.0 * B, A22)] } },
        WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [dur(2024, 15.4 * B, A24)] } },
        StockholdersEquity: usd(inst(2024, 57 * B, A24)),
        Assets: usd(inst(2023, 352 * B, A23), inst(2024, 365 * B, A24))
      }
    }
  };
}

export function acmeSubmissions(): SubmissionsJson {
  // Newest first, as SEC writes it.
  const rows: Array<[string, string, string, string, string, string]> = [
    // accession, filingDate, reportDate, form, items, primaryDocument
    ["0000320193-25-000011", "2025-02-10", "2024-09-28", "10-K/A", "", "acme-10ka.htm"],
    [Q125, "2025-01-31", "2024-12-28", "10-Q", "", "acme-20241228.htm"],
    ["0000320193-25-000007", "2025-01-30", "2025-01-30", "8-K", "2.02,9.01", "acme-8k.htm"],
    ["0001140361-24-000999", "2024-12-01", "", "4", "", "form4.xml"],
    [A24, "2024-11-01", "2024-09-28", "10-K", "", "acme-20240928.htm"],
    ["0000320193-24-000081", "2024-08-02", "2024-06-29", "10-Q", "", "acme-20240629.htm"],
    ["0000320193-23-000120", "2023-12-01", "2023-12-01", "8-K", "5.07", "acme-8k-2023.htm"],
    [A23, "2023-11-03", "2023-09-30", "10-K", "", "acme-20230930.htm"]
  ];
  return {
    cik: "320193",
    name: "Acme Devices Inc.",
    tickers: ["ACME"],
    sic: "3571",
    sicDescription: "Electronic Computers",
    fiscalYearEnd: "0928",
    stateOfIncorporation: "CA",
    filings: {
      recent: {
        accessionNumber: rows.map((row) => row[0]),
        filingDate: rows.map((row) => row[1]),
        reportDate: rows.map((row) => row[2]),
        form: rows.map((row) => row[3]),
        items: rows.map((row) => row[4]),
        primaryDocument: rows.map((row) => row[5])
      }
    }
  };
}

// An IFRS filer (20-F, euros).
export function euroFacts(): CompanyFactsJson {
  const fact = (start: string, end: string, val: number, accn: string, fy: number, filedOn: string): XbrlFact => ({
    start,
    end,
    val,
    accn,
    fy,
    fp: "FY",
    form: "20-F",
    filed: filedOn
  });
  const a23 = "0001000001-24-000010";
  const a24 = "0001000001-25-000012";
  return {
    cik: 1000001,
    entityName: "Euro Holdings N.V.",
    facts: {
      "ifrs-full": {
        Revenue: {
          units: {
            EUR: [
              fact("2023-01-01", "2023-12-31", 20 * B, a23, 2023, "2024-03-01"),
              fact("2023-01-01", "2023-12-31", 20 * B, a24, 2024, "2025-03-03"),
              fact("2024-01-01", "2024-12-31", 22 * B, a24, 2024, "2025-03-03")
            ]
          }
        },
        ProfitLoss: { units: { EUR: [fact("2024-01-01", "2024-12-31", 2.5 * B, a24, 2024, "2025-03-03")] } },
        CashFlowsFromUsedInOperatingActivities: {
          units: { EUR: [fact("2024-01-01", "2024-12-31", 4 * B, a24, 2024, "2025-03-03")] }
        },
        PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities: {
          units: { EUR: [fact("2024-01-01", "2024-12-31", -1.5 * B, a24, 2024, "2025-03-03")] }
        },
        DilutedEarningsLossPerShare: {
          units: { "EUR/shares": [fact("2024-01-01", "2024-12-31", 1.25, a24, 2024, "2025-03-03")] }
        }
      }
    }
  };
}

export interface FakeSec {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  calls: Array<{ url: string; userAgent: string | null }>;
}

/** A fetch that answers SEC URLs from a table: a JSON value, a status number, or an Error to throw. */
export function fakeSec(routes: Record<string, unknown>): FakeSec {
  const calls: FakeSec["calls"] = [];
  return {
    calls,
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: input, userAgent: headers.get("user-agent") });
      const route = Object.prototype.hasOwnProperty.call(routes, input) ? routes[input] : 404;
      if (route instanceof Error) return Promise.reject(route);
      if (typeof route === "number") return Promise.resolve(new Response("{}", { status: route }));
      return Promise.resolve(
        new Response(JSON.stringify(route), { status: 200, headers: { "content-type": "application/json" } })
      );
    }
  };
}

export const SEC = {
  tickers: "https://www.sec.gov/files/company_tickers.json",
  facts: (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
  submissions: (cik: string) => `https://data.sec.gov/submissions/CIK${cik}.json`
};

export function acmeRoutes(): Record<string, unknown> {
  return {
    [SEC.tickers]: TICKERS,
    [SEC.facts(CIK)]: acmeFacts(),
    [SEC.submissions(CIK)]: acmeSubmissions()
  };
}

/** SEC client options for tests: no waiting between requests or retries. */
export const FAST = { minIntervalMs: 0, backoffMs: 0, sleep: () => Promise.resolve() };
