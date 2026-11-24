// Deep Dive 2.0: the shared story layer. Chapter and card shapes, the render context, number phrases and the
// sentences more than one chapter uses (the big question, the tightest test). Pure TS (no Deno APIs).
// Text rules (docs/deep-dive/SPEC.md section 4): every number comes from a Derived or fact field, the words follow the
// data (grew or shrank, wider or narrower), no advice words, no em dashes, no exclamation marks.
// Paragraph text is plain text: render.ts escapes it, then turns [[ref:<card id>]] into "Chart N" links.

import type { ReportFacts } from "./adapter.ts";
import type { Check, Derived } from "./derive.ts";
import type { ClientData, PriceTexts } from "./client.ts";
import { esc, fmt, fmtMoney, pct } from "./format.ts";
import { NODATA, table, wide } from "./charts.ts";

export interface Para {
  /** The bold claim that opens the paragraph. */
  lead: string;
  body: string;
}

export interface Card {
  /** Unique on the page; Chart N links point here. */
  id: string;
  /** Titled cards get a "Chart N" number in page order. */
  title?: string;
  sub?: string;
  /** Ready HTML (already escaped). */
  html: string;
  /** Wrap html in <div class="chart">. */
  chart?: boolean;
  src?: string;
  /** Ready HTML from tbl(). */
  table?: string;
  span2?: boolean;
  notseen?: boolean;
}

export interface Chapter {
  id: string;
  chip: string;
  phases: Array<1 | 2 | 3 | 4>;
  src: string;
  h2: string;
  verdict: Para;
  /** Ready HTML placed between the head and the story (the big question box). */
  intro?: string;
  story: Para[];
  cards: Card[];
  upshot: string | null;
}

export interface Ctx {
  f: ReportFacts;
  d: Derived;
  /** "Apple" for "Apple Inc.". */
  short: string;
  /** "fiscal 2025". */
  L: string;
  price: number | null;
  priceDate: string | null;
  pt: PriceTexts;
  data: ClientData;
  /** ISO code of the fact pack's reporting currency ("USD" for legacy reports). */
  currency: string;
  /**
   * True when the figures are not in dollars: the page then has no price box and makes no price comparison,
   * because a dollar price needs the filing-date exchange rate and the ADR ratio (SPEC section 3), not in place yet.
   */
  priceOff: boolean;
}

type Num = number | null;

// ---------------------------------------------------------------- small helpers

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const last = (a: Num[]): Num => (a.length ? a[a.length - 1] : null);
/** The value for the fiscal year right before the latest; null when that year is not on record (a gap). */
export const prev = (d: Derived, a: Num[]): Num => (d.priorIndex === null ? null : a[d.priorIndex] ?? null);
export const ref = (id: string): string => `[[ref:${id}]]`;
export const fyT = (y: number): string => `fiscal ${y}`;
export const m = (v: Num): string => fmtMoney(v);
export const p = (v: Num, d = 1): string => pct(v, d);
export const pa = (v: Num, d = 1): string => pct(isNum(v) ? Math.abs(v) : null, d);
export const usd = (v: Num): string => fmt(v, "usd_ps");
export const usd0 = (v: Num): string => fmt(v, "usd_ps", { digits: 0 });
/** "0.7 points" without a sign. */
export const pts = (v: Num): string => fmt(isNum(v) ? Math.abs(v) : null, "pp", { sign: false });
/** "15.00 billion" / "48.2 million" shares. */
export function shareText(v: Num): string {
  if (!isNum(v)) return "an undisclosed number of";
  return v >= 1e9 ? `${(v / 1e9).toFixed(2)} billion` : `${(v / 1e6).toFixed(1)} million`;
}
/** "cash and short-term investments", or "cash" when no year tags short-term investments (older reports). */
export function cashName(c: { f: ReportFacts }): string {
  return c.f.annual.some((r) => isNum(r.short_term_investments)) ? "cash and short-term investments" : "cash";
}
/** Cents kept per sales dollar: 46.9 -> "47 cents". */
export const cents = (marginPct: number): string => `${Math.round(marginPct)} cents`;

/** The one honest note on price comparisons for a report whose figures are not in dollars. */
export function priceOffNote(c: Pick<Ctx, "currency">): string {
  return `The figures are in ${c.currency}, the currency of the filings, and per-share values are per reported share. ` +
    "Price comparisons need " +
    "the price in the trading currency, the exchange rate on the filing date and the ADR ratio, which are not in " +
    "place yet, so this report shows no price box, price to earnings or growth the price assumes.";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2025-10-31" -> "31 Oct 2025"; anything else -> "". */
export function dateText(iso: string | null | undefined): string {
  const mt = typeof iso === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!mt) return "";
  const mo = Number(mt[2]);
  if (mo < 1 || mo > 12) return "";
  return `${Number(mt[3])} ${MONTHS[mo - 1]} ${mt[1]}`;
}

/** "0927" -> "September". */
export function monthOf(mmdd: string | null): string | null {
  const mo = mmdd && /^\d{4}$/.test(mmdd) ? Number(mmdd.slice(0, 2)) : 0;
  return mo >= 1 && mo <= 12 ? MONTHS_LONG[mo - 1] : null;
}

/** "Apple Inc." -> "Apple". Keeps the name when stripping would leave nothing. */
export function shortName(name: string): string {
  const s = name.replace(
    /,?\s+(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|holdings|group|sa|ag|nv|se|lp|llc)\.?$/i,
    "",
  )
    .replace(/,?\s+(inc|corp|co|ltd|plc)\.?$/i, "").trim();
  return s || name;
}

/** "rose" / "fell" / "was flat" for a percent change. */
export function moved(v: number, up = "rose", down = "fell", flat = "was flat"): string {
  return Math.abs(v) < 0.05 ? flat : v > 0 ? up : down;
}

/** "a and b", "a, b and c". */
export function listText(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Percent change between two positive values, else null. */
export function chg(from: Num, to: Num): Num {
  return isNum(from) && isNum(to) && from > 0 ? (to / from - 1) * 100 : null;
}

/** Index of the first and last non-null values. */
export function span(a: Num[]): { i: number; j: number } | null {
  const i = a.findIndex(isNum);
  if (i < 0) return null;
  let j = a.length - 1;
  while (j > i && !isNum(a[j])) j--;
  return { i, j };
}

/** Fiscal years whose value fell against the year before. */
export function fallYears(d: Derived, a: Num[]): number[] {
  const out: number[] = [];
  for (let k = 1; k < a.length; k++) {
    const x = a[k - 1], y = a[k];
    if (isNum(x) && isNum(y) && y < x && d.years[k] - d.years[k - 1] === 1) out.push(d.years[k]);
  }
  return out;
}

/** Min and max with their fiscal years. */
export function extremes(
  d: Derived,
  a: Num[],
): { min: number; minY: number; max: number; maxY: number } | null {
  let r: { min: number; minY: number; max: number; maxY: number } | null = null;
  a.forEach((v, k) => {
    if (!isNum(v)) return;
    if (!r) r = { min: v, minY: d.years[k], max: v, maxY: d.years[k] };
    if (v < r.min) Object.assign(r, { min: v, minY: d.years[k] });
    if (v >= r.max) Object.assign(r, { max: v, maxY: d.years[k] });
  });
  return r;
}

// ---------------------------------------------------------------- card builders

/** A narrow and a wide variant for a span-two card; one empty state when there is no data. */
export function pair(build: (width: number) => string): string {
  const n = build(360);
  return n === NODATA ? NODATA : wide(n, build(720));
}

/** The "Show table" view behind a chart, stacked on phones. */
export function tbl(caption: string, head: string[], rows: string[][]): string {
  return table({ caption, head, rows }).replace('<details class="tbl">', '<details class="tbl stack">');
}

const PHASE_NAMES: Record<number, string> = { 1: "Phase 1", 2: "Phase 2", 3: "Phase 3", 4: "Phase 4" };

export function phaseTag(n: number): string {
  return `<span class="phase p${n}"><i></i>${PHASE_NAMES[n] ?? "Phase " + n}</span>`;
}

/** A card for data a later phase adds: names the data and the phase, shows no numbers. */
export function notSeen(id: string, title: string, what: string, source: string, phase: number): Card {
  return {
    id,
    title,
    notseen: true,
    html: `<div class="ns-row"><span class="ns-tag">Not seen yet</span>${phaseTag(phase)}</div><p>${
      esc(what)
    } <b>${esc(source)}</b></p>`,
  };
}

/** A short list of label and value rows. Values are ready HTML. */
export function ratioRows(rows: Array<[string, string]>): string {
  return `<div class="ratios">${
    rows.map(([l, v]) => `<div><span>${esc(l)}</span><b>${v}</b></div>`).join("")
  }</div>`;
}

// ---------------------------------------------------------------- shared sentences

/** Distance from a check's line in its own unit; positive = clear of the line. */
export function margin(c: Check): number | null {
  if (!isNum(c.current)) return null;
  return c.direction === "above" ? c.current - c.threshold : c.threshold - c.current;
}

export type CheckStatus = "ok" | "watch" | "bad" | "none";

/** OK, Watch (passes by under 2 points; half a point for the 1% share-count line), Tripped, or not checkable. */
export function checkStatus(c: Check): CheckStatus {
  if (c.passes === null) return "none";
  if (!c.passes) return "bad";
  const mg = margin(c);
  const band = c.key === "share_count" ? 0.5 : 2;
  return mg !== null && mg < band ? "watch" : "ok";
}

/** A check's label with a lower-case first letter, for use inside a sentence. */
export const checkLabel = (c: Check): string => c.label.charAt(0).toLowerCase() + c.label.slice(1);

/** "One of the four tests passes", "None of the four tests pass", "Three of the four tests pass". */
export function countOfFour(n: number, verb: [string, string] = ["passes", "pass"]): string {
  const w = n === 0 ? "None" : word(n).replace(/^./, (x) => x.toUpperCase());
  return `${w} of the four tests ${n === 1 ? verb[0] : verb[1]}`;
}

export const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: "OK",
  watch: "Watch",
  bad: "Tripped",
  none: "Not disclosed",
};

/** A check's current value as text ("13.5%"). */
export const checkNow = (c: Check): string => fmt(c.current, c.unit);
/** A check's line as text ("6.0%"). */
export const checkLine = (c: Check): string => fmt(c.threshold, c.unit);

/** The first tripped check, else the passing check closest to its line, else null. */
export function tightest(d: Derived): Check | null {
  const bad = d.checks.find((c) => c.passes === false);
  if (bad) return bad;
  let best: Check | null = null;
  for (const c of d.checks) {
    const mg = margin(c);
    if (c.passes !== true || mg === null) continue;
    if (!best || mg < (margin(best) as number)) best = c;
  }
  return best;
}

/** One sentence about the tightest test, for upshots. */
export function tightestSentence(c: Ctx, here = false): string {
  const t = tightest(c.d);
  const where = here ? "" : " in the Risks chapter";
  if (!t) return `None of the four tests${where} can be checked from these filings yet.`;
  const label = checkLabel(t);
  const bad = c.d.checks.filter((x) => x.passes === false).length;
  return t.passes === false
    ? bad === 1
      ? `One test${where} is already tripped: ${label}. It reads ${checkNow(t)} against a line of ${
        checkLine(t)
      }.`
      : `${
        word(bad).replace(/^./, (x) => x.toUpperCase())
      } tests${where} are already tripped. The first: ${label}. It reads ${checkNow(t)} against a line of ${
        checkLine(t)
      }.`
    : `The tightest of the four tests${where} is that ${label}: it reads ${checkNow(t)} against a line of ${
      checkLine(t)
    }.`;
}

/** The base-case growth rate, when the model exists. */
export function baseCase(c: Ctx) {
  return c.d.dcf?.scenarios.find((s) => s.key === "base") ?? null;
}

/** What the big question asks about, so the bottom line can answer it from its own data. */
export type BigQuestionKind = "loss" | "shrink" | "eps_vs_sales" | "dilution" | "pace" | "generic";

/** The one question the summary asks and the bottom line answers. Built from the data, never generic advice. */
export function bigQuestion(c: Ctx): string {
  return bigQuestionInfo(c).text;
}

/** The big question with its kind. */
export function bigQuestionInfo(c: Ctx): { text: string; kind: BigQuestionKind } {
  const q = (kind: BigQuestionKind, text: string) => ({ kind, text });
  const { d, short: S, L } = c;
  const ni = last(d.netIncome);
  const rev = last(d.revenue);
  const cash = last(d.cash);
  const g = d.growth.revenueCagr5 ?? d.growth.revenueCagrAll;
  const om = last(d.opMargin);
  const sh = d.sharesChange1y;
  if (isNum(ni) && ni <= 0) {
    return q(
      "loss",
      isNum(rev)
        ? `Can ${S} turn sales of ${m(rev)} into a profit${
          isNum(cash) ? ` before its ${m(cash)} of cash runs down` : ""
        }?`
        : `Can ${S} reach a profit${isNum(cash) ? ` before its ${m(cash)} of cash runs down` : ""}?`,
    );
  }
  const yoy = d.growth.revenueYoY;
  if ((isNum(g) && g < 0) || (isNum(yoy) && yoy < 0)) {
    const fell = isNum(yoy) && yoy < 0 ? `sales fell ${pa(yoy)} in ${L}` : `sales shrank ${pa(g)} a year`;
    return q(
      "shrink",
      `Can ${S} grow sales again after ${fell}${
        isNum(om) && om > 0 ? `, while keeping an operating margin near ${p(om, 0)}` : ""
      }?`,
    );
  }
  if (isNum(sh) && sh <= -0.5 && isNum(g)) {
    return q(
      "eps_vs_sales",
      `Can ${S} keep earnings per share growing faster than sales, with sales up ${p(g)} a year over ${
        isNum(d.growth.revenueCagr5) ? "five years" : "the years on record"
      } and the share count down ${pa(sh)} in ${L}?`,
    );
  }
  if (isNum(sh) && sh >= 1) {
    return q(
      "dilution",
      `Can ${S} grow profit fast enough to outrun a share count that rose ${p(sh)} in ${L}?`,
    );
  }
  if (isNum(g) && isNum(om)) {
    return q(
      "pace",
      `Can ${S} keep sales growing about ${p(g, 0)} a year, the pace of the last ${
        isNum(d.growth.revenueCagr5) ? "five years" : "few years"
      }, with an operating margin near ${p(om, 0)}?`,
    );
  }
  return q("generic", `Can ${S} keep growing sales and profit from the ${L} level?`);
}

/** Plain summary of the four tests: how many pass, are tripped, or cannot be checked. */
export function checkCounts(d: Derived): { pass: number; bad: number; none: number } {
  return {
    pass: d.checks.filter((x) => x.passes === true).length,
    bad: d.checks.filter((x) => x.passes === false).length,
    none: d.checks.filter((x) => x.passes === null).length,
  };
}

export const NUM_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
export const word = (n: number): string => NUM_WORDS[n] ?? String(n);

/** How a payout ratio (cash returned / FCF) reads: "more than", "about all of" or "part of" the cash made. */
export function payoutText(ratio: number): string {
  if (ratio > 1.02) {
    return `${
      pct(ratio * 100, 0)
    } of the cash it made, more than it made, so the gap came from savings or new debt`;
  }
  if (ratio >= 0.98) return "about all of the cash it made";
  return `${pct(ratio * 100, 0)} of the cash it made, and the rest stayed in the business`;
}

/** Share counts for charts and tables: billions for large companies, millions below one billion. */
export function shareSeries(
  values: Num[],
): { values: Num[]; unit: "shares_b" | "plain"; sub: string; text: (v: Num) => string } {
  const max = Math.max(0, ...values.filter(isNum));
  if (max >= 1e9) {
    return { values, unit: "shares_b", sub: "billions", text: (v) => fmt(v, "shares_b") };
  }
  return {
    values: values.map((v) => (isNum(v) ? v / 1e6 : null)),
    unit: "plain",
    sub: "millions",
    text: (v) => (isNum(v) ? `${(v / 1e6).toFixed(1)}M` : fmt(null, "plain")),
  };
}

/** Chart references in a chapter's text that do not point to a titled card of the same chapter (should be none). */
export function localRefProblems(ch: Chapter): string[] {
  const titled = new Set(ch.cards.filter((c) => c.title).map((c) => c.id));
  const texts = [
    ch.verdict.lead,
    ch.verdict.body,
    ...ch.story.flatMap((s) => [s.lead, s.body]),
    ch.upshot ?? "",
  ];
  const out: string[] = [];
  for (const t of texts) {
    for (const mt of t.matchAll(/\[\[ref:([^\]]+)\]\]/g)) {
      if (!titled.has(mt[1])) out.push(`${ch.id}: ${mt[1]}`);
    }
  }
  return out;
}
