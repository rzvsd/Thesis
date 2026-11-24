import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import {
  bigQuestion,
  checkStatus,
  dateText,
  monthOf,
  payoutText,
  shareSeries,
  shortName,
  tightest,
  tightestSentence,
} from "./story.ts";
import { buildContext } from "./render.ts";
import { sampleApplePack, sampleLossmakerPack, sampleReport } from "./testdata_pack.ts";
import type { Check } from "./derive.ts";

Deno.test("small text helpers", () => {
  assertEquals(shortName("Apple Inc."), "Apple");
  assertEquals(shortName("Example Bank Corp"), "Example Bank");
  assertEquals(shortName("Inc."), "Inc.");
  assertEquals(dateText("2025-10-31"), "31 Oct 2025");
  assertEquals(dateText("junk"), "");
  assertEquals(monthOf("0927"), "September");
  assertEquals(monthOf(null), null);
  assertEquals(payoutText(1.0), "about all of the cash it made");
  assertStringIncludes(payoutText(1.2), "more than it made");
  assertStringIncludes(payoutText(0.5), "the rest stayed in the business");
  assertEquals(shareSeries([15e9]).unit, "shares_b");
  assertEquals(shareSeries([48e6]).values, [48]);
  assertEquals(shareSeries([48e6]).text(48e6), "48.0M");
});

Deno.test("checkStatus and tightest", () => {
  const base: Check = {
    key: "op_margin",
    label: "Operating margin stays above 10.0%",
    current: 11,
    threshold: 10,
    unit: "pct",
    direction: "above",
    passes: true,
    why: "",
  };
  assertEquals(checkStatus(base), "watch");
  assertEquals(checkStatus({ ...base, current: 20 }), "ok");
  assertEquals(checkStatus({ ...base, current: 5, passes: false }), "bad");
  assertEquals(checkStatus({ ...base, current: null, passes: null }), "none");
  const c = buildContext(sampleReport(sampleApplePack()));
  // The margin line is anchored to earlier years, so it no longer wins by a fixed 3 points.
  assertEquals(tightest(c.d)?.key, "share_count");
  // The share-count line is 1%, so its Watch band is half a point.
  assertEquals(
    checkStatus({ ...base, key: "share_count", current: 0, threshold: 1, direction: "below" }),
    "ok",
  );
  assertEquals(
    checkStatus({ ...base, key: "share_count", current: 0.7, threshold: 1, direction: "below" }),
    "watch",
  );
  assertStringIncludes(tightestSentence(c), "in the Risks chapter");
  assertEquals(tightestSentence(c, true).includes("Risks chapter"), false);
});

Deno.test("the big question follows the data", () => {
  const apple = buildContext(sampleReport(sampleApplePack()));
  assertStringIncludes(bigQuestion(apple), "earnings per share growing faster than sales");
  const loss = buildContext(sampleReport(sampleLossmakerPack()));
  assertStringIncludes(bigQuestion(loss), "into a profit");
});
