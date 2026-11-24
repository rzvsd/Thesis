import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { business, owners, summary } from "./chapters_a.ts";
import { buildContext } from "./render.ts";
import { type Chapter, localRefProblems } from "./story.ts";
import { sampleApplePack, sampleBankPack, sampleLossmakerPack, sampleReport } from "./testdata_pack.ts";

function assertRefsLocal(ch: Chapter): void {
  assertEquals(localRefProblems(ch), []);
}

const apple = () => buildContext(sampleReport(sampleApplePack()));

Deno.test("summary: verdict, three paragraphs, scorecard with absolute bands, changes, upshot", () => {
  const ch = summary(apple());
  assertEquals(ch.id, "summary");
  assertEquals(ch.story.length, 3);
  assertStringIncludes(ch.verdict.lead, "highly profitable");
  assertStringIncludes(ch.verdict.body, "$416.2B");
  assertStringIncludes(ch.verdict.body, "model range of $101 to $157");
  const scores = ch.cards.find((c) => c.id === "scores");
  assertStringIncludes(scores?.sub ?? "", "Absolute 0 to 10 bands");
  assertStringIncludes(scores?.table ?? "", "Scorecard inputs");
  assertEquals((scores?.html.match(/class="mtr"/g) ?? []).length, 4);
  assertStringIncludes(ch.cards.find((c) => c.id === "changes")?.html ?? "", "Sales up 6.4% to $416.2B");
  assertStringIncludes(ch.story[2].body, "So the big question is this. Can Apple");
  assertStringIncludes(ch.upshot ?? "", "6.1% a year");
  assertRefsLocal(ch);
});

Deno.test("summary words follow the data: loss-maker and dilution", () => {
  const ch = summary(buildContext(sampleReport(sampleLossmakerPack())));
  assertStringIncludes(ch.verdict.lead, "loss-making business with fast growth");
  assertStringIncludes(ch.verdict.body, "no range is shown");
  assertStringIncludes(ch.upshot ?? "", "already tripped");
  assertRefsLocal(ch);
});

Deno.test("business: sales and margins, segments not seen yet; bank has no gross margin", () => {
  const ch = business(apple());
  assertEquals(ch.cards.filter((c) => c.notseen).length, 2);
  assertStringIncludes(ch.verdict.lead, "47 cents");
  assertStringIncludes(ch.cards[1].title ?? "", "highest in 11 years");
  assertRefsLocal(ch);
  const bank = business(buildContext(sampleReport(sampleBankPack())));
  assertStringIncludes(bank.verdict.body, "do not tag gross profit");
  assertEquals(bank.cards[1].html.includes("Gross margin"), false);
  assertRefsLocal(bank);
});

Deno.test("owners: buybacks against dilution", () => {
  const ch = owners(apple());
  assertStringIncludes(ch.verdict.lead, "Buybacks cut the share count 34% since fiscal 2015");
  assertStringIncludes(ch.story[1].body, "about all of the cash it made");
  assertRefsLocal(ch);
  const loss = owners(buildContext(sampleReport(sampleLossmakerPack())));
  assertStringIncludes(loss.verdict.lead, "rose");
  assertEquals(ch.cards.map((c) => c.id), ["own-five", "own-holders", "own-insiders", "own-board"]);
  assertRefsLocal(loss);
  // No buyback data: the share count fell, but buybacks are not claimed, and a missing series is not $0.
  const pack = sampleApplePack();
  for (const r of pack.annual) delete r.buybacks;
  const nobb = owners(buildContext(sampleReport(pack)));
  assertStringIncludes(nobb.verdict.lead, "The share count fell 34% since fiscal 2015");
  assertEquals(nobb.story.some((p) => p.body.includes("Buybacks were $0")), false);
  assertStringIncludes(nobb.story[1].body, "Buybacks are not disclosed for every year");
  assertRefsLocal(nobb);
});
