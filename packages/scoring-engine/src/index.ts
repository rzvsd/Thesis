export interface ScoreResult {
  value: "no_signal";
  reasons: string[];
}

export function createNoSignalResult(reason: string): ScoreResult {
  return {
    value: "no_signal",
    reasons: [reason]
  };
}
