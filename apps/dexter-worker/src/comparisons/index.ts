import type { CanonicalFinancialSnapshot } from "../../../../packages/contracts/src";

export type ComparableMetric =
  | "revenue"
  | "eps"
  | "net_income"
  | "operating_margin"
  | "free_cash_flow";

export interface MetricDelta {
  metric: ComparableMetric;
  current?: number;
  reference?: number;
  absolute_change?: number;
  percent_change?: number;
  direction: "up" | "down" | "flat" | "unavailable";
  missing_reason?: string;
}

export interface ComparisonBlock {
  qoq: MetricDelta[];
  yoy: MetricDelta[];
}

const metricOrder: readonly ComparableMetric[] = [
  "revenue",
  "eps",
  "net_income",
  "operating_margin",
  "free_cash_flow"
];

function selectMetricValue(
  snapshot: CanonicalFinancialSnapshot,
  metric: ComparableMetric
): number | undefined {
  if (metric === "eps") {
    return snapshot.data.eps ?? snapshot.data.eps_diluted;
  }

  return snapshot.data[metric];
}

function toMetricDelta(
  metric: ComparableMetric,
  latest: CanonicalFinancialSnapshot | undefined,
  reference: CanonicalFinancialSnapshot | undefined,
  referenceLabel: "qoq" | "yoy"
): MetricDelta {
  if (!latest || !reference) {
    return {
      metric,
      direction: "unavailable",
      missing_reason: referenceLabel === "qoq"
        ? "Prior-quarter snapshot missing."
        : "Year-ago-quarter snapshot missing."
    };
  }

  const current = selectMetricValue(latest, metric);
  const baseline = selectMetricValue(reference, metric);
  if (current === undefined || baseline === undefined) {
    return {
      metric,
      current,
      reference: baseline,
      direction: "unavailable",
      missing_reason: `Missing ${metric} in ${
        current === undefined ? "latest" : "reference"
      } snapshot.`
    };
  }

  const absoluteChange = current - baseline;
  const percentChange = baseline === 0
    ? undefined
    : (absoluteChange / Math.abs(baseline)) * 100;
  const direction = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat";

  return {
    metric,
    current,
    reference: baseline,
    absolute_change: absoluteChange,
    percent_change: percentChange,
    direction
  };
}

export function buildComparisons(input: {
  latest?: CanonicalFinancialSnapshot;
  priorQuarter?: CanonicalFinancialSnapshot;
  yearAgo?: CanonicalFinancialSnapshot;
}): ComparisonBlock {
  return {
    qoq: metricOrder.map((metric) =>
      toMetricDelta(metric, input.latest, input.priorQuarter, "qoq")),
    yoy: metricOrder.map((metric) =>
      toMetricDelta(metric, input.latest, input.yearAgo, "yoy"))
  };
}
