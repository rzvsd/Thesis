import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.13";
import { computeMonitorFreshness, summarizeMonitorState } from "./monitor.ts";
import { deepDiveFixture } from "./testing/report_fixture.ts";

const asOf = "2026-11-20T12:00:00.000Z";
const daysAgo = (days: number) => new Date(Date.parse(asOf) - days * 86_400_000).toISOString();

Deno.test("computeMonitorFreshness: fresh report is current with full score", () => {
  const result = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: asOf,
    materialEventsCount: 0,
    unreviewedEventsCount: 0,
  });
  assertEquals(result.freshnessState, "current");
  assertEquals(result.freshnessScore, 1);
  assertEquals(result.freshnessReason, "Deep Dive is fresh and no material events are waiting for review.");
});

Deno.test("computeMonitorFreshness: aging, stale and no baseline", () => {
  const aging = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: daysAgo(20),
    materialEventsCount: 1.9,
    unreviewedEventsCount: 1,
  });
  assertEquals(aging.freshnessState, "aging");
  assertEquals(aging.materialEventsCount, 1);
  assertEquals(aging.freshnessReason, "Deep Dive is 20 days old with 1 unreviewed material event(s).");
  assertAlmostEquals(aging.freshnessScore, 1 - (20 / 90) * 0.55 - (1 / 6) * 0.35, 1e-9);

  const stale = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: daysAgo(50),
    materialEventsCount: 0,
    unreviewedEventsCount: 0,
  });
  assertEquals(stale.freshnessState, "stale");
  assertEquals(stale.freshnessReason, "Deep Dive is 50 days old and now stale.");

  const eventsStale = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: daysAgo(1),
    materialEventsCount: 3,
    unreviewedEventsCount: 3,
  });
  assertEquals(eventsStale.freshnessReason, "3 material event(s) remain unreviewed.");

  const none = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: "not a date",
    materialEventsCount: -2,
    unreviewedEventsCount: 0,
    fallbackReason: "fallback",
  });
  assertEquals(none.freshnessState, "stale");
  assertEquals(none.freshnessReason, "fallback");
  assertEquals(none.lastDeepDiveAt, undefined);
  assertEquals(none.materialEventsCount, 0);
  assertAlmostEquals(none.freshnessScore, 0.45, 1e-9);
});

Deno.test("computeMonitorFreshness: recent kill-switch trigger wins", () => {
  const triggered = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: asOf,
    materialEventsCount: 0,
    unreviewedEventsCount: 0,
    killSwitchTriggeredAt: daysAgo(3),
  });
  assertEquals(triggered.freshnessState, "triggered");
  assertEquals(
    triggered.freshnessReason,
    "Kill-switch conditions fired recently and 1 material event(s) require review.",
  );
  assertAlmostEquals(triggered.freshnessScore, 0.8, 1e-9);

  const old = computeMonitorFreshness({
    asOfIso: asOf,
    lastDeepDiveAt: asOf,
    materialEventsCount: 0,
    unreviewedEventsCount: 0,
    killSwitchTriggeredAt: daysAgo(30),
  });
  assertEquals(old.freshnessState, "current");
});

Deno.test("summarizeMonitorState covers each state", () => {
  assertEquals(summarizeMonitorState(deepDiveFixture({ generated_at: asOf }), asOf), {
    state: "improved",
    reason: "Signal and drift are both supportive of the thesis direction.",
    score: 0.7,
  });
  assertEquals(
    summarizeMonitorState(deepDiveFixture({ generated_at: daysAgo(20) }), asOf).state,
    "unresolved",
  );
  assertEquals(
    summarizeMonitorState(
      deepDiveFixture({ generated_at: asOf, trust_metadata: { contradictions: [{}] } }),
      asOf,
    ).reason,
    "Evidence is conflicting and needs review.",
  );
  assertEquals(
    summarizeMonitorState(
      deepDiveFixture({ generated_at: asOf, signal: { value: "neutral" }, confidence: { score: 3 } }),
      asOf,
    ),
    {
      state: "intact",
      reason: "Latest evidence remains broadly consistent with the prior thesis.",
      score: 1,
    },
  );
  assertEquals(
    summarizeMonitorState(
      deepDiveFixture({
        generated_at: asOf,
        signal: { value: "neutral" },
        trust_metadata: { thesis_drift: { summary: "Margins Weakened" } },
      }),
      asOf,
    ).state,
    "weakened",
  );
  assertEquals(
    summarizeMonitorState(
      deepDiveFixture({
        generated_at: asOf,
        signal: { value: "positive" },
        confidence: {},
        trust_metadata: { thesis_drift: { status: "unavailable" } },
      }),
      asOf,
    ),
    {
      state: "intact",
      reason: "Latest evidence remains broadly consistent with the prior thesis.",
      score: 0.5,
    },
  );
});
