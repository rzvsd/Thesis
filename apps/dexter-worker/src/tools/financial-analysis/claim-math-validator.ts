import type { FinancialAnalysisToolData } from "./financial-analysis-tool";

export interface ClaimMathValidation {
  ok: boolean;
  mismatches: Array<{
    metric: FinancialAnalysisToolData["metrics"][number]["metric"];
    expected: number;
    actual: number;
    tolerance: number;
  }>;
}

export function validateMetricClaims(input: {
  expected: Partial<Record<FinancialAnalysisToolData["metrics"][number]["metric"], number>>;
  actual: FinancialAnalysisToolData;
  tolerance?: number;
}): ClaimMathValidation {
  const tolerance = input.tolerance ?? 0.25;
  const mismatches: ClaimMathValidation["mismatches"] = [];
  for (const metric of input.actual.metrics) {
    const expected = input.expected[metric.metric];
    if (
      typeof expected === "number" &&
      typeof metric.value === "number" &&
      Math.abs(expected - metric.value) > tolerance
    ) {
      mismatches.push({
        metric: metric.metric,
        expected,
        actual: metric.value,
        tolerance
      });
    }
  }
  return {
    ok: mismatches.length === 0,
    mismatches
  };
}
