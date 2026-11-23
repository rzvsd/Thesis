import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { withUserResearchState } from "../../pulse/research_state.ts";
import { buildPulseBriefPlan } from "./plan.ts";
import { buildMarketPulsePdf } from "./pdf.ts";
import { createPulseReport, createQuietPulseReport, createResearchState } from "./testdata.ts";

const decoder = new TextDecoder();

function assertValidPdf(bytes: Uint8Array, pageCount: number): string {
  const text = decoder.decode(bytes);
  assert(text.startsWith("%PDF-1.4"), "starts with the PDF header");
  assert(text.endsWith("%%EOF"), "ends with %%EOF");
  assert(pageCount >= 1, "has at least one page");
  assertEquals((text.match(/\/Type \/Page /g) ?? []).length, pageCount);
  assertStringIncludes(text, `/Count ${pageCount}`);
  // Content streams are plain text: only printable ASCII may reach a Tj string.
  for (const match of text.matchAll(/\((.*)\) Tj/g)) {
    assert(/^[\x20-\x7E]*$/.test(match[1]), `non-ASCII text in ${match[1]}`);
  }
  return text;
}

function assertXrefOffsets(bytes: Uint8Array): void {
  const text = decoder.decode(bytes);
  const startxref = Number(text.slice(text.lastIndexOf("startxref") + 9).trim().split("\n")[0]);
  assertEquals(text.slice(startxref, startxref + 4), "xref");
  const entries = text.slice(startxref).split("\n").slice(3).filter((line) => / 00000 n $/.test(line));
  for (const [index, entry] of entries.entries()) {
    const offset = Number(entry.slice(0, 10));
    assertEquals(text.slice(offset, offset + `${index + 1} 0 obj`.length), `${index + 1} 0 obj`);
  }
}

Deno.test("normal or event issue renders every section in order", () => {
  const report = createPulseReport();
  const plan = buildPulseBriefPlan(report);
  assert(plan.fact_pack.mode !== "quiet");
  const { bytes, pageCount } = buildMarketPulsePdf(report);
  const text = assertValidPdf(bytes, pageCount);
  assertXrefOffsets(bytes);
  assert(pageCount >= 2, `long issue flows across pages (got ${pageCount})`);
  const order = [
    "(MORNING BRIEF)",
    "(THE READ)",
    "(S&P 500)",
    "(SECTOR LEADERSHIP)",
    "(FIVE-DAY CONTEXT)",
    "(THE ONE THING)",
    "(CHANGED)",
    "(YOUR NAMES)",
    "(NVDA)",
    "(THINGS TO WATCH)",
    "(HEADLINES WORTH KNOWING)",
    "(THE HONEST READ)",
    "(SOURCES AND METHOD)",
  ];
  let cursor = 0;
  for (const marker of order) {
    const index = text.indexOf(marker, cursor);
    assert(index >= 0, `missing or out of order: ${marker}`);
    cursor = index;
  }
  assertStringIncludes(text, "(Page 1 of ");
  assertStringIncludes(text, "\\(with a twist\\)");
  assert(!text.includes("javascript:"), "headline URLs are not written");
});

Deno.test("quiet issue renders the short form", () => {
  const report = createQuietPulseReport();
  assertEquals(buildPulseBriefPlan(report).fact_pack.mode, "quiet");
  const { bytes, pageCount } = buildMarketPulsePdf(report);
  const text = assertValidPdf(bytes, pageCount);
  assertXrefOffsets(bytes);
  assertStringIncludes(text, "(QUIET TAPE)");
  assertStringIncludes(text, "(NOTHING MOVED THE NEEDLE)");
  assertStringIncludes(text, "(QUIET DAY - 30 SECOND READ)");
  assert(!text.includes("(THE ONE THING)"));
  assert(!text.includes("(YOUR NAMES)"));
});

Deno.test("personalised issue with a user research state renders the user's names", () => {
  const report = withUserResearchState(createPulseReport(), createResearchState());
  const { bytes, pageCount } = buildMarketPulsePdf(report);
  const text = assertValidPdf(bytes, pageCount);
  assertStringIncludes(text, "(YOUR NAMES)");
  assertStringIncludes(text, "(TSLA)");
  assertStringIncludes(text, "(tracked)");
});

Deno.test("sparse report without tape or morning edition still renders", () => {
  const report = {
    report_id: "sparse",
    generated_at: "2026-04-23T11:39:14.198Z",
    cycle_end: "not a date",
    macro_stress: { as_of: "2026-04-23", state: "stable" },
    sections: {},
  };
  const { bytes, pageCount } = buildMarketPulsePdf(report);
  const text = assertValidPdf(bytes, pageCount);
  assertStringIncludes(text, "(Sources: No approved sources were attached");
});

Deno.test("render is fast", () => {
  const report = withUserResearchState(createPulseReport(), createResearchState());
  buildMarketPulsePdf(report);
  const runs = 5;
  const started = performance.now();
  for (let index = 0; index < runs; index += 1) {
    buildMarketPulsePdf(report);
  }
  const perRender = (performance.now() - started) / runs;
  assert(perRender < 500, `render took ${perRender.toFixed(1)} ms`);
});
