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
