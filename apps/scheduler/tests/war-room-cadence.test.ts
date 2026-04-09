import assert from "node:assert/strict";
import test from "node:test";

import {
  WarRoomCadenceEvaluator,
  type WarRoomCycleObservation
} from "../src/war-room-cadence";

function cycle(
  warRoomId: string,
  outcome: WarRoomCycleObservation["outcome"],
  lagMinutes: number,
  runtimeMinutes: number
): WarRoomCycleObservation {
  return {
    warRoomId,
    outcome,
    lagMinutes,
    runtimeMinutes
  };
}

test("war room cadence defaults to 15 minutes and stays isolated per war_room_id", () => {
  const evaluator = new WarRoomCadenceEvaluator();

  const first = evaluator.evaluate(cycle("war-room-a", "success", 5, 6));
  assert.equal(first.cadenceMinutes, 15);
  assert.equal(first.reason, "initial");

  const second = evaluator.evaluate(cycle("war-room-b", "failure", 25, 14));
  assert.equal(second.cadenceMinutes, 15);
  assert.equal(second.reason, "initial");

  const firstAgain = evaluator.evaluate(cycle("war-room-a", "failure", 25, 14));
  assert.equal(firstAgain.cadenceMinutes, 15);
  assert.equal(firstAgain.state.consecutiveFailureTimeouts, 1);
  assert.equal(firstAgain.reason, "steady");
  assert.equal(evaluator.getState("war-room-b")?.cadenceMinutes, 15);
});

test("war room cadence falls back after two consecutive failures or timeouts", () => {
  const evaluator = new WarRoomCadenceEvaluator();

  const first = evaluator.evaluate(cycle("war-room-fail", "failure", 5, 6));
  assert.equal(first.cadenceMinutes, 15);
  assert.equal(first.state.consecutiveFailureTimeouts, 1);

  const second = evaluator.evaluate(cycle("war-room-fail", "timeout", 5, 6));
  assert.equal(second.cadenceMinutes, 30);
  assert.equal(second.reason, "fallback_failure_timeout");
  assert.equal(second.state.consecutiveFailureTimeouts, 2);
});

test("war room cadence falls back after two consecutive lag breaches", () => {
  const evaluator = new WarRoomCadenceEvaluator();

  const first = evaluator.evaluate(cycle("war-room-lag", "success", 20, 6));
  assert.equal(first.cadenceMinutes, 15);
  assert.equal(first.state.consecutiveLagBreaches, 1);

  const second = evaluator.evaluate(cycle("war-room-lag", "success", 21, 6));
  assert.equal(second.cadenceMinutes, 30);
  assert.equal(second.reason, "fallback_lag");
  assert.equal(second.state.consecutiveLagBreaches, 2);
});

test("war room cadence falls back after two consecutive runtime breaches", () => {
  const evaluator = new WarRoomCadenceEvaluator();

  const first = evaluator.evaluate(cycle("war-room-runtime", "success", 6, 13));
  assert.equal(first.cadenceMinutes, 15);
  assert.equal(first.state.consecutiveRuntimeBreaches, 1);

  const second = evaluator.evaluate(cycle("war-room-runtime", "success", 6, 14));
  assert.equal(second.cadenceMinutes, 30);
  assert.equal(second.reason, "fallback_runtime");
  assert.equal(second.state.consecutiveRuntimeBreaches, 2);
});

test("war room cadence recovers to 15 after three consecutive healthy cycles", () => {
  const evaluator = new WarRoomCadenceEvaluator();

  evaluator.evaluate(cycle("war-room-recover", "failure", 25, 14));
  const fallback = evaluator.evaluate(cycle("war-room-recover", "timeout", 25, 14));
  assert.equal(fallback.cadenceMinutes, 30);

  const healthyOne = evaluator.evaluate(cycle("war-room-recover", "success", 10, 8));
  assert.equal(healthyOne.cadenceMinutes, 30);
  assert.equal(healthyOne.state.consecutiveHealthyCycles, 1);

  const healthyTwo = evaluator.evaluate(cycle("war-room-recover", "success", 9, 8));
  assert.equal(healthyTwo.cadenceMinutes, 30);
  assert.equal(healthyTwo.state.consecutiveHealthyCycles, 2);

  const healthyThree = evaluator.evaluate(cycle("war-room-recover", "success", 8, 8));
  assert.equal(healthyThree.cadenceMinutes, 15);
  assert.equal(healthyThree.reason, "recovered");
  assert.equal(healthyThree.state.consecutiveHealthyCycles, 3);
});
