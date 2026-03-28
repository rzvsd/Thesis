import type { CanonicalFinancialSnapshot, ValuationBlock } from "../../../../packages/contracts/src";

export interface DcfComputationInput {
  snapshots: CanonicalFinancialSnapshot[];
  spotPrice?: number;
  beta?: number;
}

export interface DcfComputationResult {
  valuation?: ValuationBlock;
  degradedReason?: string;
}

interface AnnualSeriesPoint {
  fiscalYear: number;
  freeCashFlow: number;
}

function annualFcfSeries(snapshots: CanonicalFinancialSnapshot[]): AnnualSeriesPoint[] {
  const annuals = snapshots
    .filter((snapshot) => snapshot.period_type === "annual")
    .sort((left, right) => left.fiscal_year - right.fiscal_year);

  return annuals.flatMap((snapshot) => {
    const freeCashFlow = snapshot.data.free_cash_flow;
    if (freeCashFlow === undefined) {
      return [];
    }

    return [{
      fiscalYear: snapshot.fiscal_year,
      freeCashFlow
    }];
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeGrowthRate(series: AnnualSeriesPoint[]): number | undefined {
  if (series.length < 2) {
    return undefined;
  }

  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last || first.freeCashFlow <= 0 || last.freeCashFlow <= 0) {
    return undefined;
  }

  const years = Math.max(last.fiscalYear - first.fiscalYear, 1);
  const cagr = Math.pow(last.freeCashFlow / first.freeCashFlow, 1 / years) - 1;
  return clamp(cagr, -0.1, 0.2);
}

export function computeDeterministicDcf(input: DcfComputationInput): DcfComputationResult {
  const series = annualFcfSeries(input.snapshots);
  if (series.length < 3) {
    return {
      degradedReason: "At least 3 annual free-cash-flow points are required for DCF."
    };
  }

  const latestPoint = series[series.length - 1];
  if (!latestPoint) {
    return {
      degradedReason: "Latest annual free-cash-flow point is unavailable."
    };
  }

  const latestSnapshot = input.snapshots
    .filter((snapshot) => snapshot.period_type === "annual")
    .sort((left, right) => right.fiscal_year - left.fiscal_year)[0];
  const sharesOutstanding = latestSnapshot?.data.shares_outstanding;
  if (!sharesOutstanding || sharesOutstanding <= 0) {
    return {
      degradedReason: "Shares outstanding are required for per-share valuation."
    };
  }

  const beta = input.beta ?? 1.0;
  const riskFreeRate = 0.04;
  const equityRiskPremium = 0.055;
  const wacc = clamp(riskFreeRate + beta * equityRiskPremium, 0.06, 0.14);
  const terminalGrowthRate = 0.025;
  if (wacc <= terminalGrowthRate) {
    return {
      degradedReason: "Invalid valuation assumptions (WACC must exceed terminal growth)."
    };
  }

  const growthRate = computeGrowthRate(series) ?? 0.04;
  const projectionYears = 5;
  let projectedFcf = latestPoint.freeCashFlow;
  let presentValue = 0;

  for (let year = 1; year <= projectionYears; year += 1) {
    projectedFcf *= 1 + growthRate;
    presentValue += projectedFcf / Math.pow(1 + wacc, year);
  }

  const terminalValue = (projectedFcf * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);
  const discountedTerminalValue = terminalValue / Math.pow(1 + wacc, projectionYears);
  const enterpriseValue = presentValue + discountedTerminalValue;
  const fairValueMid = enterpriseValue / sharesOutstanding;
  const fairValueLow = fairValueMid * 0.85;
  const fairValueHigh = fairValueMid * 1.15;
  const impliedUpsidePct = input.spotPrice && input.spotPrice > 0
    ? ((fairValueMid - input.spotPrice) / input.spotPrice) * 100
    : undefined;

  return {
    valuation: {
      fair_value_mid: fairValueMid,
      fair_value_low: fairValueLow,
      fair_value_high: fairValueHigh,
      spot_price: input.spotPrice,
      implied_upside_pct: impliedUpsidePct,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: projectionYears,
        terminal_growth_rate: terminalGrowthRate,
        wacc,
        beta,
        effective_tax_rate: latestSnapshot?.data.effective_tax_rate,
        shares_outstanding: sharesOutstanding
      }
    }
  };
}
