import type {
  AnalysisRequest,
  EvidenceItem,
  ReportSection,
  ReportSectionStatus
} from "../../../packages/contracts/src";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isReportSectionStatus(value: unknown): value is ReportSectionStatus {
  return [
    "complete",
    "data_incomplete",
    "data_unavailable",
    "failed"
  ].includes(String(value));
}

function validateEvidenceItem(value: unknown, path: string, errors: string[]): value is EvidenceItem {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }

  if (typeof value.evidence_id !== "string") {
    errors.push(`${path}.evidence_id must be a string`);
  }

  if (
    !["filing", "article", "financial_data", "macro_data"].includes(
      String(value.source_type)
    )
  ) {
    errors.push(`${path}.source_type must be a valid evidence source type`);
  }

  if (typeof value.source_name !== "string") {
    errors.push(`${path}.source_name must be a string`);
  }

  if (typeof value.excerpt !== "string" || value.excerpt.trim().length === 0) {
    errors.push(`${path}.excerpt must be a non-empty string`);
  }

  if (!isIsoDateTime(value.retrieved_at)) {
    errors.push(`${path}.retrieved_at must be an ISO datetime string`);
  }

  return true;
}

function validateReportSection(value: unknown, path: string, errors: string[]): value is ReportSection {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }

  if (typeof value.section_id !== "string") {
    errors.push(`${path}.section_id must be a string`);
  }

  if (typeof value.title !== "string") {
    errors.push(`${path}.title must be a string`);
  }

  if (typeof value.body !== "string" || value.body.trim().length === 0) {
    errors.push(`${path}.body must be a non-empty string`);
  }

  if (!isReportSectionStatus(value.status)) {
    errors.push(`${path}.status must be a valid report section status`);
  }

  if (!Array.isArray(value.evidence)) {
    errors.push(`${path}.evidence must be an array`);
  } else {
    value.evidence.forEach((entry, index) => {
      validateEvidenceItem(entry, `${path}.evidence[${index}]`, errors);
    });
  }

  return true;
}

function validateTrustMetadata(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (!isIsoDateTime(value.generated_at)) {
    errors.push(`${path}.generated_at must be an ISO datetime string`);
  }
  if (!["fresh", "degraded", "stale"].includes(String(value.freshness_state))) {
    errors.push(`${path}.freshness_state must be valid`);
  }
  if (typeof value.evidence_count !== "number" || value.evidence_count < 0) {
    errors.push(`${path}.evidence_count must be a non-negative number`);
  }
  if (!["none", "present"].includes(String(value.contradiction_state))) {
    errors.push(`${path}.contradiction_state must be valid`);
  }
  if (!["available", "degraded", "omitted"].includes(String(value.valuation_state))) {
    errors.push(`${path}.valuation_state must be valid`);
  }
  if (!isStringArray(value.missing_data_notes)) {
    errors.push(`${path}.missing_data_notes must be an array of strings`);
  }

  if (!Array.isArray(value.contradictions)) {
    errors.push(`${path}.contradictions must be an array`);
  }
  if (!Array.isArray(value.quote_provenance)) {
    errors.push(`${path}.quote_provenance must be an array`);
  }

  if (!isObject(value.thesis_drift)) {
    errors.push(`${path}.thesis_drift must be an object`);
  } else {
    if (!["available", "unavailable"].includes(String(value.thesis_drift.status))) {
      errors.push(`${path}.thesis_drift.status must be valid`);
    }
    if (
      typeof value.thesis_drift.summary !== "string" ||
      value.thesis_drift.summary.trim().length === 0
    ) {
      errors.push(`${path}.thesis_drift.summary must be a non-empty string`);
    }
    if (!isStringArray(value.thesis_drift.reasons)) {
      errors.push(`${path}.thesis_drift.reasons must be an array of strings`);
    }
  }
}

function validateKillSwitchCondition(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.condition_id !== "string" || value.condition_id.trim().length === 0) {
    errors.push(`${path}.condition_id must be a non-empty string`);
  }
  if (
    typeof value.condition_text !== "string" ||
    value.condition_text.trim().length === 0
  ) {
    errors.push(`${path}.condition_text must be a non-empty string`);
  }
  if (
    ![
      "price_move_pct",
      "thesis_state",
      "earnings_event",
      "sec_filing",
      "guidance_revision",
      "management_change",
      "macro_regime",
      "analyst_rerating",
      "news_sentiment",
      "custom"
    ].includes(String(value.signal_type))
  ) {
    errors.push(`${path}.signal_type must be valid`);
  }
  if (typeof value.rationale !== "string" || value.rationale.trim().length === 0) {
    errors.push(`${path}.rationale must be a non-empty string`);
  }
  if (
    value.threshold_value !== undefined &&
    (typeof value.threshold_value !== "number" || Number.isNaN(value.threshold_value))
  ) {
    errors.push(`${path}.threshold_value must be a valid number when provided`);
  }
  if (
    value.threshold_unit !== undefined &&
    !["pct", "count", "score", "days"].includes(String(value.threshold_unit))
  ) {
    errors.push(`${path}.threshold_unit must be valid when provided`);
  }
  if (
    value.direction !== undefined &&
    !["against_signal", "above", "below", "any"].includes(String(value.direction))
  ) {
    errors.push(`${path}.direction must be valid when provided`);
  }
}

function validateNameRelationshipDraft(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.source_ticker !== "string" || value.source_ticker.trim().length === 0) {
    errors.push(`${path}.source_ticker must be a non-empty string`);
  }
  if (typeof value.target_ticker !== "string" || value.target_ticker.trim().length === 0) {
    errors.push(`${path}.target_ticker must be a non-empty string`);
  }
  if (
    !["supplier", "competitor", "partner", "sector"].includes(
      String(value.relationship_type)
    )
  ) {
    errors.push(`${path}.relationship_type must be valid`);
  }
  if (
    typeof value.confidence !== "number" ||
    Number.isNaN(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    errors.push(`${path}.confidence must be a number between 0 and 1`);
  }
  if (
    typeof value.evidence_text !== "string" ||
    value.evidence_text.trim().length === 0
  ) {
    errors.push(`${path}.evidence_text must be a non-empty string`);
  }
  if (typeof value.rationale !== "string" || value.rationale.trim().length === 0) {
    errors.push(`${path}.rationale must be a non-empty string`);
  }
  if (
    value.prompt_version !== undefined &&
    (typeof value.prompt_version !== "string" || value.prompt_version.trim().length === 0)
  ) {
    errors.push(`${path}.prompt_version must be a non-empty string when provided`);
  }
}

function validateStoryHeader(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const field of ["headline", "thesis_summary", "why_now", "reader_takeaway"] as const) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }
  if (!["positive", "neutral", "negative", "watch"].includes(String(value.stance_label))) {
    errors.push(`${path}.stance_label must be valid`);
  }
}

function validateChangeSummary(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.previous_view !== "string" || value.previous_view.trim().length === 0) {
    errors.push(`${path}.previous_view must be a non-empty string`);
  }
  if (typeof value.current_view !== "string" || value.current_view.trim().length === 0) {
    errors.push(`${path}.current_view must be a non-empty string`);
  }
  if (!Array.isArray(value.top_changes)) {
    errors.push(`${path}.top_changes must be an array`);
    return;
  }
  value.top_changes.forEach((entry, index) => {
    if (!isObject(entry)) {
      errors.push(`${path}.top_changes[${index}] must be an object`);
      return;
    }
    for (const field of ["title", "why_it_changed", "why_it_matters"] as const) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
        errors.push(`${path}.top_changes[${index}].${field} must be a non-empty string`);
      }
    }
    if (!["up", "down", "mixed", "watch"].includes(String(entry.direction))) {
      errors.push(`${path}.top_changes[${index}].direction must be valid`);
    }
    if (!["high", "medium", "low"].includes(String(entry.impact_level))) {
      errors.push(`${path}.top_changes[${index}].impact_level must be valid`);
    }
  });
}

function validateVisualPanel(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const type = String(value.type);
  if (
    ![
      "metric_delta",
      "timeline",
      "range_band",
      "trust_scorecard",
      "evidence_ladder",
      "valuation_bridge",
      "scenario_compare"
    ].includes(type)
  ) {
    errors.push(`${path}.type must be valid`);
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    errors.push(`${path}.title must be a non-empty string`);
  }

  if (type === "metric_delta") {
    if (!Array.isArray(value.metrics) || value.metrics.length === 0) {
      errors.push(`${path}.metrics must be a non-empty array`);
    }
  }
  if (type === "timeline" || type === "valuation_bridge") {
    if (!Array.isArray(value.points) || value.points.length === 0) {
      errors.push(`${path}.points must be a non-empty array`);
    }
  }
  if (type === "evidence_ladder") {
    if (!Array.isArray(value.rungs) || value.rungs.length === 0) {
      errors.push(`${path}.rungs must be a non-empty array`);
    }
  }
  if (type === "scenario_compare") {
    if (typeof value.base_label !== "string" || value.base_label.trim().length === 0) {
      errors.push(`${path}.base_label must be a non-empty string`);
    }
    if (typeof value.scenario_label !== "string" || value.scenario_label.trim().length === 0) {
      errors.push(`${path}.scenario_label must be a non-empty string`);
    }
  }
}

function validateExplainers(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const field of ["signal", "confidence", "freshness", "valuation", "omissions"] as const) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }
}

function validateCoverageTruth(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    errors.push(`${path}.summary must be a non-empty string`);
  }
  if (!isStringArray(value.covered)) {
    errors.push(`${path}.covered must be an array of strings`);
  }
  if (!isStringArray(value.missing)) {
    errors.push(`${path}.missing must be an array of strings`);
  }
}

function validateFinancialHistoryRow(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.period !== "string" || value.period.trim().length === 0) {
    errors.push(`${path}.period must be a non-empty string`);
  }
  if (!["annual", "quarterly"].includes(String(value.period_type))) {
    errors.push(`${path}.period_type must be valid`);
  }
  if (typeof value.fiscal_year !== "number") {
    errors.push(`${path}.fiscal_year must be a number`);
  }
  if (value.fiscal_quarter !== undefined && typeof value.fiscal_quarter !== "number") {
    errors.push(`${path}.fiscal_quarter must be a number when provided`);
  }
  for (const field of [
    "revenue",
    "gross_margin",
    "operating_margin",
    "net_income",
    "free_cash_flow",
    "debt_total",
    "cash_and_equivalents",
    "shares_outstanding"
  ] as const) {
    if (value[field] !== undefined && typeof value[field] !== "number") {
      errors.push(`${path}.${field} must be a number when provided`);
    }
  }
}

function validateFinancialDerivedMetric(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.key !== "string" || value.key.trim().length === 0) {
    errors.push(`${path}.key must be a non-empty string`);
  }
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    errors.push(`${path}.label must be a non-empty string`);
  }
  if (value.value !== undefined && typeof value.value !== "number") {
    errors.push(`${path}.value must be a number when provided`);
  }
  if (!["currency", "pct", "ratio", "count"].includes(String(value.unit))) {
    errors.push(`${path}.unit must be valid`);
  }
  if (!["available", "omitted"].includes(String(value.status))) {
    errors.push(`${path}.status must be valid`);
  }
  if (
    !["improving", "deteriorating", "flat", "unavailable"].includes(
      String(value.direction)
    )
  ) {
    errors.push(`${path}.direction must be valid`);
  }
  if (value.note !== undefined && typeof value.note !== "string") {
    errors.push(`${path}.note must be a string when provided`);
  }
}

function validateFinancialOmission(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.code !== "string" || value.code.trim().length === 0) {
    errors.push(`${path}.code must be a non-empty string`);
  }
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    errors.push(`${path}.label must be a non-empty string`);
  }
  if (typeof value.reason !== "string" || value.reason.trim().length === 0) {
    errors.push(`${path}.reason must be a non-empty string`);
  }
  if (!isStringArray(value.impacts)) {
    errors.push(`${path}.impacts must be an array of strings`);
  }
}

function validateFinancialAnalysis(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!Array.isArray(value.annual_history)) {
    errors.push(`${path}.annual_history must be an array`);
  } else {
    value.annual_history.forEach((entry, index) => {
      validateFinancialHistoryRow(entry, `${path}.annual_history[${index}]`, errors);
    });
  }
  if (!Array.isArray(value.quarterly_history)) {
    errors.push(`${path}.quarterly_history must be an array`);
  } else {
    value.quarterly_history.forEach((entry, index) => {
      validateFinancialHistoryRow(entry, `${path}.quarterly_history[${index}]`, errors);
    });
  }
  if (!Array.isArray(value.trend_metrics)) {
    errors.push(`${path}.trend_metrics must be an array`);
  } else {
    value.trend_metrics.forEach((entry, index) => {
      validateFinancialDerivedMetric(entry, `${path}.trend_metrics[${index}]`, errors);
    });
  }
  if (!Array.isArray(value.quality_metrics)) {
    errors.push(`${path}.quality_metrics must be an array`);
  } else {
    value.quality_metrics.forEach((entry, index) => {
      validateFinancialDerivedMetric(entry, `${path}.quality_metrics[${index}]`, errors);
    });
  }
  if (!Array.isArray(value.omissions)) {
    errors.push(`${path}.omissions must be an array`);
  } else {
    value.omissions.forEach((entry, index) => {
      validateFinancialOmission(entry, `${path}.omissions[${index}]`, errors);
    });
  }
}

function validateValueDisciplineSignal(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.key !== "string" || value.key.trim().length === 0) {
    errors.push(`${path}.key must be a non-empty string`);
  }
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    errors.push(`${path}.label must be a non-empty string`);
  }
  if (
    ![
      "profitability",
      "leverage_liquidity",
      "operating_efficiency",
      "earnings_quality",
      "capital_discipline"
    ].includes(String(value.family))
  ) {
    errors.push(`${path}.family must be valid`);
  }
  if (!["pass", "fail", "unavailable"].includes(String(value.status))) {
    errors.push(`${path}.status must be valid`);
  }
  if (typeof value.reason !== "string" || value.reason.trim().length === 0) {
    errors.push(`${path}.reason must be a non-empty string`);
  }
  if (value.value !== undefined && typeof value.value !== "number") {
    errors.push(`${path}.value must be a number when provided`);
  }
}

function validateValueDiscipline(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.score !== "number") {
    errors.push(`${path}.score must be a number`);
  }
  if (typeof value.max_score !== "number") {
    errors.push(`${path}.max_score must be a number`);
  }
  if (typeof value.available_signals !== "number") {
    errors.push(`${path}.available_signals must be a number`);
  }
  if (!["complete", "partial", "insufficient_data"].includes(String(value.completeness))) {
    errors.push(`${path}.completeness must be valid`);
  }
  if (
    ![
      "quality_mega_cap",
      "value_cyclical",
      "distressed",
      "financial",
      "sparse_data",
      "general"
    ].includes(String(value.context_label))
  ) {
    errors.push(`${path}.context_label must be valid`);
  }
  if (typeof value.interpretation !== "string" || value.interpretation.trim().length === 0) {
    errors.push(`${path}.interpretation must be a non-empty string`);
  }
  if (!isStringArray(value.missing_signals)) {
    errors.push(`${path}.missing_signals must be an array of strings`);
  }
  if (typeof value.does_not_prove !== "string" || value.does_not_prove.trim().length === 0) {
    errors.push(`${path}.does_not_prove must be a non-empty string`);
  }
  if (!Array.isArray(value.signals)) {
    errors.push(`${path}.signals must be an array`);
  } else {
    value.signals.forEach((entry, index) => {
      validateValueDisciplineSignal(entry, `${path}.signals[${index}]`, errors);
    });
  }
  if (!isObject(value.value_trap_warning)) {
    errors.push(`${path}.value_trap_warning must be an object`);
  } else {
    if (typeof value.value_trap_warning.triggered !== "boolean") {
      errors.push(`${path}.value_trap_warning.triggered must be a boolean`);
    }
    if (
      typeof value.value_trap_warning.summary !== "string" ||
      value.value_trap_warning.summary.trim().length === 0
    ) {
      errors.push(`${path}.value_trap_warning.summary must be a non-empty string`);
    }
    if (!isStringArray(value.value_trap_warning.reason_codes)) {
      errors.push(`${path}.value_trap_warning.reason_codes must be an array of strings`);
    }
  }
}

export function validateAnalysisRequest(value: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(value)) {
    return ["Request body must be an object"];
  }

  if (typeof value.request_id !== "string") {
    errors.push("request_id must be a string");
  }

  if (value.type !== "deep_dive") {
    errors.push("type must be deep_dive for dexter-worker");
  }

  if (typeof value.ticker !== "string" || value.ticker.trim().length === 0) {
    errors.push("ticker must be a non-empty string");
  }

  if (typeof value.job_id !== "string") {
    errors.push("job_id must be a string");
  }

  if (!isIsoDateTime(value.requested_at)) {
    errors.push("requested_at must be an ISO datetime string");
  }

  if (value.options !== undefined) {
    if (!isObject(value.options)) {
      errors.push("options must be an object when provided");
    } else if (
      value.options.sections !== undefined &&
      !isStringArray(value.options.sections)
    ) {
      errors.push("options.sections must be an array of strings");
    }
  }

  return errors;
}

export function assertAnalysisRequest(value: unknown): AnalysisRequest {
  const errors = validateAnalysisRequest(value);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return value as AnalysisRequest;
}

export function validateAnalysisReport(value: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(value)) {
    return ["AnalysisReport must be an object"];
  }

  if (typeof value.report_id !== "string") {
    errors.push("report_id must be a string");
  }

  if (typeof value.job_id !== "string") {
    errors.push("job_id must be a string");
  }

  if (typeof value.schema_version !== "string") {
    errors.push("schema_version must be a string");
  }

  if (value.type !== "deep_dive") {
    errors.push("type must be deep_dive");
  }

  if (value.ticker !== undefined && typeof value.ticker !== "string") {
    errors.push("ticker must be a string when provided");
  }

  if (!isIsoDateTime(value.generated_at)) {
    errors.push("generated_at must be an ISO datetime string");
  }

  if (!isObject(value.confidence)) {
    errors.push("confidence must be an object");
  } else {
    if (typeof value.confidence.score !== "number") {
      errors.push("confidence.score must be a number");
    }

    if (
      !["high", "medium", "low", "insufficient_data"].includes(
        String(value.confidence.label)
      )
    ) {
      errors.push("confidence.label must be valid");
    }

    if (!isStringArray(value.confidence.limiting_factors)) {
      errors.push("confidence.limiting_factors must be an array of strings");
    }
  }

  if (value.signal !== undefined) {
    if (!isObject(value.signal)) {
      errors.push("signal must be an object when provided");
    } else {
      if (
        !["positive", "neutral", "negative", "no_signal"].includes(
          String(value.signal.value)
        )
      ) {
        errors.push("signal.value must be valid");
      }

      if (!isStringArray(value.signal.reasons)) {
        errors.push("signal.reasons must be an array of strings");
      }

      if (!Array.isArray(value.signal.evidence)) {
        errors.push("signal.evidence must be an array");
      } else {
        value.signal.evidence.forEach((entry, index) => {
          validateEvidenceItem(entry, `signal.evidence[${index}]`, errors);
        });
      }
    }
  }

  if (value.historical_context !== undefined) {
    if (!isObject(value.historical_context)) {
      errors.push("historical_context must be an object when provided");
    } else {
      if (typeof value.historical_context.financial_snapshot_count !== "number") {
        errors.push("historical_context.financial_snapshot_count must be a number");
      }
      if (typeof value.historical_context.transcript_count !== "number") {
        errors.push("historical_context.transcript_count must be a number");
      }
      if (typeof value.historical_context.transcript_available !== "boolean") {
        errors.push("historical_context.transcript_available must be a boolean");
      }
      if (!isStringArray(value.historical_context.missing_reasons)) {
        errors.push("historical_context.missing_reasons must be an array of strings");
      }
    }
  }

  if (value.valuation !== undefined) {
    if (!isObject(value.valuation)) {
      errors.push("valuation must be an object when provided");
    } else if (!isObject(value.valuation.assumptions)) {
      errors.push("valuation.assumptions must be an object");
    } else {
      if (value.valuation.assumptions.methodology !== "deterministic_dcf") {
        errors.push("valuation.assumptions.methodology must be deterministic_dcf");
      }
      if (typeof value.valuation.assumptions.projection_years !== "number") {
        errors.push("valuation.assumptions.projection_years must be a number");
      }
      if (typeof value.valuation.assumptions.terminal_growth_rate !== "number") {
        errors.push("valuation.assumptions.terminal_growth_rate must be a number");
      }
      if (typeof value.valuation.assumptions.wacc !== "number") {
        errors.push("valuation.assumptions.wacc must be a number");
      }
    }
  }

  if (value.trust_metadata !== undefined) {
    validateTrustMetadata(value.trust_metadata, "trust_metadata", errors);
  }

  if (value.kill_switch_conditions !== undefined) {
    if (!Array.isArray(value.kill_switch_conditions)) {
      errors.push("kill_switch_conditions must be an array when provided");
    } else {
      if (value.kill_switch_conditions.length < 3 || value.kill_switch_conditions.length > 5) {
        errors.push("kill_switch_conditions must contain between 3 and 5 conditions");
      }
      value.kill_switch_conditions.forEach((condition, index) => {
        validateKillSwitchCondition(
          condition,
          `kill_switch_conditions[${index}]`,
          errors
        );
      });
    }
  }

  if (value.name_relationships !== undefined) {
    if (!Array.isArray(value.name_relationships)) {
      errors.push("name_relationships must be an array when provided");
    } else {
      value.name_relationships.forEach((relationship, index) => {
        validateNameRelationshipDraft(
          relationship,
          `name_relationships[${index}]`,
          errors
        );
      });
    }
  }

  if (value.story_header !== undefined) {
    validateStoryHeader(value.story_header, "story_header", errors);
  }
  if (value.change_summary !== undefined) {
    validateChangeSummary(value.change_summary, "change_summary", errors);
  }
  if (value.visual_panels !== undefined) {
    if (!Array.isArray(value.visual_panels)) {
      errors.push("visual_panels must be an array when provided");
    } else {
      value.visual_panels.forEach((entry, index) => {
        validateVisualPanel(entry, `visual_panels[${index}]`, errors);
      });
    }
  }
  if (value.explainers !== undefined) {
    validateExplainers(value.explainers, "explainers", errors);
  }
  if (value.watch_items !== undefined && !isStringArray(value.watch_items)) {
    errors.push("watch_items must be an array of strings when provided");
  }
  if (value.coverage_truth !== undefined) {
    validateCoverageTruth(value.coverage_truth, "coverage_truth", errors);
  }
  if (value.financial_analysis !== undefined) {
    validateFinancialAnalysis(value.financial_analysis, "financial_analysis", errors);
  }
  if (value.value_discipline !== undefined) {
    validateValueDiscipline(value.value_discipline, "value_discipline", errors);
  }

  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push("sections must be a non-empty array");
  } else {
    value.sections.forEach((entry, index) => {
      validateReportSection(entry, `sections[${index}]`, errors);
    });
  }

  if (!isStringArray(value.flags)) {
    errors.push("flags must be an array of strings");
  }

  if (!isStringArray(value.data_sources)) {
    errors.push("data_sources must be an array of strings");
  }

  return errors;
}
