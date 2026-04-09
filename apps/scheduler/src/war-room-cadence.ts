export type WarRoomCadenceMinutes = 15 | 30;

export type WarRoomCycleOutcome = "success" | "failure" | "timeout";

export interface WarRoomCycleObservation {
  warRoomId: string;
  outcome: WarRoomCycleOutcome;
  lagMinutes: number;
  runtimeMinutes: number;
}

export interface WarRoomCadenceState {
  cadenceMinutes: WarRoomCadenceMinutes;
  consecutiveFailureTimeouts: number;
  consecutiveLagBreaches: number;
  consecutiveRuntimeBreaches: number;
  consecutiveHealthyCycles: number;
}

export interface WarRoomCadenceDecision {
  warRoomId: string;
  cadenceMinutes: WarRoomCadenceMinutes;
  state: WarRoomCadenceState;
  changed: boolean;
  reason:
    | "initial"
    | "steady"
    | "fallback_failure_timeout"
    | "fallback_lag"
    | "fallback_runtime"
    | "recovered";
}

const DEFAULT_CADENCE_MINUTES: WarRoomCadenceMinutes = 15;
const FALLBACK_CADENCE_MINUTES: WarRoomCadenceMinutes = 30;
const FALLBACK_STREAK = 2;
const RECOVERY_STREAK = 3;

export function createWarRoomCadenceState(
  cadenceMinutes: WarRoomCadenceMinutes = DEFAULT_CADENCE_MINUTES
): WarRoomCadenceState {
  return {
    cadenceMinutes,
    consecutiveFailureTimeouts: 0,
    consecutiveLagBreaches: 0,
    consecutiveRuntimeBreaches: 0,
    consecutiveHealthyCycles: 0
  };
}

export class WarRoomCadenceEvaluator {
  private readonly states = new Map<string, WarRoomCadenceState>();

  evaluate(observation: WarRoomCycleObservation): WarRoomCadenceDecision {
    const warRoomId = normalizeWarRoomId(observation.warRoomId);
    const previousState = this.states.get(warRoomId);
    const nextState = evaluateWarRoomCadenceState(previousState, observation);

    this.states.set(warRoomId, nextState.state);
    return nextState;
  }

  getState(warRoomId: string): WarRoomCadenceState | undefined {
    return this.states.get(normalizeWarRoomId(warRoomId));
  }

  reset(warRoomId?: string): void {
    if (warRoomId === undefined) {
      this.states.clear();
      return;
    }

    this.states.delete(normalizeWarRoomId(warRoomId));
  }
}

export function evaluateWarRoomCadenceState(
  previousState: WarRoomCadenceState | undefined,
  observation: WarRoomCycleObservation
): WarRoomCadenceDecision {
  const warRoomId = normalizeWarRoomId(observation.warRoomId);
  const safeLagMinutes = normalizeNumber(observation.lagMinutes);
  const safeRuntimeMinutes = normalizeNumber(observation.runtimeMinutes);
  const state = previousState ?? createWarRoomCadenceState();

  const isFailureTimeout = observation.outcome === "failure" || observation.outcome === "timeout";
  const isLagBreached = safeLagMinutes >= 20;
  const isRuntimeBreached = safeRuntimeMinutes > 12;
  const isHealthy =
    observation.outcome === "success" && safeLagMinutes <= 10 && safeRuntimeMinutes <= 8;

  const nextState: WarRoomCadenceState = {
    cadenceMinutes: state.cadenceMinutes,
    consecutiveFailureTimeouts: isFailureTimeout ? state.consecutiveFailureTimeouts + 1 : 0,
    consecutiveLagBreaches: isLagBreached ? state.consecutiveLagBreaches + 1 : 0,
    consecutiveRuntimeBreaches: isRuntimeBreached ? state.consecutiveRuntimeBreaches + 1 : 0,
    consecutiveHealthyCycles: isHealthy ? state.consecutiveHealthyCycles + 1 : 0
  };

  let reason: WarRoomCadenceDecision["reason"] = previousState ? "steady" : "initial";

  if (
    nextState.consecutiveFailureTimeouts >= FALLBACK_STREAK ||
    nextState.consecutiveLagBreaches >= FALLBACK_STREAK ||
    nextState.consecutiveRuntimeBreaches >= FALLBACK_STREAK
  ) {
    nextState.cadenceMinutes = FALLBACK_CADENCE_MINUTES;
    if (nextState.consecutiveFailureTimeouts >= FALLBACK_STREAK) {
      reason = "fallback_failure_timeout";
    } else if (nextState.consecutiveLagBreaches >= FALLBACK_STREAK) {
      reason = "fallback_lag";
    } else {
      reason = "fallback_runtime";
    }
  } else if (
    state.cadenceMinutes === FALLBACK_CADENCE_MINUTES &&
    nextState.consecutiveHealthyCycles >= RECOVERY_STREAK
  ) {
    nextState.cadenceMinutes = DEFAULT_CADENCE_MINUTES;
    reason = "recovered";
  }

  return {
    warRoomId,
    cadenceMinutes: nextState.cadenceMinutes,
    state: nextState,
    changed: nextState.cadenceMinutes !== state.cadenceMinutes,
    reason
  };
}

function normalizeWarRoomId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("warRoomId is required.");
  }
  return normalized;
}

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
