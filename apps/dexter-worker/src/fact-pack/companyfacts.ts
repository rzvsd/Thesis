// Maps SEC XBRL company facts to AnnualFacts rows (one per fiscal year, oldest first, at most 11).
//
// Real shape of https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json:
//   { cik: 320193, entityName: "Apple Inc.", facts: {
//       "dei":     { EntityCommonStockSharesOutstanding: { label, description, units: { shares: [Fact...] } } },
//       "us-gaap": { Revenues: { label, description, units: { USD: [Fact...] } },
//                    EarningsPerShareDiluted: { units: { "USD/shares": [Fact...] } }, ... },
//       "ifrs-full": { Revenue: { units: { EUR: [Fact...] } }, ... } } }
//   Fact = { start?: "2023-10-01", end: "2024-09-28", val: 391035000000, accn: "0000320193-24-000123",
//            fy: 2024, fp: "FY", form: "10-K", filed: "2024-11-01", frame?: "CY2024" }
//   Duration facts have start and end; instant facts (balance sheet, cover page) have only end.
//   fy and fp belong to the FILING (its DocumentFiscalYearFocus/Period), not to the period of the value: the
//   FY2024 10-K also carries FY2023 and FY2022 values with fy 2024. Only non-dimensional facts are included.
//
// Rules (they fix the legacy loader, which keyed values by the filing's fy and so mixed years):
// - A fiscal year is found by its period: annual forms (10-K, 20-F, 40-F and their /A), duration 350-380 days,
//   end = that year's period end. Balance sheet values are instants at the period end.
// - Money values: the latest filed value wins, so a 10-K/A or a later 10-K that restated a year replaces the
//   first figure. Each change is recorded in `restatements`. filing_date/form/accession stay the annual report
//   that first reported the year.
// - Per-share values and share counts are taken as first reported, never from a later filing, because a later
//   filing may show them split-adjusted. Nothing is split-adjusted here, so a split shows as a step in EPS and
//   share count. The renderer must not read that step as a business change.
// - The fiscal year of a period comes from the fy of the annual report whose current period it is, else from
//   the nearest such report by counting years, else the calendar year of the period end.
import type { AnnualFacts } from "./types";

export interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number | null;
  fp?: string | null;
  form: string;
  filed: string;
  frame?: string;
}

export interface XbrlConcept {
  label?: string | null;
  description?: string | null;
  units: Record<string, XbrlFact[]>;
}

export interface CompanyFactsJson {
  cik: number | string;
  entityName: string;
  facts: Record<string, Record<string, XbrlConcept>>;
}

type FieldName = Exclude<
  keyof AnnualFacts,
  "fiscal_year" | "period_end" | "filing_date" | "form" | "accession" | "concepts" | "free_cash_flow"
>;
type Kind = "duration" | "instant";
type UnitKind = "money" | "per_share" | "shares";

interface FieldSpec {
  field: FieldName;
  kind: Kind;
  unit: UnitKind;
  /** Qualified concept names in priority order. */
  concepts: string[];
  /** Cash payments: always stored as positive numbers. */
  positive?: boolean;
}

const g = (name: string) => `us-gaap:${name}`;
const i = (name: string) => `ifrs-full:${name}`;

export const US_GAAP_REVENUE = [
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet"
].map(g);

export const US_GAAP_COST_OF_REVENUE = ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"].map(g);

const US_GAAP_FIELDS: FieldSpec[] = [
  { field: "revenue", kind: "duration", unit: "money", concepts: US_GAAP_REVENUE },
  { field: "gross_profit", kind: "duration", unit: "money", concepts: [g("GrossProfit")] },
  { field: "operating_income", kind: "duration", unit: "money", concepts: [g("OperatingIncomeLoss")] },
  {
    field: "pretax_income",
    kind: "duration",
    unit: "money",
    concepts: [
      g("IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"),
      g("IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments")
    ]
  },
  { field: "income_tax", kind: "duration", unit: "money", concepts: [g("IncomeTaxExpenseBenefit")] },
  { field: "net_income", kind: "duration", unit: "money", concepts: [g("NetIncomeLoss"), g("ProfitLoss")] },
  { field: "eps_diluted", kind: "duration", unit: "per_share", concepts: [g("EarningsPerShareDiluted")] },
  {
    field: "operating_cash_flow",
    kind: "duration",
    unit: "money",
    concepts: [
      g("NetCashProvidedByUsedInOperatingActivities"),
      g("NetCashProvidedByUsedInOperatingActivitiesContinuingOperations")
    ]
  },
  // Never CapitalExpendituresIncurredButNotYetPaid: that is a non-cash note, not the cash spent.
  {
    field: "capex",
    kind: "duration",
    unit: "money",
    concepts: [g("PaymentsToAcquirePropertyPlantAndEquipment"), g("PaymentsToAcquireProductiveAssets")],
    positive: true
  },
  {
    field: "buybacks",
    kind: "duration",
    unit: "money",
    concepts: [g("PaymentsForRepurchaseOfCommonStock")],
    positive: true
  },
  {
    field: "dividends",
    kind: "duration",
    unit: "money",
    concepts: [g("PaymentsOfDividends"), g("PaymentsOfDividendsCommonStock")],
    positive: true
  },
  {
    field: "stock_comp",
    kind: "duration",
    unit: "money",
    concepts: [g("ShareBasedCompensation"), g("AllocatedShareBasedCompensationExpense")]
  },
  {
    field: "cash",
    kind: "instant",
    unit: "money",
    concepts: [g("CashAndCashEquivalentsAtCarryingValue"), g("CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents")]
  },
  {
    field: "short_term_investments",
    kind: "instant",
    unit: "money",
    concepts: [
      g("MarketableSecuritiesCurrent"),
      g("ShortTermInvestments"),
      g("AvailableForSaleSecuritiesDebtSecuritiesCurrent")
    ]
  },
  {
    field: "shares_diluted",
    kind: "duration",
    unit: "shares",
    concepts: [g("WeightedAverageNumberOfDilutedSharesOutstanding")]
  },
  {
    field: "equity",
    kind: "instant",
    unit: "money",
    concepts: [g("StockholdersEquity"), g("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest")]
  },
  { field: "total_assets", kind: "instant", unit: "money", concepts: [g("Assets")] }
];

// IFRS filers (20-F with the ifrs-full taxonomy). Only the plain equivalents are mapped. Debt, short-term
// investments and the gross-profit fallback are left out on purpose (IFRS names and scopes differ too much to
// add up safely), so a pack from these facts lists "ifrs_mapping" in missing.
const IFRS_FIELDS: FieldSpec[] = [
  { field: "revenue", kind: "duration", unit: "money", concepts: [i("Revenue")] },
  { field: "gross_profit", kind: "duration", unit: "money", concepts: [i("GrossProfit")] },
  { field: "operating_income", kind: "duration", unit: "money", concepts: [i("ProfitLossFromOperatingActivities")] },
  { field: "pretax_income", kind: "duration", unit: "money", concepts: [i("ProfitLossBeforeTax")] },
  {
    field: "income_tax",
    kind: "duration",
    unit: "money",
    concepts: [i("IncomeTaxExpenseContinuingOperations")]
  },
  {
    field: "net_income",
    kind: "duration",
    unit: "money",
    concepts: [i("ProfitLossAttributableToOwnersOfParent"), i("ProfitLoss")]
  },
  { field: "eps_diluted", kind: "duration", unit: "per_share", concepts: [i("DilutedEarningsLossPerShare")] },
  {
    field: "operating_cash_flow",
    kind: "duration",
    unit: "money",
    concepts: [i("CashFlowsFromUsedInOperatingActivities")]
  },
  {
    field: "capex",
    kind: "duration",
    unit: "money",
    concepts: [
      i("PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"),
      i("PurchaseOfPropertyPlantAndEquipment")
    ],
    positive: true
  },
  {
    field: "dividends",
    kind: "duration",
    unit: "money",
    concepts: [i("DividendsPaidClassifiedAsFinancingActivities"), i("DividendsPaid")],
    positive: true
  },
  { field: "cash", kind: "instant", unit: "money", concepts: [i("CashAndCashEquivalents")] },
  {
    field: "equity",
    kind: "instant",
    unit: "money",
    concepts: [i("EquityAttributableToOwnersOfParent"), i("Equity")]
  },
  { field: "total_assets", kind: "instant", unit: "money", concepts: [i("Assets")] }
];

const ANNUAL_FORM = /^(10-K|20-F|40-F)(\/A)?$/;
const DAY_MS = 86_400_000;
const MAX_YEARS = 11;

export type Taxonomy = "us-gaap" | "ifrs-full";

export interface Restatement {
  fiscal_year: number;
  field: string;
  concept: string;
  first_value: number;
  value: number;
  accession: string;
  form: string;
  filed: string;
}

export interface AnnualMapping {
  taxonomy: Taxonomy | null;
  currency: string;
  annual: AnnualFacts[];
  restatements: Restatement[];
  /** Fields the taxonomy mapping does not cover at all (IFRS). */
  unmapped: string[];
}

function days(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / DAY_MS;
}

function isAnnualDuration(fact: XbrlFact): boolean {
  if (!fact.start) return false;
  const length = days(fact.start, fact.end);
  return length >= 350 && length <= 380;
}

function validFact(fact: unknown): fact is XbrlFact {
  if (typeof fact !== "object" || fact === null) return false;
  const f = fact as Partial<XbrlFact>;
  return (
    typeof f.end === "string" &&
    typeof f.val === "number" &&
    Number.isFinite(f.val) &&
    typeof f.accn === "string" &&
    typeof f.form === "string" &&
    typeof f.filed === "string"
  );
}

/** First filed wins; on a tie an original form beats an amendment. */
function byFiledAsc(a: XbrlFact, b: XbrlFact): number {
  if (a.filed !== b.filed) return a.filed < b.filed ? -1 : 1;
  return Number(a.form.endsWith("/A")) - Number(b.form.endsWith("/A"));
}

export class FactIndex {
  constructor(readonly json: CompanyFactsJson) {}

  concept(qualified: string): XbrlConcept | undefined {
    const [taxonomy, name] = qualified.split(":");
    const concept = this.json.facts?.[taxonomy ?? ""]?.[name ?? ""];
    return concept && typeof concept === "object" && concept.units ? concept : undefined;
  }

  /** Facts of a concept in one unit from annual forms. */
  annualFacts(qualified: string, unit: string): XbrlFact[] {
    const facts = this.concept(qualified)?.units?.[unit];
    if (!Array.isArray(facts)) return [];
    return facts.filter((fact) => validFact(fact) && ANNUAL_FORM.test(fact.form.trim().toUpperCase()));
  }

  /** fy/fp the filing with this accession carries in its facts (its DocumentFiscalYearFocus/Period). */
  fiscalInfoForAccession(accession: string): { fy: number; fp: string } | null {
    for (const taxonomy of Object.values(this.json.facts ?? {})) {
      for (const concept of Object.values(taxonomy ?? {})) {
        for (const facts of Object.values(concept?.units ?? {})) {
          if (!Array.isArray(facts)) continue;
          for (const fact of facts) {
            if (fact?.accn === accession && typeof fact.fy === "number" && typeof fact.fp === "string") {
              return { fy: fact.fy, fp: fact.fp.toUpperCase() };
            }
          }
        }
      }
    }
    return null;
  }
}

function pickTaxonomy(index: FactIndex): Taxonomy | null {
  const has = (concepts: string[]) =>
    concepts.some((concept) =>
      Object.keys(index.concept(concept)?.units ?? {}).some((unit) =>
        index.annualFacts(concept, unit).some(isAnnualDuration)
      )
    );
  if (has([...US_GAAP_REVENUE, g("NetIncomeLoss"), g("ProfitLoss")])) return "us-gaap";
  if (has([i("Revenue"), i("ProfitLoss")])) return "ifrs-full";
  return null;
}

/** The money unit most annual income facts use; USD wins a tie. */
function pickCurrency(index: FactIndex, concepts: string[]): string {
  const counts = new Map<string, number>();
  for (const concept of concepts) {
    for (const unit of Object.keys(index.concept(concept)?.units ?? {})) {
      if (!/^[A-Z]{3}$/.test(unit)) continue;
      counts.set(unit, (counts.get(unit) ?? 0) + index.annualFacts(concept, unit).length);
    }
  }
  let best = "USD";
  let bestCount = counts.get("USD") ?? 0;
  for (const [unit, count] of counts) {
    if (count > bestCount) {
      best = unit;
      bestCount = count;
    }
  }
  return best;
}

function unitFor(kind: UnitKind, currency: string): string {
  if (kind === "money") return currency;
  if (kind === "per_share") return `${currency}/shares`;
  return "shares";
}

interface PeriodYear {
  end: string;
  fiscalYear: number;
  /** The annual report that first reported this period. */
  original: XbrlFact;
}

/** Fiscal year ends from annual duration facts of the anchor concepts, with the fiscal year of each. */
function fiscalYears(index: FactIndex, anchors: string[], currency: string): PeriodYear[] {
  const facts = anchors.flatMap((concept) => index.annualFacts(concept, currency)).filter(isAnnualDuration);
  if (facts.length === 0) return [];

  // The current period of each annual report is the latest annual end it carries.
  const currentEnd = new Map<string, string>();
  for (const fact of facts) {
    const seen = currentEnd.get(fact.accn);
    if (!seen || fact.end > seen) currentEnd.set(fact.accn, fact.end);
  }

  const byEnd = new Map<string, XbrlFact[]>();
  for (const fact of facts) {
    const list = byEnd.get(fact.end) ?? [];
    list.push(fact);
    byEnd.set(fact.end, list);
  }

  const periods: Array<{ end: string; original: XbrlFact; anchorFy?: number }> = [];
  for (const [end, list] of byEnd) {
    const sorted = [...list].sort(byFiledAsc);
    // The report whose current period this is, first filed. Older years only seen as comparatives fall back
    // to the first filing that showed them.
    const own = sorted.filter((fact) => currentEnd.get(fact.accn) === end);
    const original = own[0] ?? sorted[0]!;
    const year = Number.parseInt(end.slice(0, 4), 10);
    const fy = own[0]?.fy;
    const plausible = typeof fy === "number" && Math.abs(fy - year) <= 1;
    periods.push({ end, original, anchorFy: plausible ? fy : undefined });
  }
  periods.sort((a, b) => (a.end < b.end ? -1 : 1));

  // Two ends within 20 days are the same year reported two ways (a data slip); keep the one with an anchor.
  const merged: typeof periods = [];
  for (const period of periods) {
    const last = merged[merged.length - 1];
    if (last && days(last.end, period.end) < 20) {
      if (last.anchorFy === undefined && period.anchorFy !== undefined) merged[merged.length - 1] = period;
      continue;
    }
    merged.push(period);
  }

  const anchored = merged.filter((period) => period.anchorFy !== undefined);
  return merged.map((period) => {
    if (period.anchorFy !== undefined) {
      return { end: period.end, fiscalYear: period.anchorFy, original: period.original };
    }
    let fiscalYear = Number.parseInt(period.end.slice(0, 4), 10);
    let nearest: (typeof anchored)[number] | undefined;
    for (const candidate of anchored) {
      if (!nearest || Math.abs(days(candidate.end, period.end)) < Math.abs(days(nearest.end, period.end))) {
        nearest = candidate;
      }
    }
    if (nearest) fiscalYear = nearest.anchorFy! + Math.round(days(nearest.end, period.end) / 365.25);
    return { end: period.end, fiscalYear, original: period.original };
  });
}

interface Picked {
  value: number;
  concept: string;
  restatement?: Omit<Restatement, "fiscal_year" | "field">;
}

/** One value for one period: the first concept in priority order that has it. */
function pickValue(
  index: FactIndex,
  spec: FieldSpec,
  period: PeriodYear,
  currency: string
): Picked | undefined {
  const unit = unitFor(spec.unit, currency);
  for (const concept of spec.concepts) {
    const candidates = index
      .annualFacts(concept, unit)
      .filter((fact) =>
        spec.kind === "duration"
          ? fact.end === period.end && isAnnualDuration(fact)
          : fact.end === period.end && !fact.start
      )
      .sort(byFiledAsc);
    if (candidates.length === 0) continue;
    const first = candidates[0]!;
    const asReported = spec.unit !== "money";
    const chosen = asReported ? first : candidates[candidates.length - 1]!;
    const sign = (value: number) => (spec.positive ? Math.abs(value) : value);
    const picked: Picked = { value: sign(chosen.val), concept };
    if (!asReported && chosen.val !== first.val) {
      picked.restatement = {
        concept,
        first_value: sign(first.val),
        value: sign(chosen.val),
        accession: chosen.accn,
        form: chosen.form,
        filed: chosen.filed
      };
    }
    return picked;
  }
  return undefined;
}

function pickInstant(index: FactIndex, concept: string, period: PeriodYear, currency: string) {
  return pickValue(index, { field: "debt_total", kind: "instant", unit: "money", concepts: [concept] }, period, currency);
}

/** Debt: LongTermDebt (it includes the current portion), else noncurrent + current portion (LongTermDebtCurrent,
 *  else DebtCurrent). Plus CommercialPaper and ShortTermBorrowings when tagged, except next to DebtCurrent,
 *  which already includes them. */
function pickDebt(index: FactIndex, period: PeriodYear, currency: string) {
  const parts: Picked[] = [];
  const total = pickInstant(index, g("LongTermDebt"), period, currency);
  let currentIsDebtCurrent = false;
  if (total) {
    parts.push(total);
  } else {
    const noncurrent = pickInstant(index, g("LongTermDebtNoncurrent"), period, currency);
    if (noncurrent) parts.push(noncurrent);
    const current = pickInstant(index, g("LongTermDebtCurrent"), period, currency);
    if (current) {
      parts.push(current);
    } else {
      const debtCurrent = pickInstant(index, g("DebtCurrent"), period, currency);
      if (debtCurrent) {
        parts.push(debtCurrent);
        currentIsDebtCurrent = true;
      }
    }
  }
  if (!currentIsDebtCurrent) {
    for (const concept of [g("CommercialPaper"), g("ShortTermBorrowings")]) {
      const part = pickInstant(index, concept, period, currency);
      if (part) parts.push(part);
    }
  }
  if (parts.length === 0) return undefined;
  return {
    value: parts.reduce((sum, part) => sum + part.value, 0),
    concept: parts.map((part) => part.concept).join(" + ")
  };
}

/** Shares outstanding: the cover page count of the annual report (dated after the period end), else the balance
 *  sheet count at the period end. As first reported. */
function pickSharesOutstanding(index: FactIndex, period: PeriodYear) {
  const cover = index
    .annualFacts("dei:EntityCommonStockSharesOutstanding", "shares")
    .filter((fact) => fact.end > period.end && days(period.end, fact.end) <= 200)
    .sort(byFiledAsc);
  const own = cover.find((fact) => fact.accn === period.original.accn) ?? cover[0];
  if (own) return { value: own.val, concept: "dei:EntityCommonStockSharesOutstanding" };
  const sheet = pickValue(
    index,
    { field: "shares_outstanding", kind: "instant", unit: "shares", concepts: [g("CommonStockSharesOutstanding")] },
    period,
    "USD"
  );
  return sheet ? { value: sheet.value, concept: sheet.concept } : undefined;
}

export function mapAnnualFacts(json: CompanyFactsJson): AnnualMapping {
  const index = new FactIndex(json);
  const taxonomy = pickTaxonomy(index);
  if (!taxonomy) return { taxonomy: null, currency: "USD", annual: [], restatements: [], unmapped: [] };

  const specs = taxonomy === "us-gaap" ? US_GAAP_FIELDS : IFRS_FIELDS;
  const anchorFields = new Set<FieldName>(["revenue", "net_income", "operating_income", "operating_cash_flow"]);
  const anchors = specs.filter((spec) => anchorFields.has(spec.field)).flatMap((spec) => spec.concepts);
  const currency = pickCurrency(index, anchors);
  const periods = fiscalYears(index, anchors, currency).slice(-MAX_YEARS);

  const restatements: Restatement[] = [];
  const annual = periods.map((period) => {
    const row: AnnualFacts = {
      fiscal_year: period.fiscalYear,
      period_end: period.end,
      filing_date: period.original.filed,
      form: period.original.form,
      accession: period.original.accn
    };
    const concepts: Record<string, string> = {};
    for (const spec of specs) {
      const picked = pickValue(index, spec, period, currency);
      if (!picked) continue;
      row[spec.field] = picked.value;
      concepts[spec.field] = picked.concept;
      if (picked.restatement) {
        restatements.push({ fiscal_year: period.fiscalYear, field: spec.field, ...picked.restatement });
      }
    }

    if (taxonomy === "us-gaap") {
      if (row.gross_profit === undefined && row.revenue !== undefined) {
        const cost = pickValue(
          index,
          { field: "gross_profit", kind: "duration", unit: "money", concepts: US_GAAP_COST_OF_REVENUE },
          period,
          currency
        );
        if (cost) {
          row.gross_profit = row.revenue - cost.value;
          concepts.gross_profit = `${concepts.revenue} - ${cost.concept}`;
        }
      }
      const debt = pickDebt(index, period, currency);
      if (debt) {
        row.debt_total = debt.value;
        concepts.debt_total = debt.concept;
      }
    }

    const shares = pickSharesOutstanding(index, period);
    if (shares) {
      row.shares_outstanding = shares.value;
      concepts.shares_outstanding = shares.concept;
    }
    if (row.operating_cash_flow !== undefined && row.capex !== undefined) {
      row.free_cash_flow = row.operating_cash_flow - row.capex;
      concepts.free_cash_flow = "operating_cash_flow - capex";
    }
    row.concepts = concepts;
    return row;
  });

  const unmapped = taxonomy === "ifrs-full" ? ["debt_total", "short_term_investments", "buybacks", "stock_comp", "shares_diluted"] : [];
  return { taxonomy, currency, annual, restatements, unmapped };
}
