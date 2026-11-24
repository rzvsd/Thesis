import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import {
  CHART_CSS,
  columns,
  hbars,
  lines,
  niceTicks,
  NODATA,
  type Series,
  table,
  textW,
  wide,
  xLabelPlan,
} from "./charts.ts";
import { donut, heat, meter, range, waterfall } from "./charts_more.ts";
import { MINUS } from "./format.ts";

const B = 1e9;
const FY = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => `FY${y}`);
const EVIL = `<script>alert("x")</script>'"&`;

/** Tags balance, no raw "<" in text, no script or event handlers. */
function assertWellFormed(html: string): void {
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/g;
  let m: RegExpExecArray | null;
  let last = 0;
  let text = "";
  while ((m = re.exec(html))) {
    text += html.slice(last, m.index);
    last = re.lastIndex;
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) {
      assertEquals(stack.pop(), name, `unbalanced </${name}>`);
    } else {
      stack.push(name);
    }
  }
  text += html.slice(last);
  assertEquals(stack, [], "unclosed tags");
  assert(!text.includes("<") && !text.includes(">"), `raw angle bracket in text: ${text.slice(0, 120)}`);
  assert(!/<script/i.test(html), "script tag");
  assert(!/\son\w+=/i.test(html), "inline event handler");
  assert(!/javascript:/i.test(html), "javascript: url");
}

interface TextBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  t: string;
  cls: string;
}

const unesc = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(
    /&amp;/g,
    "&",
  );

/** Text boxes of plain (untransformed) <text> elements, estimated the same way the kit does. */
function textBoxes(svg: string): TextBox[] {
  const out: TextBox[] = [];
  const re =
    /<text class="([^"]*)"( data-dd="[^"]*")? x="([-\d.]+)" y="([-\d.]+)"(?: text-anchor="(\w+)")?>(.*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const [, cls, , xs, ys, anchor, body] = m;
    const t = unesc(body.replace(/<[^>]+>/g, ""));
    const size = cls.includes("tx-ink") || cls.includes("tx-lab") ? 11 : 10.5;
    const w = textW(t, size, cls.includes("tx-ink") ? 600 : 400);
    const x = Number(xs);
    const y = Number(ys);
    const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    out.push({ x0, x1: x0 + w, y0: y - size * 0.75, y1: y + size * 0.2, t, cls });
  }
  return out;
}

function assertNoOverlap(svg: string): void {
  const b = textBoxes(svg);
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const p = b[i];
      const q = b[j];
      const over = p.x0 < q.x1 - 0.5 && q.x0 < p.x1 - 0.5 && p.y0 < q.y1 - 0.5 && q.y0 < p.y1 - 0.5;
      assert(!over, `labels overlap: "${p.t}" and "${q.t}"`);
    }
  }
}

/** Numbers in a path's d attribute as [x, y] pairs (absolute M/L/Q/H/V commands only). */
function pathYs(d: string): number[] {
  const ys: number[] = [];
  const re = /([MLQHVZ])([^MLQHVZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[2].split(/[ ,]+/).filter(Boolean).map(Number);
    if (m[1] === "V") ys.push(...nums);
    else if (m[1] !== "H" && m[1] !== "Z") { for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]); }
  }
  return ys;
}

const twoSeries: Series[] = [
  {
    name: "Sales",
    values: [233.7, 215.6, 229.2, 265.6, 260.2, 274.5, 365.8, 394.3, 383.3, 391, 416.2].map((v) => v * B),
    tone: "s1",
  },
  {
    name: "Net profit",
    values: [53.4, 45.7, 48.4, 59.5, 55.3, 57.4, 94.7, 99.8, 97, 93.7, 112].map((v) => v * B),
    tone: "s4",
  },
];

Deno.test("niceTicks: 1-2-5 steps, zero kept, degenerate ranges", () => {
  assertEquals(niceTicks(0, 416, 4), [0, 100, 200, 300, 400, 500]);
  assertEquals(niceTicks(-3.4, 5.2, 4), [-4, -2, 0, 2, 4, 6]);
  assertEquals(niceTicks(5, 5), [0, 1, 2, 3, 4, 5]);
  assertEquals(niceTicks(0, 0), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assertEquals(niceTicks(NaN, 1), [0, 1]);
  assert(niceTicks(0.0001, 0.0009).length >= 2);
});

Deno.test("textW uses 0.56em for digits", () => {
  assertEquals(Math.round(textW("0000", 10) * 100) / 100, 22.4);
});

Deno.test("columns: structure, legend, titles on every mark", () => {
  const s = columns({
    title: "Sales and net profit",
    labels: FY,
    series: twoSeries,
    unit: "usd",
    labelLast: true,
  });
  assertWellFormed(s);
  assertStringIncludes(s, 'class="ch"');
  assertStringIncludes(s, 'viewBox="0 0 360 220"');
  assertStringIncludes(s, 'role="img"');
  assertStringIncludes(s, 'aria-label="Sales and net profit"');
  assertStringIncludes(s, '<div class="lg">');
  assertEquals((s.match(/<path class="f-/g) ?? []).length, 22);
  assert(!/<path class="f-[^"]*" d="[^"]*"\/>/.test(s), "a bar without a title");
  assertStringIncludes(s, "<title>Sales, FY2025: $416B</title>");
  assertStringIncludes(s, ">$416B</text>");
  assertStringIncludes(s, ">$112B</text>");
  assertNoOverlap(s);
});

Deno.test("columns: grouped labels with close values never overlap", () => {
  const s = columns({
    title: "Cash and debt",
    labels: FY.slice(-5),
    series: [
      { name: "Cash", values: [190, 169, 162, 156, 99.4].map((v) => v * B), tone: "s6" },
      { name: "Debt", values: [124, 120, 111, 106, 98.7].map((v) => v * B), tone: "s5" },
      { name: "Other", values: [10, 20, 30, 40, 99].map((v) => v * B), tone: "s2" },
    ],
    unit: "usd",
    labelLast: true,
  });
  assertWellFormed(s);
  assertNoOverlap(s);
  // the labels fit inside the viewBox
  for (const b of textBoxes(s)) assert(b.x0 >= -0.5 && b.x1 <= 360.5, `label outside: ${b.t}`);
});

Deno.test("columns: negative values sit below the zero line, rounded at the bottom", () => {
  const s = columns({
    title: "Net income",
    labels: ["FY2023", "FY2024", "FY2025"],
    series: [{ name: "Net income", values: [-5 * B, null, 5 * B], tone: "s4" }],
    unit: "usd",
    labelLast: true,
  });
  assertWellFormed(s);
  const zero = Number(/<line class="axis" x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)"/.exec(s)![1]);
  const ds = [...s.matchAll(/<path class="f-s4" d="([^"]+)"/g)].map((m) => m[1]);
  assertEquals(ds.length, 2, "null is a gap, not a bar");
  const neg = pathYs(ds[0]);
  const pos = pathYs(ds[1]);
  assert(Math.min(...neg) >= zero - 0.1 && Math.max(...neg) > zero + 10, "negative bar below zero");
  assert(Math.max(...pos) <= zero + 0.1 && Math.min(...pos) < zero - 10, "positive bar above zero");
  assertStringIncludes(s, `<title>Net income, FY2023: ${MINUS}$5.0B</title>`);
});

Deno.test("columns: stacked totals, highlightLast dims earlier bars", () => {
  const s = columns({
    title: "Returns",
    labels: FY.slice(-3),
    series: [
      { name: "Buybacks", values: [80 * B, 90 * B, 91 * B], tone: "s1" },
      { name: "Dividends", values: [15 * B, 15 * B, 15.4 * B], tone: "s2" },
    ],
    unit: "usd",
    stacked: true,
    labelLast: true,
    highlightLast: true,
  });
  assertWellFormed(s);
  assertStringIncludes(s, ">$106B</text>");
  assertEquals((s.match(/ dim"/g) ?? []).length, 4);
});

Deno.test("x labels thin from the last label backwards", () => {
  const plan = xLabelPlan(FY, 20);
  assert(plan.every > 1);
  assertEquals(plan.labels[10], "FY25", "crowded FY labels shorten");
  const s = columns({ title: "t", labels: FY, series: twoSeries, unit: "usd" });
  const shown = [...s.matchAll(/<text class="tx" x="[\d.]+" y="213" text-anchor="middle">([^<]+)<\/text>/g)]
    .map((m) => m[1]);
  assert(shown.length >= 3 && shown.length < 11, `shown ${shown.length}`);
  assert(shown[shown.length - 1].endsWith("25"), "last year always shown");
  assertNoOverlap(s);
  const wideSvg = columns({ title: "t", labels: FY, series: twoSeries, unit: "usd", width: 900 });
  const all = [...wideSvg.matchAll(/text-anchor="middle">FY20\d\d<\/text>/g)].length;
  assertEquals(all, 11);
});

Deno.test("lines: null gaps break the path; end labels do not collide", () => {
  const s = lines({
    title: "Margins",
    labels: FY.slice(-5),
    series: [
      { name: "Operating", values: [30, null, 31, 31.5, 32.0], tone: "s4" },
      { name: "Net", values: [25, 26, 27, 31.4, 31.8], tone: "s2" },
      { name: "Lonely", values: [null, 12, null, null, null], tone: "s3" },
    ],
    unit: "pct",
    labelLast: true,
  });
  assertWellFormed(s);
  const d = /<path class="ln st-s4" d="([^"]+)"/.exec(s)![1];
  assertEquals((d.match(/M/g) ?? []).length, 2);
  assertStringIncludes(s, '<circle class="f-s3" cx="'); // an isolated point still shows
  assertStringIncludes(s, "<title>Net, FY2025: 31.8%</title>");
  assertStringIncludes(s, '<div class="lg">');
  assertNoOverlap(s);
});

Deno.test("all-null data renders the empty state", () => {
  const nul = [{ name: "x", values: [null, null], tone: "s1" as const }];
  assertEquals(columns({ title: "t", labels: ["a", "b"], series: nul, unit: "usd" }), NODATA);
  assertEquals(lines({ title: "t", labels: ["a", "b"], series: nul, unit: "usd" }), NODATA);
  assertEquals(hbars({ title: "t", rows: [{ label: "a", value: null }], unit: "usd" }), NODATA);
  assertEquals(donut({ title: "t", parts: [{ label: "a", value: 0, tone: "s1" }] }), NODATA);
  assertEquals(
    heat({
      title: "t",
      rowLabel: "r",
      colLabel: "c",
      rows: ["1"],
      cols: ["1"],
      values: [[null]],
      unit: "usd",
    }),
    NODATA,
  );
  assertEquals(range({ title: "t", rows: [], unit: "usd_ps" }), NODATA);
  assertEquals(
    waterfall({
      title: "t",
      start: { label: "a", value: NaN },
      steps: [],
      end: { label: "b", value: 1 },
      unit: "usd_ps",
    }),
    NODATA,
  );
  assertStringIncludes(NODATA, 'class="nodata"');
  assertStringIncludes(NODATA, "Not disclosed");
});

Deno.test("hostile labels are escaped everywhere", () => {
  const ser: Series[] = [{ name: EVIL, values: [1, 2], tone: "s1" }, {
    name: "b",
    values: [2, 1],
    tone: "s2",
  }];
  const outs = [
    columns({ title: EVIL, labels: [EVIL, "b"], series: ser, unit: "usd", labelLast: true }),
    columns({ title: EVIL, labels: [EVIL, "b"], series: ser, unit: "usd", stacked: true, labelLast: true }),
    lines({ title: EVIL, labels: [EVIL, "b"], series: ser, unit: "pct", labelLast: true }),
    hbars({
      title: EVIL,
      rows: [{ label: EVIL, value: 3, note: EVIL }, { label: "b", value: null }],
      unit: "usd",
    }),
    donut({
      title: EVIL,
      parts: [{ label: EVIL, value: 2, tone: "s1" }],
      center: { value: EVIL, label: EVIL },
    }),
    waterfall({
      title: EVIL,
      start: { label: EVIL, value: 1 },
      steps: [{ label: EVIL, value: 0.5 }],
      end: { label: EVIL, value: 1.5 },
      unit: "usd_ps",
    }),
    range({
      title: EVIL,
      rows: [{ label: EVIL, low: 1, high: 2 }],
      marker: { value: 1.5, label: EVIL },
      unit: "usd_ps",
    }),
    meter({ label: EVIL, value: 5, max: 10, note: EVIL }),
    heat({
      title: EVIL,
      rowLabel: EVIL,
      colLabel: EVIL,
      rows: [EVIL],
      cols: [EVIL],
      values: [[1]],
      unit: "usd_ps",
    }),
    table({ caption: EVIL, head: [EVIL, EVIL], rows: [[EVIL, EVIL]] }),
  ];
  for (const s of outs) {
    assertWellFormed(s);
    assert(!s.includes("<script"), s.slice(0, 200));
    assert(s.includes("&lt;script&gt;") || s.includes("&lt;scri"), "escaped text present");
    assert(!s.includes(`"x")`), "raw quote leaked");
  }
});

Deno.test("hbars: ranked rows, n/a for null, note text", () => {
  const s = hbars({
    title: "Regions",
    rows: [
      { label: "Americas", value: 178.4 * B, note: "+3.9% a year" },
      { label: "Greater China", value: 64.4 * B, tone: "s5" },
      { label: "Nowhere", value: null },
    ],
    unit: "usd",
  });
  assertWellFormed(s);
  assertStringIncludes(s, ">$178B</text>");
  assertStringIncludes(s, ">n/a</text>");
  assertStringIncludes(s, "<title>Nowhere: Not disclosed</title>");
  assertStringIncludes(s, 'class="f-s5"');
  assertNoOverlap(s);
});

Deno.test("range: marker carries data attributes the client maps prices with", () => {
  const s = range({
    title: "Value",
    rows: [
      { label: "Model", low: 172, high: 236, mid: 204, tone: "s1" },
      { label: "P/E history", low: 164, high: 261, tone: "s5", faded: true },
    ],
    marker: { value: 191, label: "Price $191" },
    unit: "usd_ps",
  });
  assertWellFormed(s);
  const m =
    /<g data-dd="marker" data-dd-when="price" data-min="([-\d.]+)" data-max="([-\d.]+)" data-x0="([\d.]+)" data-x1="([\d.]+)" transform="translate\(([\d.]+),0\)">/
      .exec(s);
  assert(m, "marker group");
  const [min, max, x0, x1, tx] = m!.slice(1).map(Number);
  assert(min <= 164 && max >= 261);
  assert(Math.abs(tx - (x0 + ((191 - min) / (max - min)) * (x1 - x0))) < 0.2, "marker x maps the price");
  assertStringIncludes(s, 'data-dd="marker-text"');
  assertStringIncludes(s, "faded");
  assertStringIncludes(s, ">$172 to $236</text>");
  const hidden = range({
    title: "Value",
    rows: [{ label: "Model", low: 1, high: 2 }],
    marker: null,
    unit: "usd_ps",
  });
  assertStringIncludes(hidden, 'data-dd="marker"');
  assertStringIncludes(hidden, 'style="display:none"');
  const wideSvg = range({
    title: "Value",
    rows: [{ label: "Model", low: 172, high: 236 }],
    marker: { value: 191, label: "Price $191" },
    unit: "usd_ps",
    width: 720,
  });
  assertWellFormed(wideSvg);
  assertNoOverlap(wideSvg);
});

Deno.test("waterfall: every step labelled with its sign", () => {
  const s = waterfall({
    title: "EPS bridge",
    start: { label: "FY2024", value: 1.1 },
    steps: [{ label: "Lower sales", value: -0.9 }, { label: "Tax", value: 0.15 }],
    end: { label: "FY2025", value: 0.35 },
    unit: "usd_ps",
  });
  assertWellFormed(s);
  assertStringIncludes(s, `>${MINUS}$0.90</text>`);
  assertStringIncludes(s, ">+$0.15</text>");
  assertStringIncludes(s, ">$1.10</text>");
  assertEquals((s.match(/class="conn"/g) ?? []).length, 3);
  assertStringIncludes(s, 'class="f-s5"');
  assertNoOverlap(s);
});

Deno.test("donut: legend shares, single part ring", () => {
  const s = donut({
    title: "Sales by product",
    parts: [{ label: "iPhone", value: 209.6, tone: "s1" }, { label: "Services", value: 109.2, tone: "s2" }],
    center: { value: "$416B", label: "fiscal 2025" },
  });
  assertWellFormed(s);
  assertStringIncludes(s, "<b>66%</b>");
  assertStringIncludes(s, "<b>34%</b>");
  assertStringIncludes(s, 'class="sw bg-s2"');
  const one = donut({ title: "One", parts: [{ label: "All", value: 1, tone: "s1" }] });
  assertStringIncludes(one, 'fill-rule="evenodd"');
});

Deno.test("meter: clamps, and shows n/a for missing", () => {
  const full = meter({ label: "Growth", value: 15, max: 10 });
  assertWellFormed(full);
  assertStringIncludes(full, 'width="100.0%"');
  const na = meter({ label: "Returns", value: null, max: 10 });
  assertStringIncludes(na, ">n/a</span>");
  assertStringIncludes(na, "Not disclosed");
});

Deno.test("heat: diverging classes around mid, data-v on cells", () => {
  const s = heat({
    title: "Sensitivity",
    rowLabel: "Discount rate",
    colLabel: "Terminal growth",
    rows: ["8.5%", "9.5%", "10.5%"],
    cols: ["2.0%", "3.0%"],
    values: [[300, 320], [200, 210], [100, null]],
    unit: "usd_ps",
    mid: 200,
  });
  assertWellFormed(s);
  assert(/class="hm-p\d"/.test(s));
  assert(/class="hm-n\d"/.test(s));
  assertStringIncludes(s, 'class="hm-0"');
  assertStringIncludes(s, 'data-v="320"');
  assertStringIncludes(s, ">$320</text>");
  assertStringIncludes(s, ">n/a</text>");
});

Deno.test("table and wide wrappers", () => {
  const t = table({ caption: "Sales", head: ["Year", "Sales"], rows: [["FY2025", "$416B"], ["FY2024", ""]] });
  assertWellFormed(t);
  assert(t.startsWith('<details class="tbl"><summary>Show table</summary><table>'));
  assertStringIncludes(t, '<td data-l="Sales">n/a</td>');
  assertEquals(
    wide("<b>n</b>", "<b>w</b>"),
    '<div class="w-n"><b>n</b></div><div class="w-w"><b>w</b></div>',
  );
});

Deno.test("CHART_CSS defines the tone classes and the wide switch", () => {
  for (const t of ["s1", "s6", "pos", "neg", "deemph"]) {
    assertStringIncludes(CHART_CSS, `.f-${t}{`);
    assertStringIncludes(CHART_CSS, `.st-${t}{`);
  }
  assertStringIncludes(CHART_CSS, "@media (min-width:760px){.w-n{display:none}.w-w{display:block}}");
  assert(!CHART_CSS.includes("url("), "no external requests");
});
