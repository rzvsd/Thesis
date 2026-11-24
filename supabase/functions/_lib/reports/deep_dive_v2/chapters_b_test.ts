import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { forecasts, modelRange, risks, value } from "./chapters_b.ts";
import { NODATA } from "./charts.ts";
import { buildContext } from "./render.ts";
import { type Chapter, localRefProblems } from "./story.ts";
import { sampleApplePack, sampleBankPack, sampleLossmakerPack, sampleReport } from "./testdata_pack.ts";

const apple = () => buildContext(sampleReport(sampleApplePack()));

Deno.test("value: model range with a hidden movable marker when no price is stored", () => {
  const c = apple();
  const ch = value(c);
  assertStringIncludes(ch.verdict.lead, "base value at $126 a share, in a range of $101 to $157");
  assertStringIncludes(ch.story[2].lead, "no price in this report yet");
  const svg = modelRange(c, 720);
  assertStringIncludes(svg, 'data-dd="marker"');
  assertStringIncludes(svg, 'display="none"');
  assertEquals(svg.includes('style="display:none"'), false);
  const ratios = ch.cards.find((x) => x.id === "val-ratios")?.html ?? "";
  for (const k of ["pe", "gap", "implied"]) assertStringIncludes(ratios, `data-dd="${k}"`);
  assertStringIncludes(ratios, "Type a price");
  assertEquals(ch.cards.some((x) => x.id === "val-heat"), false); // the grid is in Forecasts (SPEC 09)
  assertStringIncludes(forecasts(c).cards.find((x) => x.id === "fc-heat")?.html ?? "", "hm-");
  assertRefsLocal(ch);
});

Deno.test("value: a stored price is quoted with its date and the marker shows", () => {
  const c = buildContext(sampleReport(sampleBankPack()));
  const ch = value(c);
  assertStringIncludes(ch.verdict.body, "At the $61.50 close on 27 Feb 2026");
  // Implied growth covers years 1 to 5, then the fade, never "ten years".
  assertStringIncludes(ch.verdict.body, "for five years, then slows to 2.5% by year ten");
  assertEquals(JSON.stringify(ch).includes("for ten years"), false);
  assertEquals(JSON.stringify(ch).includes("for a decade"), false);
  assertEquals(modelRange(c, 360).includes('display="none"'), false);
  assertRefsLocal(ch);
});

Deno.test("value and forecasts without a model", () => {
  const c = buildContext(sampleReport(sampleLossmakerPack()));
  assertStringIncludes(value(c).verdict.lead, "cannot run");
  assertEquals(modelRange(c, 360), NODATA);
  const fc = forecasts(c);
  assertStringIncludes(fc.verdict.lead, "No model cases");
  assertRefsLocal(fc);
});

Deno.test("forecasts: base path labelled as a model", () => {
  const ch = forecasts(apple());
  assertStringIncludes(ch.verdict.body, "not a forecast from management");
  assertStringIncludes(ch.cards[0].html, "FY2035");
  assertRefsLocal(ch);
});

Deno.test("risks: four kill switches with status", () => {
  const ch = risks(apple());
  assertEquals(ch.verdict.lead, "All four tests pass on fiscal 2025 numbers.");
  const html = ch.cards[0].html;
  assertEquals((html.match(/class="k"/g) ?? []).length, 4);
  assertStringIncludes(html, "status ok");
  const loss = risks(buildContext(sampleReport(sampleLossmakerPack())));
  assertStringIncludes(loss.cards[0].html, "status bad");
  assertEquals(/\bToday\b/.test(loss.story[1].body), false);
  assertRefsLocal(ch);
  assertRefsLocal(loss);
});

function assertRefsLocal(ch: Chapter): void {
  assertEquals(localRefProblems(ch), []);
}
