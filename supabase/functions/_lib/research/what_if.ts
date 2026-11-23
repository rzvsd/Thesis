// What-if DCF recompute for POST /v1/reports/:id/scenario.
// Copied from apps/product-api/src/server.ts (computeScenarioResponse and its helpers).
import type {
  ScenarioInputOmission,
  ScenarioOverrides,
  ScenarioResponse,
  ValuationAssumptions,
  ValuationBlock,
} from "./types.ts";
import { clampNumber, isFiniteNumber, roundTo } from "./util.ts";

const phase6ScenarioDeterministicModel = "phase6_deterministic_v1" as const;

function deterministicValuationFactor(assumptions: { terminal_growth_rate: number; wacc: number }): number {
  return (1 + assumptions.terminal_growth_rate) / (assumptions.wacc - assumptions.terminal_growth_rate);
}

function buildScenarioInputOmissions(valuation: ValuationBlock): ScenarioInputOmission[] {
  const omissions: ScenarioInputOmission[] = [
    {
      omission_code: "market_beta_omitted",
      omission_text: "Phase 6 deterministic scenarios do not use market beta or correlation inputs.",
      affects_fields: ["assumptions.beta", "assumptions.correlation_matrix"],
    },
  ];
  if (!isFiniteNumber(valuation.spot_price)) {
    omissions.push({
      omission_code: "spot_reference_unavailable",
      omission_text:
        "Spot reference is unavailable in this report, so implied upside is omitted in scenario output.",
      affects_fields: ["spot_price", "implied_upside_pct"],
    });
  }
  if (isFiniteNumber(valuation.assumptions.beta)) {
    omissions.push({
      omission_code: "legacy_beta_ignored",
      omission_text:
        "A legacy beta value exists on this report and is ignored by the Phase 6 deterministic scenario model.",
      affects_fields: ["assumptions.beta"],
    });
  }
  return omissions;
}

function assumptionsWithoutLegacyBeta(assumptions: ValuationAssumptions): ValuationAssumptions {
  const normalized: ValuationAssumptions = { ...assumptions };
  delete normalized.beta;
  return normalized;
}

export function computeScenarioResponse(
  reportId: string,
  valuation: ValuationBlock,
  overrides: ScenarioOverrides,
): ScenarioResponse {
  const omissions = buildScenarioInputOmissions(valuation);
  const baseAssumptions = assumptionsWithoutLegacyBeta(valuation.assumptions);
  const base = {
    fair_value_mid: valuation.fair_value_mid,
    fair_value_low: valuation.fair_value_low,
    fair_value_high: valuation.fair_value_high,
    spot_price: valuation.spot_price,
    implied_upside_pct: valuation.implied_upside_pct,
    assumptions: baseAssumptions,
    degraded_reason: valuation.degraded_reason,
    omissions,
  };

  const scenarioAssumptions = {
    ...baseAssumptions,
    projection_years: overrides.projection_years ?? baseAssumptions.projection_years,
    terminal_growth_rate: overrides.terminal_growth_rate ?? baseAssumptions.terminal_growth_rate,
    wacc: overrides.wacc ?? baseAssumptions.wacc,
  };

  if (!isFiniteNumber(valuation.fair_value_mid)) {
    return {
      report_id: reportId,
      deterministic_model: phase6ScenarioDeterministicModel,
      base,
      scenario: {
        fair_value_mid: undefined,
        fair_value_low: undefined,
        fair_value_high: undefined,
        spot_price: valuation.spot_price,
        implied_upside_pct: undefined,
        assumptions: scenarioAssumptions,
        degraded_reason: valuation.degraded_reason ??
          "Base valuation fair value is unavailable for scenario recomputation.",
        omissions,
      },
      omissions,
    };
  }

  const baseFactor = deterministicValuationFactor(baseAssumptions);
  const scenarioFactor = deterministicValuationFactor(scenarioAssumptions);
  const projectionRatio = clampNumber(
    scenarioAssumptions.projection_years / baseAssumptions.projection_years,
    0.5,
    1.5,
  );
  const scaling = (scenarioFactor / baseFactor) * projectionRatio;

  const scenarioMid = roundTo(valuation.fair_value_mid * scaling, 4);
  const scenarioLow = isFiniteNumber(valuation.fair_value_low)
    ? roundTo(valuation.fair_value_low * scaling, 4)
    : undefined;
  const scenarioHigh = isFiniteNumber(valuation.fair_value_high)
    ? roundTo(valuation.fair_value_high * scaling, 4)
    : undefined;
  const spotPrice = isFiniteNumber(valuation.spot_price) ? valuation.spot_price : undefined;
  const impliedUpsidePct = spotPrice ? roundTo(((scenarioMid - spotPrice) / spotPrice) * 100, 4) : undefined;

  return {
    report_id: reportId,
    deterministic_model: phase6ScenarioDeterministicModel,
    base,
    scenario: {
      fair_value_mid: scenarioMid,
      fair_value_low: scenarioLow,
      fair_value_high: scenarioHigh,
      spot_price: spotPrice,
      implied_upside_pct: impliedUpsidePct,
      assumptions: scenarioAssumptions,
      omissions,
    },
    omissions,
  };
}
