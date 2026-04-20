import type {
  CanonicalFinancialSnapshot,
  FinancialAnalysisBlock,
  FinancialDerivedMetric,
  FinancialHistoryRow,
  FinancialMetricDirection,
  FinancialOmission
} from "../../../../packages/contracts/src";

const MIN_ANNUAL_HISTORY_POINTS = 3;
const MAX_ANNUAL_HISTORY_ROWS = 5;
const MAX_QUARTERLY_HISTORY_ROWS = 6;
const EPSILON = 1e-6;

interface MetricSeriesPoint {
  fiscalYear: number;
  value: number;
}

function toHistoryRow(snapshot: CanonicalFinancialSnapshot): FinancialHistoryRow {
  return {
    period: snapshot.period,
    period_type: snapshot.period_type,
    fiscal_year: snapshot.fiscal_year,
    fiscal_quarter: snapshot.fiscal_quarter,
    revenue: snapshot.data.revenue,
    gross_margin: snapshot.data.gross_margin,
    operating_margin: snapshot.data.operating_margin,
    net_income: snapshot.data.net_income,
    free_cash_flow: snapshot.data.free_cash_flow,
    debt_total: snapshot.data.debt_total,
    cash_and_equivalents: snapshot.data.cash_and_equivalents,
    shares_outstanding: snapshot.data.shares_outstanding
  };
}

function sortAnnualDesc(snapshots: CanonicalFinancialSnapshot[]): CanonicalFinancialSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.period_type === "annual")
    .sort((left, right) => right.fiscal_year - left.fiscal_year);
}

function sortQuarterlyDesc(snapshots: CanonicalFinancialSnapshot[]): CanonicalFinancialSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.period_type === "quarterly")
    .sort((left, right) => {
      const yearDiff = right.fiscal_year - left.fiscal_year;
      if (yearDiff !== 0) {
        return yearDiff;
      }
      return (right.fiscal_quarter ?? 0) - (left.fiscal_quarter ?? 0);
    });
}

function metricDirectionFromValue(
  value: number,
  options: {
    betterWhenLower?: boolean;
    neutralBand?: number;
  } = {}
): FinancialMetricDirection {
  const neutralBand = options.neutralBand ?? EPSILON;
  if (Math.abs(value) <= neutralBand) {
    return "flat";
  }

  if (options.betterWhenLower) {
    return value < 0 ? "improving" : "deteriorating";
  }
  return value > 0 ? "improving" : "deteriorating";
}

function pickSeries(
  annualSnapshotsAsc: CanonicalFinancialSnapshot[],
  selector: (snapshot: CanonicalFinancialSnapshot) => number | undefined
): MetricSeriesPoint[] {
  return annualSnapshotsAsc.flatMap((snapshot) => {
    const value = selector(snapshot);
    if (value === undefined || Number.isNaN(value)) {
      return [];
    }
    return [{ fiscalYear: snapshot.fiscal_year, value }];
  });
}

function computeCagr(series: MetricSeriesPoint[]): number | undefined {
  if (series.length < 2) {
    return undefined;
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last || first.value <= 0 || last.value <= 0) {
    return undefined;
  }

  const years = Math.max(last.fiscalYear - first.fiscalYear, 1);
  const ratio = last.value / first.value;
  return (Math.pow(ratio, 1 / years) - 1) * 100;
}

function computeDelta(series: MetricSeriesPoint[]): number | undefined {
  if (series.length < 2) {
    return undefined;
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) {
    return undefined;
  }
  return last.value - first.value;
}

function computePercentDelta(series: MetricSeriesPoint[]): number | undefined {
  if (series.length < 2) {
    return undefined;
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last || Math.abs(first.value) <= EPSILON) {
    return undefined;
  }
  return ((last.value - first.value) / Math.abs(first.value)) * 100;
}

function availableMetric(input: {
  key: string;
  label: string;
  value: number;
  unit: FinancialDerivedMetric["unit"];
  direction: FinancialMetricDirection;
  note?: string;
}): FinancialDerivedMetric {
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    unit: input.unit,
    status: "available",
    direction: input.direction,
    note: input.note
  };
}

function omittedMetric(input: {
  key: string;
  label: string;
  unit: FinancialDerivedMetric["unit"];
  note: string;
}): FinancialDerivedMetric {
  return {
    key: input.key,
    label: input.label,
    unit: input.unit,
    status: "omitted",
    direction: "unavailable",
    note: input.note
  };
}

function addOmission(
  omissions: Map<string, FinancialOmission>,
  omission: FinancialOmission
): void {
  if (!omissions.has(omission.code)) {
    omissions.set(omission.code, omission);
  }
}

function safeDivide(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (
    numerator === undefined ||
    denominator === undefined ||
    Number.isNaN(numerator) ||
    Number.isNaN(denominator) ||
    Math.abs(denominator) <= EPSILON
  ) {
    return undefined;
  }
  return numerator / denominator;
}

function latestAnnualSnapshot(
  annualSnapshotsDesc: CanonicalFinancialSnapshot[]
): CanonicalFinancialSnapshot | undefined {
  return annualSnapshotsDesc[0];
}

export function buildFinancialAnalysis(
  snapshots: CanonicalFinancialSnapshot[]
): FinancialAnalysisBlock {
  const annualSnapshotsDesc = sortAnnualDesc(snapshots);
  const quarterlySnapshotsDesc = sortQuarterlyDesc(snapshots);
  const annualSnapshotsAsc = [...annualSnapshotsDesc].reverse();
  const latestAnnual = latestAnnualSnapshot(annualSnapshotsDesc);
  const omissions = new Map<string, FinancialOmission>();
  const trendMetrics: FinancialDerivedMetric[] = [];
  const qualityMetrics: FinancialDerivedMetric[] = [];

  const annualHistory = annualSnapshotsDesc
    .slice(0, MAX_ANNUAL_HISTORY_ROWS)
    .map(toHistoryRow);
  const quarterlyHistory = quarterlySnapshotsDesc
    .slice(0, MAX_QUARTERLY_HISTORY_ROWS)
    .map(toHistoryRow);

  if (annualHistory.length < MIN_ANNUAL_HISTORY_POINTS) {
    addOmission(omissions, {
      code: "annual_history_insufficient",
      label: "Annual history is insufficient",
      reason: `Only ${annualHistory.length} annual snapshot(s) were available; at least ${MIN_ANNUAL_HISTORY_POINTS} are required for 3-5 year trend reliability.`,
      impacts: ["financial_statement_analysis", "valuation", "value_discipline"]
    });
  }

  const revenueSeries = pickSeries(annualSnapshotsAsc, (snapshot) => snapshot.data.revenue);
  const revenueCagr = computeCagr(revenueSeries);
  if (revenueCagr !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "revenue_cagr_3y_pct",
        label: "Revenue CAGR (3y)",
        value: revenueCagr,
        unit: "pct",
        direction: metricDirectionFromValue(revenueCagr)
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "revenue_cagr_3y_pct",
        label: "Revenue CAGR (3y)",
        unit: "pct",
        note: "Revenue CAGR requires at least two annual revenue points with positive values."
      })
    );
    addOmission(omissions, {
      code: "revenue_cagr_missing",
      label: "Revenue CAGR unavailable",
      reason: "Revenue CAGR could not be computed from annual snapshot history.",
      impacts: ["financial_statement_analysis", "valuation"]
    });
  }

  const grossMarginSeries = pickSeries(annualSnapshotsAsc, (snapshot) => snapshot.data.gross_margin);
  const grossMarginDelta = computeDelta(grossMarginSeries);
  if (grossMarginDelta !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "gross_margin_delta_3y_pp",
        label: "Gross margin change (3y)",
        value: grossMarginDelta,
        unit: "pct",
        direction: metricDirectionFromValue(grossMarginDelta)
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "gross_margin_delta_3y_pp",
        label: "Gross margin change (3y)",
        unit: "pct",
        note: "Gross-margin trend needs annual gross-margin values."
      })
    );
  }

  const operatingMarginSeries = pickSeries(
    annualSnapshotsAsc,
    (snapshot) => snapshot.data.operating_margin
  );
  const operatingMarginDelta = computeDelta(operatingMarginSeries);
  if (operatingMarginDelta !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "operating_margin_delta_3y_pp",
        label: "Operating margin change (3y)",
        value: operatingMarginDelta,
        unit: "pct",
        direction: metricDirectionFromValue(operatingMarginDelta)
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "operating_margin_delta_3y_pp",
        label: "Operating margin change (3y)",
        unit: "pct",
        note: "Operating-margin trend needs annual operating-margin values."
      })
    );
  }

  const fcfSeries = pickSeries(annualSnapshotsAsc, (snapshot) => snapshot.data.free_cash_flow);
  const fcfCagr = computeCagr(fcfSeries);
  if (fcfCagr !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "free_cash_flow_cagr_3y_pct",
        label: "Free cash flow CAGR (3y)",
        value: fcfCagr,
        unit: "pct",
        direction: metricDirectionFromValue(fcfCagr)
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "free_cash_flow_cagr_3y_pct",
        label: "Free cash flow CAGR (3y)",
        unit: "pct",
        note: "FCF CAGR requires at least two annual free-cash-flow points with positive values."
      })
    );
    addOmission(omissions, {
      code: "free_cash_flow_trend_missing",
      label: "Free cash flow trend unavailable",
      reason: "Annual free-cash-flow history is insufficient for a deterministic trend.",
      impacts: ["financial_statement_analysis", "valuation"]
    });
  }

  const debtSeries = pickSeries(annualSnapshotsAsc, (snapshot) => snapshot.data.debt_total);
  const debtChange = computeDelta(debtSeries);
  if (debtChange !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "debt_total_change_3y",
        label: "Debt total change (3y)",
        value: debtChange,
        unit: "currency",
        direction: metricDirectionFromValue(debtChange, { betterWhenLower: true })
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "debt_total_change_3y",
        label: "Debt total change (3y)",
        unit: "currency",
        note: "Debt trend requires annual debt_total values."
      })
    );
  }

  const cashSeries = pickSeries(annualSnapshotsAsc, (snapshot) => snapshot.data.cash_and_equivalents);
  const cashChange = computeDelta(cashSeries);
  if (cashChange !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "cash_change_3y",
        label: "Cash and equivalents change (3y)",
        value: cashChange,
        unit: "currency",
        direction: metricDirectionFromValue(cashChange)
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "cash_change_3y",
        label: "Cash and equivalents change (3y)",
        unit: "currency",
        note: "Cash trend requires annual cash_and_equivalents values."
      })
    );
  }

  const shareSeries = pickSeries(annualSnapshotsAsc, (snapshot) => snapshot.data.shares_outstanding);
  const shareChangePct = computePercentDelta(shareSeries);
  if (shareChangePct !== undefined) {
    trendMetrics.push(
      availableMetric({
        key: "share_count_change_3y_pct",
        label: "Share count change (3y)",
        value: shareChangePct,
        unit: "pct",
        direction: metricDirectionFromValue(shareChangePct, { betterWhenLower: true })
      })
    );
  } else {
    trendMetrics.push(
      omittedMetric({
        key: "share_count_change_3y_pct",
        label: "Share count change (3y)",
        unit: "pct",
        note: "Share-count change requires annual shares_outstanding values."
      })
    );
  }

  const roe = safeDivide(latestAnnual?.data.net_income, latestAnnual?.data.shareholders_equity);
  if (roe !== undefined) {
    qualityMetrics.push(
      availableMetric({
        key: "return_on_equity_latest",
        label: "Return on equity (latest)",
        value: roe,
        unit: "ratio",
        direction: metricDirectionFromValue(roe)
      })
    );
  } else {
    qualityMetrics.push(
      omittedMetric({
        key: "return_on_equity_latest",
        label: "Return on equity (latest)",
        unit: "ratio",
        note: "ROE requires latest net income and shareholders equity."
      })
    );
  }

  const roa = safeDivide(latestAnnual?.data.net_income, latestAnnual?.data.total_assets);
  if (roa !== undefined) {
    qualityMetrics.push(
      availableMetric({
        key: "return_on_assets_latest",
        label: "Return on assets (latest)",
        value: roa,
        unit: "ratio",
        direction: metricDirectionFromValue(roa)
      })
    );
  } else {
    qualityMetrics.push(
      omittedMetric({
        key: "return_on_assets_latest",
        label: "Return on assets (latest)",
        unit: "ratio",
        note: "ROA requires latest net income and total assets."
      })
    );
  }

  const cashConversion = safeDivide(
    latestAnnual?.data.operating_cash_flow,
    latestAnnual?.data.net_income
  );
  if (cashConversion !== undefined) {
    qualityMetrics.push(
      availableMetric({
        key: "cash_conversion_latest",
        label: "Cash conversion (latest)",
        value: cashConversion,
        unit: "ratio",
        direction: metricDirectionFromValue(cashConversion - 1)
      })
    );
  } else {
    qualityMetrics.push(
      omittedMetric({
        key: "cash_conversion_latest",
        label: "Cash conversion (latest)",
        unit: "ratio",
        note: "Cash conversion requires operating cash flow and net income."
      })
    );
    addOmission(omissions, {
      code: "cash_conversion_missing",
      label: "Cash conversion unavailable",
      reason: "Operating cash flow and net income were not both available for latest annual period.",
      impacts: ["financial_statement_analysis", "value_discipline"]
    });
  }

  const debtToEquity = safeDivide(
    latestAnnual?.data.debt_total,
    latestAnnual?.data.shareholders_equity
  );
  if (debtToEquity !== undefined) {
    qualityMetrics.push(
      availableMetric({
        key: "debt_to_equity_latest",
        label: "Debt to equity (latest)",
        value: debtToEquity,
        unit: "ratio",
        direction: metricDirectionFromValue(debtToEquity, {
          betterWhenLower: true,
          neutralBand: 0.01
        })
      })
    );
  } else {
    qualityMetrics.push(
      omittedMetric({
        key: "debt_to_equity_latest",
        label: "Debt to equity (latest)",
        unit: "ratio",
        note: "Debt-to-equity needs debt_total and shareholders_equity."
      })
    );
  }

  const accrualRatio = safeDivide(
    (latestAnnual?.data.net_income ?? NaN) - (latestAnnual?.data.operating_cash_flow ?? NaN),
    latestAnnual?.data.total_assets
  );
  if (accrualRatio !== undefined) {
    qualityMetrics.push(
      availableMetric({
        key: "accrual_ratio_latest",
        label: "Accrual ratio (latest)",
        value: accrualRatio,
        unit: "ratio",
        direction: metricDirectionFromValue(accrualRatio, { betterWhenLower: true })
      })
    );
  } else {
    qualityMetrics.push(
      omittedMetric({
        key: "accrual_ratio_latest",
        label: "Accrual ratio (latest)",
        unit: "ratio",
        note: "Accrual ratio needs net_income, operating_cash_flow, and total_assets."
      })
    );
  }

  const fcfMargin = safeDivide(latestAnnual?.data.free_cash_flow, latestAnnual?.data.revenue);
  if (fcfMargin !== undefined) {
    qualityMetrics.push(
      availableMetric({
        key: "free_cash_flow_margin_latest",
        label: "Free cash flow margin (latest)",
        value: fcfMargin,
        unit: "ratio",
        direction: metricDirectionFromValue(fcfMargin)
      })
    );
  } else {
    qualityMetrics.push(
      omittedMetric({
        key: "free_cash_flow_margin_latest",
        label: "Free cash flow margin (latest)",
        unit: "ratio",
        note: "FCF margin needs free_cash_flow and revenue in latest annual period."
      })
    );
  }

  return {
    annual_history: annualHistory,
    quarterly_history: quarterlyHistory,
    trend_metrics: trendMetrics,
    quality_metrics: qualityMetrics,
    omissions: Array.from(omissions.values())
  };
}

