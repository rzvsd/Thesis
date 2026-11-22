import type {
  CanonicalFinancialSnapshot,
  EvidenceItem,
  FinancialIndicator,
  FinancialIndicatorBenchmark,
  FinancialIndicatorCalculationBasis,
  FinancialIndicatorsBlock,
  FinancialIndicatorsMemo,
  FinancialIndicatorPriceReference,
  FinancialIndicatorTrend,
  InvestorEducationBox,
  IndicatorOmission,
  ValueClassificationBlock
} from "../../../packages/contracts/src";

import type { DexterConfig } from "./config";
import { runLiveDexterQuery } from "./live-dexter";

const promptVersion = "ph7-m13-financial-indicators-v2";

type DataKey = keyof CanonicalFinancialSnapshot["data"];
type IndicatorGroup = "valuation" | "profitability" | "growth" | "balance_sheet" | "cash_flow_quality" | "capital_allocation";

interface BuildFinancialIndicatorsInput {
  ticker: string;
  generatedAt: string;
  latest?: CanonicalFinancialSnapshot;
  financials: CanonicalFinancialSnapshot[];
  spotPrice?: number;
  priceReference?: FinancialIndicatorPriceReference;
  fixtureMode: boolean;
}

interface MetricSpec {
  id: string;
  label: string;
  unit: FinancialIndicator["unit"];
  group: IndicatorGroup;
  compute: (ctx: CalculatorContext) => number | undefined;
  missingReason: string;
  interpretation: (value: number | undefined, ctx: CalculatorContext) => string;
}

interface CalculatorContext {
  ticker: string;
  latest?: CanonicalFinancialSnapshot;
  metricSnapshot?: CanonicalFinancialSnapshot;
  balanceSheetSnapshot?: CanonicalFinancialSnapshot;
  calculationBasis: FinancialIndicatorCalculationBasis;
  annualsDesc: CanonicalFinancialSnapshot[];
  annualsAsc: CanonicalFinancialSnapshot[];
  spotPrice?: number;
  priceReference?: FinancialIndicatorPriceReference;
  marketCap?: number;
  enterpriseValue?: number;
}

const bannedNarrativePattern =
  /\b(buy|sell|hold|short|long|price target|entry|exit|stop loss|take profit|trade now|add shares|trim shares|overweight|underweight|outperform|underperform|position size|allocation)\b/i;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function data(snapshot: CanonicalFinancialSnapshot | undefined, key: DataKey): number | undefined {
  const value = snapshot?.data[key];
  return isFiniteNumber(value) ? value : undefined;
}

function safeDivide(numerator?: number, denominator?: number): number | undefined {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) {
    return undefined;
  }
  return numerator / denominator;
}

function percent(value?: number): number | undefined {
  return isFiniteNumber(value) ? value * 100 : undefined;
}

function percentChange(current?: number, prior?: number): number | undefined {
  if (!isFiniteNumber(current) || !isFiniteNumber(prior) || prior === 0) {
    return undefined;
  }
  return ((current - prior) / Math.abs(prior)) * 100;
}

function subtractIfBoth(left?: number, right?: number): number | undefined {
  if (!isFiniteNumber(left) || !isFiniteNumber(right)) {
    return undefined;
  }
  return left - right;
}

function cagr(current?: number, prior?: number, years?: number): number | undefined {
  if (!isFiniteNumber(current) || !isFiniteNumber(prior) || !isFiniteNumber(years) || years <= 0 || current <= 0 || prior <= 0) {
    return undefined;
  }
  return (Math.pow(current / prior, 1 / years) - 1) * 100;
}

function round(value: number | undefined, digits = 2): number | undefined {
  if (!isFiniteNumber(value)) {
    return undefined;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortAnnualDesc(snapshots: CanonicalFinancialSnapshot[]): CanonicalFinancialSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.period_type === "annual")
    .slice()
    .sort((a, b) => b.fiscal_year - a.fiscal_year);
}

function sortQuarterlyDesc(snapshots: CanonicalFinancialSnapshot[]): CanonicalFinancialSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.period_type === "quarterly")
    .slice()
    .sort((a, b) => {
      if (b.fiscal_year !== a.fiscal_year) {
        return b.fiscal_year - a.fiscal_year;
      }
      return (b.fiscal_quarter ?? 0) - (a.fiscal_quarter ?? 0);
    });
}

function evidenceForSnapshot(snapshot: CanonicalFinancialSnapshot, retrievedAt: string): EvidenceItem {
  return {
    evidence_id: `financial-indicators-${snapshot.ticker.toLowerCase()}-${snapshot.period.toLowerCase()}`,
    source_type: "financial_data",
    source_name: `SEC companyfacts/XBRL ${snapshot.period_type} snapshot`,
    excerpt:
      `${snapshot.ticker} ${snapshot.period} SEC-backed financial snapshot used for financial indicators; ` +
      `available fields include ${Object.keys(snapshot.data).slice(0, 10).join(", ")}.`,
    retrieved_at: snapshot.retrieved_at || retrievedAt
  };
}

function priceEvidence(ticker: string, spotPrice: number, generatedAt: string): EvidenceItem {
  return {
    evidence_id: `financial-indicators-${ticker.toLowerCase()}-spot-price`,
    source_type: "financial_data",
    source_name: "Approved Deep Dive spot/reference price",
    excerpt:
      `${ticker} spot/reference price available to Deep Dive context: ${spotPrice}. ` +
      "M13 records kind/date/source in price_reference when upstream provenance is available.",
    retrieved_at: generatedAt
  };
}

function defaultPriceReference(input: BuildFinancialIndicatorsInput, spotPrice: number): FinancialIndicatorPriceReference {
  return input.priceReference ?? {
    source_name: "Approved Deep Dive spot/reference price",
    retrieved_at: input.generatedAt,
    price_date: input.generatedAt.slice(0, 10),
    currency: "USD",
    price_kind: input.fixtureMode ? "fixture" : "close",
    value: spotPrice,
    provenance_note:
      input.fixtureMode
        ? "Fixture price used for deterministic Deep Dive proof; live reports should attach provider-specific price provenance upstream."
        : "Price was supplied by the approved Deep Dive context; provider-specific URL is absent unless the upstream source attaches it."
  };
}

function indicator(args: {
  id: string;
  label: string;
  value?: number;
  unit: FinancialIndicator["unit"];
  period: string;
  interpretation: string;
  evidenceRefs: string[];
}): FinancialIndicator {
  return {
    indicator_id: args.id,
    label: args.label,
    value: args.value,
    unit: args.unit,
    period: args.period,
    state: args.value === undefined ? "missing" : "available",
    interpretation: args.interpretation,
    evidence_refs: args.evidenceRefs
  };
}

function addOmission(
  omissions: IndicatorOmission[],
  family: IndicatorOmission["family"],
  reasonCode: IndicatorOmission["reason_code"],
  reason: string
): void {
  if (omissions.some((entry) => entry.family === family && entry.reason_code === reasonCode && entry.reason === reason)) {
    return;
  }
  omissions.push({ family, reason_code: reasonCode, reason, blocking: false });
}

function latestAnnual(ctx: CalculatorContext): CanonicalFinancialSnapshot | undefined {
  return ctx.annualsDesc[0] ?? ctx.latest;
}

function metricSnapshot(ctx: CalculatorContext): CanonicalFinancialSnapshot | undefined {
  return ctx.metricSnapshot ?? latestAnnual(ctx);
}

function metricData(ctx: CalculatorContext, key: DataKey): number | undefined {
  return data(metricSnapshot(ctx), key);
}

function balanceData(ctx: CalculatorContext, key: DataKey): number | undefined {
  return data(ctx.balanceSheetSnapshot ?? metricSnapshot(ctx), key);
}

function yearsBetween(current?: CanonicalFinancialSnapshot, prior?: CanonicalFinancialSnapshot): number | undefined {
  if (!current || !prior) {
    return undefined;
  }
  return Math.max(1, current.fiscal_year - prior.fiscal_year);
}

function annualOffset(ctx: CalculatorContext, yearsBack: number): CanonicalFinancialSnapshot | undefined {
  const current = latestAnnual(ctx);
  if (!current) {
    return undefined;
  }
  return ctx.annualsDesc.find((snapshot) => snapshot.fiscal_year <= current.fiscal_year - yearsBack);
}

function valueAt(ctx: CalculatorContext, key: DataKey, yearsBack: number): number | undefined {
  return data(yearsBack === 0 ? latestAnnual(ctx) : annualOffset(ctx, yearsBack), key);
}

const valuationSpecs: MetricSpec[] = [
  {
    id: "market_cap",
    label: "Market cap",
    unit: "currency",
    group: "valuation",
    compute: (ctx) => ctx.marketCap,
    missingReason: "Market cap requires spot/reference price and shares outstanding.",
    interpretation: (value) =>
      value === undefined
        ? "Market cap is omitted because approved price or share count is missing."
        : "Market cap shows what the market currently says the equity is worth."
  },
  {
    id: "enterprise_value",
    label: "Enterprise value",
    unit: "currency",
    group: "valuation",
    compute: (ctx) => ctx.enterpriseValue,
    missingReason: "Enterprise value requires market cap, debt, and cash.",
    interpretation: (value) =>
      value === undefined
        ? "Enterprise value is omitted because market cap, debt, or cash is missing."
        : "Enterprise value adds debt and subtracts cash so the reader sees the full business price."
  },
  {
    id: "pe_ratio",
    label: "P/E",
    unit: "multiple",
    group: "valuation",
    compute: (ctx) => safeDivide(ctx.spotPrice, metricData(ctx, "eps_diluted") ?? metricData(ctx, "eps")),
    missingReason: "P/E requires spot/reference price and positive EPS.",
    interpretation: (value) =>
      value === undefined
        ? "P/E is omitted because price or EPS is missing."
        : value < 15
          ? "P/E sits in a classic value-looking range, but the rest of the memo must test whether that is cheap or a trap."
          : value > 35
            ? "P/E is above a classic value range, so the stock needs durable earnings quality to justify the multiple."
            : "P/E is not obviously cheap or extreme by itself; quality and growth decide the read."
  },
  {
    id: "ps_ratio",
    label: "P/S",
    unit: "multiple",
    group: "valuation",
    compute: (ctx) => safeDivide(ctx.marketCap, metricData(ctx, "revenue")),
    missingReason: "P/S requires market cap and revenue.",
    interpretation: (value) =>
      value === undefined
        ? "P/S is omitted because market cap or revenue is missing."
        : value > 8
          ? "P/S is high, which means the market is paying a premium for each dollar of sales."
          : "P/S is not stretched on its own, but margins decide how much of sales becomes profit."
  },
  {
    id: "pb_ratio",
    label: "P/B",
    unit: "multiple",
    group: "valuation",
    compute: (ctx) => safeDivide(ctx.marketCap, balanceData(ctx, "shareholders_equity")),
    missingReason: "P/B requires market cap and shareholders' equity.",
    interpretation: (value) =>
      value === undefined
        ? "P/B is omitted because market cap or equity is missing."
        : value > 6
          ? "P/B is high, so the market is valuing the company far above book equity."
          : "P/B is not the whole story, but it helps distinguish asset value from earnings power."
  },
  {
    id: "ev_ebitda",
    label: "EV/EBITDA",
    unit: "multiple",
    group: "valuation",
    compute: (ctx) => safeDivide(ctx.enterpriseValue, metricData(ctx, "ebitda")),
    missingReason: "EV/EBITDA requires enterprise value and EBITDA.",
    interpretation: (value) =>
      value === undefined
        ? "EV/EBITDA is omitted because enterprise value or EBITDA is missing."
        : value > 20
          ? "EV/EBITDA is premium, so operating cash economics need to stay strong."
          : "EV/EBITDA is not premium enough by itself to settle the value question."
  },
  {
    id: "fcf_yield",
    label: "FCF yield",
    unit: "pct",
    group: "valuation",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "free_cash_flow"), ctx.marketCap)),
    missingReason: "FCF yield requires free cash flow and market cap.",
    interpretation: (value) =>
      value === undefined
        ? "FCF yield is omitted because market cap or free cash flow is missing."
        : value < 3
          ? "FCF yield is low for classic value, which means the stock is priced for quality or growth."
          : "FCF yield gives the reader a cash-return view of valuation."
  }
];

const nonPriceSpecs: MetricSpec[] = [
  {
    id: "gross_margin",
    label: "Gross margin",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => metricData(ctx, "gross_margin") ?? percent(safeDivide(metricData(ctx, "gross_profit"), metricData(ctx, "revenue"))),
    missingReason: "Gross margin requires gross profit and revenue.",
    interpretation: (value) => value === undefined ? "Gross margin is missing." : value > 60 ? "Gross margin is excellent and points to strong product economics." : "Gross margin shows how much sales value survives direct costs."
  },
  {
    id: "operating_margin",
    label: "Operating margin",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => metricData(ctx, "operating_margin") ?? percent(safeDivide(metricData(ctx, "operating_income"), metricData(ctx, "revenue"))),
    missingReason: "Operating margin requires operating income and revenue.",
    interpretation: (value) => value === undefined ? "Operating margin is missing." : value > 25 ? "Operating margin is strong; the business keeps a lot of profit after operating costs." : "Operating margin shows whether scale is turning into operating profit."
  },
  {
    id: "net_margin",
    label: "Net margin",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "net_income"), metricData(ctx, "revenue"))),
    missingReason: "Net margin requires net income and revenue.",
    interpretation: (value) => value === undefined ? "Net margin is missing." : value > 20 ? "Net margin is strong; a meaningful share of revenue reaches the bottom line." : "Net margin is the cleanest simple view of final profitability."
  },
  {
    id: "roe",
    label: "ROE",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "net_income"), balanceData(ctx, "shareholders_equity"))),
    missingReason: "ROE requires net income and shareholders' equity.",
    interpretation: (value) => value === undefined ? "ROE is missing." : value > 20 ? "ROE is strong, suggesting the company earns a high return on shareholder capital." : "ROE shows whether equity capital is being used productively."
  },
  {
    id: "roa",
    label: "ROA",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "net_income"), balanceData(ctx, "total_assets"))),
    missingReason: "ROA requires net income and total assets.",
    interpretation: (value) => value === undefined ? "ROA is missing." : value > 10 ? "ROA is strong, which means the asset base is producing meaningful earnings." : "ROA helps test whether profit is supported by the asset base."
  },
  {
    id: "roic",
    label: "ROIC",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => {
      const taxRate = metricData(ctx, "effective_tax_rate");
      const investedCapital = subtractIfBoth(
        (balanceData(ctx, "debt_total") ?? 0) + (balanceData(ctx, "shareholders_equity") ?? 0),
        balanceData(ctx, "cash_and_equivalents")
      );
      return percent(safeDivide(
        metricData(ctx, "operating_income") !== undefined && taxRate !== undefined
          ? metricData(ctx, "operating_income")! * (1 - taxRate)
          : undefined,
        investedCapital
      ));
    },
    missingReason: "ROIC requires operating income, effective tax rate, debt, cash, and equity.",
    interpretation: (value) => value === undefined ? "ROIC is omitted because invested-capital or tax inputs are incomplete." : value > 15 ? "ROIC is strong; the company is producing high returns on the capital tied up in the business." : "ROIC tests whether growth is earning attractive returns, not just getting larger."
  },
  {
    id: "asset_turnover",
    label: "Asset turnover",
    unit: "ratio",
    group: "profitability",
    compute: (ctx) => safeDivide(metricData(ctx, "revenue"), balanceData(ctx, "total_assets")),
    missingReason: "Asset turnover requires revenue and total assets.",
    interpretation: (value) => value === undefined ? "Asset turnover is missing." : "Asset turnover shows how much revenue the company produces from each dollar of assets."
  },
  {
    id: "gross_profit_assets",
    label: "Gross profit / assets",
    unit: "pct",
    group: "profitability",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "gross_profit"), balanceData(ctx, "total_assets"))),
    missingReason: "Gross profit/assets requires gross profit and total assets.",
    interpretation: (value) => value === undefined ? "Gross profit/assets is missing." : value > 25 ? "Gross profit/assets is strong and points to valuable assets or a capital-light model." : "Gross profit/assets helps compare business quality before financing choices."
  },
  {
    id: "revenue_cagr_5y",
    label: "Revenue CAGR",
    unit: "pct",
    group: "growth",
    compute: (ctx) => cagr(valueAt(ctx, "revenue", 0), valueAt(ctx, "revenue", 5), yearsBetween(latestAnnual(ctx), annualOffset(ctx, 5))),
    missingReason: "Revenue CAGR requires enough annual revenue history.",
    interpretation: (value) => value === undefined ? "Revenue CAGR is missing." : value > 10 ? "Revenue compounded at a strong pace over the reviewed period." : "Revenue CAGR shows whether the company has actually been getting larger."
  },
  {
    id: "eps_cagr_5y",
    label: "EPS CAGR",
    unit: "pct",
    group: "growth",
    compute: (ctx) => cagr(valueAt(ctx, "eps_diluted", 0) ?? valueAt(ctx, "eps", 0), valueAt(ctx, "eps_diluted", 5) ?? valueAt(ctx, "eps", 5), yearsBetween(latestAnnual(ctx), annualOffset(ctx, 5))),
    missingReason: "EPS CAGR requires enough annual EPS history.",
    interpretation: (value) => value === undefined ? "EPS CAGR is missing." : value > 10 ? "EPS has compounded strongly, which helps explain premium valuation." : "EPS CAGR tests whether revenue growth is reaching owners."
  },
  {
    id: "fcf_cagr_5y",
    label: "FCF CAGR",
    unit: "pct",
    group: "growth",
    compute: (ctx) => cagr(valueAt(ctx, "free_cash_flow", 0), valueAt(ctx, "free_cash_flow", 5), yearsBetween(latestAnnual(ctx), annualOffset(ctx, 5))),
    missingReason: "FCF CAGR requires enough annual free-cash-flow history.",
    interpretation: (value) => value === undefined ? "FCF CAGR is missing." : value > 10 ? "Free cash flow compounded strongly, which supports business quality." : "FCF CAGR tests whether growth turns into owner cash."
  },
  {
    id: "debt_to_equity",
    label: "Debt / equity",
    unit: "ratio",
    group: "balance_sheet",
    compute: (ctx) => safeDivide(balanceData(ctx, "debt_total"), balanceData(ctx, "shareholders_equity")),
    missingReason: "Debt/equity requires total debt and shareholders' equity.",
    interpretation: (value) => value === undefined ? "Debt/equity is missing." : value < 0.6 ? "Debt/equity is manageable; leverage is not the main story." : "Debt/equity needs attention because leverage can make cheap stocks dangerous."
  },
  {
    id: "net_debt_ebitda",
    label: "Net debt / EBITDA",
    unit: "ratio",
    group: "balance_sheet",
    compute: (ctx) => safeDivide(subtractIfBoth(balanceData(ctx, "debt_total"), balanceData(ctx, "cash_and_equivalents")), metricData(ctx, "ebitda")),
    missingReason: "Net debt/EBITDA requires debt, cash, and EBITDA.",
    interpretation: (value) => value === undefined ? "Net debt/EBITDA is missing." : value <= 0 ? "Net cash position reduces balance-sheet stress." : value < 2 ? "Net debt/EBITDA is manageable." : "Net debt/EBITDA is elevated enough to watch."
  },
  {
    id: "cash_debt",
    label: "Cash / debt",
    unit: "ratio",
    group: "balance_sheet",
    compute: (ctx) => safeDivide(balanceData(ctx, "cash_and_equivalents"), balanceData(ctx, "debt_total")),
    missingReason: "Cash/debt requires cash and total debt.",
    interpretation: (value) => value === undefined ? "Cash/debt is missing." : value > 1 ? "Cash covers total debt, which gives the company room to absorb stress." : "Cash/debt shows how much of leverage is covered by immediate liquidity."
  },
  {
    id: "interest_coverage",
    label: "Interest coverage",
    unit: "ratio",
    group: "balance_sheet",
    compute: (ctx) => safeDivide(metricData(ctx, "operating_income"), metricData(ctx, "interest_expense") === undefined ? undefined : Math.abs(metricData(ctx, "interest_expense")!)),
    missingReason: "Interest coverage requires operating income and interest expense.",
    interpretation: (value) => value === undefined ? "Interest coverage is missing." : value > 8 ? "Interest coverage is comfortable; operating profit covers interest many times over." : value > 3 ? "Interest coverage is usable but worth watching if profit weakens." : "Interest coverage is thin, so debt risk can dominate the story quickly."
  },
  {
    id: "current_ratio",
    label: "Current ratio",
    unit: "ratio",
    group: "balance_sheet",
    compute: (ctx) => safeDivide(balanceData(ctx, "current_assets"), balanceData(ctx, "current_liabilities")),
    missingReason: "Current ratio requires current assets and current liabilities.",
    interpretation: (value) => value === undefined ? "Current ratio is omitted because current asset/liability fields are missing." : value > 1.5 ? "Current ratio suggests a decent short-term liquidity cushion." : "Current ratio is a simple check on near-term balance-sheet flexibility."
  },
  {
    id: "quick_ratio",
    label: "Quick ratio",
    unit: "ratio",
    group: "balance_sheet",
    compute: (ctx) => safeDivide(subtractIfBoth(balanceData(ctx, "current_assets"), balanceData(ctx, "inventory") ?? 0), balanceData(ctx, "current_liabilities")),
    missingReason: "Quick ratio requires current assets, current liabilities, and inventory when available.",
    interpretation: (value) => value === undefined ? "Quick ratio is omitted because short-term liquidity inputs are missing." : value > 1 ? "Quick ratio indicates liquid assets cover near-term liabilities." : "Quick ratio is tighter and deserves attention if cash flow also weakens."
  },
  {
    id: "fcf_margin",
    label: "FCF margin",
    unit: "pct",
    group: "cash_flow_quality",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "free_cash_flow"), metricData(ctx, "revenue"))),
    missingReason: "FCF margin requires free cash flow and revenue.",
    interpretation: (value) => value === undefined ? "FCF margin is missing." : value > 20 ? "FCF margin is strong; revenue is converting into real cash." : "FCF margin tests whether sales become spendable cash."
  },
  {
    id: "cash_conversion",
    label: "Cash conversion",
    unit: "ratio",
    group: "cash_flow_quality",
    compute: (ctx) => safeDivide(metricData(ctx, "free_cash_flow"), metricData(ctx, "net_income")),
    missingReason: "Cash conversion requires free cash flow and net income.",
    interpretation: (value) => value === undefined ? "Cash conversion is missing." : value > 0.8 ? "Cash conversion is healthy; reported profit is backed by cash." : "Cash conversion is weaker and deserves scrutiny."
  },
  {
    id: "capex_intensity",
    label: "Capex intensity",
    unit: "pct",
    group: "cash_flow_quality",
    compute: (ctx) => {
      const capex = metricData(ctx, "capital_expenditure");
      return percent(safeDivide(capex === undefined ? undefined : Math.abs(capex), metricData(ctx, "revenue")));
    },
    missingReason: "Capex intensity requires capital expenditure and revenue.",
    interpretation: (value) => value === undefined ? "Capex intensity is missing." : value > 15 ? "Capex intensity is high, so cash-flow durability needs extra attention." : "Capex intensity is not consuming an unusually large share of revenue."
  },
  {
    id: "share_count_change_5y",
    label: "Share count change",
    unit: "pct",
    group: "capital_allocation",
    compute: (ctx) => percentChange(valueAt(ctx, "shares_outstanding", 0), valueAt(ctx, "shares_outstanding", 5)),
    missingReason: "Share-count change requires enough annual share history.",
    interpretation: (value) => value === undefined ? "Share-count trend is missing." : value < 0 ? "Share count declined, which means buybacks or retirements helped owners." : value > 5 ? "Share count rose, so dilution deserves attention." : "Share count was broadly stable."
  },
  {
    id: "buyback_yield",
    label: "Buyback yield",
    unit: "pct",
    group: "capital_allocation",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "share_repurchases"), ctx.marketCap)),
    missingReason: "Buyback yield requires repurchase dollars and market cap.",
    interpretation: (value) => value === undefined ? "Buyback yield is omitted because repurchase or market-cap data is missing." : value > 2 ? "Buyback yield is meaningful; capital returns are reducing the equity base." : "Buyback yield is not a large part of the read."
  },
  {
    id: "dividend_yield",
    label: "Dividend yield",
    unit: "pct",
    group: "capital_allocation",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "dividends_paid") === undefined ? undefined : Math.abs(metricData(ctx, "dividends_paid")!), ctx.marketCap)),
    missingReason: "Dividend yield requires dividend cash paid and market cap.",
    interpretation: (value) => value === undefined ? "Dividend yield is omitted because dividend or market-cap data is missing." : value > 3 ? "Dividend yield is a meaningful part of shareholder return." : "Dividend yield is modest; the value case depends more on earnings and cash flow."
  },
  {
    id: "payout_ratio",
    label: "Payout ratio",
    unit: "pct",
    group: "capital_allocation",
    compute: (ctx) => percent(safeDivide(metricData(ctx, "dividends_paid") === undefined ? undefined : Math.abs(metricData(ctx, "dividends_paid")!), metricData(ctx, "net_income"))),
    missingReason: "Payout ratio requires dividend cash paid and net income.",
    interpretation: (value) => value === undefined ? "Payout ratio is omitted because dividend or net-income data is missing." : value < 60 ? "Payout ratio leaves room for reinvestment or buybacks." : "Payout ratio is high enough to watch if earnings weaken."
  }
];

function buildIndicators(
  specs: MetricSpec[],
  ctx: CalculatorContext,
  omissions: IndicatorOmission[],
  evidenceRefs: string[]
): Record<IndicatorGroup, FinancialIndicator[]> {
  const grouped: Record<IndicatorGroup, FinancialIndicator[]> = {
    valuation: [],
    profitability: [],
    growth: [],
    balance_sheet: [],
    cash_flow_quality: [],
    capital_allocation: []
  };
  const period = metricSnapshot(ctx)?.period ?? latestAnnual(ctx)?.period ?? ctx.latest?.period ?? "unknown";

  for (const spec of specs) {
    const value = round(spec.compute(ctx));
    if (value === undefined) {
      const reasonCode = spec.group === "valuation" && !ctx.spotPrice ? "missing_price" : "missing_denominator";
      addOmission(omissions, spec.group === "valuation" && !ctx.spotPrice ? "price_source" : spec.group, reasonCode, spec.missingReason);
    }
    grouped[spec.group].push(indicator({
      id: spec.id,
      label: spec.label,
      value,
      unit: spec.unit,
      period,
      interpretation: spec.interpretation(value, ctx),
      evidenceRefs
    }));
  }

  return grouped;
}

function trendDirection(current?: number, reference?: number, higherIsBetter = true): FinancialIndicatorTrend["direction"] {
  const change = percentChange(current, reference);
  if (change === undefined) {
    return "unavailable";
  }
  if (Math.abs(change) < 2) {
    return "unchanged";
  }
  return (change > 0) === higherIsBetter ? "improving" : "weakening";
}

function buildTrend(ctx: CalculatorContext, id: string, label: string, unit: FinancialIndicator["unit"], key: DataKey, higherIsBetter = true): FinancialIndicatorTrend {
  const current = round(valueAt(ctx, key, 0));
  const oneYearAgo = round(valueAt(ctx, key, 1));
  const threeYearsAgo = round(valueAt(ctx, key, 3));
  const fiveYearsAgo = round(valueAt(ctx, key, 5));
  const direction = trendDirection(current, fiveYearsAgo ?? threeYearsAgo ?? oneYearAgo, higherIsBetter);
  return {
    indicator_id: id,
    label,
    unit,
    current,
    one_year_ago: oneYearAgo,
    three_years_ago: threeYearsAgo,
    five_years_ago: fiveYearsAgo,
    direction,
    plain_english:
      direction === "improving"
        ? `${label} improved over the reviewed history.`
        : direction === "weakening"
          ? `${label} weakened over the reviewed history and needs explanation.`
          : direction === "unchanged"
            ? `${label} was broadly stable over the reviewed history.`
            : `${label} does not have enough annual history for a clean trend.`,
    evidence_refs: ctx.annualsDesc.map((snapshot) => `financial-indicators-${snapshot.ticker.toLowerCase()}-${snapshot.period.toLowerCase()}`).slice(0, 5)
  };
}

function findIndicator(group: FinancialIndicator[], id: string): number | undefined {
  return group.find((entry) => entry.indicator_id === id)?.value;
}

const ttmFlowKeys: DataKey[] = [
  "revenue",
  "gross_profit",
  "operating_income",
  "net_income",
  "eps",
  "eps_diluted",
  "ebitda",
  "free_cash_flow",
  "operating_cash_flow",
  "capital_expenditure",
  "depreciation_amortization",
  "interest_expense",
  "share_repurchases",
  "dividends_paid"
];

function sumDefined(snapshots: CanonicalFinancialSnapshot[], key: DataKey): number | undefined {
  let total = 0;
  let count = 0;
  for (const snapshot of snapshots) {
    const value = data(snapshot, key);
    if (value !== undefined) {
      total += value;
      count += 1;
    }
  }
  return count === snapshots.length ? total : undefined;
}

function quarterIndex(snapshot: CanonicalFinancialSnapshot): number | undefined {
  const fiscalQuarter = snapshot.fiscal_quarter;
  if (fiscalQuarter === undefined || !Number.isInteger(fiscalQuarter) || fiscalQuarter < 1 || fiscalQuarter > 4) {
    return undefined;
  }
  return snapshot.fiscal_year * 4 + (fiscalQuarter - 1);
}

// True TTM needs four unique fiscal quarters with no gap; duplicates or a missing quarter span more than twelve months.
function areConsecutiveQuartersDesc(quartersDesc: CanonicalFinancialSnapshot[]): boolean {
  const indexes = quartersDesc.map(quarterIndex);
  return indexes.every((index, position) =>
    index !== undefined && (position === 0 || index === (indexes[position - 1] as number) - 1));
}

function buildTtmMetricSnapshot(
  ticker: string,
  quartersDesc: CanonicalFinancialSnapshot[],
  retrievedAt: string
): { snapshot?: CanonicalFinancialSnapshot; periods: string[] } {
  const lastFour = quartersDesc.slice(0, 4);
  if (lastFour.length < 4 || !areConsecutiveQuartersDesc(lastFour)) {
    return { periods: [] };
  }
  const metricDataMap: CanonicalFinancialSnapshot["data"] = {};
  for (const key of ttmFlowKeys) {
    const value = sumDefined(lastFour, key);
    if (value !== undefined) {
      metricDataMap[key] = value;
    }
  }
  const revenue = metricDataMap.revenue;
  const grossProfit = metricDataMap.gross_profit;
  const operatingIncome = metricDataMap.operating_income;
  if (revenue !== undefined && revenue !== 0) {
    if (grossProfit !== undefined) {
      metricDataMap.gross_margin = (grossProfit / revenue) * 100;
    }
    if (operatingIncome !== undefined) {
      metricDataMap.operating_margin = (operatingIncome / revenue) * 100;
    }
  }
  const taxRates = lastFour.map((snapshot) => data(snapshot, "effective_tax_rate")).filter(isFiniteNumber);
  if (taxRates.length > 0) {
    metricDataMap.effective_tax_rate = taxRates.reduce((sum, value) => sum + value, 0) / taxRates.length;
  }
  return {
    periods: lastFour.map((snapshot) => snapshot.period),
    snapshot: {
      snapshot_id: `${ticker}-ttm-${lastFour[0]?.period ?? "unknown"}`,
      ticker,
      period: `TTM through ${lastFour[0]?.period ?? "unknown"}`,
      period_type: "annual",
      fiscal_year: lastFour[0]?.fiscal_year ?? new Date(retrievedAt).getUTCFullYear(),
      provider: "derived_ttm_from_quarterly_snapshots",
      retrieved_at: retrievedAt,
      data: metricDataMap,
      missing_fields: []
    }
  };
}

function buildBenchmarks(block: {
  valuation: FinancialIndicator[];
  profitability: FinancialIndicator[];
  balanceSheet: FinancialIndicator[];
  cashFlow: FinancialIndicator[];
  valueClassification: ValueClassificationBlock;
}): FinancialIndicatorBenchmark[] {
  const cohort = "reviewed broad-market quality/value band";
  const all = [
    ...block.valuation,
    ...block.profitability,
    ...block.balanceSheet,
    ...block.cashFlow
  ];
  const bands: Array<{ id: string; label: string; unit: FinancialIndicator["unit"]; low: number; median: number; high: number; aboveIsGood?: boolean }> = [
    { id: "pe_ratio", label: "P/E", unit: "multiple", low: 15, median: 25, high: 35 },
    { id: "ps_ratio", label: "P/S", unit: "multiple", low: 3, median: 6, high: 10 },
    { id: "ev_ebitda", label: "EV/EBITDA", unit: "multiple", low: 10, median: 16, high: 24 },
    { id: "fcf_yield", label: "FCF yield", unit: "pct", low: 2.5, median: 5, high: 8, aboveIsGood: true },
    { id: "operating_margin", label: "Operating margin", unit: "pct", low: 15, median: 25, high: 35, aboveIsGood: true },
    { id: "roic", label: "ROIC", unit: "pct", low: 8, median: 15, high: 25, aboveIsGood: true },
    { id: "debt_to_equity", label: "Debt / equity", unit: "ratio", low: 0.3, median: 0.8, high: 1.5 },
    { id: "cash_conversion", label: "Cash conversion", unit: "ratio", low: 0.6, median: 0.85, high: 1.1, aboveIsGood: true }
  ];
  return bands.map((band) => {
    const indicatorValue = all.find((entry) => entry.indicator_id === band.id)?.value;
    const comparison: FinancialIndicatorBenchmark["comparison"] =
      indicatorValue === undefined
        ? "unavailable"
        : indicatorValue < band.low
          ? "below"
          : indicatorValue > band.high
            ? "above"
            : "near";
    const plainEnglish =
      comparison === "unavailable"
        ? `${band.label} cannot be benchmarked because the indicator is missing.`
        : comparison === "near"
          ? `${band.label} sits inside the reviewed broad-market band, so it is not the oddest part of the read.`
          : band.aboveIsGood
            ? `${band.label} is ${comparison} the reviewed band; for this metric, higher usually points to stronger quality or cash return.`
            : `${band.label} is ${comparison} the reviewed band; for this metric, higher usually means the company must justify more valuation or leverage pressure.`;
    return {
      indicator_id: band.id,
      label: band.label,
      cohort,
      median: band.median,
      low: band.low,
      high: band.high,
      unit: band.unit,
      comparison,
      plain_english: plainEnglish
    };
  });
}

function buildEducationBoxes(
  block: {
    classification: ValueClassificationBlock;
    evidenceRefs: string[];
    hasPrice: boolean;
    hasRoic: boolean;
  }
): InvestorEducationBox[] {
  const label = block.classification.classification.replaceAll("_", " ");
  return [
    {
      topic: "classification",
      title: `What does "${label}" mean?`,
      body:
        label === "classic value"
          ? "Classic value means the company looks inexpensive relative to earnings, cash flow, or book value. The important test is whether the business is durable enough for that cheapness to matter."
          : label === "quality growth" || label === "expensive growth"
            ? "Quality growth means the market is paying for durable growth, margins, and cash conversion. It is not classic cheapness; it is a bet that business quality keeps justifying the premium."
            : "This label is a shorthand for the pattern of valuation, profitability, cash flow, and balance-sheet evidence. It is not a recommendation and it should change when the evidence changes.",
      example: "A low P/E can be a bargain when cash flow is stable, or a trap when earnings are falling.",
      evidence_refs: block.evidenceRefs
    },
    {
      topic: "value_trap",
      title: "What would make it a value trap?",
      body:
        "A value trap is cheap for a reason. Falling revenue, shrinking margins, weak cash conversion, high debt, or dilution can make a low multiple look attractive while the business is actually getting worse.",
      example: "Cheap plus improving cash flow is different from cheap plus collapsing earnings.",
      evidence_refs: block.evidenceRefs
    },
    {
      topic: "valuation_multiple",
      title: "Why valuation multiples matter",
      body:
        block.hasPrice
          ? "Price-based ratios show how much the market is paying for sales, earnings, book value, and cash flow. They are useful only when read beside growth and quality."
          : "Price-based ratios are omitted here because an approved price was not available. That is better than pretending to know P/E from an unapproved quote.",
      example: "A P/E of 45 can be rational for a compounding business, while a P/E of 12 can still be dangerous if earnings are deteriorating.",
      evidence_refs: block.evidenceRefs
    },
    {
      topic: "cash_flow_quality",
      title: "Why cash-flow quality matters",
      body:
        "Accounting earnings are not enough. Cash conversion and free-cash-flow margin test whether reported profit turns into cash the company can reinvest, return, or use to reduce risk.",
      evidence_refs: block.evidenceRefs
    },
    {
      topic: "roic",
      title: block.hasRoic ? "Why ROIC matters" : "Why ROIC is omitted",
      body:
        block.hasRoic
          ? "ROIC asks whether the company earns attractive returns on the capital tied up in the business. It is one of the cleanest tests of business quality."
          : "ROIC is omitted when operating income, tax rate, debt, cash, or equity inputs are incomplete. The report avoids using a rough guess as if it were a clean quality signal.",
      evidence_refs: block.evidenceRefs
    }
  ];
}

function classifyValue(args: {
  valuation: FinancialIndicator[];
  profitability: FinancialIndicator[];
  growth: FinancialIndicator[];
  balanceSheet: FinancialIndicator[];
  cashFlow: FinancialIndicator[];
}): ValueClassificationBlock {
  const pe = findIndicator(args.valuation, "pe_ratio");
  const ps = findIndicator(args.valuation, "ps_ratio");
  const fcfYield = findIndicator(args.valuation, "fcf_yield");
  const roe = findIndicator(args.profitability, "roe");
  const operatingMargin = findIndicator(args.profitability, "operating_margin");
  const revenueCagr = findIndicator(args.growth, "revenue_cagr_5y");
  const fcfCagr = findIndicator(args.growth, "fcf_cagr_5y");
  const debtEquity = findIndicator(args.balanceSheet, "debt_to_equity");
  const cashConversion = findIndicator(args.cashFlow, "cash_conversion");
  const reasons: string[] = [];
  const trapWarnings: string[] = [];

  if (pe === undefined && roe === undefined && revenueCagr === undefined) {
    return {
      classification: "insufficient_data",
      confidence: "low",
      reasons: ["There is not enough valuation or quality data to classify the company."],
      trap_warnings: []
    };
  }

  if ((pe !== undefined && pe < 15) && (revenueCagr !== undefined && revenueCagr < 0 || fcfCagr !== undefined && fcfCagr < 0 || debtEquity !== undefined && debtEquity > 1.5)) {
    trapWarnings.push("Low valuation is paired with weakening growth, cash flow, or leverage risk.");
    return {
      classification: "value_trap_risk",
      confidence: "medium",
      reasons: ["The stock looks optically cheap, but business-quality signals are not clean."],
      trap_warnings: trapWarnings
    };
  }

  if ((pe !== undefined && pe < 15) && (fcfYield !== undefined && fcfYield > 5) && (cashConversion !== undefined && cashConversion > 0.8)) {
    reasons.push("Valuation is low while cash generation remains healthy.");
    return { classification: "classic_value", confidence: "medium", reasons, trap_warnings: trapWarnings };
  }

  if ((pe === undefined || pe < 25) && (roe !== undefined && roe > 18) && (cashConversion !== undefined && cashConversion > 0.8)) {
    reasons.push("Profitability and cash conversion are strong without an obviously stretched multiple.");
    return { classification: "quality_value", confidence: "medium", reasons, trap_warnings: trapWarnings };
  }

  if ((revenueCagr !== undefined && revenueCagr > 10 || fcfCagr !== undefined && fcfCagr > 10) && (operatingMargin !== undefined && operatingMargin > 25) && (cashConversion !== undefined && cashConversion > 0.75)) {
    reasons.push("Growth, margins, and cash conversion support a quality-growth classification.");
    if ((pe !== undefined && pe > 35) || (ps !== undefined && ps > 8)) {
      reasons.push("The valuation is premium, so future growth has to keep doing real work.");
      return { classification: "expensive_growth", confidence: "medium", reasons, trap_warnings: trapWarnings };
    }
    return { classification: "quality_growth", confidence: "medium", reasons, trap_warnings: trapWarnings };
  }

  if ((debtEquity !== undefined && debtEquity > 2) && (cashConversion !== undefined && cashConversion < 0.5)) {
    return {
      classification: "distressed",
      confidence: "medium",
      reasons: ["Leverage and weak cash conversion point to financial stress."],
      trap_warnings: ["Debt can make apparent cheapness dangerous."]
    };
  }

  return {
    classification: "turnaround",
    confidence: "low",
    reasons: ["The signals are mixed enough that the company needs trend confirmation before a cleaner label is appropriate."],
    trap_warnings: trapWarnings
  };
}

function fallbackMemo(block: Omit<FinancialIndicatorsBlock, "plain_english">): FinancialIndicatorsMemo {
  const classification = block.value_classification.classification.replaceAll("_", " ");
  const availableValuation = block.valuation.filter((entry) => entry.state === "available");
  const cashConversion = block.cash_flow_quality.find((entry) => entry.indicator_id === "cash_conversion")?.value;
  const debtEquity = block.balance_sheet.find((entry) => entry.indicator_id === "debt_to_equity")?.value;
  const strongProfitability = block.profitability.filter((entry) => (entry.value ?? 0) > 20).length;
  const trendCount = block.five_year_trends.filter((entry) => entry.direction !== "unavailable").length;

  return {
    value_lens:
      availableValuation.length > 0
        ? `The value lens classifies this company as ${classification}. That does not mean the stock is good or bad by itself; it means the current fundamentals and available valuation ratios look more like that category than classic low-multiple value.`
        : `The value lens classifies this company as ${classification}, but price-dependent valuation ratios are omitted because the report does not have an approved spot/reference price. The memo therefore leans on business quality rather than pretending to know P/E.`,
    business_quality:
      strongProfitability >= 2
        ? "Profitability is the cleaner part of the read. Several margin or return indicators are strong, which means the business is not merely growing revenue; it is keeping a meaningful amount of that revenue as profit."
        : "Business quality is not proven by one growth line. The memo checks margins and returns before treating revenue growth as durable value creation.",
    balance_sheet_read:
      debtEquity === undefined
        ? "Balance-sheet leverage cannot be fully judged because debt/equity inputs are incomplete."
        : debtEquity < 0.6
          ? "The balance sheet does not look like the main risk in this read. Debt/equity is manageable, so the bigger question is valuation versus quality."
          : "Balance-sheet leverage deserves attention. A company can look cheap and still be risky if debt limits flexibility.",
    cash_flow_read:
      cashConversion === undefined
        ? "Cash-flow quality is incomplete because free cash flow or net income is missing."
        : cashConversion > 0.8
          ? "Cash conversion is healthy, which means reported earnings are backed by cash rather than just accounting profit."
          : "Cash conversion is weaker, so the reader should be careful about treating earnings as fully real owner cash.",
    five_year_read:
      trendCount > 0
        ? "The five-year board separates business improvement from multiple expansion. If quality improved while valuation also expanded, the stock did not necessarily become cheaper."
        : "Five-year trend history is not deep enough for a confident long-term read, so the memo avoids dressing up a short history as a cycle view.",
    plain_english_takeaway:
      `Plain English: this is a ${classification} read based on the available indicators. The important question is whether business quality and cash flow justify the valuation, not whether one ratio looks attractive in isolation.`,
    what_to_watch_next:
      "Watch revenue growth, margin durability, cash conversion, leverage, share count, and whether valuation ratios move because earnings improve or because the market pays more for the same dollar of earnings."
  };
}

function validateMemoCandidate(candidate: Record<string, unknown>): FinancialIndicatorsMemo | undefined {
  const fields: Array<keyof FinancialIndicatorsMemo> = [
    "value_lens",
    "business_quality",
    "balance_sheet_read",
    "cash_flow_read",
    "five_year_read",
    "plain_english_takeaway",
    "what_to_watch_next"
  ];
  const memo: Partial<FinancialIndicatorsMemo> = {};
  for (const field of fields) {
    const value = candidate[field];
    if (typeof value !== "string" || value.trim().length < 30 || bannedNarrativePattern.test(value)) {
      return undefined;
    }
    memo[field] = value.trim();
  }
  return memo as FinancialIndicatorsMemo;
}

async function maybeRewriteMemo(
  block: FinancialIndicatorsBlock,
  input: BuildFinancialIndicatorsInput,
  config: DexterConfig
): Promise<FinancialIndicatorsBlock> {
  if (input.fixtureMode) {
    return block;
  }

  const prompt = [
    "You are writing the Financial Indicators & Value Lens section for Thesis Deep Dive.",
    "You may explain the supplied ratios in plain English. You cannot compute ratios, change numbers, add tickers, add sources, or give trading advice.",
    "Return strict JSON with keys: value_lens, business_quality, balance_sheet_read, cash_flow_read, five_year_read, plain_english_takeaway, what_to_watch_next.",
    "No buy/sell/hold, no price targets, no allocation language.",
    JSON.stringify({
      ticker: input.ticker,
      period: block.period,
      classification: block.value_classification,
      valuation: block.valuation,
      profitability: block.profitability,
      growth: block.growth,
      balance_sheet: block.balance_sheet,
      cash_flow_quality: block.cash_flow_quality,
      capital_allocation: block.capital_allocation,
      five_year_trends: block.five_year_trends,
      omissions: block.omissions
    })
  ].join("\n\n");

  try {
    const result = await runLiveDexterQuery(prompt, config, 20_000, 1);
    const parsed = JSON.parse(result.answer) as Record<string, unknown>;
    const memo = validateMemoCandidate(parsed);
    if (!memo) {
      return {
        ...block,
        omissions: [
          ...block.omissions,
          {
            family: "valuation",
            reason_code: "llm_unavailable",
            reason: "LLM value-lens explanation failed policy validation; deterministic memo was retained.",
            blocking: false
          }
        ]
      };
    }
    return { ...block, plain_english: memo };
  } catch {
    return {
      ...block,
      omissions: [
        ...block.omissions,
        {
          family: "valuation",
          reason_code: "llm_unavailable",
          reason: "LLM value-lens explanation was unavailable; deterministic memo was retained.",
          blocking: false
        }
      ]
    };
  }
}

export async function buildFinancialIndicators(
  input: BuildFinancialIndicatorsInput,
  config: DexterConfig
): Promise<FinancialIndicatorsBlock> {
  const annualsDesc = sortAnnualDesc(input.financials);
  const annualsAsc = annualsDesc.slice().reverse();
  const quartersDesc = sortQuarterlyDesc(input.financials);
  const ttm = buildTtmMetricSnapshot(input.ticker, quartersDesc, input.generatedAt);
  const effectiveLatest = input.latest ?? annualsDesc[0];
  const latestAnnualSnapshot = annualsDesc[0] ?? effectiveLatest;
  const metricSnapshotForRatios = ttm.snapshot ?? latestAnnualSnapshot;
  const balanceSheetSnapshot = quartersDesc[0] ?? latestAnnualSnapshot;
  const spotPrice = input.spotPrice && input.spotPrice > 0 ? input.spotPrice : undefined;
  const priceReference = spotPrice ? defaultPriceReference(input, spotPrice) : undefined;
  const calculationBasis: FinancialIndicatorCalculationBasis = {
    ttm_periods: ttm.periods,
    latest_balance_sheet_period: balanceSheetSnapshot?.period,
    annual_fallback_period: ttm.snapshot ? undefined : latestAnnualSnapshot?.period,
    note:
      ttm.snapshot
        ? "Flow metrics use the latest four quarterly snapshots on a TTM basis; balance-sheet ratios use the latest balance-sheet snapshot."
        : "Four consecutive quarterly snapshots were not available, so the value lens uses the latest annual snapshot for flow metrics."
  };
  const omissions: IndicatorOmission[] = [];
  const evidence = [
    ...annualsDesc.slice(0, 5).map((snapshot) => evidenceForSnapshot(snapshot, input.generatedAt)),
    ...quartersDesc.slice(0, 4).map((snapshot) => evidenceForSnapshot(snapshot, input.generatedAt)),
    ...(spotPrice ? [priceEvidence(input.ticker, spotPrice, input.generatedAt)] : [])
  ];
  const evidenceRefs = evidence.map((entry) => entry.evidence_id);
  const shares = data(balanceSheetSnapshot, "shares_outstanding");
  const debt = data(balanceSheetSnapshot, "debt_total");
  const cash = data(balanceSheetSnapshot, "cash_and_equivalents");
  const marketCap =
    spotPrice && shares && shares > 0
      ? spotPrice * shares
      : undefined;
  const enterpriseValue =
    marketCap !== undefined && debt !== undefined && cash !== undefined
      ? marketCap + debt - cash
      : undefined;
  const ctx: CalculatorContext = {
    ticker: input.ticker,
    latest: effectiveLatest,
    metricSnapshot: metricSnapshotForRatios,
    balanceSheetSnapshot,
    calculationBasis,
    annualsDesc,
    annualsAsc,
    spotPrice,
    priceReference,
    marketCap,
    enterpriseValue
  };

  if (!effectiveLatest) {
    addOmission(omissions, "annual_history", "missing_snapshot", "No financial snapshot was available for indicator calculation.");
  }
  if (annualsDesc.length < 2) {
    addOmission(omissions, "annual_history", "insufficient_periods", "Less than two annual snapshots were available.");
  }
  if (!ttm.snapshot) {
    addOmission(omissions, "quarterly_history", "insufficient_ttm_quarters", "Four unique consecutive quarterly snapshots were not available, so true TTM ratios could not be built.");
  }
  if (!ctx.spotPrice) {
    addOmission(omissions, "price_source", "missing_price", "Approved spot/reference price was unavailable, so price-dependent valuation ratios are omitted.");
  } else if (!input.priceReference && !input.fixtureMode) {
    addOmission(omissions, "price_source", "price_provenance_incomplete", "Price was supplied as a reference value without provider URL or live/delayed/close metadata.");
  }

  const grouped = buildIndicators([...valuationSpecs, ...nonPriceSpecs], ctx, omissions, evidenceRefs);
  const fiveYearTrends = [
    buildTrend(ctx, "revenue", "Revenue", "currency", "revenue"),
    buildTrend(ctx, "gross_margin", "Gross margin", "pct", "gross_margin"),
    buildTrend(ctx, "operating_margin", "Operating margin", "pct", "operating_margin"),
    buildTrend(ctx, "free_cash_flow", "Free cash flow", "currency", "free_cash_flow"),
    buildTrend(ctx, "debt_total", "Total debt", "currency", "debt_total", false),
    buildTrend(ctx, "shares_outstanding", "Shares outstanding", "count", "shares_outstanding", false)
  ];
  const valueClassification = classifyValue({
    valuation: grouped.valuation,
    profitability: grouped.profitability,
    growth: grouped.growth,
    balanceSheet: grouped.balance_sheet,
    cashFlow: grouped.cash_flow_quality
  });
  const benchmarks = buildBenchmarks({
    valuation: grouped.valuation,
    profitability: grouped.profitability,
    balanceSheet: grouped.balance_sheet,
    cashFlow: grouped.cash_flow_quality,
    valueClassification
  });
  const education = buildEducationBoxes({
    classification: valueClassification,
    evidenceRefs,
    hasPrice: Boolean(ctx.spotPrice),
    hasRoic: grouped.profitability.some((entry) => entry.indicator_id === "roic" && entry.state === "available")
  });

  const withoutMemo: Omit<FinancialIndicatorsBlock, "plain_english"> = {
    prompt_version: promptVersion,
    period: metricSnapshotForRatios?.period ?? effectiveLatest?.period ?? "unknown",
    basis: ttm.snapshot ? (ctx.spotPrice ? "mixed" : "ttm") : (ctx.spotPrice ? "mixed" : "annual"),
    calculation_basis: calculationBasis,
    price_reference: priceReference,
    valuation: grouped.valuation,
    profitability: grouped.profitability,
    growth: grouped.growth,
    balance_sheet: grouped.balance_sheet,
    cash_flow_quality: grouped.cash_flow_quality,
    capital_allocation: grouped.capital_allocation,
    five_year_trends: fiveYearTrends,
    benchmarks,
    education,
    value_classification: valueClassification,
    omissions,
    evidence
  };
  const block: FinancialIndicatorsBlock = {
    ...withoutMemo,
    plain_english: fallbackMemo(withoutMemo)
  };

  return maybeRewriteMemo(block, input, config);
}
