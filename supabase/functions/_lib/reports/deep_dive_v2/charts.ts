// Deep Dive 2.0 chart kit, part 1: shared helpers, columns, lines, ranked bars, tables and CHART_CSS.
// Every function is pure and returns a complete static SVG (or HTML) string, so charts work without JS and in print.
// Ported from the approved mockup's client chart kit (docs/deep-dive/mockup.html). Colours only via CSS classes.
// Text never overlaps: margins are reserved from estimated label widths (textW) and x labels are thinned.

import { esc, fmt, fmtAxis, NOT_DISCLOSED, type Unit } from "./format.ts";

export type Tone = "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "pos" | "neg" | "deemph";
export interface Series {
  name: string;
  values: Array<number | null>;
  tone: Tone;
}

export const NODATA = `<div class="nodata">${NOT_DISCLOSED}</div>`;
const TONES: readonly Tone[] = ["s1", "s2", "s3", "s4", "s5", "s6", "pos", "neg", "deemph"];
const tone = (t: Tone | undefined): Tone => (t && TONES.includes(t) ? t : "s1");
export const fillCls = (t: Tone | undefined): string => `f-${tone(t)}`;
export const strokeCls = (t: Tone | undefined): string => `st-${tone(t)}`;
export const bgCls = (t: Tone | undefined): string => `bg-${tone(t)}`;

export const FONT_TICK = 10.5;
export const FONT_LABEL = 11;

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Coordinate to text with at most one decimal. */
export function n1(v: number): string {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? "0" : String(r);
}

/** "Nice" axis ticks (1, 2, 5 steps) covering [min, max]; port of the mockup's niceTicks. Always >= 2 ticks. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!isNum(min) || !isNum(max)) return [0, 1];
  let lo0 = Math.min(min, max);
  let hi0 = Math.max(min, max);
  if (hi0 === lo0) {
    if (lo0 === 0) hi0 = 1;
    else if (lo0 > 0) lo0 = 0;
    else hi0 = 0;
  }
  const raw = (hi0 - lo0) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const lo = Math.floor(lo0 / step + 1e-9) * step;
  const hi = Math.ceil(hi0 / step - 1e-9) * step;
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + step * 1e-6 && i < 50; i++) {
    out.push(Number((lo + i * step).toPrecision(12)));
  }
  if (out.length < 2) out.push(Number((lo + step).toPrecision(12)));
  return out;
}

/** Estimated text width in viewBox units (system sans: digits about 0.56em). Errs slightly wide on purpose. */
export function textW(s: string, size = FONT_LABEL, weight = 400): number {
  let w = 0;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") w += 0.56;
    else if (ch === " ") w += 0.28;
    else if (".,:;'|!ilj".includes(ch)) w += 0.28;
    else if ("frt()[]-/".includes(ch)) w += 0.38;
    else if ("%mwMW@".includes(ch)) w += 0.86;
    else if (ch >= "A" && ch <= "Z") w += 0.68;
    else if (ch === "$" || ch === "−" || ch === "+") w += 0.6;
    else w += 0.55;
  }
  return w * size * (weight >= 600 ? 1.06 : 1);
}

/** Cuts `s` to fit `maxW`, ending in an ellipsis. */
export function ellipsize(s: string, maxW: number, size = FONT_LABEL, weight = 400): string {
  if (textW(s, size, weight) <= maxW) return s;
  const chars = Array.from(s);
  while (chars.length > 1 && textW(chars.join("").trimEnd() + "…", size, weight) > maxW) chars.pop();
  return chars.length > 1 ? chars.join("").trimEnd() + "…" : "";
}

export function svgOpen(w: number, h: number, title: string, extra = ""): string {
  return `<svg class="ch${extra ? " " + extra : ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${
    n1(w)
  } ${n1(h)}" width="100%" role="img" aria-label="${esc(title)}">`;
}

/** Vertical bar from the zero line y0 to the data end y1, with a rounded data end (4px). */
export function vBar(x: number, w: number, y0: number, y1: number, r = 4): string {
  const h = Math.abs(y0 - y1);
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const up = y1 <= y0;
  const e = up ? y1 + rr : y1 - rr;
  return `M${n1(x)},${n1(y0)}V${n1(e)}Q${n1(x)},${n1(y1)} ${n1(x + rr)},${n1(y1)}H${n1(x + w - rr)}Q${
    n1(x + w)
  },${n1(y1)} ${n1(x + w)},${n1(e)}V${n1(y0)}Z`;
}

/** Horizontal bar from the zero line x0 to the data end x1, rounded at the data end. */
export function hBar(x0: number, x1: number, y: number, h: number, r = 4): string {
  const w = Math.abs(x1 - x0);
  const rr = Math.max(0, Math.min(r, h / 2, w));
  const right = x1 >= x0;
  const e = right ? x1 - rr : x1 + rr;
  return `M${n1(x0)},${n1(y)}H${n1(e)}Q${n1(x1)},${n1(y)} ${n1(x1)},${n1(y + rr)}V${n1(y + h - rr)}Q${
    n1(x1)
  },${n1(y + h)} ${n1(e)},${n1(y + h)}H${n1(x0)}Z`;
}

/** Plain rectangle path (stacked inner segments, waterfall steps). */
export function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${n1(x)},${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}Z`;
}

export function titleTag(label: string, value: string): string {
  return `<title>${esc(label)}: ${esc(value)}</title>`;
}

/** Legend row (HTML) for two or more series. */
export function legendHtml(items: Array<{ name: string; tone: Tone }>, kind: "box" | "line"): string {
  if (items.length < 2) return "";
  const k = kind === "line" ? "lk" : "sw";
  return `<div class="lg">${
    items.map((i) => `<span><i class="${k} ${bgCls(i.tone)}"></i>${esc(i.name)}</span>`).join("")
  }</div>`;
}

/** Horizontal gridlines with y tick labels; the zero line (or the bottom line) is the stronger axis. */
export function yGrid(
  ticks: number[],
  unit: Unit,
  y: (v: number) => number,
  x1: number,
  x2: number,
): string {
  const txt = fmtAxis(ticks, unit);
  const hasZero = ticks.some((t) => t === 0);
  let s = "";
  ticks.forEach((t, i) => {
    const axis = hasZero ? t === 0 : i === 0;
    s += `<line class="${axis ? "axis" : "grid"}" x1="${n1(x1)}" x2="${n1(x2)}" y1="${n1(y(t))}" y2="${
      n1(y(t))
    }"/>`;
    s += `<text class="tx" x="${n1(x1 - 6)}" y="${n1(y(t) + 3.5)}" text-anchor="end">${esc(txt[i])}</text>`;
  });
  return s;
}

export function yAxisWidth(ticks: number[], unit: Unit): number {
  return Math.ceil(Math.max(14, ...fmtAxis(ticks, unit).map((t) => textW(t, FONT_TICK)))) + 10;
}

/**
 * Picks which x labels to show so neighbours never touch. Counts from the LAST label backwards:
 * label i shows when (n - 1 - i) % every === 0. "FY2015" labels shorten to "FY15" when that shows more.
 */
export function xLabelPlan(labels: string[], spacing: number): { labels: string[]; every: number } {
  const need = (ls: string[]) =>
    Math.max(1, Math.ceil((Math.max(0, ...ls.map((l) => textW(l, FONT_TICK))) + 8) / Math.max(1, spacing)));
  const every = need(labels);
  if (every > 1 && labels.length && labels.every((l) => /^FY\d{4}$/.test(l))) {
    const short = labels.map((l) => "FY" + l.slice(4));
    const e2 = need(short);
    if (e2 < every) return { labels: short, every: e2 };
  }
  return { labels, every };
}

function xLabels(labels: string[], xs: number[], spacing: number, yText: number, w: number): string {
  const plan = xLabelPlan(labels, spacing);
  const n = labels.length;
  let s = "";
  plan.labels.forEach((l, i) => {
    if ((n - 1 - i) % plan.every !== 0) return;
    const half = textW(l, FONT_TICK) / 2;
    const x = Math.max(half + 1, Math.min(w - half - 1, xs[i]));
    s += `<text class="tx" x="${n1(x)}" y="${n1(yText)}" text-anchor="middle">${esc(l)}</text>`;
  });
  return s;
}

interface Lab {
  cx: number;
  y: number;
  w: number;
  text: string;
  x: number;
}

/**
 * Pushes value labels apart horizontally when they would overlap (same row within 12px). Each label starts at
 * its preset left edge `x` (centred, or anchored to its bar edge like the mockup's grouped labels).
 */
export function spreadLabels(labs: Lab[], gap = 4): void {
  labs.sort((a, b) => a.x - b.x);
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < labs.length; i++) {
      for (let j = i + 1; j < labs.length; j++) {
        const a = labs[i];
        const b = labs[j];
        if (Math.abs(a.y - b.y) >= 12) continue;
        const over = a.x + a.w + gap - b.x;
        if (over > 0.01) {
          a.x -= over / 2;
          b.x += over / 2;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/** Per-share money at or above $100 drops the cents in chart labels ($204, not $204.00). */
export function labelDigits(unit: Unit, values: number[]): number | undefined {
  if (unit !== "usd_ps") return undefined;
  const m = Math.max(0, ...values.filter(isNum).map(Math.abs));
  return m >= 100 ? 0 : undefined;
}

function valueAt(s: Series, i: number): number | null {
  const v = s.values[i];
  return isNum(v) ? v : null;
}

function hasAny(series: Series[]): boolean {
  return series.some((s) => s.values.some(isNum));
}

// ---------------------------------------------------------------- columns

export function columns(o: {
  title: string;
  labels: string[];
  series: Series[];
  unit: Unit;
  width?: number;
  height?: number;
  stacked?: boolean;
  highlightLast?: boolean;
  labelLast?: boolean;
}): string {
  const W = o.width ?? 360;
  const H = o.height ?? 220;
  const n = o.labels.length;
  const series = o.series;
  if (!n || !hasAny(series)) return NODATA;
  const stacked = !!o.stacked && series.length > 1;
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    if (stacked) {
      let p = 0;
      let q = 0;
      for (const s of series) {
        const v = valueAt(s, i);
        if (v === null) continue;
        if (v >= 0) p += v;
        else q += v;
      }
      hi = Math.max(hi, p);
      lo = Math.min(lo, q);
    } else {
      for (const s of series) {
        const v = valueAt(s, i);
        if (v !== null) {
          hi = Math.max(hi, v);
          lo = Math.min(lo, v);
        }
      }
    }
  }
  const span = hi - lo || 1;
  const ticks = niceTicks(lo < 0 ? lo - span * 0.02 : lo, hi > 0 ? hi + span * 0.02 : hi, 4);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const ml = yAxisWidth(ticks, o.unit);
  const last = n - 1;
  // value labels at the last category
  const labelVals: Array<{ v: number; text: string }> = [];
  if (o.labelLast) {
    if (stacked) {
      const vs = series.map((s) => valueAt(s, last)).filter(isNum);
      if (vs.length) {
        const tot = vs.reduce((a, b) => a + b, 0);
        labelVals.push({ v: tot, text: fmt(tot, o.unit) });
      }
    } else {
      for (const s of series) {
        const v = valueAt(s, last);
        if (v !== null) labelVals.push({ v, text: fmt(v, o.unit) });
      }
    }
  }
  const mt = labelVals.some((l) => l.v >= 0) ? 22 : 10;
  const mb = 24 + (labelVals.some((l) => l.v < 0) ? 14 : 0);
  const ph = H - mt - mb;
  const y = (v: number) => mt + ph - ((v - t0) / (t1 - t0)) * ph;
  const k = stacked ? 1 : series.length;

  const layout = (mr: number) => {
    const pw = W - ml - mr;
    const band = pw / n;
    const bw = Math.max(1, Math.min(24, (band * 0.72 - (k - 1) * 2) / k));
    let marks = "";
    const labs: Lab[] = [];
    const cxs: number[] = [];
    for (let i = 0; i < n; i++) {
      const cx = ml + band * i + band / 2;
      cxs.push(cx);
      const dim = o.highlightLast && i !== last ? " dim" : "";
      const cat = o.labels[i];
      if (stacked) {
        const x = cx - bw / 2;
        const vals = series.map((s) => valueAt(s, i));
        const lastPos = vals.reduce<number>((a, v, j) => (v !== null && v > 0 ? j : a), -1);
        const lastNeg = vals.reduce<number>((a, v, j) => (v !== null && v < 0 ? j : a), -1);
        let accP = 0;
        let accN = 0;
        let firstP = true;
        let firstN = true;
        series.forEach((s, j) => {
          const v = vals[j];
          if (v === null || v === 0) return;
          const from = v > 0 ? accP : accN;
          const to = from + v;
          if (v > 0) accP = to;
          else accN = to;
          const inner = v > 0 ? !firstP : !firstN;
          if (v > 0) firstP = false;
          else firstN = false;
          let y0 = y(from);
          const y1 = y(to);
          if (inner) y0 += v > 0 ? -2 : 2;
          if ((v > 0 && y0 <= y1) || (v < 0 && y0 >= y1)) return;
          const outer = j === (v > 0 ? lastPos : lastNeg);
          const d = outer ? vBar(x, bw, y0, y1) : rectPath(x, Math.min(y0, y1), bw, Math.abs(y1 - y0));
          marks += `<path class="${fillCls(s.tone)}${dim}" d="${d}">${
            titleTag(`${s.name}, ${cat}`, fmt(v, o.unit))
          }</path>`;
        });
        if (i === last && labelVals.length) {
          const lv = labelVals[0];
          const ly = lv.v >= 0 ? y(accP) - 5 : y(accN) + 12;
          const w = textW(lv.text, FONT_LABEL, 600);
          labs.push({ cx, y: ly, w, text: lv.text, x: cx - w / 2 });
        }
      } else {
        const gw = k * bw + (k - 1) * 2;
        let x = cx - gw / 2;
        let li = 0;
        for (const s of series) {
          const v = valueAt(s, i);
          if (v !== null && v !== 0) {
            marks += `<path class="${fillCls(s.tone)}${dim}" d="${vBar(x, bw, y(0), y(v))}">${
              titleTag(`${s.name}, ${cat}`, fmt(v, o.unit))
            }</path>`;
          }
          if (i === last && v !== null && o.labelLast) {
            const lv = labelVals[li];
            const ly = v >= 0 ? y(v) - 5 : y(v) + 12;
            const w = textW(lv.text, FONT_LABEL, 600);
            // grouped: first label ends at its bar's right edge, last starts at its bar's left edge (mockup)
            const lx = k === 1
              ? x + bw / 2 - w / 2
              : li === 0
              ? x + bw - w
              : li === labelVals.length - 1
              ? x
              : x + bw / 2 - w / 2;
            labs.push({ cx: x + bw / 2, y: ly, w, text: lv.text, x: lx });
            li++;
          }
          x += bw + 2;
        }
      }
    }
    spreadLabels(labs);
    const right = Math.max(0, ...labs.map((l) => l.x + l.w));
    return { pw, band, marks, labs, cxs, overflow: right - (W - 2) };
  };

  let mr = 8;
  let L = layout(mr);
  for (let it = 0; it < 4 && L.overflow > 0.5; it++) {
    mr += L.overflow + 1;
    L = layout(mr);
  }
  let s = svgOpen(W, H, o.title);
  s += yGrid(ticks, o.unit, y, ml, W - mr);
  s += L.marks;
  s += `<line class="axis" x1="${n1(ml)}" x2="${n1(W - mr)}" y1="${n1(y(0))}" y2="${n1(y(0))}"/>`;
  for (const l of L.labs) {
    s += `<text class="tx-ink halo" x="${n1(l.x)}" y="${n1(l.y)}">${esc(l.text)}</text>`;
  }
  s += xLabels(o.labels, L.cxs, L.band, H - 7, W);
  s += "</svg>";
  return s + legendHtml(series, "box");
}

// ---------------------------------------------------------------- lines

export function lines(o: {
  title: string;
  labels: string[];
  series: Series[];
  unit: Unit;
  width?: number;
  height?: number;
  labelLast?: boolean;
  zero?: boolean;
}): string {
  const W = o.width ?? 360;
  const H = o.height ?? 210;
  const n = o.labels.length;
  const series = o.series;
  if (!n || !hasAny(series)) return NODATA;
  const all = series.flatMap((s) => s.values.slice(0, n).filter(isNum));
  const zero = o.zero !== false;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const ticks = niceTicks(lo, hi, 4);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const ml = yAxisWidth(ticks, o.unit);
  const mt = 12;
  const mb = 24;
  const ph = H - mt - mb;
  const y = (v: number) => mt + ph - ((v - t0) / (t1 - t0)) * ph;
  const ends: Array<{ s: Series; i: number; v: number; y: number; text: string }> = [];
  for (const s of series) {
    let li = Math.min(n, s.values.length) - 1;
    while (li >= 0 && !isNum(s.values[li])) li--;
    if (li < 0) continue;
    const v = s.values[li] as number;
    ends.push({ s, i: li, v, y: y(v) + 4, text: fmt(v, o.unit) });
  }
  const mr = o.labelLast
    ? Math.ceil(Math.max(0, ...ends.map((e) => textW(e.text, FONT_LABEL, 600)))) + 14
    : 10;
  const pw = W - ml - mr;
  const x = (i: number) => ml + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
  let s = svgOpen(W, H, o.title);
  s += yGrid(ticks, o.unit, y, ml, W - mr);
  const xs = o.labels.map((_, i) => x(i));
  s += xLabels(o.labels, xs, n === 1 ? pw : pw / (n - 1), H - 7, W);
  for (const se of series) {
    let d = "";
    let pen = false;
    const singles: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = valueAt(se, i);
      if (v === null) {
        pen = false;
        continue;
      }
      const prevNull = i === 0 || valueAt(se, i - 1) === null;
      const nextNull = i === n - 1 || valueAt(se, i + 1) === null;
      if (prevNull && nextNull) singles.push(i);
      d += `${pen ? "L" : "M"}${n1(x(i))},${n1(y(v))}`;
      pen = true;
    }
    if (d) s += `<path class="ln ${strokeCls(se.tone)}" d="${d}"><title>${esc(se.name)}</title></path>`;
    for (const i of singles) {
      s += `<circle class="${fillCls(se.tone)}" cx="${n1(x(i))}" cy="${
        n1(y(valueAt(se, i) as number))
      }" r="3"/>`;
    }
  }
  for (const e of ends) {
    s += `<circle class="${fillCls(e.s.tone)} dot" cx="${n1(x(e.i))}" cy="${n1(y(e.v))}" r="4"/>`;
  }
  // invisible hover targets, one per point, each with a "label: value" title
  for (const se of series) {
    for (let i = 0; i < n; i++) {
      const v = valueAt(se, i);
      if (v === null) continue;
      s += `<circle class="hit" cx="${n1(x(i))}" cy="${n1(y(v))}" r="6">${
        titleTag(`${se.name}, ${o.labels[i]}`, fmt(v, o.unit))
      }</circle>`;
    }
  }
  if (o.labelLast && ends.length) {
    const top = mt + 4;
    const bottom = mt + ph + 4;
    // An end before the last column (history followed by forecasts) is labelled above and to the left of its
    // point, clear of the lines that continue to the right.
    for (const e of ends.filter((e) => e.i < n - 1)) {
      s += `<text class="tx-ink halo" x="${n1(x(e.i) - 8)}" y="${
        n1(Math.max(top, y(e.v) - 8))
      }" text-anchor="end">${esc(e.text)}</text>`;
    }
    const labs = [...ends].filter((e) => e.i === n - 1).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
    const over = labs.length ? labs[labs.length - 1].y - bottom : 0;
    if (over > 0) {
      labs[labs.length - 1].y = bottom;
      for (let i = labs.length - 2; i >= 0; i--) {
        if (labs[i + 1].y - labs[i].y < 13) labs[i].y = labs[i + 1].y - 13;
      }
    }
    if (labs.length && labs[0].y < top) labs[0].y = top;
    for (const e of labs) {
      s += `<text class="tx-ink halo" x="${n1(x(e.i) + 8)}" y="${n1(e.y)}">${esc(e.text)}</text>`;
    }
  }
  s += "</svg>";
  return s + legendHtml(series, "line");
}

// ---------------------------------------------------------------- ranked horizontal bars

export function hbars(o: {
  title: string;
  rows: Array<{ label: string; value: number | null; tone?: Tone; note?: string }>;
  unit: Unit;
  width?: number;
}): string {
  const W = o.width ?? 360;
  const rows = o.rows;
  if (!rows.length || !rows.some((r) => isNum(r.value))) return NODATA;
  const vals = rows.map((r) => (isNum(r.value) ? r.value : null));
  const max = Math.max(0, ...vals.filter(isNum));
  const min = Math.min(0, ...vals.filter(isNum));
  const span = max - min || 1;
  const x0 = 1;
  const x1 = W - 1;
  const xv = (v: number) => x0 + ((v - min) / span) * (x1 - x0);
  const rowH = 34;
  const H = rows.length * rowH;
  let s = svgOpen(W, H, o.title);
  rows.forEach((r, i) => {
    const top = i * rowH;
    const v = vals[i];
    const vt = v === null ? "n/a" : fmt(v, o.unit);
    const vw = textW(vt, FONT_LABEL, 600);
    const room = W - vw - 12;
    const label = ellipsize(r.label, room, FONT_LABEL, 500);
    const noteRoom = room - textW(label, FONT_LABEL, 500) - 6;
    const note = r.note && noteRoom > 20 ? ellipsize(r.note, noteRoom, 10.5) : "";
    s += `<text class="tx-lab" x="0" y="${n1(top + 12)}">${esc(label)}${
      note ? `<tspan class="tx" dx="6">${esc(note)}</tspan>` : ""
    }</text>`;
    s += `<text class="${v === null ? "tx" : "tx-ink"}" x="${W}" y="${n1(top + 12)}" text-anchor="end">${
      esc(vt)
    }</text>`;
    const by = top + 19;
    if (v !== null && v !== 0) {
      const a = xv(0);
      let b = xv(v);
      if (Math.abs(b - a) < 2) b = a + (v > 0 ? 2 : -2);
      s += `<path class="${fillCls(r.tone)}" d="${hBar(a, b, by, 8)}">${
        titleTag(r.label + (r.note ? `, ${r.note}` : ""), vt)
      }</path>`;
    } else {
      s += `<rect class="hit" x="0" y="${n1(by)}" width="${W}" height="8">${
        titleTag(r.label, v === null ? NOT_DISCLOSED : vt)
      }</rect>`;
    }
  });
  if (min < 0) {
    s += `<line class="axis" x1="${n1(xv(0))}" x2="${n1(xv(0))}" y1="16" y2="${n1(H - 4)}"/>`;
  }
  return s + "</svg>";
}

// ---------------------------------------------------------------- table and wide

/** Data table behind a chart, collapsed by default. Every cell is escaped. Empty cells show "n/a". */
export function table(o: { caption: string; head: string[]; rows: string[][] }): string {
  const cell = (c: unknown) => {
    const t = c === null || c === undefined || String(c).trim() === "" ? "n/a" : String(c);
    return esc(t);
  };
  const head = o.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("");
  const body = o.rows.map((r) =>
    `<tr>${
      r.map((c, j) => `<td${j ? ` data-l="${esc(o.head[j] ?? "")}"` : ""}>${cell(c)}</td>`).join("")
    }</tr>`
  ).join("");
  return `<details class="tbl"><summary>Show table</summary><table><caption>${
    esc(o.caption)
  }</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
}

/** Span-two chart: the narrow variant on phones, the wide one from 760px (and in print). */
export function wide(narrowSvg: string, wideSvg: string): string {
  return `<div class="w-n">${narrowSvg}</div><div class="w-w">${wideSvg}</div>`;
}

// ---------------------------------------------------------------- CSS

const TONE_VARS: Array<[Tone, string]> = [
  ["s1", "var(--s1)"],
  ["s2", "var(--s2)"],
  ["s3", "var(--s3)"],
  ["s4", "var(--s4)"],
  ["s5", "var(--s5)"],
  ["s6", "var(--s6)"],
  ["pos", "var(--pos)"],
  ["neg", "var(--neg)"],
  ["deemph", "var(--deemph)"],
];

const HEAT_STEPS = [22, 44, 66, 85];
const DIV_MID = "var(--div-mid,var(--grid))";

export const CHART_CSS = [
  ".ch{display:block;width:100%;height:auto;overflow:visible}",
  ".ch text{font-family:var(--f-body,system-ui,sans-serif)}",
  ".tx{fill:var(--muted);font-size:10.5px;font-variant-numeric:tabular-nums}",
  ".tx-ink{fill:var(--ink);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}",
  ".tx-lab{fill:var(--ink);font-size:11px;font-weight:500}",
  ".tx-on{fill:#fff;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}",
  ".tx-heat{fill:var(--ink);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}",
  ".halo{paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round}",
  ".grid{stroke:var(--grid);stroke-width:1}",
  ".axis{stroke:var(--axis);stroke-width:1}",
  ".ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}",
  ".dot{stroke:var(--surface);stroke-width:2}",
  ".hit{fill:transparent}",
  ".dim{opacity:.42}",
  ".faded{opacity:.5}",
  ".mk-line{stroke:var(--ink);stroke-width:2}",
  ".mk-mid{stroke:var(--muted);stroke-width:1.5}",
  ".conn{stroke:var(--axis);stroke-width:1;stroke-dasharray:2 3}",
  ".trk{fill:var(--grid)}",
  '.ch path[class^="f-"]:hover{opacity:.85}',
  ...TONE_VARS.map(([t, v]) => `.f-${t}{fill:${v}}.st-${t}{stroke:${v}}.bg-${t}{background:${v}}`),
  ".hm-0{fill:" + DIV_MID + "}",
  ...HEAT_STEPS.map((p, i) =>
    `.hm-p${i + 1}{fill:color-mix(in oklab,var(--div-pos,var(--s4)) ${p}%,${DIV_MID})}` +
    `.hm-n${i + 1}{fill:color-mix(in oklab,var(--div-neg,var(--s5)) ${p}%,${DIV_MID})}`
  ),
  // legend
  ".lg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--ink-2,var(--muted));margin-top:8px}",
  ".lg span{display:inline-flex;align-items:center;gap:6px;min-width:0}",
  ".lg .sw,.dn-lg .sw{width:10px;height:10px;border-radius:3px;display:inline-block;flex:none}",
  ".lg .lk{width:14px;height:2px;border-radius:2px;display:inline-block;flex:none}",
  // donut
  ".dn{display:flex;flex-wrap:wrap;gap:16px;align-items:center}",
  ".dn .ch.dn-svg{flex:none;width:auto;max-width:100%;height:auto}",
  ".dn-lg{flex:1;min-width:170px;display:grid;gap:8px}",
  ".dn-lg div{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:13px}",
  ".dn-lg span{min-width:0;overflow-wrap:anywhere}",
  ".dn-lg b{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}",
  ".dn-c{fill:var(--ink);font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}",
  // meter
  ".mtr{display:grid;grid-template-columns:150px minmax(0,1fr) 52px;gap:4px 10px;align-items:center}",
  ".mtr+.mtr{margin-top:12px}",
  ".mtr-n{font-size:13.5px;font-weight:500;min-width:0}",
  ".mtr-t{display:block;width:100%;height:8px;overflow:hidden;border-radius:4px}",
  ".mtr-v{font-size:13px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}",
  ".mtr-v.na{color:var(--muted);font-weight:500}",
  ".mtr-r{grid-column:1/-1;font-size:12.5px;color:var(--muted)}",
  "@media (max-width:460px){.mtr{grid-template-columns:minmax(0,1fr) 52px}.mtr-t{grid-column:1/-1;grid-row:2}" +
  ".mtr-r{grid-row:3}}",
  // table
  ".tbl{margin-top:4px}",
  ".tbl summary{cursor:pointer;font-size:12px;font-weight:600;color:var(--accent,var(--ink));padding:4px 0;" +
  "list-style:none;width:max-content}",
  ".tbl summary::-webkit-details-marker{display:none}",
  ".tbl[open] summary{margin-bottom:6px}",
  ".tbl table{border-collapse:collapse;width:100%;font-size:12.5px;font-variant-numeric:tabular-nums}",
  ".tbl caption{text-align:left;font-size:11.5px;color:var(--muted);padding-bottom:4px}",
  ".tbl th,.tbl td{padding:6px 8px;border-bottom:1px solid var(--line,var(--grid));text-align:right}",
  ".tbl th:first-child,.tbl td:first-child{text-align:left}",
  ".tbl th{font-weight:600;color:var(--muted);font-size:11.5px;vertical-align:bottom}",
  // wide variants
  ".w-w{display:none}",
  "@media (min-width:760px){.w-n{display:none}.w-w{display:block}}",
  "@media print{.w-n{display:none}.w-w{display:block}}",
].join("\n");
