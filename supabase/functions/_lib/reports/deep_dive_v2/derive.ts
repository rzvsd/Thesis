// Deep Dive 2.0: everything the page calculates from the fact pack's annual rows. Pure TS (no Deno APIs).
// Every number here comes from AnnualFacts fields; a value is null when an input is missing. Never throws.
// Percents are percent numbers (46.9 means 46.9%); margin changes are percentage points.
// Stock splits: per-share values and share counts are compared on one basis. A fact pack that lists splits has
// adjusted its rows already and is trusted. Otherwise a split is looked for between adjacent fiscal years (a share
// count step close to a clean split ratio, EPS moving with it against profit, and no new capital in equity), and
// earlier years are rescaled to the latest year's basis, so a split never reads as dilution or an EPS collapse.

import type { AnnualFacts, StockSplit } from "./fact_pack.ts";
import { baseGrowth, buildDcf } from "./dcf.ts";
import type { Dcf } from "./dcf.ts";

/** Same union as format.ts `Unit` (kept local so this file has no dependency on the formatter). */
export type CheckUnit = "usd" | "usd_b" | "usd_ps" | "pct" | "pp" | "x" | "shares_b" | "plain";

type Num = number | null;

export interface EpsBridgeStep {
  key: "sales" | "margin" | "tax" | "shares" | "other";
  label: string;
  value: number;
}

export interface ScoreRow {
  key: "profitability" | "growth" | "health" | "returns";
  label: string;
  /** 0 to 10, one decimal. */
  score: Num;
  basis: string;
}

export interface Check {
  key: "revenue_growth" | "op_margin" | "fcf_conversion" | "share_count";
  label: string;
  current: Num;
  threshold: number;
  unit: CheckUnit;
  direction: "above" | "below";
  passes: boolean | null;
  why: string;
}

/** A stock split the EPS and share-count series are on the latest basis for. */
export interface SplitAdjustment {
  /** New shares per old share: 4 for a 4-for-1 split, 0.1 for a 1-for-10 reverse split. */
  ratio: number;
  /** The first fiscal year on the new share basis. */
  fiscalYear: number;
  /** "pack": listed by the fact pack, whose rows came adjusted; "detected": found here from the share counts. */
  source: "pack" | "detected";
}

export interface Derived {
  /** Stock splits the per-share values and share counts are adjusted for, oldest first (empty when none). */
  splits: SplitAdjustment[];
  years: number[];
  labels: string[];
  latest: AnnualFacts;
  /** The row for the fiscal year right before the latest, or null when that year is not on record (a gap). */
  prior: AnnualFacts | null;
  /** Index of `prior` in the series, or null. Every one-year change compares against this row only. */
  priorIndex: number | null;
  first: AnnualFacts;
  revenue: Num[];
  netIncome: Num[];
  fcf: Num[];
  ocf: Num[];
  eps: Num[];
  /** Shares outstanding, else weighted diluted shares. */
  shares: Num[];
  grossMargin: Num[];
  opMargin: Num[];
  netMargin: Num[];
  fcfMargin: Num[];
  /** Cash plus short-term investments. */
  cash: Num[];
  debt: Num[];
  netCash: Num[];
  buybacks: Num[];
  dividends: Num[];
  growth: {
    revenueYoY: Num;
    netIncomeYoY: Num;
    epsYoY: Num;
    fcfYoY: Num;
    revenueCagr5: Num;
    revenueCagrAll: Num;
    fcfCagr5: Num;
    epsCagrAll: Num;
  };
  /** Percent, negative = fewer shares. */
  sharesChange1y: Num;
  sharesChangeAll: Num;
  /** Points. */
  marginChange1y: { gross: Num; op: Num };
  /** Sums over the last 5 fiscal years; ratio = (buybacks + dividends) / fcf. */
  cashReturn5: { fcf: Num; buybacks: Num; dividends: Num; ratio: Num };
  /** Sums over every year that has both values; ratio = fcf / netIncome. */
  fcfToNetIncomeAll: { fcf: Num; netIncome: Num; ratio: Num };
  epsBridge: { from: number; to: number; steps: EpsBridgeStep[] } | null;
  taxRate: Num[];
  scorecard: ScoreRow[];
  checks: Check[];
  dcf: Dcf | null;
}

// ---------- helpers ----------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const val = (v: unknown): Num => (isNum(v) ? v : null);
const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const fyLabel = (year: number): string => `FY${year}`;

/** "6.4%", with U+2212 for negatives. */
function pctText(v: number, digits = 1): string {
  const r = round(v, digits);
  return `${r < 0 ? "−" : ""}${Math.abs(r).toFixed(digits)}%`;
}

function ratioPct(num: Num, den: Num): Num {
  return num !== null && den !== null && den > 0 ? (num / den) * 100 : null;
}

/** Percent change; null unless the base is positive. */
function change(from: Num, to: Num): Num {
  return from !== null && to !== null && from > 0 ? (to / from - 1) * 100 : null;
}

/** Compound annual growth in percent between two positive endpoints `periods` years apart. */
export function cagr(from: Num, to: Num, periods: number): Num {
  if (from === null || to === null || !(from > 0) || !(to > 0) || !(periods > 0)) return null;
  return (Math.pow(to / from, 1 / periods) - 1) * 100;
}

const lastOf = (a: Num[]): Num => (a.length ? a[a.length - 1] : null);

/** Normalise: keep rows with a numeric fiscal_year, one per year (the later row wins), oldest first. */
function normalise(facts: AnnualFacts[]): AnnualFacts[] {
  const byYear = new Map<number, AnnualFacts>();
  for (const row of Array.isArray(facts) ? facts : []) {
    if (row && typeof row === "object" && isNum(row.fiscal_year)) byYear.set(row.fiscal_year, row);
  }
  return [...byYear.values()].sort((a, b) => a.fiscal_year - b.fiscal_year);
}

// ---------- stock splits ----------

const SPLIT_FORWARD = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const SPLIT_RATIOS = [...SPLIT_FORWARD, ...SPLIT_FORWARD.map((r) => 1 / r)];

/** The clean split ratio within 3% of `ratio`, else null. */
export function cleanSplitRatio(ratio: number): Num {
  if (!isNum(ratio) || ratio <= 0) return null;
  return SPLIT_RATIOS.find((r) => Math.abs(ratio / r - 1) <= 0.03) ?? null;
}

const positive = (v: unknown): v is number => isNum(v) && v > 0;

/** Share count ratio from one row to the next: diluted shares when both rows have them, else outstanding. */
function shareRatio(a: AnnualFacts, b: AnnualFacts): Num {
  if (positive(a.shares_diluted) && positive(b.shares_diluted)) return b.shares_diluted / a.shares_diluted;
  if (positive(a.shares_outstanding) && positive(b.shares_outstanding)) {
    return b.shares_outstanding / a.shares_outstanding;
  }
  return null;
}

function epsOf(r: AnnualFacts): Num {
  const e = val(r.eps_diluted);
  if (e !== null) return e;
  const ni = val(r.net_income);
  const s = positive(r.shares_diluted)
    ? r.shares_diluted
    : positive(r.shares_outstanding)
    ? r.shares_outstanding
    : null;
  return ni !== null && s !== null ? ni / s : null;
}

/**
 * EPS moved the way a split of share ratio `r` moves it. With net profit in both years, EPS ratio times share ratio
 * must be within 25% of the net profit ratio (the share count and EPS describe the same shares), whatever profit
 * did: a company often splits after a strong year. Without it, the split must bring the EPS change closer to flat.
 */
function epsAgrees(a: AnnualFacts, b: AnnualFacts, r: number): boolean {
  const e0 = epsOf(a), e1 = epsOf(b);
  if (e0 === null || e1 === null) return true;
  if (e0 === 0 || e1 / e0 <= 0) return false;
  const er = e1 / e0;
  const n0 = val(a.net_income), n1 = val(b.net_income);
  if (n0 !== null && n1 !== null && n0 !== 0) {
    const nr = n1 / n0;
    return nr > 0 && Math.abs((er * r) / nr - 1) <= 0.25;
  }
  return Math.abs(Math.log(er * r)) < Math.abs(Math.log(er));
}

/**
 * Shares, EPS and profit cannot tell a split from shares sold or paid for a business (EPS is profit over shares
 * either way), so the step must also look like a split elsewhere. A split moves no money: equity changes by the
 * year's profit, stock pay and what was paid out, and new capital beyond that (above 20% of the prior equity, or
 * 10% of assets when equity was not positive) means the shares were issued. And a split moves the year-end and the
 * weighted share counts alike: an issue during the year moves the year-end count more.
 */
function looksLikeSplit(a: AnnualFacts, b: AnnualFacts, clean: number): boolean {
  for (const key of ["shares_diluted", "shares_outstanding"] as const) {
    const x = a[key], y = b[key];
    if (positive(x) && positive(y) && Math.abs(y / x / clean - 1) > 0.1) return false;
  }
  const q0 = val(a.equity), q1 = val(b.equity);
  if (q0 === null || q1 === null) return true;
  const kept = (val(b.net_income) ?? 0) + (val(b.stock_comp) ?? 0) - (val(b.dividends) ?? 0) -
    (val(b.buybacks) ?? 0);
  const raised = q1 - q0 - kept;
  if (q0 > 0) return raised <= 0.2 * q0;
  const assets = val(a.total_assets);
  return assets === null || !(assets > 0) || raised <= 0.1 * assets;
}

/** Rows with EPS and share counts on the latest basis, and the splits that took them there. */
function splitAdjust(rows: AnnualFacts[], listed: StockSplit[] | undefined): {
  rows: AnnualFacts[];
  splits: SplitAdjustment[];
} {
  const first = rows.length ? rows[0].fiscal_year : 0;
  const latest = rows.length ? rows[rows.length - 1].fiscal_year : 0;
  if (Array.isArray(listed) && listed.length) {
    // The pack adjusted its rows: trust it and look for nothing more, so nothing is adjusted twice.
    const splits = listed
      .filter((x) =>
        positive(x.ratio) && x.effective_fiscal_year > first && x.effective_fiscal_year <= latest
      )
      .map((x): SplitAdjustment => ({ ratio: x.ratio, fiscalYear: x.effective_fiscal_year, source: "pack" }));
    return { rows, splits };
  }
  const found: Array<{ index: number; ratio: number }> = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (b.fiscal_year !== a.fiscal_year + 1) continue;
    const r = shareRatio(a, b);
    const clean = r === null ? null : cleanSplitRatio(r);
    if (r === null || clean === null || !epsAgrees(a, b, r) || !looksLikeSplit(a, b, clean)) continue;
    found.push({ index: i, ratio: clean });
  }
  if (!found.length) return { rows, splits: [] };
  const adjusted = rows.map((row, k) => {
    const f = found.filter((x) => x.index > k).reduce((t, x) => t * x.ratio, 1);
    if (f === 1) return row;
    const copy: AnnualFacts = { ...row };
    if (isNum(copy.eps_diluted)) copy.eps_diluted = copy.eps_diluted / f;
    if (isNum(copy.shares_diluted)) copy.shares_diluted = copy.shares_diluted * f;
    if (isNum(copy.shares_outstanding)) copy.shares_outstanding = copy.shares_outstanding * f;
    return copy;
  });
  return {
    rows: adjusted,
    splits: found.map((x) => ({ ratio: x.ratio, fiscalYear: rows[x.index].fiscal_year, source: "detected" })),
  };
}

// ---------- pieces ----------

function series(rows: AnnualFacts[]) {
  const revenue = rows.map((r) => val(r.revenue));
  const netIncome = rows.map((r) => val(r.net_income));
  const ocf = rows.map((r) => val(r.operating_cash_flow));
  const fcf = rows.map((r) => {
    const f = val(r.free_cash_flow);
    if (f !== null) return f;
    const o = val(r.operating_cash_flow);
    const c = val(r.capex);
    return o !== null && c !== null ? o - c : null;
  });
  const dilutedOrOut = rows.map((r) => {
    const s = val(r.shares_diluted) ?? val(r.shares_outstanding);
    return s !== null && s > 0 ? s : null;
  });
  const eps = rows.map((r, i) => {
    const e = val(r.eps_diluted);
    if (e !== null) return e;
    const ni = netIncome[i];
    const s = dilutedOrOut[i];
    return ni !== null && s !== null ? round(ni / s, 2) : null;
  });
  const shares = rows.map((r) => {
    const s = val(r.shares_outstanding) ?? val(r.shares_diluted);
    return s !== null && s > 0 ? s : null;
  });
  const margin = (pick: (r: AnnualFacts) => unknown) =>
    rows.map((r, i) => ratioPct(val(pick(r)), revenue[i]));
  const cash = rows.map((r) => {
    const c = val(r.cash);
    return c === null ? null : c + (val(r.short_term_investments) ?? 0);
  });
  const debt = rows.map((r) => val(r.debt_total));
  const netCash = cash.map((c, i) => (c !== null && debt[i] !== null ? c - (debt[i] as number) : null));
  const taxRate = rows.map((r) => ratioPct(val(r.income_tax), val(r.pretax_income)));
  return {
    revenue,
    netIncome,
    ocf,
    fcf,
    eps,
    shares,
    dilutedOrOut,
    grossMargin: margin((r) => r.gross_profit),
    opMargin: margin((r) => r.operating_income),
    netMargin: margin((r) => r.net_income),
    fcfMargin: fcf.map((f, i) => ratioPct(f, revenue[i])),
    cash,
    debt,
    netCash,
    buybacks: rows.map((r) => val(r.buybacks)),
    dividends: rows.map((r) => val(r.dividends)),
    taxRate,
  };
}

/** CAGR from the row `span` fiscal years before the latest to the latest. */
function cagrSpan(years: number[], a: Num[], span: number): Num {
  const n = years.length;
  if (n < 2) return null;
  const i = years.indexOf(years[n - 1] - span);
  return i < 0 ? null : cagr(a[i], a[n - 1], span);
}

/** CAGR from the earliest non-null value to the latest value. */
function cagrAll(years: number[], a: Num[]): Num {
  const n = years.length;
  const i = a.findIndex((v) => v !== null);
  if (i < 0 || i >= n - 1) return null;
  return cagr(a[i], a[n - 1], years[n - 1] - years[i]);
}

function sumOrNull(a: Num[]): Num {
  if (!a.length || a.some((v) => v === null)) return null;
  return (a as number[]).reduce((s, v) => s + v, 0);
}

function epsBridge(prior: AnnualFacts | null, latest: AnnualFacts, from: Num, to: Num): Derived["epsBridge"] {
  if (!prior || from === null || to === null) return null;
  const r0 = val(prior.revenue), r1 = val(latest.revenue);
  const op0 = val(prior.operating_income), op1 = val(latest.operating_income);
  const pt0 = val(prior.pretax_income), pt1 = val(latest.pretax_income);
  const tx0 = val(prior.income_tax), tx1 = val(latest.income_tax);
  const ni1 = val(latest.net_income);
  const s0 = val(prior.shares_diluted) ?? val(prior.shares_outstanding);
  const s1 = val(latest.shares_diluted) ?? val(latest.shares_outstanding);
  if (
    r0 === null || r1 === null || op0 === null || op1 === null || pt0 === null || pt1 === null ||
    tx0 === null ||
    tx1 === null || ni1 === null || s0 === null || s1 === null || r0 <= 0 || r1 <= 0 || pt0 <= 0 || s0 <= 0 ||
    s1 <= 0
  ) return null;
  const m0 = op0 / r0, m1 = op1 / r1;
  const t0 = tx0 / pt0;
  const keep0 = 1 - t0;
  // Profit after tax at the prior tax rate: sales at the prior operating margin, then the margin change. Then the
  // tax step: this year's pretax profit taxed at the prior rate against the tax actually charged
  // (pretax1 * (t0 - t1)). All per prior diluted share; the share step moves to this year's share count.
  const sales = round(((r1 - r0) * m0 * keep0) / s0, 2);
  const margin = round((r1 * (m1 - m0) * keep0) / s0, 2);
  const tax = round((pt1 * t0 - tx1) / s0, 2);
  const shares = round(ni1 / s1 - ni1 / s0, 2);
  // A step that rounds to zero gets a level label, so a split-adjusted share count never reads "Fewer shares".
  const label = (v: number, down: string, up: string, level: string) => (v === 0 ? level : v < 0 ? down : up);
  // The share step is named for what the share count did: with a loss, more shares make the loss per share
  // smaller, so the sign of the step does not say which way the count moved.
  const sharesLabel = shares === 0 || s1 === s0
    ? "Same share count"
    : s1 > s0
    ? "More shares"
    : "Fewer shares";
  const steps: EpsBridgeStep[] = [
    { key: "sales", label: label(sales, "Lower sales", "Higher sales", "Same sales"), value: sales },
    { key: "margin", label: label(margin, "Narrower margin", "Wider margin", "Same margin"), value: margin },
    { key: "tax", label: label(tax, "Higher tax rate", "Lower tax rate", "Same tax rate"), value: tax },
    { key: "shares", label: sharesLabel, value: shares },
  ];
  // Non-operating items, items below pretax profit and rounding: whatever makes the steps sum to the change.
  const residue = round(to - from - steps.reduce((s, x) => s + x.value, 0), 2);
  if (Math.abs(residue) >= 0.005) steps.push({ key: "other", label: "Other items", value: residue });
  return { from, to, steps };
}

function scorecard(
  latestLabel: string,
  firstLabel: string | null,
  opMargin: Num,
  revenueCagrAll: Num,
  netCash: Num,
  fcfLatest: Num,
  returnRatio: Num,
): ScoreRow[] {
  const band = (v: number, lo: number, hi: number) => round(clamp(((v - lo) / (hi - lo)) * 10, 0, 10), 1);
  const rows: ScoreRow[] = [];
  rows.push({
    key: "profitability",
    label: "Profitability",
    score: opMargin === null ? null : band(opMargin, 0, 35),
    basis: opMargin === null
      ? "Not disclosed: needs operating income and sales for the latest year."
      : `Operating margin of ${
        pctText(opMargin)
      } in ${latestLabel}. Scale: 0% scores 0, 35% or more scores 10.`,
  });
  rows.push({
    key: "growth",
    label: "Growth",
    score: revenueCagrAll === null ? null : band(revenueCagrAll, -5, 15),
    basis: revenueCagrAll === null
      ? "Not disclosed: needs positive sales in at least two years."
      : `Sales grew ${pctText(revenueCagrAll)} a year from ${firstLabel} to ${latestLabel}. ` +
        "Scale: −5% scores 0, 15% or more scores 10.",
  });
  let health: Num = null;
  let healthBasis = "Not disclosed: needs cash, debt and free cash flow for the latest year.";
  const healthScale = "Scale: net debt of 4 years of free cash flow or more scores 0, net cash scores 10.";
  if (netCash !== null && netCash >= 0) {
    health = 10;
    healthBasis = `Cash and short-term investments exceed debt in ${latestLabel}. ${healthScale}`;
  } else if (netCash !== null && fcfLatest !== null) {
    if (fcfLatest <= 0) {
      health = 0;
      healthBasis =
        `Net debt with no positive free cash flow in ${latestLabel} to pay it down. ${healthScale}`;
    } else {
      const yearsOfFcf = -netCash / fcfLatest;
      health = band(-yearsOfFcf, -4, 0);
      healthBasis =
        `Net debt equals ${round(yearsOfFcf, 1).toFixed(1)} years of free cash flow in ${latestLabel}. ` +
        healthScale;
    }
  }
  rows.push({ key: "health", label: "Financial health", score: health, basis: healthBasis });
  rows.push({
    key: "returns",
    label: "Cash returned",
    score: returnRatio === null ? null : band(returnRatio, 0, 1),
    basis: returnRatio === null
      ? "Not disclosed: needs 5 years of free cash flow, buybacks and dividends."
      : `Buybacks and dividends were ${pctText(returnRatio * 100, 0)} of free cash flow over 5 years. ` +
        "Scale: 0% scores 0, 100% or more scores 10.",
  });
  return rows;
}

/** Where the base growth rate came from when there is no cash-flow model (mirrors dcf.ts baseGrowth). */
function baseSourceText(growth: Derived["growth"], base: number): string {
  const kept = `Kept between ${pctText(-5, 0)} and ${pctText(15, 0)}, that gives a base rate of ${
    pctText(base)
  }, and the line sits 4 points below it.`;
  if (isNum(growth.fcfCagr5)) {
    return `Free cash flow grew ${pctText(growth.fcfCagr5)} a year over five years. ${kept}`;
  }
  const g = isNum(growth.revenueCagr5) ? growth.revenueCagr5 : growth.revenueCagrAll;
  const over = isNum(growth.revenueCagr5) ? "over five years" : "over the years on record";
  return `Sales grew ${pctText(g ?? base)} a year ${over}. ${kept}`;
}

function checks(
  latestLabel: string,
  base: Num,
  hasModel: boolean,
  growth: Derived["growth"],
  opMargin: Num,
  opHistory: { avg: number; from: string; to: string } | null,
  fcfConv3: Num,
  sharesChange1y: Num,
): Check[] {
  const revenueYoY = growth.revenueYoY;
  const growthLine = round(Math.max(0, base === null ? 0 : base - 4), 1);
  // The margin line is anchored to the years before the latest, so the latest year can trip it.
  const marginLine = opHistory === null ? 0 : round(opHistory.avg - 3, 1);
  const opCurrent = opHistory === null ? null : opMargin;
  const pass = (cur: Num, line: number, dir: "above" | "below"): boolean | null =>
    cur === null ? null : dir === "above" ? cur > line : cur < line;
  return [
    {
      key: "revenue_growth",
      label: `Sales growth stays above ${pctText(growthLine)}`,
      current: revenueYoY,
      threshold: growthLine,
      unit: "pct",
      direction: "above",
      passes: pass(revenueYoY, growthLine, "above"),
      why:
        (revenueYoY === null
          ? `Not disclosed: needs sales for ${latestLabel} and the fiscal year before it. `
          : "") +
        (base === null
          ? "No growth rate is on record for the base case, so the line is zero: sales that shrink break the story."
          : hasModel
          ? `The base case has free cash flow growing ${
            pctText(base)
          } a year. Sales growth under this line ` +
            "would mean the business is growing too slowly to carry it."
          : baseSourceText(growth, base)),
    },
    {
      key: "op_margin",
      label: opHistory === null
        ? "Operating margin stays near its past level"
        : `Operating margin stays above ${pctText(marginLine)}`,
      current: opCurrent,
      threshold: marginLine,
      unit: "pct",
      direction: "above",
      passes: pass(opCurrent, marginLine, "above"),
      why: opMargin === null
        ? "Not disclosed: needs operating income and sales for the latest year."
        : opHistory === null
        ? `It was ${
          pctText(opMargin)
        } in ${latestLabel}. The line needs an earlier year of operating margin to compare against.`
        : `${
          opHistory.from === opHistory.to
            ? `It was ${pctText(opHistory.avg)} in ${opHistory.from}`
            : `It averaged ${pctText(opHistory.avg)} from ${opHistory.from} to ${opHistory.to}`
        }. A fall of more than 3 points below that would mean costs or prices are moving against the business.`,
    },
    {
      key: "fcf_conversion",
      label: "Free cash flow stays above 80% of net profit",
      current: fcfConv3,
      threshold: 80,
      unit: "pct",
      direction: "above",
      passes: pass(fcfConv3, 80, "above"),
      why: fcfConv3 === null
        ? "Not disclosed: needs 3 years of free cash flow and a positive net profit."
        : `Over the last 3 years free cash flow was ${
          pctText(fcfConv3, 0)
        } of net profit. Under 80% would mean ` +
          "reported profit is not turning into cash.",
    },
    {
      key: "share_count",
      label: "Share count rises less than 1% a year",
      current: sharesChange1y,
      threshold: 1,
      unit: "pct",
      direction: "below",
      passes: pass(sharesChange1y, 1, "below"),
      why: sharesChange1y === null
        ? "Not disclosed: needs the share count for the latest year and the year before."
        : `The share count changed ${
          pctText(sharesChange1y)
        } in ${latestLabel}. A rise of 1% or more would ` +
          "mean new shares are diluting owners.",
    },
  ];
}

// ---------- main ----------

const EMPTY_ROW: AnnualFacts = { fiscal_year: 0, period_end: "" };

/**
 * Derived metrics for the page. `facts` should be oldest first; rows are sorted and de-duplicated anyway.
 * `splits` are the fact pack's listed splits (its rows are then already adjusted).
 */
export function derive(facts: AnnualFacts[], splits?: StockSplit[]): Derived {
  const adjusted = splitAdjust(normalise(facts), splits);
  const rows = adjusted.rows;
  const n = rows.length;
  const years = rows.map((r) => r.fiscal_year);
  const labels = years.map(fyLabel);
  const latest = n ? rows[n - 1] : EMPTY_ROW;
  const first = n ? rows[0] : EMPTY_ROW;
  const s = series(rows);
  const latestYear = n ? years[n - 1] : 0;
  const latestLabel = n ? fyLabel(latestYear) : "the latest year";
  // A one-year change needs the fiscal year right before the latest. When the history skips it (FY2022 then
  // FY2025), the preceding row is not "the year before", so every one-year change is null.
  const priorIndex = n > 1 && years[n - 2] === latestYear - 1 ? n - 2 : null;
  const prior = priorIndex === null ? null : rows[priorIndex];
  const prevOf = (a: Num[]): Num => (priorIndex === null ? null : a[priorIndex] ?? null);

  const growth: Derived["growth"] = {
    revenueYoY: change(prevOf(s.revenue), lastOf(s.revenue)),
    netIncomeYoY: change(prevOf(s.netIncome), lastOf(s.netIncome)),
    epsYoY: change(prevOf(s.eps), lastOf(s.eps)),
    fcfYoY: change(prevOf(s.fcf), lastOf(s.fcf)),
    revenueCagr5: cagrSpan(years, s.revenue, 5),
    revenueCagrAll: cagrAll(years, s.revenue),
    fcfCagr5: cagrSpan(years, s.fcf, 5),
    epsCagrAll: cagrAll(years, s.eps),
  };

  const firstShareIdx = s.shares.findIndex((v) => v !== null);
  const sharesChangeAll = firstShareIdx >= 0 && firstShareIdx < n - 1
    ? change(s.shares[firstShareIdx], lastOf(s.shares))
    : null;

  const diff = (a: Num[]): Num => {
    const x = lastOf(a), y = prevOf(a);
    return x !== null && y !== null ? x - y : null;
  };

  // Last 5 fiscal years (consecutive, since years are unique and sorted).
  const in5 = years.map((y) => y > latestYear - 5);
  const has5 = in5.filter(Boolean).length === 5;
  const pick5 = (a: Num[]) => a.filter((_, i) => in5[i]);
  const fcf5 = has5 ? sumOrNull(pick5(s.fcf)) : null;
  // A series counts only when all five years are tagged: a missing year is not a zero.
  const bb5 = has5 ? sumOrNull(pick5(s.buybacks)) : null;
  const div5 = has5 ? sumOrNull(pick5(s.dividends)) : null;
  const ratio5 = fcf5 !== null && fcf5 > 0 && bb5 !== null && div5 !== null ? (bb5 + div5) / fcf5 : null;

  // Every year with both FCF and net income.
  const pairs = s.fcf.map((f, i) => [f, s.netIncome[i]] as const).filter(([f, ni]) =>
    f !== null && ni !== null
  );
  const fcfAll = pairs.length ? pairs.reduce((t, [f]) => t + (f as number), 0) : null;
  const niAll = pairs.length ? pairs.reduce((t, [, ni]) => t + (ni as number), 0) : null;

  // Last 3 fiscal years for the cash conversion check.
  const in3 = years.map((y) => y > latestYear - 3);
  const fcf3 = in3.filter(Boolean).length === 3 ? sumOrNull(s.fcf.filter((_, i) => in3[i])) : null;
  const ni3 = in3.filter(Boolean).length === 3 ? sumOrNull(s.netIncome.filter((_, i) => in3[i])) : null;
  const conv3 = fcf3 !== null && ni3 !== null && ni3 > 0 ? (fcf3 / ni3) * 100 : null;

  const partial = {
    years,
    fcf: s.fcf,
    shares: s.shares,
    netCash: s.netCash,
    growth,
    revenue: s.revenue,
  };
  const dcf = buildDcf(partial);
  const base = dcf ? dcf.scenarios.find((x) => x.key === "base")?.growth ?? null : baseGrowth(growth);
  const sharesChange1y = change(prevOf(s.shares), lastOf(s.shares));
  const opLatest = lastOf(s.opMargin);
  // Average operating margin of the up to five fiscal years before the latest (by year, so a gap shortens it).
  const opHistory = (() => {
    const xs: Array<[number, number]> = [];
    for (let i = 0; i < n - 1; i++) {
      const v = s.opMargin[i];
      if (v !== null && years[i] >= latestYear - 5) xs.push([years[i], v]);
    }
    if (!xs.length) return null;
    return {
      avg: xs.reduce((t, [, v]) => t + v, 0) / xs.length,
      from: fyLabel(xs[0][0]),
      to: fyLabel(xs[xs.length - 1][0]),
    };
  })();

  return {
    splits: adjusted.splits,
    years,
    labels,
    latest,
    prior,
    priorIndex,
    first,
    revenue: s.revenue,
    netIncome: s.netIncome,
    fcf: s.fcf,
    ocf: s.ocf,
    eps: s.eps,
    shares: s.shares,
    grossMargin: s.grossMargin,
    opMargin: s.opMargin,
    netMargin: s.netMargin,
    fcfMargin: s.fcfMargin,
    cash: s.cash,
    debt: s.debt,
    netCash: s.netCash,
    buybacks: s.buybacks,
    dividends: s.dividends,
    growth,
    sharesChange1y,
    sharesChangeAll,
    marginChange1y: { gross: diff(s.grossMargin), op: diff(s.opMargin) },
    cashReturn5: { fcf: fcf5, buybacks: bb5, dividends: div5, ratio: ratio5 },
    fcfToNetIncomeAll: {
      fcf: fcfAll,
      netIncome: niAll,
      ratio: fcfAll !== null && niAll !== null && niAll > 0 ? fcfAll / niAll : null,
    },
    epsBridge: epsBridge(prior, latest, prevOf(s.eps), lastOf(s.eps)),
    taxRate: s.taxRate,
    scorecard: scorecard(
      latestLabel,
      (() => {
        const i = s.revenue.findIndex((v) => v !== null);
        return i >= 0 ? labels[i] : null;
      })(),
      opLatest,
      growth.revenueCagrAll,
      lastOf(s.netCash),
      lastOf(s.fcf),
      ratio5,
    ),
    checks: checks(latestLabel, base, dcf !== null, growth, opLatest, opHistory, conv3, sharesChange1y),
    dcf,
  };
}
