// Deep Dive 2.0: turns a stored report into the facts the renderer draws from. Pure TS (no Deno APIs).
// A report with a usable fact pack (report.fact_pack, see fact_pack.ts) is read as is. An older report without one
// is mapped from financial_analysis.annual_history (the legacy rows) into AnnualFacts, so it renders the same page
// with more "Not seen yet" cards. Legacy prose is never read: only numbers with a field name are kept.

import {
  type AnnualFacts,
  type FactPack,
  type FilingRef,
  type PriceAtFiling,
  readFactPack,
  type StockSplit,
} from "./fact_pack.ts";

export interface LatestFilingInfo {
  form: string;
  fiscalYear: number | null;
  /** "FY", "Q1", "Q2", "Q3" or "Q4" (legacy reports can say Q4). */
  fiscalPeriod: string | null;
  filingDate: string | null;
  periodEnd: string | null;
}

export interface ReportFacts {
  mode: "fact_pack" | "legacy";
  ticker: string;
  name: string;
  exchange: string | null;
  /** SIC description (fact pack) or issuer industry/sector (legacy). */
  industry: string | null;
  sic: string | null;
  /** MMDD, e.g. "0927". */
  fiscalYearEnd: string | null;
  currency: string;
  /** Oldest first, one row per fiscal year. */
  annual: AnnualFacts[];
  /** Stock splits the fact pack lists (its rows are already adjusted for them). Empty for legacy reports and
   *  packs that list none; derive.ts then looks for a split in the share counts itself. */
  splits: StockSplit[];
  latestFiling: LatestFilingInfo | null;
  /** Newest first. */
  filings: FilingRef[];
  price: PriceAtFiling | null;
  /** Parts the pack could not fill ("segments", "regions", ...). */
  missing: string[];
  sources: Array<{ name: string; url: string }>;
  generatedAt: string | null;
  retrievedAt: string | null;
  /** Legacy name relationships, names only. */
  relationships: Array<{ name: string; kind: string }>;
  /** True only when the stored report says it is sample data. */
  sample: boolean;
}

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
/** Report text can never form the page's own [[ref:id]] chart-link token (render.ts runs it after escaping). */
const defang = (v: string): string => v.replace(/\[\[ref:/gi, "[[ ref:");
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? defang(v.trim()) : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown): string | null => {
  const s = str(v);
  return s && DATE.test(s.slice(0, 10)) ? s.slice(0, 10) : null;
};

/** Legacy margins are percent numbers (46.9) in live reports; some old fixtures store fractions (0.469).
 * All margins within ±1 is not enough on its own: a thin-margin company stores 0.8 for 0.8%. Where net profit and
 * sales are on record, the reading closer to the net margin wins. */
function marginScale(rows: Rec[]): number {
  const ms = rows.flatMap((r) => [num(r.gross_margin), num(r.operating_margin)]).filter((v): v is number =>
    v !== undefined
  );
  if (!ms.length || !ms.every((m) => Math.abs(m) <= 1) || !ms.some((m) => Math.abs(m) >= 0.02)) return 1;
  let fraction = 0, percent = 0;
  for (const r of rows) {
    const rev = num(r.revenue), ni = num(r.net_income);
    const m = num(r.operating_margin) ?? num(r.gross_margin);
    if (rev === undefined || rev <= 0 || ni === undefined || m === undefined) continue;
    const netPct = (ni / rev) * 100;
    if (Math.abs(m * 100 - netPct) < Math.abs(m - netPct)) fraction++;
    else percent++;
  }
  return fraction + percent === 0 || fraction > percent ? 100 : 1;
}

/** Maps financial_analysis.annual_history rows to AnnualFacts (oldest first, one per year). Money stays in units. */
export function legacyAnnual(history: unknown): AnnualFacts[] {
  if (!Array.isArray(history)) return [];
  const rows = history.filter((r): r is Rec =>
    isRec(r) && num(r.fiscal_year) !== undefined &&
    (r.period_type === undefined || r.period_type === "annual")
  );
  const scale = marginScale(rows);
  const byYear = new Map<number, AnnualFacts>();
  for (const r of rows) {
    const year = num(r.fiscal_year) as number;
    const revenue = num(r.revenue);
    const gm = num(r.gross_margin);
    const om = num(r.operating_margin);
    const row: AnnualFacts = { fiscal_year: year, period_end: "" };
    if (revenue !== undefined) row.revenue = revenue;
    if (revenue !== undefined && gm !== undefined) row.gross_profit = (gm * scale / 100) * revenue;
    if (revenue !== undefined && om !== undefined) row.operating_income = (om * scale / 100) * revenue;
    const map: Array<[keyof AnnualFacts, string]> = [
      ["net_income", "net_income"],
      ["free_cash_flow", "free_cash_flow"],
      ["debt_total", "debt_total"],
      ["cash", "cash_and_equivalents"],
      ["shares_outstanding", "shares_outstanding"],
    ];
    for (const [to, from] of map) {
      const v = num(r[from]);
      if (v !== undefined) (row as unknown as Rec)[to] = v;
    }
    byYear.set(year, row);
  }
  return [...byYear.values()].sort((a, b) => a.fiscal_year - b.fiscal_year);
}

function legacyLatest(report: Rec): LatestFilingInfo | null {
  const fi = isRec(report.filing_intelligence) ? report.filing_intelligence : null;
  const lf = fi && isRec(fi.latest_filing) ? fi.latest_filing : null;
  if (!lf) return null;
  const form = str(lf.form);
  if (!form || form === "unknown") return null;
  const q = num(lf.fiscal_quarter);
  return {
    form,
    fiscalYear: num(lf.fiscal_year) ?? null,
    fiscalPeriod: /^10-K/.test(form) ? "FY" : q ? `Q${q}` : null,
    filingDate: date(lf.filing_date),
    periodEnd: null,
  };
}

function relationships(report: Rec): ReportFacts["relationships"] {
  const list = Array.isArray(report.name_relationships) ? report.name_relationships : [];
  const out: ReportFacts["relationships"] = [];
  const seen = new Set<string>();
  for (const r of list) {
    if (!isRec(r)) continue;
    const name = str(r.target_ticker);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name: name.slice(0, 40),
      kind: (str(r.relationship_type) ?? "").replace(/_/g, " ").slice(0, 40),
    });
  }
  return out.slice(0, 24);
}

function validPrice(p: PriceAtFiling | null): PriceAtFiling | null {
  return p && num(p.value) !== undefined && p.value > 0 && date(p.date)
    ? { ...p, date: date(p.date) as string }
    : null;
}

function issuerText(report: Rec, key: string): string | null {
  return isRec(report.issuer) ? str(report.issuer[key]) : null;
}

const LEGACY_MISSING = ["segments", "regions", "customers", "owners", "filings", "price_at_filing"];

/** Everything the renderer needs from a stored report. Never throws on a malformed report. */
export function readReportFacts(report: unknown): ReportFacts {
  const r: Rec = isRec(report) ? report : {};
  const pack: FactPack | null = readFactPack(r);
  const ticker = (str(r.ticker) ?? pack?.ticker ?? "").toUpperCase().slice(0, 12);
  const name = issuerText(r, "name") ?? str(pack?.entity_name) ?? (ticker || "This company");
  const common = {
    ticker,
    name,
    generatedAt: date(r.generated_at),
    relationships: relationships(r),
    sample: r.sample === true,
  };
  if (pack) {
    const lf = pack.latest_filing;
    return {
      ...common,
      mode: "fact_pack",
      exchange: issuerText(r, "exchange"),
      industry: str(pack.sic_description) ?? issuerText(r, "industry") ?? issuerText(r, "sector"),
      sic: str(pack.sic),
      fiscalYearEnd: str(pack.fiscal_year_end),
      currency: str(pack.currency) ?? "USD",
      annual: pack.annual,
      splits: pack.splits ?? [],
      latestFiling: lf
        ? {
          form: str(lf.form) ?? "10-K",
          fiscalYear: num(lf.fiscal_year) ?? null,
          fiscalPeriod: str(lf.fiscal_period),
          filingDate: date(lf.filing_date),
          periodEnd: date(lf.period_end),
        }
        : null,
      filings: pack.filings.filter((f) => isRec(f) && str(f.form) && date(f.filing_date))
        .map((f) => ({
          ...f,
          form: str(f.form) as string,
          items: typeof f.items === "string" ? defang(f.items) : undefined,
        }))
        .sort((a, b) => (a.filing_date < b.filing_date ? 1 : a.filing_date > b.filing_date ? -1 : 0)),
      price: validPrice(pack.price_at_filing),
      missing: pack.missing.filter((m) => typeof m === "string").map(defang),
      sources: pack.sources.filter((s) => isRec(s) && str(s.name)).map((s) => ({
        ...s,
        name: str(s.name) as string,
        url: typeof s.url === "string" ? defang(s.url) : "",
      })),
      retrievedAt: date(pack.retrieved_at),
    };
  }
  const fa = isRec(r.financial_analysis) ? r.financial_analysis : {};
  const latest = legacyLatest(r);
  return {
    ...common,
    mode: "legacy",
    exchange: issuerText(r, "exchange"),
    industry: issuerText(r, "industry") ?? issuerText(r, "sector"),
    sic: null,
    fiscalYearEnd: null,
    currency: issuerText(r, "currency") ?? "USD",
    annual: legacyAnnual(fa.annual_history),
    splits: [],
    latestFiling: latest,
    filings: latest
      ? [{
        form: latest.form,
        filing_date: latest.filingDate ?? "",
        accession: "",
        ...(latest.periodEnd ? { period_end: latest.periodEnd } : {}),
      }]
      : [],
    price: null,
    missing: [...LEGACY_MISSING],
    sources: [],
    retrievedAt: null,
  };
}

/** The as-of date of the report: the latest filing's date, else the latest annual row's, else generation. */
export function asOfDate(f: ReportFacts): string | null {
  const last = f.annual[f.annual.length - 1];
  return f.latestFiling?.filingDate ?? date(last?.filing_date) ?? f.generatedAt;
}
