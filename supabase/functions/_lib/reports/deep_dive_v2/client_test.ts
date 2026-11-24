import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import {
  CLIENT_CORE_JS,
  CLIENT_JS,
  CLIENT_JS_SHA256,
  type ClientData,
  NA_TEXT,
  NO_PRICE_TEXT,
  priceTexts,
  SHARE_PAGE_CSP,
} from "./client.ts";
import { type DcfInputs, impliedGrowth, valuePerShare } from "./dcf.ts";

// ---------------------------------------------------------------- helpers

interface Core {
  vps(i: DcfInputs, g: number): number;
  ig(i: DcfInputs, p: number): number | null;
  texts(
    d: unknown,
    p: number | null,
  ): { pe: string; gap: string; cls: string; implied: string; price: string };
}

// The page script runs in these tests as a module loaded from a data: URL (no Function constructor, which the
// SAST baseline forbids). Modules are strict, so this also checks the script is strict-safe.
function dataUrl(src: string): string {
  const bytes = new TextEncoder().encode(src);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:text/javascript;base64,${btoa(bin)}`;
}

const CORE = (await import(dataUrl(`${CLIENT_CORE_JS}\nexport default {vps:vps,ig:ig,texts:texts};`)))
  .default as Core;
const runClient = (await import(dataUrl(`export default function (document, window) {\n${CLIENT_JS}\n}`)))
  .default as (document: unknown, window: unknown) => void;

function loadCore(): Core {
  return CORE;
}

const INPUTS: DcfInputs = {
  baseFcf: 100e9,
  shares: 15e9,
  netCash: 30e9,
  wacc: 9.5,
  terminal: 2.5,
  years: 10,
  fade: 5,
};

const DATA: ClientData = {
  price: 191,
  eps: 7.47,
  scenarios: { bear: 120, base: 204.4, bull: 270 },
  dcf: INPUTS,
  currency: "USD",
};

// A tiny fake DOM: just enough for the client script, selectors matched by exact string.
class FakeEl {
  attrs = new Map<string, string>();
  kids: FakeEl[] = [];
  own = "";
  classes = new Set<string>();
  listeners = new Map<string, Array<() => void>>();
  parentNode: FakeEl | null = null;
  value = "";
  scrollLeft = 0;
  scrollWidth = 0;
  clientWidth = 0;
  scrolledTo: number | null = null;
  rect = { left: 0, width: 0 };
  id = "";
  classList = {
    toggle: (c: string, force?: boolean) => {
      const on = force === undefined ? !this.classes.has(c) : force;
      if (on) this.classes.add(c);
      else this.classes.delete(c);
      return on;
    },
    contains: (c: string) => this.classes.has(c),
  };
  get textContent(): string {
    return this.own + this.kids.map((k) => k.textContent).join("");
  }
  set textContent(v: string) {
    this.own = v;
    this.kids = [];
  }
  set className(v: string) {
    this.classes = new Set(v.split(" ").filter(Boolean));
  }
  appendChild(k: FakeEl) {
    this.kids.push(k);
    k.parentNode = this;
    return k;
  }
  getAttribute(n: string): string | null {
    return this.attrs.has(n) ? this.attrs.get(n)! : null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, String(v));
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
  addEventListener(t: string, f: () => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]);
  }
  fire(t: string) {
    for (const f of this.listeners.get(t) ?? []) f();
  }
  getBoundingClientRect() {
    return this.rect;
  }
  /** Only the `[data-dd="..."]` form, searched depth first. */
  querySelector(sel: string): FakeEl | null {
    const m = /^\[data-dd="([^"]+)"\]$/.exec(sel);
    if (!m) return null;
    for (const k of this.kids) {
      if (k.getAttribute("data-dd") === m[1]) return k;
      const hit = k.querySelector(sel);
      if (hit) return hit;
    }
    return null;
  }
  scrollTo(o: { left: number }) {
    this.scrolledTo = o.left;
  }
}

function el(attrs: Record<string, string> = {}): FakeEl {
  const e = new FakeEl();
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function makePage(
  data: unknown,
  opts: {
    inputValue?: string;
    storage?: Record<string, string>;
    raw?: string;
    /** The in-app embed has no theme button. */
    noThemeButton?: boolean;
    /** html[data-theme] as the server sent it. */
    serverTheme?: string;
  } = {},
) {
  const reg = new Map<string, FakeEl[]>();
  const add = (sel: string, e: FakeEl) => {
    reg.set(sel, [...(reg.get(sel) ?? []), e]);
    return e;
  };
  const html = el(opts.serverTheme ? { "data-theme": opts.serverTheme } : {});
  const body = el();
  const themeBtn = el({ "data-dd-theme": "" });
  if (!opts.noThemeButton) add("button[data-dd-theme]", themeBtn);
  const story = add("button[data-dd-mode]", el({ "data-dd-mode": "story", "aria-pressed": "true" }));
  const charts = add("button[data-dd-mode]", el({ "data-dd-mode": "charts", "aria-pressed": "false" }));
  const navWrap = el();
  navWrap.scrollWidth = 1200;
  navWrap.clientWidth = 360;
  navWrap.rect = { left: 0, width: 360 };
  const chips = ["summary", "business", "value"].map((id, i) => {
    const a = navWrap.appendChild(add('nav.chipnav a[href^="#"]', el({ href: "#" + id })));
    a.rect = { left: 400 + i * 100, width: 80 };
    return a;
  });
  const sections = new Map(["summary", "business", "value"].map((id) => {
    const s = el();
    s.id = id;
    return [id, s];
  }));
  const script = add("script#dd-data", el());
  script.textContent = opts.raw ?? JSON.stringify(data);
  const input = add('input[data-dd="price"]', el());
  input.value = opts.inputValue ?? "";
  const pe = add('[data-dd="pe"]', el());
  const pe2 = add('[data-dd="pe"]', el());
  const gap = add('[data-dd="gap"]', el());
  const implied = add('[data-dd="implied"]', el());
  const priceText = add('[data-dd="price-text"]', el());
  const marker = add(
    '[data-dd="marker"]',
    el({ "data-dd": "marker", "data-min": "100", "data-max": "300", "data-x0": "20", "data-x1": "340" }),
  );
  const markerText = marker.appendChild(el({ "data-dd": "marker-text", "text-anchor": "middle" }));
  markerText.own = "Your price";
  const marker2 = add(
    '[data-dd="marker"]',
    el({ "data-min": "100", "data-max": "300", "data-x0": "20", "data-x1": "340", "data-x": "50" }),
  );
  const whenPrice = add("[data-dd-when]", el({ "data-dd-when": "price" }));
  const whenNo = add("[data-dd-when]", el({ "data-dd-when": "noprice" }));

  const store = new Map(Object.entries(opts.storage ?? {}));
  let ioCb: ((es: Array<{ isIntersecting: boolean; target: FakeEl }>) => void) | null = null;
  const observed: FakeEl[] = [];
  const doc = {
    documentElement: html,
    body,
    querySelectorAll: (s: string) => reg.get(s) ?? [],
    querySelector: (s: string) => (reg.get(s) ?? [])[0] ?? null,
    getElementById: (id: string) => sections.get(id) ?? null,
    createElement: () => el(),
    createTextNode: (t: string) => {
      const e = el();
      e.own = t;
      return e;
    },
  };
  const win = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    matchMedia: () => ({ matches: false }),
    IntersectionObserver: class {
      constructor(cb: typeof ioCb) {
        ioCb = cb;
      }
      observe(t: FakeEl) {
        observed.push(t);
      }
    },
  };
  runClient(doc, win);
  return {
    html,
    body,
    themeBtn,
    story,
    charts,
    markerText,
    navWrap,
    chips,
    sections,
    input,
    pe,
    pe2,
    gap,
    implied,
    priceText,
    marker,
    marker2,
    whenPrice,
    whenNo,
    store,
    observed,
    intersect: (id: string) => ioCb!([{ isIntersecting: true, target: sections.get(id)! }]),
  };
}

// ---------------------------------------------------------------- tests

Deno.test("CLIENT_JS_SHA256 matches the script", async () => {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(CLIENT_JS)));
  assertEquals(btoa(String.fromCharCode(...h)), CLIENT_JS_SHA256);
  assertStringIncludes(SHARE_PAGE_CSP, `script-src 'sha256-${CLIENT_JS_SHA256}'`);
  assertStringIncludes(SHARE_PAGE_CSP, "default-src 'none'");
});

Deno.test("CLIENT_JS is safe to inline and self-contained", () => {
  assert([...CLIENT_JS].every((c) => c.charCodeAt(0) < 128), "ASCII only");
  assert(!CLIENT_JS.includes("</"), "no </ inside <script>");
  assert(
    !/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|https?:|import\(|fetch\(/.test(CLIENT_JS),
  );
  assert(!/=>|`|\?\?|\?\.|\blet\b|\bconst\b|\bclass\b/.test(CLIENT_JS), "plain ES5-style syntax");
  assert(CLIENT_JS.split("\n").length < 140);
  // parses (compiled once above)
  assertEquals(typeof runClient, "function");
});

Deno.test("client math is identical to dcf.ts", () => {
  const core = loadCore();
  const cases: DcfInputs[] = [
    INPUTS,
    { ...INPUTS, netCash: -50e9 },
    { ...INPUTS, wacc: 8.5, terminal: 3.5 },
    { ...INPUTS, baseFcf: 2.5e6, shares: 1.2e6, netCash: 0 },
    { ...INPUTS, fade: 10 },
    { ...INPUTS, fade: 0 },
    { ...INPUTS, baseFcf: -5e9 },
    { ...INPUTS, wacc: 2, terminal: 2.5 }, // invalid
    { ...INPUTS, shares: 0 }, // invalid
    { ...INPUTS, years: 7.5 }, // invalid
  ];
  for (const i of cases) {
    for (const g of [-20, -7.3, -1, 0, 2.5, 6.1, 15, 40]) {
      const a = core.vps(i, g);
      const b = valuePerShare(i, g);
      assert(Object.is(a, b), `vps ${JSON.stringify(i)} g=${g}: ${a} vs ${b}`);
    }
    for (const p of [-1, 0, 1, 50, 120.5, 191, 204, 260, 1000, 1e6]) {
      assertEquals(core.ig(i, p), impliedGrowth(i, p), `ig ${JSON.stringify(i)} p=${p}`);
    }
  }
  assertEquals(core.vps(null as unknown as DcfInputs, 5), NaN);
  assertEquals(core.ig(null as unknown as DcfInputs, 100), null);
});

Deno.test("client texts equal priceTexts()", () => {
  const core = loadCore();
  const datas: Array<ClientData | null> = [
    DATA,
    { ...DATA, eps: null },
    { ...DATA, eps: -1.2 },
    { ...DATA, scenarios: null, dcf: null },
    { ...DATA, scenarios: { bear: null, base: -3.4, bull: null } },
    { ...DATA, scenarios: { bear: 1000, base: 12345.6, bull: 20000 } },
    null,
  ];
  for (const d of datas) {
    for (const p of [null, -5, 0, 0.5, 100, 191, 204.4, 205, 2500.25, 123456]) {
      const js = core.texts(d, p);
      const ts = priceTexts(d, p);
      assertEquals(
        { pe: js.pe, gap: js.gap, cls: js.cls, implied: js.implied, price: js.price },
        { pe: ts.pe, gap: ts.gap, cls: ts.gapClass, implied: ts.implied, price: ts.price },
        `data=${JSON.stringify(d)} price=${p}`,
      );
    }
  }
});

Deno.test("priceTexts: wording", () => {
  const t = priceTexts(DATA, 191);
  assertEquals(t.pe, "25.6x");
  assertEquals(t.gap, "+7% to the base value ($204)");
  assertEquals(t.gapClass, "up");
  assertEquals(t.price, "$191.00");
  const g = impliedGrowth(INPUTS, 191)!;
  assertEquals(t.implied, `${g < 0 ? "−" : ""}${Math.abs(g).toFixed(1)}% a year`);
  const dn = priceTexts(DATA, 213);
  assertEquals(dn.gap, "−4% to the base value ($204)");
  assertEquals(dn.gapClass, "dn");
  assertEquals(priceTexts(DATA, 204.4).gapClass, "");
  assertEquals(priceTexts(DATA, 2500).pe, "334.7x");
  assertEquals(priceTexts({ ...DATA, eps: 0.01 }, 2500).pe, "250,000.0x");
  assertEquals(priceTexts(DATA, 1e9).implied, NA_TEXT); // outside the -20..40 bisection range
  assertEquals(priceTexts(DATA, null), {
    pe: NO_PRICE_TEXT,
    gap: NO_PRICE_TEXT,
    gapClass: "",
    implied: NO_PRICE_TEXT,
    price: "",
  });
  assertEquals(priceTexts({ ...DATA, scenarios: null, dcf: null, eps: null }, 100).gap, NA_TEXT);
});

Deno.test("fake DOM: price box on load and on input", () => {
  const pg = makePage(DATA, { inputValue: "191" });
  const want = priceTexts(DATA, 191);
  assertEquals(pg.pe.textContent, want.pe);
  assertEquals(pg.pe2.textContent, want.pe);
  assertEquals(pg.gap.textContent, want.gap);
  assert(pg.gap.classes.has("up") && !pg.gap.classes.has("dn"));
  assertEquals(pg.implied.textContent, want.implied);
  assertEquals(pg.priceText.textContent, "$191.00");
  // 191 in [100, 300] mapped to [20, 340]: 20 + 91/200*320 = 165.6
  assertEquals(pg.marker.getAttribute("transform"), "translate(165.6,0)");
  assertEquals(pg.marker2.getAttribute("transform"), "translate(115.6,0)");
  assertEquals(pg.marker.getAttribute("display"), null);
  assertEquals(pg.whenPrice.getAttribute("hidden"), null);
  assertEquals(pg.whenNo.getAttribute("hidden"), "");

  pg.input.value = "$1,000";
  pg.input.fire("input");
  assertEquals(pg.pe.textContent, priceTexts(DATA, 1000).pe);
  assertEquals(pg.marker.getAttribute("transform"), "translate(340,0)"); // clamped to the axis end
  assert(pg.gap.classes.has("dn") && !pg.gap.classes.has("up"));
  // A price off the axis says so on the marker label.
  assertEquals(pg.markerText.textContent, "Your price \u2192");
  assertEquals(pg.markerText.getAttribute("text-anchor"), "end");
  pg.input.value = "50";
  pg.input.fire("input");
  assertEquals(pg.markerText.textContent, "\u2190 Your price");
  assertEquals(pg.markerText.getAttribute("text-anchor"), "start");
  pg.input.value = "200";
  pg.input.fire("input");
  assertEquals(pg.markerText.textContent, "Your price");
  assertEquals(pg.markerText.getAttribute("text-anchor"), "middle");

  pg.input.value = "abc";
  pg.input.fire("input");
  assertEquals(pg.pe.textContent, NO_PRICE_TEXT);
  assertEquals(pg.gap.textContent, NO_PRICE_TEXT);
  assertEquals(pg.priceText.textContent, "");
  assertEquals(pg.marker.getAttribute("display"), "none");
  assertEquals(pg.whenPrice.getAttribute("hidden"), "");
  assertEquals(pg.whenNo.getAttribute("hidden"), null);
});

Deno.test("fake DOM: no price stored and none typed", () => {
  const pg = makePage({ ...DATA, price: null }, { inputValue: "" });
  assertEquals(pg.pe.textContent, NO_PRICE_TEXT);
  assertEquals(pg.whenPrice.getAttribute("hidden"), "");
  assertEquals(pg.whenNo.getAttribute("hidden"), null);
  pg.input.value = "100";
  pg.input.fire("change");
  assertEquals(pg.marker.getAttribute("transform"), "translate(20,0)");
  assertEquals(pg.whenPrice.getAttribute("hidden"), null);
});

Deno.test("fake DOM: bad JSON block does not break the page", () => {
  const pg = makePage(null, { inputValue: "50", raw: "{not json" });
  assertEquals(pg.pe.textContent, NA_TEXT);
  assertEquals(pg.gap.textContent, NA_TEXT);
  assertEquals(pg.implied.textContent, NA_TEXT);
});

Deno.test("fake DOM: theme cycles and is remembered", () => {
  const pg = makePage(DATA, { storage: { "dd-theme": "dark" } });
  assertEquals(pg.html.getAttribute("data-theme"), "dark");
  assertEquals(pg.themeBtn.textContent, "Theme: Dark");
  pg.themeBtn.fire("click");
  assertEquals(pg.html.getAttribute("data-theme"), null);
  assertEquals(pg.themeBtn.textContent, "Theme: Auto");
  assertEquals(pg.store.get("dd-theme"), "auto");
  pg.themeBtn.fire("click");
  assertEquals(pg.html.getAttribute("data-theme"), "light");
  assertEquals(pg.themeBtn.textContent, "Theme: Light");
  assertEquals(pg.themeBtn.getAttribute("aria-label"), "Theme: Light. Switch light or dark");
  const fresh = makePage(DATA);
  assertEquals(fresh.themeBtn.textContent, "Theme: Auto");
  assertEquals(fresh.html.getAttribute("data-theme"), null);
});

Deno.test("fake DOM: a page without the theme button keeps the server theme, stored choice or not", () => {
  const stores: Array<Record<string, string>> = [{}, { "dd-theme": "auto" }, { "dd-theme": "light" }];
  for (const storage of stores) {
    const pg = makePage(DATA, { noThemeButton: true, serverTheme: "dark", storage });
    assertEquals(pg.html.getAttribute("data-theme"), "dark");
    assertEquals(pg.store.get("dd-theme"), storage["dd-theme"]);
  }
  const auto = makePage(DATA, { noThemeButton: true, storage: { "dd-theme": "dark" } });
  assertEquals(auto.html.getAttribute("data-theme"), null);
});

Deno.test("fake DOM: with nothing stored the theme button starts from the server theme", () => {
  const pg = makePage(DATA, { serverTheme: "light" });
  assertEquals(pg.html.getAttribute("data-theme"), "light");
  assertEquals(pg.themeBtn.textContent, "Theme: Light");
  pg.themeBtn.fire("click");
  assertEquals(pg.html.getAttribute("data-theme"), "dark");
  assertEquals(pg.store.get("dd-theme"), "dark");
  // A stored choice still wins over the server theme on the page with the button.
  const stored = makePage(DATA, { serverTheme: "light", storage: { "dd-theme": "auto" } });
  assertEquals(stored.html.getAttribute("data-theme"), null);
  assertEquals(stored.themeBtn.textContent, "Theme: Auto");
});

Deno.test("fake DOM: reading mode", () => {
  const pg = makePage(DATA, { storage: { "dd-mode": "charts" } });
  assert(pg.body.classes.has("charts-only"));
  assertEquals(pg.charts.getAttribute("aria-pressed"), "true");
  assertEquals(pg.story.getAttribute("aria-pressed"), "false");
  pg.story.fire("click");
  assert(!pg.body.classes.has("charts-only"));
  assertEquals(pg.story.getAttribute("aria-pressed"), "true");
  assertEquals(pg.store.get("dd-mode"), "story");
});

Deno.test("fake DOM: chip nav highlight", () => {
  const pg = makePage(DATA);
  assertEquals(pg.observed.length, 3);
  pg.intersect("value");
  assertEquals(pg.chips.map((c) => c.classes.has("on")), [false, false, true]);
  // chip at left 600, width 80, in a 360px strip: 0 + 600 - (360 - 80) / 2 = 460
  assertEquals(pg.navWrap.scrolledTo, 460);
  pg.intersect("summary");
  assertEquals(pg.chips.map((c) => c.classes.has("on")), [true, false, false]);
});

Deno.test("fake DOM: storage that throws is ignored", () => {
  const reg = new Map<string, FakeEl[]>();
  const doc = {
    documentElement: el(),
    body: el(),
    querySelectorAll: (s: string) => reg.get(s) ?? [],
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => el(),
    createTextNode: () => el(),
  };
  const win = {
    get localStorage(): Storage {
      throw new Error("blocked");
    },
  };
  runClient(doc, win);
});
