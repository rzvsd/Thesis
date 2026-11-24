import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { BASE_CSS, PAGE_CSS, pageCss, PRINT_RULES } from "./css.ts";
import { CHART_CSS } from "./charts.ts";

function braceBalance(css: string): number {
  let n = 0;
  for (const c of css) {
    if (c === "{") n++;
    if (c === "}") n--;
    if (n < 0) return n;
  }
  return n;
}

Deno.test("PAGE_CSS: page rules, then chart kit, then print", () => {
  assertEquals(PAGE_CSS, pageCss(CHART_CSS));
  const iBase = PAGE_CSS.indexOf(BASE_CSS);
  const iChart = PAGE_CSS.indexOf(CHART_CSS.trim());
  const iPrint = PAGE_CSS.indexOf(PRINT_RULES);
  assertEquals(iBase, 0);
  assert(iChart > iBase && iPrint > iChart, "order");
  assertEquals(pageCss(""), BASE_CSS + "\n" + PRINT_RULES);
});

Deno.test("PAGE_CSS: well formed and safe inside <style>", () => {
  assertEquals(braceBalance(PAGE_CSS), 0);
  assert(!PAGE_CSS.includes("</"), "no </");
  assert(!/https?:|@import|url\(/.test(PAGE_CSS), "no external requests");
  assert(!PAGE_CSS.includes("—"), "no em dash");
});

Deno.test("PAGE_CSS: tokens for light, dark (auto and forced) and every token the chart kit uses", () => {
  assertStringIncludes(PAGE_CSS, '@media (prefers-color-scheme: dark){\n  :root:not([data-theme="light"]){');
  assertStringIncludes(PAGE_CSS, ':root[data-theme="dark"]{');
  const defined = new Set([...BASE_CSS.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...PAGE_CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  for (const t of used) assert(defined.has(t), `token ${t} is defined`);
  for (
    const t of [
      "--s1",
      "--s6",
      "--pos",
      "--neg",
      "--deemph",
      "--grid",
      "--axis",
      "--ink",
      "--muted",
      "--surface",
    ]
  ) {
    assert(defined.has(t), t);
  }
  // dark values exist for the series colours
  assertStringIncludes(BASE_CSS, "--s1:#ba882e");
  assertStringIncludes(BASE_CSS, "--s1:#b48226");
});

Deno.test("PAGE_CSS: layout, story layer, polish and states from the mockup", () => {
  for (
    const sel of [
      ".appbar{",
      ".chipnav a.on{",
      ".hero h1{",
      ".pricebox{",
      ".kpis{",
      ".grid2{",
      ".card{",
      ".story>p:first-child::first-letter{",
      ".upshot b{",
      "body.charts-only .story",
      '.readmode button[aria-pressed="true"]',
      "main section:nth-of-type(even){",
      "#bottom{",
      ".tbl.stack",
      ".nodata{",
      ".card.notseen{",
      ".ns-tag{",
      "[hidden]{display:none!important}",
      '[data-dd="gap"].up',
    ]
  ) assertStringIncludes(PAGE_CSS, sel);
  assertStringIncludes(PAGE_CSS, ".card.notseen{background:transparent;border:1.5px dashed");
});

Deno.test("PAGE_CSS: print rules", () => {
  assertStringIncludes(PRINT_RULES, "@page{size:A4;margin:14mm}");
  assertStringIncludes(PRINT_RULES, "print-color-adjust:exact");
  assertStringIncludes(PRINT_RULES, ".appbar,.chipnav,.readmode,.iconbtn,.priceinput-edit");
  assertStringIncludes(PRINT_RULES, "main section{break-before:page");
  assertStringIncludes(PRINT_RULES, "main section:first-of-type{break-before:auto}");
  assertStringIncludes(PRINT_RULES, ".card,.kpis,.upshot");
  assertStringIncludes(PRINT_RULES, "break-inside:avoid");
  assertStringIncludes(PRINT_RULES, "details.tbl::details-content{content-visibility:visible");
  // light tokens are forced in print, over both dark selectors
  const print = PRINT_RULES.slice(PRINT_RULES.indexOf("@media print"));
  assertStringIncludes(print, ':root,:root:not([data-theme="light"]),:root[data-theme="dark"]{');
  assertStringIncludes(print, "--bg:#F5F1E8");
  assert(!print.includes("--bg:#0A0A0A"));
});
