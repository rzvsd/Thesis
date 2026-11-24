import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { action, countries, links } from "./chapters_later.ts";
import { buildContext } from "./render.ts";
import { type Chapter, localRefProblems } from "./story.ts";
import { sampleApplePack, sampleReport } from "./testdata_pack.ts";

Deno.test("later-phase chapters keep their place with Not seen yet cards and no numbers invented", () => {
  const c = buildContext(sampleReport(sampleApplePack()));
  for (const ch of [countries(c), links(c), action(c)]) {
    assertEquals(ch.cards.every((x) => x.notseen), true);
    assertEquals(ch.story.length >= 1, true);
    assertEquals(typeof ch.upshot, "string");
    assertStringIncludes(ch.verdict.lead, "Not seen yet");
    assertRefsLocal(ch);
  }
  assertStringIncludes(action(c).cards[0].html, "no licensed price data for this date");
});

Deno.test("links shows legacy relationship names only, escaped", () => {
  const c = buildContext({
    ticker: "AAPL",
    name_relationships: [{ target_ticker: "<TSM>", relationship_type: "supplier", confidence: 0.9 }],
  });
  const ch = links(c);
  assertEquals(ch.cards[0].id, "lk-names");
  assertStringIncludes(ch.cards[0].html, "&lt;TSM&gt;");
  assertEquals(ch.cards[0].html.includes("0.9"), false);
  assertRefsLocal(ch);
});

function assertRefsLocal(ch: Chapter): void {
  assertEquals(localRefProblems(ch), []);
}
