import assert from "node:assert/strict";
import test from "node:test";

import { buildEarningsEventStates } from "../src/earnings-state";
import type { CalendarEventRecord } from "../src/types";

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
    ...overrides
  };
}

test("confirmed timing downgrades to estimated when source is not official or first-party", () => {
  const states = buildEarningsEventStates({
    asOf: "2026-08-01",
    events: [
      event({
        timingState: "confirmed",
        sourceState: "derived",
        reasonText: ""
      })
    ],
    artifactsByTicker: new Map()
  });
  assert.equal(states.length, 1);
  assert.equal(states[0]?.timing_state, "estimated");
  assert.equal(states[0]?.source_state, "derived");
  assert.match(states[0]?.reason_text ?? "", /official or first-party/i);
});

test("confirmed timing remains confirmed when source is official", () => {
  const states = buildEarningsEventStates({
    asOf: "2026-08-01",
    events: [
      event({
        timingState: "confirmed",
        sourceState: "official",
        reasonText: ""
      })
    ],
    artifactsByTicker: new Map()
  });
  assert.equal(states.length, 1);
  assert.equal(states[0]?.timing_state, "confirmed");
  assert.equal(states[0]?.source_state, "official");
});
