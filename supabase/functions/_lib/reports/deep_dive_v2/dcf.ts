// Deep Dive 2.0: the discounted cash flow model behind the value range, the scenarios and the price box.
// Pure TS (no Deno APIs): the same file runs in Node for previews.
//
// Method (state it on the page):
// - Base FCF = average free cash flow of the last 3 fiscal years. All 3 must be positive, else no model.
// - Growth for years 1..fade (5) is the scenario growth. From year fade+1 it moves in a straight line to the
//   terminal rate, which it reaches in the last explicit year (year 10).
// - Discount rate 9.5%, terminal growth 2.5%.
// - Value per share = (PV of FCF in years 1..10 + PV of the terminal value + net cash) / latest shares.
//   Terminal value = FCF in year 10 * (1 + terminal) / (discount - terminal), discounted like year 10.
// - Base growth = 5-year FCF CAGR clamped to [-5, 15], else the revenue CAGR (5-year, else all years), clamped the
//   same way, rounded to 1 decimal. Bear = base - 4, bull = base + 4.
// - Sensitivity: discount 8.5..10.5 by terminal 1.5..3.5 at base growth.
// All rates are percent numbers (9.5 means 9.5%).

import type { Derived } from "./derive.ts";

export interface Scenario {
  key: "bear" | "base" | "bull";
  label: string;
  /** Percent per year for years 1-5. */
  growth: number;
  /** Value per share, rounded to cents. */
  value: number;
  /** Projected FCF for years 1..years, whole currency units. */
  fcfPath: number[];
}

export interface DcfInputs {
  baseFcf: number;
  shares: number;
  netCash: number;
  /** Discount rate, percent. */
  wacc: number;
  /** Terminal growth, percent. */
  terminal: number;
  /** Explicit forecast years (10). */
  years: number;
  /** Last year at the scenario growth (5); growth then fades linearly to `terminal` by year `years`. */
  fade: number;
}

export interface Dcf {
  baseFcf: number;
  shares: number;
  netCash: number;
  wacc: number;
  terminal: number;
  years: number;
  scenarios: Scenario[];
  /** values[i][j] = value per share at waccs[i] and terminals[j], base growth. */
  sensitivity: { waccs: number[]; terminals: number[]; values: number[][] };
  inputs: DcfInputs;
}

export const DCF_WACC = 9.5;
export const DCF_TERMINAL = 2.5;
export const DCF_YEARS = 10;
export const DCF_FADE = 5;
/** Bear and bull sit this many points below and above the base growth. */
export const DCF_SPREAD = 4;
export const DCF_GROWTH_MIN = -5;
export const DCF_GROWTH_MAX = 15;
export const SENSITIVITY_WACCS = [8.5, 9, 9.5, 10, 10.5];
export const SENSITIVITY_TERMINALS = [1.5, 2, 2.5, 3, 3.5];
/** Bisection range for impliedGrowth, percent. */
export const IMPLIED_MIN = -20;
export const IMPLIED_MAX = 40;
const IMPLIED_ITERATIONS = 60;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r; // no -0
};

function validInputs(i: DcfInputs): boolean {
  return !!i && isNum(i.baseFcf) && isNum(i.shares) && i.shares > 0 && isNum(i.netCash) && isNum(i.wacc) &&
    isNum(i.terminal) && i.wacc > i.terminal && i.wacc > -100 && i.terminal > -100 &&
    Number.isInteger(i.years) && i.years >= 1 && i.years <= 100 && Number.isInteger(i.fade) && i.fade >= 0 &&
    i.fade <= i.years;
}

/** Growth (percent) applied in year t (1-based). */
function growthAt(i: DcfInputs, growth: number, t: number): number {
  if (t <= i.fade || i.years === i.fade) return growth;
  return growth + (i.terminal - growth) * (t - i.fade) / (i.years - i.fade);
}

/** Projected FCF for years 1..years (unrounded). Empty when the inputs are invalid. */
export function projectFcf(inputs: DcfInputs, growth: number): number[] {
  if (!validInputs(inputs) || !isNum(growth)) return [];
  const out: number[] = [];
  let f = inputs.baseFcf;
  for (let t = 1; t <= inputs.years; t++) {
    f *= 1 + growthAt(inputs, growth, t) / 100;
    out.push(f);
  }
  return out;
}

/** Value per share at `growth` percent a year for years 1..fade. NaN when the inputs are invalid. */
export function valuePerShare(inputs: DcfInputs, growth: number): number {
  if (!validInputs(inputs) || !isNum(growth)) return NaN;
  const w = inputs.wacc / 100;
  const tg = inputs.terminal / 100;
  let f = inputs.baseFcf;
  let disc = 1;
  let pv = 0;
  for (let t = 1; t <= inputs.years; t++) {
    f *= 1 + growthAt(inputs, growth, t) / 100;
    disc *= 1 + w;
    pv += f / disc;
  }
  const tv = f * (1 + tg) / (w - tg) / disc;
  const v = (pv + tv + inputs.netCash) / inputs.shares;
  return Number.isFinite(v) ? v : NaN;
}

/**
 * The growth (percent a year, years 1..fade) at which valuePerShare equals `price`. Bisection on [-20, 40] with
 * 60 iterations. Null when the inputs are invalid, base FCF is not positive, the price is not positive, or the
 * price is outside [valuePerShare(-20), valuePerShare(40)].
 */
export function impliedGrowth(inputs: DcfInputs, price: number): number | null {
  if (!validInputs(inputs) || inputs.baseFcf <= 0 || !isNum(price) || price <= 0) return null;
  let lo = IMPLIED_MIN;
  let hi = IMPLIED_MAX;
  const vlo = valuePerShare(inputs, lo);
  const vhi = valuePerShare(inputs, hi);
  if (!isNum(vlo) || !isNum(vhi) || price < vlo || price > vhi) return null;
  for (let k = 0; k < IMPLIED_ITERATIONS; k++) {
    const mid = (lo + hi) / 2;
    if (valuePerShare(inputs, mid) > price) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Base scenario growth, percent with 1 decimal, or null when no growth rate is known. */
export function baseGrowth(growth: Derived["growth"]): number | null {
  const g = isNum(growth?.fcfCagr5)
    ? growth.fcfCagr5
    : isNum(growth?.revenueCagr5)
    ? growth.revenueCagr5
    : isNum(growth?.revenueCagrAll)
    ? growth.revenueCagrAll
    : null;
  if (g === null) return null;
  return round(Math.min(DCF_GROWTH_MAX, Math.max(DCF_GROWTH_MIN, g)), 1);
}

const last = <T>(
  a: ReadonlyArray<T> | undefined,
): T | undefined => (a && a.length ? a[a.length - 1] : undefined);

/** The DCF for a company, or null when base FCF, shares, net cash or a growth rate is missing. */
export function buildDcf(d: Pick<Derived, "fcf" | "shares" | "netCash" | "growth" | "revenue">): Dcf | null {
  const fcf = Array.isArray(d?.fcf) ? d.fcf : [];
  if (fcf.length < 3) return null;
  const recent = fcf.slice(-3);
  if (!recent.every((v): v is number => isNum(v) && v > 0)) return null;
  const shares = last(d.shares);
  const netCash = last(d.netCash);
  if (!isNum(shares) || shares <= 0 || !isNum(netCash)) return null;
  const g = baseGrowth(d.growth);
  if (g === null) return null;

  const inputs: DcfInputs = {
    baseFcf: (recent[0] + recent[1] + recent[2]) / 3,
    shares,
    netCash,
    wacc: DCF_WACC,
    terminal: DCF_TERMINAL,
    years: DCF_YEARS,
    fade: DCF_FADE,
  };
  const defs: Array<[Scenario["key"], string, number]> = [
    ["bear", "Bear case", round(g - DCF_SPREAD, 1)],
    ["base", "Base case", g],
    ["bull", "Bull case", round(g + DCF_SPREAD, 1)],
  ];
  const scenarios: Scenario[] = [];
  for (const [key, label, growth] of defs) {
    const v = valuePerShare(inputs, growth);
    if (!isNum(v)) return null;
    scenarios.push({
      key,
      label,
      growth,
      value: round(v, 2),
      fcfPath: projectFcf(inputs, growth).map(Math.round),
    });
  }
  const values = SENSITIVITY_WACCS.map((wacc) =>
    SENSITIVITY_TERMINALS.map((terminal) => round(valuePerShare({ ...inputs, wacc, terminal }, g), 2))
  );
  return {
    baseFcf: inputs.baseFcf,
    shares,
    netCash,
    wacc: inputs.wacc,
    terminal: inputs.terminal,
    years: inputs.years,
    scenarios,
    sensitivity: { waccs: [...SENSITIVITY_WACCS], terminals: [...SENSITIVITY_TERMINALS], values },
    inputs,
  };
}
