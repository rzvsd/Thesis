// Deep Dive 2.0: escaping and number formatting shared by every renderer file.
// Pure TS (no Deno APIs). Display text uses U+2212 for minus and "Not disclosed" for missing values.
// Money units ("usd", "usd_b", "usd_ps") are in the report currency: "$" by default, and the page render sets the
// fact pack's currency with withCurrency() ("€", "£", or the ISO code and a space, "CHF 12.3B").

export const MINUS = "−";
export const NOT_DISCLOSED = "Not disclosed";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes & < > " ' for HTML text and attribute values. null/undefined become "". */
export function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

export type Unit = "usd" | "usd_b" | "usd_ps" | "pct" | "pp" | "x" | "shares_b" | "plain";

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

/** The ISO code in upper case; "USD" for anything that is not a three-letter code (legacy reports are in dollars). */
export function currencyCode(code: unknown): string {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(c) ? c : "USD";
}

/** The money prefix for a currency: "$", "€", "£", else the code and a space ("CHF "). */
export function currencyPrefix(code: string): string {
  const c = currencyCode(code);
  return SYMBOLS[c] ?? `${c} `;
}

let CUR = "USD";
let PRE = "$";

/** The currency money is formatted in right now. */
export function currentCurrency(): string {
  return CUR;
}

/** Runs `fn` with money formatted in `code`, then restores the previous currency (rendering is synchronous). */
export function withCurrency<T>(code: string, fn: () => T): T {
  const was = [CUR, PRE] as const;
  CUR = currencyCode(code);
  PRE = currencyPrefix(CUR);
  try {
    return fn();
  } finally {
    [CUR, PRE] = was;
  }
}

/** The unit word for chart and table subtitles: "$" for dollars, else the ISO code ("EUR per share"). */
export function moneyUnit(): string {
  return CUR === "USD" ? "$" : CUR;
}

export interface FmtOpts {
  /** Show "+" for positive values. */
  sign?: boolean;
  /** Decimal digits, overriding the unit default. */
  digits?: number;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Fixed digits with thousands separators, no sign. */
function grouped(abs: number, digits: number): string {
  const s = abs.toFixed(Math.max(0, Math.min(6, digits)));
  const [int, frac] = s.split(".");
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${g}.${frac}` : g;
}

/** Sign prefix for a value already rounded to `digits` (so -0.04 at 1 digit has no sign). */
function signOf(v: number, digits: number, plus: boolean): string {
  const r = Number(Math.abs(v).toFixed(Math.max(0, Math.min(6, digits))));
  if (r === 0) return "";
  if (v < 0) return MINUS;
  return plus ? "+" : "";
}

const SCALES: Array<[number, string]> = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];

/** Compact money: picks T/B/M/K, digits from `pick(mantissa)`; rolls 999.96B over to $1.0T. */
function compactMoney(v: number, plus: boolean, pick: (m: number, suffix: string) => number): string {
  const abs = Math.abs(v);
  for (let i = 0; i < SCALES.length; i++) {
    const [scale, suffix] = SCALES[i];
    if (abs >= scale * 0.9995) {
      let m = abs / scale;
      let d = pick(m, suffix);
      d = pick(Number(m.toFixed(d)), suffix); // 99.96 rounds to 100.0, which takes the >= 100 digits
      if (Number(m.toFixed(d)) >= 1000 && i > 0) {
        const [s2, suf2] = SCALES[i - 1];
        m = abs / s2;
        d = pick(m, suf2);
        return `${signOf(v, 6, plus)}${PRE}${grouped(m, d)}${suf2}`;
      }
      return `${signOf(v, 6, plus)}${PRE}${grouped(m, d)}${suffix}`;
    }
  }
  const d = Number.isInteger(abs) ? 0 : 2;
  return `${signOf(v, d, plus)}${PRE}${grouped(abs, d)}`;
}

/** Formats a value for display. Non-finite and null values give "Not disclosed". */
export function fmt(value: number | null | undefined, unit: Unit, opts: FmtOpts = {}): string {
  if (!isNum(value)) return NOT_DISCLOSED;
  const plus = opts.sign === true;
  const dd = opts.digits;
  const v = value;
  const abs = Math.abs(v);
  switch (unit) {
    case "usd":
      return compactMoney(v, plus, (m) => dd ?? (m >= 100 ? 0 : 1));
    case "usd_b": {
      const b = abs / 1e9;
      const d = dd ?? (b >= 100 ? 0 : 1);
      return `${signOf(v < 0 ? -b : b, d, plus)}${PRE}${grouped(b, d)}B`;
    }
    case "usd_ps": {
      const d = dd ?? 2;
      return `${signOf(v, d, plus)}${PRE}${grouped(abs, d)}`;
    }
    case "pct": {
      const d = dd ?? 1;
      return `${signOf(v, d, plus)}${grouped(abs, d)}%`;
    }
    case "pp": {
      const d = dd ?? 1;
      return `${signOf(v, d, opts.sign !== false)}${grouped(abs, d)} points`;
    }
    case "x": {
      const d = dd ?? 1;
      return `${signOf(v, d, plus)}${grouped(abs, d)}x`;
    }
    case "shares_b": {
      const d = dd ?? 2;
      const b = abs / 1e9;
      return `${signOf(v < 0 ? -b : b, d, plus)}${grouped(b, d)}B`;
    }
    case "plain":
    default: {
      const d = dd ?? (Number.isInteger(v) ? 0 : 1);
      return `${signOf(v, d, plus)}${grouped(abs, d)}`;
    }
  }
}

/** Money with one decimal for B and T: $416.2B, $98.8B, $750M, $1.2T. */
export function fmtMoney(value: number | null | undefined): string {
  if (!isNum(value)) return NOT_DISCLOSED;
  return compactMoney(
    value,
    false,
    (m, suffix) => (suffix === "B" || suffix === "T") ? 1 : (m >= 100 ? 0 : 1),
  );
}

/** Percent number to text: pct(6.4) = "6.4%", pct(-2.1) = "−2.1%". */
export function pct(n: number | null | undefined, digits = 1): string {
  return fmt(n, "pct", { digits });
}

/** fy(2025) = "FY2025". */
export function fy(year: number): string {
  return `FY${year}`;
}

/**
 * Axis tick labels: one shared scale and the fewest decimals that keep the ticks distinct.
 * Zero is shown as "$0" or "0%" without a scale letter. Money ticks use the current currency prefix.
 */
export function fmtAxis(ticks: number[], unit: Unit): string[] {
  const finite = ticks.filter(isNum);
  if (!finite.length) return ticks.map(() => "");
  const step = finite.length > 1 ? Math.abs(finite[1] - finite[0]) : Math.abs(finite[0]) || 1;
  const maxAbs = Math.max(...finite.map(Math.abs));
  // fewest decimals (0 to 3) at which the step is a whole number: 100 -> 0, 2.5 -> 1, 0.25 -> 2
  const decimalsFor = (scaledStep: number) => {
    for (let d = 0; d < 3; d++) {
      const m = scaledStep * Math.pow(10, d);
      if (Math.abs(m - Math.round(m)) < 1e-6 * Math.max(1, m)) return d;
    }
    return 3;
  };
  const scaled = (t: number, scale: number, d: number, pre: string, suf: string, plus = false) => {
    if (Math.abs(t) < step / 1e6) return `${pre}0${unit === "pct" || unit === "x" ? suf : ""}`;
    return `${signOf(t, 6, plus)}${pre}${grouped(Math.abs(t) / scale, d)}${suf}`;
  };
  switch (unit) {
    case "usd": {
      let scale = 1;
      let suf = "";
      for (const [s, l] of SCALES) {
        if (maxAbs >= s) {
          scale = s;
          suf = l;
          break;
        }
      }
      const d = decimalsFor(step / scale);
      return ticks.map((t) => scaled(t, scale, d, PRE, suf));
    }
    case "usd_b": {
      const d = decimalsFor(step / 1e9);
      return ticks.map((t) => scaled(t, 1e9, d, PRE, "B"));
    }
    case "usd_ps":
      return ticks.map((t) => scaled(t, 1, decimalsFor(step) ? 2 : 0, PRE, "")); // cents come in pairs
    case "pct":
      return ticks.map((t) => scaled(t, 1, decimalsFor(step), "", "%"));
    case "pp":
      return ticks.map((t) => scaled(t, 1, decimalsFor(step), "", "", true));
    case "x":
      return ticks.map((t) => scaled(t, 1, decimalsFor(step), "", "x"));
    case "shares_b": {
      const d = decimalsFor(step / 1e9);
      return ticks.map((t) => scaled(t, 1e9, d, "", "B"));
    }
    default:
      return ticks.map((t) => scaled(t, 1, decimalsFor(step), "", ""));
  }
}
