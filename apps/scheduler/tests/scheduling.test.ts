import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCycleWindowForRun,
  computeNextScheduledRun,
  computeTestModeCycleWindow,
  getZonedDateTimeParts
} from "../src/scheduling";

test("computeNextScheduledRun returns a future 06:30 America/New_York run", () => {
  const now = new Date("2026-03-21T10:00:00.000Z");
  const next = computeNextScheduledRun(now, "America/New_York", 6, 30);

  assert.ok(next.getTime() > now.getTime());
  const local = getZonedDateTimeParts(next, "America/New_York");
  assert.equal(local.hour, 6);
  assert.equal(local.minute, 30);
});

test("computeCycleWindowForRun anchors previous boundary at same local wall-clock", () => {
  const runAt = new Date("2026-03-21T10:30:00.000Z");
  const window = computeCycleWindowForRun(runAt, "America/New_York", 6, 30);

  const startLocal = getZonedDateTimeParts(new Date(window.cycleStart), "America/New_York");
  const endLocal = getZonedDateTimeParts(new Date(window.cycleEnd), "America/New_York");
  assert.equal(startLocal.hour, 6);
  assert.equal(startLocal.minute, 30);
  assert.equal(endLocal.hour, 6);
  assert.equal(endLocal.minute, 30);
});

test("computeTestModeCycleWindow returns a 24h lookback window", () => {
  const runAt = new Date("2026-03-21T12:00:00.000Z");
  const window = computeTestModeCycleWindow(runAt);
  assert.equal(window.cycleEnd, "2026-03-21T12:00:00.000Z");
  assert.equal(window.cycleStart, "2026-03-20T12:00:00.000Z");
});
