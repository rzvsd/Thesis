export type FearGreedLabel =
  | "extreme_fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme_greed";

export interface SignalInput {
  input_name: string;
  provider: string;
  available: boolean;
  normalized_score?: number;
  raw_value?: number;
  retrieved_at?: string;
  notes?: string;
}

export interface WeightedSignalInput extends SignalInput {
  weight: number;
}

export interface CompositeScoreResult {
  score: number;
  label: FearGreedLabel;
  sub_scores: WeightedSignalInput[];
  missing_inputs: string[];
}

export function toFearGreedLabel(score: number): FearGreedLabel {
  if (score <= 20) {
    return "extreme_fear";
  }
  if (score <= 40) {
    return "fear";
  }
  if (score <= 60) {
    return "neutral";
  }
  if (score <= 80) {
    return "greed";
  }
  return "extreme_greed";
}

export function normalizeLinearRange(
  value: number,
  lowerBound: number,
  upperBound: number,
  invert = false
): number {
  const denominator = upperBound - lowerBound;
  if (denominator <= 0) {
    return 50;
  }

  const ratio = (value - lowerBound) / denominator;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const normalized = invert ? 1 - clampedRatio : clampedRatio;
  return Number((normalized * 100).toFixed(2));
}

export function computeFearGreedComposite(
  inputs: SignalInput[],
  minimumAvailableInputs = 3
): CompositeScoreResult {
  const availableInputs = inputs.filter((entry) =>
    entry.available &&
    typeof entry.normalized_score === "number" &&
    Number.isFinite(entry.normalized_score)
  );

  if (availableInputs.length < minimumAvailableInputs) {
    throw new Error(
      `Insufficient available inputs: ${availableInputs.length} available, minimum ${minimumAvailableInputs} required`
    );
  }

  const weight = Number((1 / availableInputs.length).toFixed(8));
  const availableByName = new Set(availableInputs.map((entry) => entry.input_name));

  const weighted = inputs.map((entry): WeightedSignalInput => {
    if (!availableByName.has(entry.input_name)) {
      return {
        ...entry,
        weight: 0
      };
    }

    return {
      ...entry,
      weight
    };
  });

  const score = Number(
    weighted
      .filter((entry) => entry.weight > 0 && typeof entry.normalized_score === "number")
      .reduce((acc, entry) => acc + (entry.normalized_score as number) * entry.weight, 0)
      .toFixed(2)
  );

  return {
    score,
    label: toFearGreedLabel(score),
    sub_scores: weighted,
    missing_inputs: weighted
      .filter((entry) => !entry.available)
      .map((entry) => entry.input_name)
  };
}
