import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import {
  buildContext,
  buildDeepDiveV2Html,
  EMBED_CSS,
  filingEyebrow,
  NOT_ADVICE_TEXT,
  renderDeepDiveV2,
  type RenderOptions,
} from "./render.ts";
import { CLIENT_JS } from "./client.ts";
import {
  sampleApplePack,
  sampleBankPack,
  sampleLossmakerPack,
  sampleReport,
  sampleSharesPack,
} from "./testdata_pack.ts";
import { sampleInstitutionalReport } from "../testdata/editorial_institutional.ts";
import { sampleSparseReport } from "../testdata/editorial_sparse.ts";

const OPTS = { downloadUrl: "https://example.com/app?a=1&b=2" };
const IDS = [
  "summary",
  "business",
  "countries",
  "links",
  "owners",
  "financials",
  "value",
  "action",
  "forecasts",
  "risks",
  "events",
  "bottom",
  "sources",
];

function reports(): Array<[string, unknown]> {
  return [
    ["aapl", sampleReport(sampleApplePack())],
    ["lossmaker", sampleReport(sampleLossmakerPack())],
    ["bank", sampleReport(sampleBankPack())],
    ["legacy", sampleInstitutionalReport("job-1", "report-1")],
    ["sparse", sampleSparseReport("job-2", "report-2")],
    ["empty", {}],
  ];
}

/** The text a reader sees: no style, script, tags or attribute values. */
function visibleText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(
      /&gt;/g,
      ">",
    );
}

const BANNED =
  /\b((buy|sell|hold|stop|target|exit)(s|ing|ers?)?|entr(y|ies)|accumulate|overweight|underweight|outperform|undervalued|overvalued|cheap|expensive|upside|downside|opportunity|attractive|bullish|bearish|recommend\w*|should)\b/i;

Deno.test("every sample renders 13 chapters in SPEC order with resolved chart references", () => {
  for (const [name, report] of reports()) {
    const r = renderDeepDiveV2(report, OPTS);
    assertEquals(r.problems, [], name);
    assertEquals([...r.html.matchAll(/<section id="([a-z]+)">/g)].map((m) => m[1]), IDS, name);
    assertEquals([...r.html.matchAll(/<nav class="chipnav"[\s\S]*?<\/nav>/g)].length, 1);
    // chapters 01 to 11 have a verdict, a story and an upshot; Bottom line has an upshot
    for (const ch of r.chapters.slice(0, 11)) {
      assert(ch.verdict.lead && ch.story.length && ch.upshot, `${name} ${ch.id}`);
      assert(ch.cards.length >= 1, `${name} ${ch.id} cards`);
    }
    assert(r.chapters[11].upshot);
    // chart numbers run 1..N in page order
    const nums = [...r.html.matchAll(/<div class="fignum">Chart (\d+)<\/div>/g)].map((m) => Number(m[1]));
    assertEquals(nums, nums.map((_, i) => i + 1), name);
  }
});

Deno.test("page text: no advice words, no em dashes, no exclamation marks", () => {
  for (const [name, report] of reports()) {
    const text = visibleText(buildDeepDiveV2Html(report, OPTS));
    const hit = BANNED.exec(text);
    assertEquals(
      hit
        ? `${hit[0]}: ${text.slice(Math.max(0, hit.index - 50), hit.index + 20).replace(/\s+/g, " ")}`
        : null,
      null,
      name,
    );
    assertEquals(text.includes("—"), false, `${name} em dash`);
    assertEquals(text.includes("!"), false, `${name} exclamation`);
    // SPEC rule 2: the page is frozen at the filing date, so nothing reads as current.
    const today = /\btoday\b/i.exec(text);
    assertEquals(
      today ? text.slice(Math.max(0, today.index - 50), today.index + 20) : null,
      null,
      `${name} today`,
    );
  }
});

Deno.test("chapter shape: 1 to 7 cards, 2 to 4 story paragraphs in chapters 01 to 11", () => {
  for (const [name, report] of reports()) {
    const r = renderDeepDiveV2(report, OPTS);
    for (const ch of r.chapters) {
      assert(ch.cards.length >= 1 && ch.cards.length <= 7, `${name} ${ch.id}: ${ch.cards.length} cards`);
    }
    for (const ch of r.chapters.slice(0, 11)) {
      assert(ch.story.length >= 2 && ch.story.length <= 4, `${name} ${ch.id}: ${ch.story.length} paragraphs`);
    }
  }
});

Deno.test("CSP contract: one constant script, one JSON block, no handlers or external loads", () => {
  for (const [name, report] of reports()) {
    const html = buildDeepDiveV2Html(report, OPTS);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    assertEquals(scripts.length, 2, name);
    assertEquals(scripts[0][1], ' type="application/json" id="dd-data"');
    assertEquals(scripts[1][2], CLIENT_JS);
    const data = JSON.parse(scripts[0][2]);
    assertEquals(Object.keys(data).sort(), ["currency", "dcf", "eps", "price", "scenarios"]);
    assertEquals(/\son[a-z]+=/i.test(html), false, `${name} inline handler`);
    assertEquals(/javascript:/i.test(html), false);
    assertEquals(/<(img|link|iframe|object|embed)\b/i.test(html), false);
    assertEquals(/\ssrc=/i.test(html.replace(/<script>[\s\S]*?<\/script>/, "")), false);
    assertMatch(html, /^<!doctype html><html lang="en"><head><meta charset="utf-8" \/>/);
    assertStringIncludes(html, '<meta name="robots" content="noindex, nofollow" />');
  }
});

Deno.test("head, footer and escaping", () => {
  const pack = sampleLossmakerPack();
  const html = buildDeepDiveV2Html(sampleReport(pack, { issuer: { name: "A&B <script>x</script>" } }), OPTS);
  assertStringIncludes(html, "<title>A&amp;B &lt;script&gt;x&lt;/script&gt; Deep Dive</title>");
  assertEquals(html.includes("<script>x</script>"), false);
  assertStringIncludes(html, 'href="https://example.com/app?a=1&amp;b=2"');
  assertStringIncludes(html, "Thesis is research, not financial advice.");
  assertStringIncludes(html, "Sample report");
  const json = /<script type="application\/json" id="dd-data">([\s\S]*?)<\/script>/.exec(
    buildDeepDiveV2Html(sampleReport(sampleApplePack()), OPTS),
  )?.[1] ?? "";
  assertEquals(json.includes("<"), false);
});

Deno.test("in-app options: the default page is unchanged, theme only adds html[data-theme]", () => {
  for (const [name, report] of reports()) {
    const base = buildDeepDiveV2Html(report, OPTS);
    assertEquals(buildDeepDiveV2Html(report, { ...OPTS, theme: undefined, embed: false }), base, name);
    // A theme the type does not allow (a caller that skipped validation) is ignored.
    const bad = { ...OPTS, theme: '"><script>' } as unknown as RenderOptions;
    assertEquals(buildDeepDiveV2Html(report, bad), base, name);
    for (const theme of ["light", "dark"] as const) {
      const themed = buildDeepDiveV2Html(report, { ...OPTS, theme });
      assert(themed.startsWith(`<!doctype html><html lang="en" data-theme="${theme}"><head>`), name);
      assertEquals(themed.replace(` data-theme="${theme}"`, ""), base, name);
    }
  }
});

Deno.test("embed: no app bar, theme switch or app link; same chapters, notice and script", () => {
  for (const [name, report] of reports()) {
    const html = buildDeepDiveV2Html(report, { ...OPTS, embed: true, theme: "dark" });
    assertMatch(html, /^<!doctype html><html lang="en" data-theme="dark"><head>/);
    assertEquals(html.includes('class="appbar"'), false, name);
    assertEquals(html.replace(/<script>[\s\S]*?<\/script>/, "").includes("data-dd-theme"), false, name);
    assertEquals(html.includes("Get the Thesis app"), false, name);
    assertEquals(html.includes("example.com/app"), false, name);
    assertEquals(
      html.includes('class="sample-pill"'),
      name === "aapl" || name === "lossmaker" || name === "bank",
    );
    assertStringIncludes(html, `${EMBED_CSS}</style>`);
    assertStringIncludes(html, '<nav class="chipnav"');
    assertStringIncludes(html, 'data-dd-mode="charts"');
    assertStringIncludes(html, NOT_ADVICE_TEXT.slice(0, 60));
    const ids = [...html.matchAll(/<section id="([a-z]+)">/g)].map((m) => m[1]);
    assertEquals(ids, IDS, name);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    assertEquals(scripts.map((m) => m[1]), [' type="application/json" id="dd-data"', ""], name);
    assertEquals(scripts[1][2], CLIENT_JS);
  }
  const plain = buildDeepDiveV2Html(sampleReport(sampleApplePack()), { ...OPTS, embed: true });
  assertMatch(plain, /^<!doctype html><html lang="en"><head>/);
});

Deno.test("no stored price: the box opens empty and price-only parts are hidden", () => {
  const html = buildDeepDiveV2Html(sampleReport(sampleApplePack()), OPTS);
  assertStringIncludes(html, 'data-dd="price" type="text"');
  assertStringIncludes(html, 'value=""');
  assertMatch(html, /data-dd="gap" data-dd-when="price" hidden>/);
  assertMatch(html, /<span class="noprice" data-dd-when="noprice">/);
  assertStringIncludes(html, '<span data-dd="pe">Type a price</span>');
  assertStringIncludes(html, "Deep Dive · From the 10-K for fiscal 2025");
  assertStringIncludes(html, "Fiscal year ends in September");
});

Deno.test("stored price: the box opens at the filing-date close", () => {
  const c = buildContext(sampleReport(sampleBankPack()));
  const html = buildDeepDiveV2Html(sampleReport(sampleBankPack()), OPTS);
  assertStringIncludes(html, 'value="61.50"');
  assertStringIncludes(html, `<span data-dd="pe">${c.pt.pe}</span>`);
  assertMatch(html, /<span class="noprice" data-dd-when="noprice" hidden>/);
  assertStringIncludes(html, "Opens at the $61.50 close on 27 Feb 2026");
});

Deno.test("filingEyebrow names the form and period", () => {
  const c = buildContext(sampleReport(sampleApplePack()));
  assertEquals(filingEyebrow(c.f, c), "From the 10-K for fiscal 2025");
  const q = buildContext({
    filing_intelligence: { latest_filing: { form: "10-Q", fiscal_year: 2026, fiscal_quarter: 2 } },
  });
  assertEquals(filingEyebrow(q.f, q), "From the 10-Q for Q2 fiscal 2026");
  const none = buildContext({});
  assertEquals(filingEyebrow(none.f, none), "From SEC filings");
});

Deno.test("legacy reports render the same page with more Not seen cards and the older-format pill", () => {
  const html = buildDeepDiveV2Html(sampleInstitutionalReport("job-1", "report-1"), OPTS);
  assertStringIncludes(html, "Older report format");
  assertStringIncludes(html, "Only the latest filing is on record");
  assert((html.match(/Not seen yet/g) ?? []).length > 10);
  // legacy LLM prose is never shown
  assertEquals(html.includes("Cash resilience is outpacing market skepticism"), false);
});

// ---------------------------------------------------------------- hostile input

const EVIL = `</script><img src=x onerror=alert(1)>"'\`<!--<svg onload=alert(2)>[[ref:scores]]  `;

/** Replaces every string leaf with EVIL (and every number, when asked); dates keep a valid prefix. */
function poison(v: unknown, key = "", numbersToo = false): unknown {
  if (Array.isArray(v)) return v.map((x) => poison(x, key, numbersToo));
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      o[k] = k === "version" || k === "fiscal_year" ? x : poison(x, k, numbersToo);
    }
    if (key === "concepts") o[EVIL] = EVIL;
    return o;
  }
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) + EVIL : EVIL;
  if (typeof v === "number" && numbersToo) return EVIL;
  return v;
}

function hostileReport(numbersToo: boolean): Record<string, unknown> {
  const base = sampleBankPack() as unknown as Record<string, unknown>;
  const pack = poison(base, "", numbersToo) as Record<string, unknown>;
  if (!numbersToo) pack.price_at_filing = { value: 61.5, date: "2026-02-27" + EVIL, source: EVIL };
  (pack.missing as unknown[]).push(EVIL, "segments");
  (pack.filings as unknown[]).push({
    form: "8-K" + EVIL,
    filing_date: "2025-01-01" + EVIL,
    accession: EVIL,
    items: "2.02," + EVIL,
    url: "javascript:alert(1)",
    period_end: EVIL,
  });
  (pack.sources as unknown[]).push({ name: EVIL, url: "javascript:alert(1)" });
  return {
    ...sampleReport(sampleApplePack()),
    ticker: EVIL,
    issuer: { name: EVIL, exchange: EVIL, industry: EVIL, sector: EVIL, currency: EVIL },
    generated_at: "2025-11-01" + EVIL,
    name_relationships: [{ target_ticker: EVIL, relationship_type: EVIL }],
    fact_pack: pack,
    sample: false,
  };
}

function hostileLegacy(): Record<string, unknown> {
  const r = poison(sampleInstitutionalReport("job-1", "report-1")) as Record<string, unknown>;
  r.issuer = { name: EVIL, exchange: EVIL, industry: EVIL, currency: EVIL };
  r.ticker = EVIL;
  r.filing_intelligence = {
    latest_filing: {
      form: "10-Q" + EVIL,
      fiscal_year: 2025,
      fiscal_quarter: 2,
      filing_date: "2025-05-01" + EVIL,
    },
  };
  r.name_relationships = [{ target_ticker: EVIL, relationship_type: EVIL }];
  return r;
}

for (
  const [name, mk] of [
    ["hostile strings", () => hostileReport(false)],
    ["hostile strings and numbers", () => hostileReport(true)],
    ["hostile legacy", hostileLegacy],
  ] as Array<[string, () => Record<string, unknown>]>
) {
  Deno.test(`escaping: ${name} never reach the page as markup`, () => {
    const r = renderDeepDiveV2(mk(), OPTS);
    const html = r.html;
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assertEquals(scripts.length, 2, name);
    assertEquals(scripts[0][1], ' type="application/json" id="dd-data"');
    assertEquals(scripts[1][1], "");
    assertEquals(scripts[1][2], CLIENT_JS);
    assertEquals((html.match(/<script/gi) ?? []).length, 2, `${name}: raw <script`);
    assertEquals(/<img\b/i.test(html), false, `${name}: <img`);
    assertEquals(/<svg onload/i.test(html), false, `${name}: svg onload`);
    assertEquals(/<!--/.test(html), false, `${name}: comment opener`);
    const outside = html.replace(/<script>[\s\S]*?<\/script>/, "").replace(/&lt;[\s\S]*?&gt;/g, "");
    assertEquals(/\son[a-z]+\s*=/i.test(outside), false, `${name}: handler attribute`);
    assertEquals(/javascript:/i.test(html), false, `${name}: javascript: URL`);
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      assert(m[1].startsWith("#") || m[1] === "https://example.com/app?a=1&amp;b=2", `${name}: href ${m[1]}`);
    }
    assertEquals(/\s(src|action|formaction|xlink:href|srcset|poster)=/i.test(outside), false, `${name}: src`);
    JSON.parse(scripts[0][2]);
    assertEquals(scripts[0][2].includes("<"), false);
    // Report text cannot form chart links: every [[ref:]] in the page comes from the renderer.
    assertEquals(r.problems, [], name);
  });
}

// ---------------------------------------------------------------- review fixes: gaps, currency, missing values

/** The page outside <script> and <style>: text, SVG labels and attribute values. */
function outsideScripts(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ");
}

/** The Apple pack with only the given fiscal years. */
function applePackYears(years: number[]): ReturnType<typeof sampleApplePack> {
  const pack = sampleApplePack();
  pack.annual = pack.annual.filter((r) => years.includes(r.fiscal_year));
  return pack;
}

Deno.test("gapped history: no one-year claim and no model are built from the gap", () => {
  const report = sampleReport(applePackYears([2020, 2022, 2025]));
  const c = buildContext(report);
  assertEquals(c.d.years, [2020, 2022, 2025]);
  assertEquals(c.d.growth.revenueYoY, null);
  assertEquals(c.d.dcf, null);
  const r = renderDeepDiveV2(report, OPTS);
  assertEquals(r.problems, []);
  const text = visibleText(r.html).replace(/\s+/g, " ");
  for (
    const claim of [
      /on the year/i,
      /a year earlier/i,
      /Last year/,
      /the one before/i,
      /What changed since (FY|fiscal)/,
      /year-on-year changes? on record/,
      /in the year\./,
      /Earnings per share went from \$[\d.]+ to \$[\d.]+( in fiscal 2025)?\./,
      /Base case/,
    ]
  ) {
    const hit = claim.exec(text);
    assertEquals(hit ? text.slice(Math.max(0, hit.index - 80), hit.index + 40) : null, null, String(claim));
  }
  assertStringIncludes(text, "fiscal 2024 is not on record");
  assertStringIncludes(text, "The model needs three straight years of free cash flow");
  assertStringIncludes(text, "No prior year");
  assertStringIncludes(r.html, '"scenarios":null');
});

Deno.test("currency: a EUR pack shows euros, no dollar money and no price box", () => {
  const pack = sampleApplePack();
  pack.currency = "EUR";
  // A stored price is not compared either: it would need the trading currency and the ADR ratio.
  pack.price_at_filing = { value: 191, date: "2025-10-31", source: "test" };
  const r = renderDeepDiveV2(sampleReport(pack), OPTS);
  assertEquals(r.problems, []);
  const page = outsideScripts(r.html);
  assertEquals(
    page.includes("$"),
    false,
    page.slice(Math.max(0, page.indexOf("$") - 80), page.indexOf("$") + 20),
  );
  assertEquals(/dollar/i.test(page), false);
  assertStringIncludes(page, "€416.2B");
  assertMatch(page, /<text[^>]*>€\d/); // SVG axis and value labels
  assertStringIncludes(page, "EUR per reported share");
  assertStringIncludes(page, "Price comparisons are off");
  assertStringIncludes(page, "ADR ratio");
  // No input, no price fields the script would fill, no price line in the range charts.
  assertEquals(/<input\b/.test(page), false);
  assertEquals(/data-dd="(price|pe|gap|implied|price-text|marker)"/.test(page), false);
  assertEquals(/data-dd-when=/.test(page), false);
  assertEquals(/Your price|Type a price|at your price|191\.00|close on/.test(visibleText(r.html)), false);
  const data = JSON.parse(
    /<script type="application\/json" id="dd-data">([\s\S]*?)<\/script>/.exec(r.html)![1],
  );
  assertEquals(data, { price: null, eps: null, scenarios: null, dcf: null, currency: "EUR" });
  // The model values still show, in the reporting currency.
  assert(buildContext(sampleReport(pack)).d.dcf);
  assertStringIncludes(page, "The model range is €");
  // The banned words and marks stay out in this mode too.
  const text = visibleText(r.html);
  assertEquals(BANNED.exec(text)?.[0] ?? null, null);
  assertEquals(text.includes("—") || text.includes("!"), false);
});

Deno.test("currency: other codes use the ISO code; legacy and missing codes stay in dollars", () => {
  const chf = sampleApplePack();
  chf.currency = "chf";
  const page = outsideScripts(buildDeepDiveV2Html(sampleReport(chf), OPTS));
  assertStringIncludes(page, "CHF 416.2B");
  assertStringIncludes(page, "CHF per reported share");
  assertEquals(page.includes("$"), false);
  assertEquals(/<input\b/.test(page), false);
  const gbp = sampleApplePack();
  gbp.currency = "GBP";
  assertStringIncludes(buildDeepDiveV2Html(sampleReport(gbp), OPTS), "£416.2B");
  // USD packs keep the price box; the formatter is back to dollars after a non-USD render.
  const usd = buildDeepDiveV2Html(sampleReport(sampleApplePack()), OPTS);
  assertStringIncludes(usd, 'data-dd="price" type="text"');
  assertStringIncludes(usd, "$416.2B");
  assertEquals(buildContext(sampleInstitutionalReport("job-1", "report-1")).currency, "USD");
});

Deno.test("missing latest net profit is not called a loss anywhere", () => {
  const pack = sampleApplePack();
  const last = pack.annual[pack.annual.length - 1];
  delete last.net_income;
  delete last.eps_diluted;
  const c = buildContext(sampleReport(pack));
  assertEquals(c.d.netIncome[c.d.netIncome.length - 1], null);
  const text = visibleText(buildDeepDiveV2Html(sampleReport(pack), OPTS)).replace(/\s+/g, " ");
  assertStringIncludes(text, "First, net profit is not tagged for fiscal 2025.");
  for (
    const claim of [/not yet profitable/, /net loss/i, /\blost\b/, /broke even/, /Can Apple reach a profit/]
  ) {
    assertEquals(claim.exec(text)?.[0] ?? null, null, String(claim));
  }
});

Deno.test("net debt with free cash flow missing does not say the cash flow is negative", () => {
  const pack = sampleApplePack();
  const last = pack.annual[pack.annual.length - 1];
  last.cash = 1e9;
  delete last.short_term_investments;
  delete last.free_cash_flow;
  delete last.operating_cash_flow;
  const ch = renderDeepDiveV2(sampleReport(pack), OPTS).chapters.find((x) => x.id === "risks")!;
  assertStringIncludes(ch.verdict.body, "free cash flow is not tagged for fiscal 2025");
  assertEquals(ch.verdict.body.includes("not positive"), false);
});

Deno.test("margin chart title counts rows on record, not calendar years, when the history has gaps", () => {
  const title = (years: number[]): string => {
    const pack = applePackYears(years);
    const lastRow = pack.annual[pack.annual.length - 1];
    lastRow.gross_profit = (lastRow.revenue as number) * 0.3;
    return visibleText(buildDeepDiveV2Html(sampleReport(pack), OPTS)).replace(/\s+/g, " ");
  };
  const gapped = title([2015, 2020, 2025]);
  assertStringIncludes(gapped, "Gross margin at its lowest of the 3 years on record");
  assertEquals(/(highest|lowest) in \d+ years/.exec(gapped)?.[0] ?? null, null);
  assertStringIncludes(title([2023, 2024, 2025]), "Gross margin at its lowest in 3 years");
});

Deno.test("KPI tiles say No prior year only when the year before is not on record", () => {
  const pack = sampleLossmakerPack();
  const lastRow = pack.annual[pack.annual.length - 1] as unknown as Record<string, unknown>;
  for (const k of Object.keys(lastRow)) {
    if (!["fiscal_year", "period_end", "filing_date", "revenue"].includes(k)) delete lastRow[k];
  }
  const html = renderDeepDiveV2(sampleReport(pack), OPTS).html;
  const kpis = visibleText(html.slice(html.indexOf('<div class="kpis">'), html.indexOf("Price to earnings")))
    .replace(/\s+/g, " ");
  assertEquals(kpis.includes("No prior year"), false, kpis);
  assertStringIncludes(kpis, "Operating margin Not disclosed −42.6% a year earlier");
  assertStringIncludes(kpis, "Shares, change in the year Not disclosed 51.0 million shares a year earlier");
  const gapped = renderDeepDiveV2(sampleReport(applePackYears([2020, 2022, 2025])), OPTS).html;
  assertStringIncludes(gapped.slice(gapped.indexOf('<div class="kpis">')), "No prior year");
});

Deno.test("a stock split, listed by the pack or not, reads as no change in shares and no dilution", () => {
  const notes = {
    split_listed: "Adjusted for a 4-for-1 split in fiscal 2025.",
    split_raw: "Adjusted for what looks like a 4-for-1 split in fiscal 2025, judged from the share count",
  } as const;
  for (const mode of ["split_listed", "split_raw"] as const) {
    const report = sampleReport(sampleSharesPack(mode));
    const c = buildContext(report);
    const d = c.d;
    // Never adjusted twice: every year on the FY2025 basis of 320 million shares.
    assertEquals(d.shares, [320e6, 320e6, 320e6, 320e6, 320e6], mode);
    assertEquals(d.eps, [0.5, 0.5, 0.5, 0.5, 0.5], mode);
    assertEquals(d.sharesChange1y, 0, mode);
    assertEquals(d.growth.epsYoY, 0, mode);
    const share = d.checks.find((k) => k.key === "share_count");
    assertEquals(share?.passes, true, mode);
    // The EPS bridge has no share step and runs from $0.50 to $0.50.
    assertEquals(d.epsBridge?.from, 0.5, mode);
    assertEquals(d.epsBridge?.to, 0.5, mode);
    assert(Math.abs(d.epsBridge?.steps.find((x) => x.key === "shares")?.value ?? 1) < 0.005, mode);

    const r = renderDeepDiveV2(report, OPTS);
    assertEquals(r.problems, [], mode);
    const text = visibleText(r.html);
    for (
      const claim of ["smaller slice", "New shares mean", "rise in shares", "More shares", "Fewer shares"]
    ) {
      assertEquals(text.includes(claim), false, `${mode}: ${claim}`);
    }
    assertEquals(/Share count (up|down) [1-9]/.test(text), false, mode);
    assertStringIncludes(text, "earnings per share held at $0.50");
    assertEquals(/into 0 parts|came from same/.test(text), false, mode);
    // The adjustment is said once, on the share count chart.
    const sharesCard = r.chapters.find((ch) => ch.id === "financials")?.cards.find((cd) =>
      cd.id === "fin-shares"
    );
    assertStringIncludes(sharesCard?.sub ?? "", notes[mode]);
    assertEquals(text.split("4-for-1").length - 1, 1, mode);
    assertEquals(BANNED.exec(text)?.[0] ?? null, null);
    assertEquals(text.includes("—") || text.includes("!"), false);
  }
});

Deno.test("a genuine 30% share issue is still reported as dilution", () => {
  const report = sampleReport(sampleSharesPack("issue"));
  const c = buildContext(report);
  assertEquals(c.d.splits, []);
  assert(Math.abs((c.d.sharesChange1y ?? 0) - 30) < 1e-9);
  assertEquals(c.d.checks.find((k) => k.key === "share_count")?.passes, false);
  const r = renderDeepDiveV2(report, OPTS);
  const text = visibleText(r.html);
  assertStringIncludes(text, "smaller slice");
  assertStringIncludes(text, "Share count up 30.0%");
  assertEquals(text.includes("split in fiscal"), false);
  assert((c.d.epsBridge?.steps.find((x) => x.key === "shares")?.value ?? 0) < 0);
});

Deno.test("a split in a year profit grew strongly is still adjusted, not read as dilution", () => {
  // 2-for-1 in FY2025 with net profit up 50%: EPS $2.00 to $1.50 as reported, shares 80 to 160 million.
  const pack = sampleSharesPack("split_raw");
  pack.annual = pack.annual.map((row) =>
    row.fiscal_year === 2025
      ? {
        ...row,
        operating_income: 0.3e9,
        pretax_income: 0.3e9,
        income_tax: 0.06e9,
        net_income: 0.24e9,
        eps_diluted: 1.5,
        shares_diluted: 160e6,
        shares_outstanding: 160e6,
      }
      : row
  );
  const report = sampleReport(pack);
  const c = buildContext(report);
  assertEquals(c.d.splits, [{ ratio: 2, fiscalYear: 2025, source: "detected" }]);
  assertEquals(c.d.sharesChange1y, 0);
  assertEquals(c.d.checks.find((k) => k.key === "share_count")?.passes, true);
  assertEquals(c.d.epsBridge?.steps.find((x) => x.key === "shares")?.value, 0);
  const r = renderDeepDiveV2(report, OPTS);
  assertEquals(r.problems, []);
  const text = visibleText(r.html);
  for (const claim of ["smaller slice", "New shares mean", "More shares", "Fewer shares"]) {
    assertEquals(text.includes(claim), false, claim);
  }
  assertEquals(/Share count (up|down) [1-9]/.test(text), false);
  assertStringIncludes(text, "Adjusted for what looks like a 2-for-1 split in fiscal 2025");
});
