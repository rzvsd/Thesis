export function safeDivide(
  numerator?: number,
  denominator?: number
): number | undefined {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    Math.abs(denominator) <= 1e-9
  ) {
    return undefined;
  }
  return numerator / denominator;
}

export function percentChange(
  current?: number,
  prior?: number
): number | undefined {
  const ratio = safeDivide(
    typeof current === "number" && typeof prior === "number" ? current - prior : undefined,
    typeof prior === "number" ? Math.abs(prior) : undefined
  );
  return typeof ratio === "number" ? ratio * 100 : undefined;
}

export function percentRatio(
  numerator?: number,
  denominator?: number
): number | undefined {
  const ratio = safeDivide(numerator, denominator);
  return typeof ratio === "number" ? ratio * 100 : undefined;
}
