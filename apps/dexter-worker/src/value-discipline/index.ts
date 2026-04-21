import type {
  CanonicalFinancialSnapshot,
  FinancialAnalysisBlock,
  ValueDisciplineBlock,
  ValueDisciplineContextLabel,
  ValueDisciplineSignal,
  ValuationBlock
} from "../../../../packages/contracts/src";

const MAX_SCORE = 9;
const EPSILON = 1e-6;

interface BuildValueDisciplineInput {
  ticker: string;
  snapshots: CanonicalFinancialSnapshot[];
  financialAnalysis: FinancialAnalysisBlock;
  valuation?: ValuationBlock;
}

type SignalResult = Pick<ValueDisciplineSignal, "status" | "reason" | "value">;

function sortAnnualDesc(snapshots: CanonicalFinancialSnapshot[]): CanonicalFinancialSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.period_type === "annual")
    .sort((left, right) => right.fiscal_year - left.fiscal_year);
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

function signal(
  key: string,
  label: string,
  family: ValueDisciplineSignal["family"],
  result: SignalResult
): ValueDisciplineSignal {
  return {
    key,
    label,
    family,
    status: result.status,
    reason: result.reason,
    value: result.value
  };
}

function unavailable(reason: string): SignalResult {
  return { status: "unavailable", reason };
}

function passFail(condition: boolean, passReason: string, failReason: string, value?: number): SignalResult {
  return {
    status: condition ? "pass" : "fail",
    reason: condition ? passReason : failReason,
    value
  };
}

function classifyContext(args: {
  annualCount: number;
  availableSignals: number;
  score: number;
  latest?: CanonicalFinancialSnapshot;
  prior?: CanonicalFinancialSnapshot;
  signals: ValueDisciplineSignal[];
}): ValueDisciplineContextLabel {
  const latest = args.latest;
  const prior = args.prior;
  if (args.annualCount < 3 || args.availableSignals <= 3 || !latest || !prior) {
    return "sparse_data";
  }

  const latestDebtToAssets = safeDivide(latest.data.debt_total, latest.data.total_assets);
  const latestRoa = safeDivide(latest.data.net_income, latest.data.total_assets);
  const priorRoa = safeDivide(prior.data.net_income, prior.data.total_assets);
  const latestCashFlow = latest.data.operating_cash_flow;
  const latestGrossMargin = latest.data.gross_margin;

  const financialPattern =
    latest.data.gross_margin === undefined &&
    latest.data.operating_margin === undefined &&
    latest.data.total_assets !== undefined &&
    latest.data.debt_total !== undefined;
  if (financialPattern) {
    return "financial";
  }

  const distressedPattern =
    (latest.data.net_income !== undefined && latest.data.net_income <= 0) ||
    (latestCashFlow !== undefined && latestCashFlow <= 0) ||
    ((latestDebtToAssets ?? 0) >= 0.8 && args.score <= 3);
  if (distressedPattern) {
    return "distressed";
  }

  const shareDisciplineSignal = args.signals.find((entry) => entry.key === "share_count_not_diluting");
  const qualityPattern =
    args.score >= 7 &&
    (latestGrossMargin ?? 0) >= 40 &&
    (latestRoa ?? 0) >= 0.12 &&
    shareDisciplineSignal?.status === "pass";
  if (qualityPattern) {
    return "quality_mega_cap";
  }

  const cyclicalPattern =
    (latestGrossMargin ?? 100) < 35 &&
    (latestDebtToAssets ?? 0) >= 0.35 &&
    (latestRoa ?? 1) > -0.05 &&
    (priorRoa ?? 1) > -0.05;
  if (cyclicalPattern) {
    return "value_cyclical";
  }

  return "general";
}

function buildInterpretation(args: {
  ticker: string;
  score: number;
  maxScore: number;
  availableSignals: number;
  contextLabel: ValueDisciplineContextLabel;
  completeness: ValueDisciplineBlock["completeness"];
  missingCount: number;
  warningTriggered: boolean;
}): string {
  const base = `${args.ticker} scores ${args.score}/${args.maxScore} on available value-discipline signals (${args.availableSignals} available).`;
  const contextLine = (() => {
    switch (args.contextLabel) {
      case "quality_mega_cap":
        return "Context reads as quality mega-cap: stability and capital discipline matter more than deep-value cheapness signals.";
      case "value_cyclical":
        return "Context reads as value/cyclical: balance-sheet pressure and margin resilience should be monitored through cycles.";
      case "distressed":
        return "Context reads as distressed: this score is mainly a triage tool for deterioration, not a comfort signal.";
      case "financial":
        return "Context reads as financial-style statements: interpret cautiously because traditional Piotroski-style inputs are incomplete for this profile.";
      case "sparse_data":
        return "Context is sparse-data: use this as a checkpoint, not a conviction-grade value call.";
      default:
        return "Context is general: use the score alongside valuation, risks, and evidence instead of in isolation.";
    }
  })();
  const completenessLine = args.completeness === "complete"
    ? "All core signals were available."
    : `${args.missingCount} signal(s) were unavailable, so the score is partial.`;
  const warningLine = args.warningTriggered
    ? "A value-trap warning is active because upside optics conflict with quality signals."
    : "No active value-trap warning was triggered by the current inputs.";

  return `${base} ${contextLine} ${completenessLine} ${warningLine}`;
}

export function buildValueDisciplineScorecard(
  input: BuildValueDisciplineInput
): ValueDisciplineBlock {
  const annualSnapshots = sortAnnualDesc(input.snapshots);
  const latest = annualSnapshots[0];
  const prior = annualSnapshots[1];

  const roaLatest = safeDivide(latest?.data.net_income, latest?.data.total_assets);
  const roaPrior = safeDivide(prior?.data.net_income, prior?.data.total_assets);
  const cfoLatest = latest?.data.operating_cash_flow;
  const netIncomeLatest = latest?.data.net_income;
  const debtToAssetsLatest = safeDivide(latest?.data.debt_total, latest?.data.total_assets);
  const debtToAssetsPrior = safeDivide(prior?.data.debt_total, prior?.data.total_assets);
  const netCashToAssetsLatest = safeDivide(
    (latest?.data.cash_and_equivalents ?? NaN) - (latest?.data.debt_total ?? NaN),
    latest?.data.total_assets
  );
  const netCashToAssetsPrior = safeDivide(
    (prior?.data.cash_and_equivalents ?? NaN) - (prior?.data.debt_total ?? NaN),
    prior?.data.total_assets
  );
  const grossMarginLatest = latest?.data.gross_margin;
  const grossMarginPrior = prior?.data.gross_margin;
  const assetTurnoverLatest = safeDivide(latest?.data.revenue, latest?.data.total_assets);
  const assetTurnoverPrior = safeDivide(prior?.data.revenue, prior?.data.total_assets);
  const sharesLatest = latest?.data.shares_outstanding;
  const sharesPrior = prior?.data.shares_outstanding;

  const signals: ValueDisciplineSignal[] = [
    signal(
      "roa_positive",
      "Positive return on assets",
      "profitability",
      roaLatest === undefined
        ? unavailable("ROA needs latest net income and total assets.")
        : passFail(
            roaLatest > 0,
            "Latest ROA is positive.",
            "Latest ROA is not positive.",
            roaLatest
          )
    ),
    signal(
      "operating_cash_flow_positive",
      "Positive operating cash flow",
      "profitability",
      cfoLatest === undefined
        ? unavailable("Operating cash-flow signal needs latest operating_cash_flow.")
        : passFail(
            cfoLatest > 0,
            "Latest operating cash flow is positive.",
            "Latest operating cash flow is not positive.",
            cfoLatest
          )
    ),
    signal(
      "roa_improving",
      "ROA improving vs prior year",
      "profitability",
      roaLatest === undefined || roaPrior === undefined
        ? unavailable("ROA trend needs latest and prior annual net income + total assets.")
        : passFail(
            roaLatest > roaPrior,
            "ROA improved year over year.",
            "ROA did not improve year over year.",
            roaLatest - roaPrior
          )
    ),
    signal(
      "cash_flow_exceeds_earnings",
      "Cash flow exceeds net income",
      "earnings_quality",
      cfoLatest === undefined || netIncomeLatest === undefined
        ? unavailable("Accrual-quality signal needs latest operating_cash_flow and net_income.")
        : passFail(
            cfoLatest > netIncomeLatest,
            "Operating cash flow exceeds net income, supporting earnings quality.",
            "Operating cash flow does not exceed net income, so accrual quality is weaker.",
            cfoLatest - netIncomeLatest
          )
    ),
    signal(
      "leverage_declining",
      "Leverage declining",
      "leverage_liquidity",
      debtToAssetsLatest === undefined || debtToAssetsPrior === undefined
        ? unavailable("Leverage trend needs latest and prior debt_total + total_assets.")
        : passFail(
            debtToAssetsLatest < debtToAssetsPrior,
            "Debt-to-assets improved versus prior year.",
            "Debt-to-assets did not improve versus prior year.",
            debtToAssetsPrior - debtToAssetsLatest
          )
    ),
    signal(
      "liquidity_buffer_improving",
      "Liquidity buffer improving",
      "leverage_liquidity",
      netCashToAssetsLatest === undefined || netCashToAssetsPrior === undefined
        ? unavailable("Liquidity buffer needs cash, debt, and total-assets values for latest and prior years.")
        : passFail(
            netCashToAssetsLatest > netCashToAssetsPrior,
            "Net cash-to-assets buffer improved.",
            "Net cash-to-assets buffer did not improve.",
            netCashToAssetsLatest - netCashToAssetsPrior
          )
    ),
    signal(
      "gross_margin_improving",
      "Gross margin improving",
      "operating_efficiency",
      grossMarginLatest === undefined || grossMarginPrior === undefined
        ? unavailable("Gross-margin trend needs latest and prior annual gross_margin.")
        : passFail(
            grossMarginLatest > grossMarginPrior,
            "Gross margin improved year over year.",
            "Gross margin did not improve year over year.",
            grossMarginLatest - grossMarginPrior
          )
    ),
    signal(
      "asset_turnover_improving",
      "Asset turnover improving",
      "operating_efficiency",
      assetTurnoverLatest === undefined || assetTurnoverPrior === undefined
        ? unavailable("Asset-turnover trend needs revenue and total_assets for latest and prior annual periods.")
        : passFail(
            assetTurnoverLatest > assetTurnoverPrior,
            "Asset turnover improved year over year.",
            "Asset turnover did not improve year over year.",
            assetTurnoverLatest - assetTurnoverPrior
          )
    ),
    signal(
      "share_count_not_diluting",
      "Share count discipline",
      "capital_discipline",
      sharesLatest === undefined || sharesPrior === undefined
        ? unavailable("Share-discipline signal needs latest and prior annual shares_outstanding.")
        : passFail(
            sharesLatest <= sharesPrior * 1.002,
            "Share count is stable or improved versus prior year.",
            "Share count increased materially versus prior year.",
            sharesPrior - sharesLatest
          )
    )
  ];

  const availableSignals = signals.filter((entry) => entry.status !== "unavailable").length;
  const score = signals.filter((entry) => entry.status === "pass").length;
  const completeness: ValueDisciplineBlock["completeness"] = availableSignals === 0
    ? "insufficient_data"
    : availableSignals === MAX_SCORE
      ? "complete"
      : "partial";
  const missingSignals = signals
    .filter((entry) => entry.status === "unavailable")
    .map((entry) => entry.label);

  const contextLabel = classifyContext({
    annualCount: input.financialAnalysis.annual_history.length,
    availableSignals,
    score,
    latest,
    prior,
    signals
  });

  const warningCodes: string[] = [];
  if (contextLabel === "distressed") {
    warningCodes.push("distressed_context");
  }
  if ((input.valuation?.implied_upside_pct ?? 0) >= 15 && score <= 4) {
    warningCodes.push("upside_vs_quality_divergence");
  }
  if (signals.some((entry) => entry.key === "gross_margin_improving" && entry.status === "fail") &&
    signals.some((entry) => entry.key === "leverage_declining" && entry.status === "fail")) {
    warningCodes.push("deteriorating_quality_stack");
  }

  const warningTriggered = warningCodes.length > 0;
  const valueTrapWarning: ValueDisciplineBlock["value_trap_warning"] = {
    triggered: warningTriggered,
    summary: warningTriggered
      ? "Potential value-trap profile: headline upside or cheapness can be misleading when quality signals are weak."
      : "No active value-trap warning based on current value-discipline signals.",
    reason_codes: warningCodes
  };

  return {
    score,
    max_score: MAX_SCORE,
    available_signals: availableSignals,
    completeness,
    context_label: contextLabel,
    interpretation: buildInterpretation({
      ticker: input.ticker,
      score,
      maxScore: MAX_SCORE,
      availableSignals,
      contextLabel,
      completeness,
      missingCount: missingSignals.length,
      warningTriggered
    }),
    missing_signals: missingSignals,
    does_not_prove:
      "This score is a structured quality/value checkpoint, not a buy or sell recommendation, and it does not replace full valuation or risk work.",
    signals,
    value_trap_warning: valueTrapWarning
  };
}

