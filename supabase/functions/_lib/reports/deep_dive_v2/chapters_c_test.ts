import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { bottom, events, sources } from "./chapters_c.ts";
import { buildContext } from "./render.ts";
import { type Chapter, localRefProblems } from "./story.ts";
import { sampleApplePack, sampleLossmakerPack, sampleReport } from "./testdata_pack.ts";

const apple = () => buildContext(sampleReport(sampleApplePack()));

Deno.test("events: filings newest first with 8-K item codes", () => {
  const ch = events(apple());
  assertStringIncludes(ch.verdict.lead, "10 filings in the 12 months to 31 Oct 2025");
  const html = ch.cards[0].html;
  assertEquals((html.match(/class="e"/g) ?? []).length, 10);
  assertStringIncludes(html, "8-K 2.02");
  assertStringIncludes(html, "Shareholder votes");
  assert(html.indexOf("31 Oct 2025") < html.indexOf("30 Jan 2025"));
  assertRefsLocal(ch);
});

Deno.test("events: legacy reports show only the latest filing", () => {
  const ch = events(buildContext({
    ticker: "X",
    filing_intelligence: { latest_filing: { form: "10-K", period: "2025-FY", fiscal_year: 2025 } },
  }));
  assertStringIncludes(ch.verdict.lead, "Only the latest filing");
  assertRefsLocal(ch);
});

Deno.test("bottom line: big question, answer, four ways to be wrong", () => {
  const ch = bottom(apple());
  assertStringIncludes(ch.intro ?? "", "The big question");
  // The answer comes from the question (EPS against sales), the tests follow it.
  assertStringIncludes(ch.verdict.lead, "Yes in fiscal 2025: earnings per share rose");
  assertStringIncludes(ch.verdict.body, "All four tests in the Risks chapter pass");
  assertEquals((ch.cards[0].html.match(/<i>/g) ?? []).length, 4);
  assertStringIncludes(ch.cards[0].html, "Sales growth falls below");
  const loss = bottom(buildContext(sampleReport(sampleLossmakerPack())));
  assertStringIncludes(loss.verdict.lead, "Not yet");
  assertStringIncludes(loss.verdict.body, "tripped");
  // A tripped test is never described as close to its line, nor as holding the answer in place.
  assertEquals((loss.upshot ?? "").includes("stays the same while"), false);
  assertStringIncludes(loss.upshot ?? "", "back inside");
  assertEquals(loss.story[2].body.includes("closest to its line"), false);
  assertRefsLocal(ch);
  assertRefsLocal(loss);
  // EPS down while sales rose: the answer is no.
  const pack = sampleApplePack();
  pack.annual[pack.annual.length - 1].eps_diluted = 5.33;
  const down = bottom(buildContext(sampleReport(pack)));
  assertStringIncludes(down.verdict.lead, "Not in fiscal 2025");
  assertEquals(down.story[0].lead.includes("yes"), false);
});

Deno.test("sources: table with licences first, coverage, tags and method", () => {
  const ch = sources(apple());
  assertEquals(ch.cards[0].title, "Where the data comes from");
  assertEquals(ch.cards[0].span2, true);
  assertStringIncludes(ch.cards[0].html, "CC BY 4.0");
  assertStringIncludes(ch.cards[0].html, ">Licence<");
  assertEquals(ch.story.length, 0);
  assertEquals(ch.upshot, null);
  assertStringIncludes(ch.cards[1].html, "Closing price on the filing date");
  assertStringIncludes(ch.cards[2].html, "us-gaap:GrossProfit");
  assertStringIncludes(ch.cards[3].html, "discount rate 9.5%");
});

function assert(v: boolean) {
  assertEquals(v, true);
}

function assertRefsLocal(ch: Chapter): void {
  assertEquals(localRefProblems(ch), []);
}

Deno.test("events: filings after the as-of date or older than 12 months are left out", () => {
  const pack = sampleApplePack();
  pack.filings = [
    ...pack.filings,
    { form: "8-K", filing_date: "2025-12-01", accession: "late", items: "5.02" },
    { form: "8-K", filing_date: "2024-06-01", accession: "old", items: "8.01" },
  ];
  const ch = events(buildContext(sampleReport(pack)));
  assertStringIncludes(ch.verdict.lead, "10 filings in the 12 months to 31 Oct 2025");
  assertEquals(ch.cards[0].html.includes("1 Dec 2025"), false);
  assertEquals(ch.cards[0].html.includes("1 Jun 2024"), false);
});
