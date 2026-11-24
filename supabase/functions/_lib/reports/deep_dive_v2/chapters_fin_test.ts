import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { financials } from "./chapters_fin.ts";
import { NODATA } from "./charts.ts";
import { buildContext } from "./render.ts";
import { type Chapter, localRefProblems } from "./story.ts";
import { sampleApplePack, sampleLossmakerPack, sampleReport } from "./testdata_pack.ts";

Deno.test("financials: eleven years, the bridge and the full table", () => {
  const ch = financials(buildContext(sampleReport(sampleApplePack())));
  assertEquals(ch.h2, "Eleven years of the numbers");
  assertEquals(ch.cards.map((c) => c.id), [
    "fin-revni",
    "fin-bridge",
    "fin-margins",
    "fin-fcf",
    "fin-returns",
    "fin-shares",
    "fin-cash",
  ]);
  assertStringIncludes(ch.verdict.lead, "Sales up 78% since fiscal 2015, net profit more than doubled");
  assertStringIncludes(ch.story[1].body, "lower tax rate +$0.73");
  assertStringIncludes(ch.cards[1].title ?? "", "From $6.08 to $7.47");
  // The full table sits behind Show table on the sales card.
  assertEquals((ch.cards[0].table?.match(/<tr>/g) ?? []).length, 12); // head + 11 years
  assertStringIncludes(ch.cards[0].table ?? "", ">EPS<");
  assertRefsLocal(ch);
});

Deno.test("financials: a loss-maker gets loss wording and an empty bridge", () => {
  const ch = financials(buildContext(sampleReport(sampleLossmakerPack())));
  assertStringIncludes(ch.story[0].lead, "not yet profitable");
  assertStringIncludes(ch.story[2].lead, "uses more cash than it makes");
  assertEquals(ch.cards[1].html, NODATA);
  assertStringIncludes(ch.cards[2].title ?? "", "Loses");
  assertRefsLocal(ch);
});

function assertRefsLocal(ch: Chapter): void {
  assertEquals(localRefProblems(ch), []);
}

Deno.test("financials: a missing latest net profit gets a neutral lead, not a loss", () => {
  const pack = sampleApplePack();
  delete pack.annual[pack.annual.length - 1].net_income;
  const ch = financials(buildContext(sampleReport(pack)));
  assertEquals(ch.story[0].lead, "First, net profit is not tagged for fiscal 2025.");
  assertEquals(ch.verdict.lead.includes("loss"), false);
  assertRefsLocal(ch);
  // A reported zero is still not a profit.
  const zero = sampleApplePack();
  zero.annual[zero.annual.length - 1].net_income = 0;
  assertStringIncludes(financials(buildContext(sampleReport(zero))).story[0].lead, "not yet profitable");
});

Deno.test("financials: a gapped history names the missing year instead of a one-year change", () => {
  const pack = sampleApplePack();
  pack.annual = pack.annual.filter((r) => [2020, 2022, 2025].includes(r.fiscal_year));
  const ch = financials(buildContext(sampleReport(pack)));
  assertEquals(ch.cards[1].html, NODATA);
  assertEquals(ch.cards[1].sub, "Needs fiscal 2024, which is not on record");
  assertStringIncludes(ch.story[1].body, "needs fiscal 2024, which is not on record");
  assertEquals(/Last year/.test(ch.story.map((s) => s.body).join(" ")), false);
  assertRefsLocal(ch);
});
