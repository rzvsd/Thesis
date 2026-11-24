// Deep Dive 2.0 chart kit, part 2: donut, waterfall (bridge), range (football field), meter and heat grid.
// Same conventions as charts.ts: pure functions, static SVG, colours only via CHART_CSS classes, escaped text.

import { esc, fmt, fmtAxis, NOT_DISCLOSED, type Unit } from "./format.ts";
import {
  bgCls,
  ellipsize,
  fillCls,
  FONT_LABEL,
  FONT_TICK,
  isNum,
  labelDigits,
  n1,
  niceTicks,
  NODATA,
  rectPath,
  svgOpen,
  textW,
  titleTag,
  type Tone,
  vBar,
  yAxisWidth,
  yGrid,
} from "./charts.ts";

// ---------------------------------------------------------------- donut

function shareText(part: number, total: number): string {
  const p = (part / total) * 100;
  return fmt(p, "pct", { digits: p < 1 ? 1 : 0 });
}

/** Donut (six parts or fewer) plus an HTML legend list with each part's share. */
export function donut(o: {
  title: string;
  parts: Array<{ label: string; value: number; tone: Tone }>;
  center?: { value: string; label: string };
  size?: number;
}): string {
  const size = Math.max(96, o.size ?? 176);
  const parts = o.parts.filter((p) => isNum(p.value) && p.value > 0);
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!parts.length || !(total > 0)) return NODATA;
  const c = size / 2;
  const ro = c - 8;
  const ri = ro - Math.max(14, ro * 0.3);
  const gap = parts.length > 1 ? 0.022 : 0;
  const P = (rad: number, a: number) => `${n1(c + rad * Math.cos(a))},${n1(c + rad * Math.sin(a))}`;
  let s =
    `<svg class="ch dn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" ` +
    `height="${size}" role="img" aria-label="${esc(o.title)}">`;
  let a0 = -Math.PI / 2;
  for (const p of parts) {
    const ang = (p.value / total) * Math.PI * 2;
    const t = titleTag(p.label, shareText(p.value, total));
    if (parts.length === 1) {
      // a full ring: two half arcs outside, two inside, even-odd fill
      const d = `M${P(ro, 0)}A${ro},${ro} 0 1 1 ${P(ro, Math.PI)}A${ro},${ro} 0 1 1 ${P(ro, 0)}Z` +
        `M${P(ri, 0)}A${ri},${ri} 0 1 0 ${P(ri, Math.PI)}A${ri},${ri} 0 1 0 ${P(ri, 0)}Z`;
      s += `<path class="${fillCls(p.tone)}" fill-rule="evenodd" d="${d}">${t}</path>`;
      break;
    }
    const s0 = a0 + gap / 2;
    const s1 = a0 + ang - gap / 2;
    a0 += ang;
    if (s1 <= s0) continue;
    const large = s1 - s0 > Math.PI ? 1 : 0;
    const d = `M${P(ro, s0)}A${n1(ro)},${n1(ro)} 0 ${large} 1 ${P(ro, s1)}L${P(ri, s1)}A${n1(ri)},${
      n1(ri)
    } 0 ${large} 0 ${P(ri, s0)}Z`;
    s += `<path class="${fillCls(p.tone)}" d="${d}">${t}</path>`;
  }
  if (o.center) {
    const room = ri * 2 - 12;
    const need = textW(o.center.value, 20, 600);
    const fs = need > room ? Math.max(11, Math.floor((20 * room) / need)) : 20;
    s += `<text class="dn-c" x="${n1(c)}" y="${n1(c + 2)}" text-anchor="middle"${
      fs !== 20 ? ` style="font-size:${fs}px"` : ""
    }>${esc(o.center.value)}</text>`;
    const sub = ellipsize(o.center.label, room, FONT_TICK);
    if (sub) s += `<text class="tx" x="${n1(c)}" y="${n1(c + 18)}" text-anchor="middle">${esc(sub)}</text>`;
  }
  s += "</svg>";
  const rows = parts.map((p) =>
    `<div><i class="sw ${bgCls(p.tone)}"></i><span>${esc(p.label)}</span><b>${
      esc(shareText(p.value, total))
    }</b></div>`
  ).join("");
  return `<div class="dn">${s}<div class="dn-lg">${rows}</div></div>`;
}

// ---------------------------------------------------------------- waterfall

/** Splits a label into two balanced lines when both fit `maxW`; null when they do not. */
function twoLines(label: string, maxW: number): [string, string] | null {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const w = Math.max(textW(a, FONT_TICK), textW(b, FONT_TICK));
    if (w <= maxW && w < bestW) {
      best = [a, b];
      bestW = w;
    }
  }
  return best;
}

/** Bridge from a start total through signed steps to an end total, every step labelled (like the EPS bridge). */
export function waterfall(o: {
  title: string;
  start: { label: string; value: number };
  steps: Array<{ label: string; value: number }>;
  end: { label: string; value: number };
  unit: Unit;
  width?: number;
}): string {
  const W = o.width ?? 360;
  if (!isNum(o.start?.value) || !isNum(o.end?.value)) return NODATA;
  const items = [
    { label: o.start.label, value: o.start.value, tot: true },
    ...o.steps.filter((st) => isNum(st.value)).map((st) => ({
      label: st.label,
      value: st.value,
      tot: false,
    })),
    { label: o.end.label, value: o.end.value, tot: true },
  ];
  const n = items.length;
  const levels: Array<{ from: number; to: number }> = [];
  let acc = 0;
  for (const it of items) {
    if (it.tot) {
      levels.push({ from: 0, to: it.value });
      acc = it.value;
    } else {
      levels.push({ from: acc, to: acc + it.value });
      acc += it.value;
    }
  }
  const all = levels.flatMap((l) => [l.from, l.to]);
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const span = hi - lo || 1;
  const ticks = niceTicks(lo < 0 ? lo - span * 0.06 : lo, hi > 0 ? hi + span * 0.06 : hi, 4);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const ml = yAxisWidth(ticks, o.unit);
  const mr = 8;
  const pw = W - ml - mr;
  const band = pw / n;
  const bw = Math.min(56, band * 0.62);
  const texts = items.map((it) => (it.tot ? fmt(it.value, o.unit) : fmt(it.value, o.unit, { sign: true })));
  const stagger = Math.max(...texts.map((t) => textW(t, FONT_LABEL, 600))) > band - 4;
  const cats = items.map((it) => {
    const room = band - 4;
    if (textW(it.label, FONT_TICK) <= room) return [it.label];
    return twoLines(it.label, room) ?? [ellipsize(it.label, room, FONT_TICK)];
  });
  const twoRow = cats.some((c) => c.length > 1);
  const mt = stagger ? 34 : 22;
  const negLabel = levels.some((l, i) => items[i].tot && l.to < 0);
  const mb = (twoRow ? 36 : 24) + (negLabel ? 14 : 0);
  const H = 240 + (twoRow ? 12 : 0);
  const ph = H - mt - mb;
  const y = (v: number) => mt + ph - ((v - t0) / (t1 - t0)) * ph;
  let s = svgOpen(W, H, o.title);
  s += yGrid(ticks, o.unit, y, ml, W - mr);
  items.forEach((it, i) => {
    const cx = ml + band * i + band / 2;
    const x = cx - bw / 2;
    const l = levels[i];
    let d: string;
    let cls: string;
    if (it.tot) {
      d = vBar(x, bw, y(0), y(l.to));
      cls = "f-s1";
    } else {
      const top = y(Math.max(l.from, l.to));
      const h = Math.max(2, Math.abs(y(l.from) - y(l.to)));
      d = rectPath(x, top, bw, h);
      cls = it.value >= 0 ? "f-s4" : "f-s5";
    }
    s += `<path class="${cls}" d="${d}">${titleTag(it.label, texts[i])}</path>`;
    if (i < n - 1) {
      const lv = y(l.to);
      s += `<line class="conn" x1="${n1(x + bw)}" x2="${n1(x + band)}" y1="${n1(lv)}" y2="${n1(lv)}"/>`;
    }
    const below = it.tot && l.to < 0;
    const ly = below ? y(l.to) + 12 : y(Math.max(l.from, l.to)) - 5 - (stagger && i % 2 === 1 ? 12 : 0);
    s += `<text class="tx-ink halo" x="${n1(cx)}" y="${n1(ly)}" text-anchor="middle">${esc(texts[i])}</text>`;
    const c = cats[i];
    const yb = H - 7;
    if (c.length > 1) {
      s += `<text class="tx" x="${n1(cx)}" y="${n1(yb - 12)}" text-anchor="middle">${esc(c[0])}</text>`;
      s += `<text class="tx" x="${n1(cx)}" y="${n1(yb)}" text-anchor="middle">${esc(c[1])}</text>`;
    } else {
      s += `<text class="tx" x="${n1(cx)}" y="${n1(yb)}" text-anchor="middle">${esc(c[0])}</text>`;
    }
  });
  s += `<line class="axis" x1="${n1(ml)}" x2="${n1(W - mr)}" y1="${n1(y(0))}" y2="${n1(y(0))}"/>`;
  return s + "</svg>";
}

// ---------------------------------------------------------------- range (football field)

/**
 * Value ranges per method with an optional price marker. The marker is `<g data-dd="marker" data-min data-max
 * data-x0 data-x1 transform="translate(x,0)">`: the client maps a typed price from [min,max] to [x0,x1].
 * With no marker the group is still drawn, hidden with style="display:none", so the client can show it.
 */
export function range(o: {
  title: string;
  rows: Array<{ label: string; low: number; high: number; mid?: number; tone?: Tone; faded?: boolean }>;
  marker?: { value: number; label: string } | null;
  unit: Unit;
  width?: number;
}): string {
  const W = o.width ?? 360;
  const rows = o.rows.filter((r) => isNum(r.low) && isNum(r.high));
  if (!rows.length) return NODATA;
  const narrow = W < 560;
  const marker = o.marker && isNum(o.marker.value) ? o.marker : null;
  const vals = rows.flatMap((r) => [r.low, r.high, ...(isNum(r.mid) ? [r.mid] : [])]);
  if (marker) vals.push(marker.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo -= pad;
  hi += pad;
  if (Math.min(...vals) >= 0) lo = Math.max(0, lo);
  const ticks = niceTicks(lo, hi, 4);
  const dmin = ticks[0];
  const dmax = ticks[ticks.length - 1];
  const tickTxt = fmtAxis(ticks, o.unit);
  const tickHalf = Math.max(...tickTxt.map((t) => textW(t, FONT_TICK))) / 2 + 2;
  const mLabel = marker ? marker.label : "Your price";
  const markHalf = textW(mLabel, FONT_LABEL, 600) / 2 + 2;
  const labelCol = narrow
    ? 0
    : Math.min(Math.max(...rows.map((r) => textW(r.label, FONT_LABEL, 500))) + 14, W * 0.36);
  const ml = narrow ? Math.max(tickHalf, markHalf, 4) : Math.max(labelCol + 10, markHalf);
  const mr = Math.max(tickHalf, markHalf, 4);
  const pw = W - ml - mr;
  const x = (v: number) => ml + ((Math.min(dmax, Math.max(dmin, v)) - dmin) / (dmax - dmin)) * pw;
  const mt = 30;
  const rowH = narrow ? 40 : 30;
  // Range ends of $10 or more read as whole dollars, which keeps the narrow label clear of the values.
  const digits = o.unit === "usd_ps" && vals.length && Math.min(...vals.map(Math.abs)) >= 10
    ? 0
    : labelDigits(o.unit, vals);
  let labels = ""; // drawn after the marker, so the halo breaks the marker line under each label
  const H = mt + rows.length * rowH + 26;
  const gridBottom = H - 22;
  let s = svgOpen(W, H, o.title);
  ticks.forEach((t, i) => {
    s += `<line class="grid" x1="${n1(x(t))}" x2="${n1(x(t))}" y1="${mt - 4}" y2="${n1(gridBottom)}"/>`;
    s += `<text class="tx" x="${n1(x(t))}" y="${n1(H - 6)}" text-anchor="middle">${esc(tickTxt[i])}</text>`;
  });
  rows.forEach((r, i) => {
    const top = mt + i * rowH;
    const by = narrow ? top + 18 : top + 8;
    const lo2 = Math.min(r.low, r.high);
    const hi2 = Math.max(r.low, r.high);
    let xa = x(lo2);
    let xb = x(hi2);
    if (xb - xa < 4) {
      const m = (xa + xb) / 2;
      xa = m - 2;
      xb = m + 2;
    }
    const vt = `${fmt(lo2, o.unit, { digits })} to ${fmt(hi2, o.unit, { digits })}`;
    const vw = textW(vt, FONT_TICK);
    if (narrow) {
      const label = ellipsize(r.label, pw - vw - 18, FONT_LABEL, 500);
      labels += `<text class="tx-lab halo" x="${n1(ml)}" y="${n1(top + 12)}">${esc(label)}</text>`;
      labels += `<text class="tx halo" x="${n1(W - mr)}" y="${n1(top + 12)}" text-anchor="end">${
        esc(vt)
      }</text>`;
    } else {
      const label = ellipsize(r.label, labelCol - 4, FONT_LABEL, 500);
      labels += `<text class="tx-lab" x="${n1(ml - 10)}" y="${n1(by + 9)}" text-anchor="end">${
        esc(label)
      }</text>`;
      if (xb + 6 + vw <= W - 1) {
        labels += `<text class="tx halo" x="${n1(xb + 6)}" y="${n1(by + 9)}">${esc(vt)}</text>`;
      } else if (xa - 6 - vw >= ml) {
        labels += `<text class="tx halo" x="${n1(xa - 6)}" y="${n1(by + 9)}" text-anchor="end">${
          esc(vt)
        }</text>`;
      }
    }
    s += `<rect class="${fillCls(r.tone)}${r.faded ? " faded" : ""}" x="${n1(xa)}" y="${n1(by)}" width="${
      n1(xb - xa)
    }" height="10" rx="5">${titleTag(r.label, vt)}</rect>`;
    if (isNum(r.mid)) {
      s += `<line class="mk-mid" x1="${n1(x(r.mid))}" x2="${n1(x(r.mid))}" y1="${n1(by - 3)}" y2="${
        n1(by + 13)
      }">${titleTag(`${r.label}, middle`, fmt(r.mid, o.unit))}</line>`;
    }
  });
  const xm = marker ? x(marker.value) : ml + pw / 2;
  s += `<g data-dd="marker" data-dd-when="price" data-min="${dmin}" data-max="${dmax}" data-x0="${
    n1(ml)
  }" data-x1="${n1(W - mr)}" transform="translate(${n1(xm)},0)"${marker ? "" : ' style="display:none"'}>`;
  s += `<line class="mk-line" x1="0" x2="0" y1="${mt - 10}" y2="${n1(gridBottom)}">${
    marker
      ? titleTag(mLabel, fmt(marker.value, o.unit))
      : "<title>Your price, typed in the box at the top</title>"
  }</line>`;
  const off = marker ? (marker.value > dmax ? 1 : marker.value < dmin ? -1 : 0) : 0;
  s += `<text class="tx-ink halo" data-dd="marker-text" x="0" y="${mt - 14}" text-anchor="${
    off > 0 ? "end" : off < 0 ? "start" : "middle"
  }">${esc(off > 0 ? `${mLabel} →` : off < 0 ? `← ${mLabel}` : mLabel)}</text></g>`;
  return s + labels + "</svg>";
}

// ---------------------------------------------------------------- meter

/** Scorecard row: name, a thin track filled to value/max, the value, and a note line. */
export function meter(
  o: { label: string; value: number | null; max: number; tone?: Tone; note?: string },
): string {
  const max = isNum(o.max) && o.max > 0 ? o.max : 10;
  const has = isNum(o.value);
  const v = has ? Math.max(0, Math.min(max, o.value as number)) : 0;
  const vt = has ? fmt(o.value, "plain", { digits: 1 }) : "n/a";
  const aria = has ? `${o.label}: ${vt} of ${fmt(max, "plain")}` : `${o.label}: ${NOT_DISCLOSED}`;
  const fill = has && v > 0
    ? `<rect class="${fillCls(o.tone)}" width="${((v / max) * 100).toFixed(1)}%" height="8" rx="4"/>`
    : "";
  const note = o.note ?? (has ? "" : NOT_DISCLOSED);
  return `<div class="mtr"><span class="mtr-n">${esc(o.label)}</span>` +
    `<svg class="mtr-t" xmlns="http://www.w3.org/2000/svg" width="100%" height="8" role="img" aria-label="${
      esc(aria)
    }"><title>${esc(aria)}</title><rect class="trk" width="100%" height="8" rx="4"/>${fill}</svg>` +
    `<span class="mtr-v${has ? "" : " na"}">${esc(vt)}</span>` +
    (note ? `<span class="mtr-r">${esc(note)}</span>` : "") + `</div>`;
}

// ---------------------------------------------------------------- heat grid

function median(xs: number[]): number {
  const a = [...xs].sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * Sensitivity grid. Cells above `mid` shade blue, below shade clay, in 4 steps each (classes hm-p1..4, hm-n1..4).
 * With no mid the median cell value is the centre. Each cell group carries data-v for the client.
 */
export function heat(o: {
  title: string;
  rowLabel: string;
  colLabel: string;
  rows: string[];
  cols: string[];
  values: Array<Array<number | null>>;
  unit: Unit;
  mid?: number;
  width?: number;
}): string {
  const W = o.width ?? 360;
  const nr = o.rows.length;
  const nc = o.cols.length;
  const cell = (r: number, c: number) => {
    const v = o.values[r]?.[c];
    return isNum(v) ? v : null;
  };
  const flat: number[] = [];
  for (let r = 0; r < nr; r++) {
    for (let c = 0; c < nc; c++) if (cell(r, c) !== null) flat.push(cell(r, c) as number);
  }
  if (!nr || !nc || !flat.length) return NODATA;
  const mid = isNum(o.mid) ? o.mid : median(flat);
  const spread = Math.max(...flat.map((v) => Math.abs(v - mid))) || 1;
  const digits = labelDigits(o.unit, flat);
  const denom = isNum(o.mid) && o.mid !== 0 ? Math.abs(o.mid) * 0.5 : spread;
  const rotW = 16;
  const headW = Math.max(...o.rows.map((r) => textW(r, FONT_TICK))) + 10;
  const gx = rotW + headW;
  const gapC = 2;
  const cellW = (W - gx - (nc - 1) * gapC) / nc;
  const cellH = 30;
  const gy = 36;
  const gridH = nr * (cellH + gapC) - gapC;
  const H = gy + gridH + 2;
  let s = svgOpen(W, H, o.title);
  const cellsW = W - gx;
  const colLabel = ellipsize(o.colLabel, cellsW, FONT_TICK);
  s += `<text class="tx" x="${n1(gx + cellsW / 2)}" y="11" text-anchor="middle">${esc(colLabel)}</text>`;
  const rowLabel = ellipsize(o.rowLabel, gridH, FONT_TICK);
  s += `<text class="tx" transform="translate(10,${n1(gy + gridH / 2)}) rotate(-90)" text-anchor="middle">${
    esc(rowLabel)
  }</text>`;
  o.cols.forEach((c, j) => {
    const cx = gx + j * (cellW + gapC) + cellW / 2;
    s += `<text class="tx" x="${n1(cx)}" y="28" text-anchor="middle">${
      esc(ellipsize(c, cellW - 2, FONT_TICK))
    }</text>`;
  });
  o.rows.forEach((rl, i) => {
    const top = gy + i * (cellH + gapC);
    s += `<text class="tx" x="${n1(gx - 6)}" y="${n1(top + cellH / 2 + 3.5)}" text-anchor="end">${
      esc(rl)
    }</text>`;
    o.cols.forEach((cl, j) => {
      const v = cell(i, j);
      const x = gx + j * (cellW + gapC);
      const cx = x + cellW / 2;
      const ty = top + cellH / 2 + 4;
      const label = `${o.rowLabel} ${rl}, ${o.colLabel} ${cl}`;
      if (v === null) {
        s += `<g>${titleTag(label, NOT_DISCLOSED)}<rect class="trk" x="${n1(x)}" y="${n1(top)}" width="${
          n1(cellW)
        }" height="${cellH}" rx="4"/><text class="tx" x="${n1(cx)}" y="${
          n1(ty)
        }" text-anchor="middle">n/a</text></g>`;
        return;
      }
      const d = Math.max(-1, Math.min(1, (v - mid) / denom));
      const b = Math.min(4, Math.round(Math.abs(d) * 4));
      const cls = b === 0 ? "hm-0" : d > 0 ? `hm-p${b}` : `hm-n${b}`;
      let vt = fmt(v, o.unit, { digits });
      if (textW(vt, FONT_LABEL, 600) > cellW - 4) vt = fmt(v, o.unit, { digits: 0 });
      vt = ellipsize(vt, cellW - 4, FONT_LABEL, 600);
      s += `<g data-v="${v}">${titleTag(label, fmt(v, o.unit))}<rect class="${cls}" x="${n1(x)}" y="${
        n1(top)
      }" width="${n1(cellW)}" height="${cellH}" rx="4"/><text class="${b >= 3 ? "tx-on" : "tx-heat"}" x="${
        n1(cx)
      }" y="${n1(ty)}" text-anchor="middle">${esc(vt)}</text></g>`;
    });
  });
  return s + "</svg>";
}
