// Ported from apps/product-api/tests/earnings-state-policy.test.ts, plus the war room evidence pack.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { buildEarningsEventStates } from "./earnings_state.ts";
import type { CalendarEventRecord, CallArtifact } from "./types.ts";
import { buildWarRoomEvidencePack, findEarningsState } from "./war_room.ts";

function event(overrides: Partial<CalendarEventRecord>): CalendarEventRecord {
  return {
    id: "event-1",
    ticker: "AAPL",
    eventType: "earnings",
    eventDate: "2026-08-01",
    eventTime: "after_market",
    provider: "calendar_partner",
    retrievedAt: "2026-07-31T12:00:00.000Z",
    timingState: "estimated",
    sourceState: "derived",
    sourceRef: {},
    reasonText: "",
    ...overrides,
  };
}

Deno.test("confirmed timing downgrades to estimated when source is not official or first-party", () => {
  const states = buildEarningsEventStates({
    asOf: "2026-08-01",
    events: [event({ timingState: "confirmed", sourceState: "derived" })],
    artifactsByTicker: new Map(),
  });
  assertEquals(states.length, 1);
  assertEquals(states[0].timing_state, "estimated");
  assertEquals(states[0].source_state, "derived");
  assertMatch(states[0].reason_text, /official or first-party/i);
});

Deno.test("confirmed timing remains confirmed when source is official", () => {
  const states = buildEarningsEventStates({
    asOf: "2026-08-01",
    events: [event({ timingState: "confirmed", sourceState: "official" })],
    artifactsByTicker: new Map(),
  });
  assertEquals(states[0].timing_state, "confirmed");
  assertEquals(states[0].source_state, "official");
});

const release: CallArtifact = {
  artifact_id: "art-1",
  ticker: "AAPL",
  artifact_type: "earnings_release",
  title: "Q3 results",
  source_url: "https://example.com/q3",
  source_domain: "example.com",
  published_at: "2026-08-01T21:00:00.000Z",
  retrieved_at: "2026-08-01T21:05:00.000Z",
  completeness_state: "complete",
  rights: {},
  metadata: {},
};

Deno.test("a release artifact promotes the state to actual and feeds the war room pack", () => {
  const states = buildEarningsEventStates({
    asOf: "2026-08-02",
    events: [event({}), event({ id: "event-2", eventDate: "2026-08-03", provider: "other" })],
    artifactsByTicker: new Map([["AAPL", [release]]]),
  });
  const state = findEarningsState(states, { ticker: "aapl", eventId: "event-1" });
  assert(state);
  assertEquals(state.timing_state, "actual");
  assertEquals(state.evidence_state, "release_artifact");
  assertEquals(state.conflict.has_conflict, true);
  const pack = buildWarRoomEvidencePack({ state, timeline: [] });
  assertEquals((pack.release_artifact as { artifact_id: string }).artifact_id, "art-1");
  assertEquals(
    (pack.baseline as { omission: { reason_code: string } }).omission.reason_code,
    "baseline_missing",
  );
  assertEquals(pack.transcript.available, false);
});
