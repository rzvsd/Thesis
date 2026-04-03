import type { AnalysisReport } from "../../../packages/contracts/src";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validateEvidenceItem(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.evidence_id !== "string" || value.evidence_id.trim().length === 0) {
    errors.push(`${path}.evidence_id must be a non-empty string`);
  }
  if (
    !["filing", "article", "financial_data", "macro_data"].includes(
      String(value.source_type)
    )
  ) {
    errors.push(`${path}.source_type must be valid`);
  }
  if (typeof value.source_name !== "string" || value.source_name.trim().length === 0) {
    errors.push(`${path}.source_name must be a non-empty string`);
  }
  if (typeof value.excerpt !== "string" || value.excerpt.trim().length === 0) {
    errors.push(`${path}.excerpt must be a non-empty string`);
  }
  if (!isIsoDateTime(value.retrieved_at)) {
    errors.push(`${path}.retrieved_at must be an ISO datetime string`);
  }
  if (value.url !== undefined && typeof value.url !== "string") {
    errors.push(`${path}.url must be a string when provided`);
  }
}

function validateSection(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.section_id !== "string" || value.section_id.trim().length === 0) {
    errors.push(`${path}.section_id must be a non-empty string`);
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    errors.push(`${path}.title must be a non-empty string`);
  }
  if (typeof value.body !== "string" || value.body.trim().length === 0) {
    errors.push(`${path}.body must be a non-empty string`);
  }
  if (!["complete", "data_incomplete", "data_unavailable", "failed"].includes(String(value.status))) {
    errors.push(`${path}.status must be valid`);
  }
  if (!Array.isArray(value.evidence)) {
    errors.push(`${path}.evidence must be an array`);
  } else {
    value.evidence.forEach((item, index) => {
      validateEvidenceItem(item, `${path}.evidence[${index}]`, errors);
    });
  }
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
  } else {
    value.contradictions.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`${path}.contradictions[${index}] must be an object`);
        return;
      }
      if (typeof item.id !== "string" || item.id.trim().length === 0) {
        errors.push(`${path}.contradictions[${index}].id must be a non-empty string`);
      }
      if (typeof item.description !== "string" || item.description.trim().length === 0) {
        errors.push(
          `${path}.contradictions[${index}].description must be a non-empty string`
        );
      }
      if (!["low", "medium", "high"].includes(String(item.severity))) {
        errors.push(`${path}.contradictions[${index}].severity must be valid`);
      }
    });
  }

  if (!Array.isArray(value.quote_provenance)) {
    errors.push(`${path}.quote_provenance must be an array`);
  } else {
    value.quote_provenance.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`${path}.quote_provenance[${index}] must be an object`);
        return;
      }
      if (typeof item.quote !== "string" || item.quote.trim().length === 0) {
        errors.push(`${path}.quote_provenance[${index}].quote must be a non-empty string`);
      }
      if (typeof item.source_name !== "string" || item.source_name.trim().length === 0) {
        errors.push(
          `${path}.quote_provenance[${index}].source_name must be a non-empty string`
        );
      }
      if (
        !["filing", "article", "financial_data", "macro_data"].includes(
          String(item.source_type)
        )
      ) {
        errors.push(`${path}.quote_provenance[${index}].source_type must be valid`);
      }
      if (item.retrieved_at !== undefined && !isIsoDateTime(item.retrieved_at)) {
        errors.push(
          `${path}.quote_provenance[${index}].retrieved_at must be an ISO datetime string`
        );
      }
    });
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

export function validateIncomingAnalysisReport(report: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(report)) {
    return ["report must be an object"];
  }

  if (typeof report.report_id !== "string" || report.report_id.trim().length === 0) {
    errors.push("report_id must be a non-empty string");
  }
  if (typeof report.job_id !== "string" || report.job_id.trim().length === 0) {
    errors.push("job_id must be a non-empty string");
  }
  if (typeof report.schema_version !== "string" || report.schema_version.trim().length === 0) {
    errors.push("schema_version must be a non-empty string");
  }
  if (report.type !== "deep_dive") {
    errors.push("type must be deep_dive");
  }
  if (report.ticker !== undefined && (typeof report.ticker !== "string" || report.ticker.trim().length === 0)) {
    errors.push("ticker must be a non-empty string when provided");
  }
  if (!isIsoDateTime(report.generated_at)) {
    errors.push("generated_at must be an ISO datetime string");
  }

  if (!isObject(report.confidence)) {
    errors.push("confidence must be an object");
  } else {
    if (typeof report.confidence.score !== "number") {
      errors.push("confidence.score must be a number");
    }
    if (
      !["high", "medium", "low", "insufficient_data"].includes(
        String(report.confidence.label)
      )
    ) {
      errors.push("confidence.label must be valid");
    }
    if (!isStringArray(report.confidence.limiting_factors)) {
      errors.push("confidence.limiting_factors must be an array of strings");
    }
  }

  if (report.signal !== undefined) {
    if (!isObject(report.signal)) {
      errors.push("signal must be an object when provided");
    } else {
      if (!["positive", "neutral", "negative", "no_signal"].includes(String(report.signal.value))) {
        errors.push("signal.value must be valid");
      }
      if (!isStringArray(report.signal.reasons)) {
        errors.push("signal.reasons must be an array of strings");
      }
      if (!Array.isArray(report.signal.evidence)) {
        errors.push("signal.evidence must be an array");
      } else {
        report.signal.evidence.forEach((item, index) => {
          validateEvidenceItem(item, `signal.evidence[${index}]`, errors);
        });
      }
    }
  }

  if (report.historical_context !== undefined) {
    if (!isObject(report.historical_context)) {
      errors.push("historical_context must be an object when provided");
    } else {
      if (typeof report.historical_context.financial_snapshot_count !== "number") {
        errors.push("historical_context.financial_snapshot_count must be a number");
      }
      if (typeof report.historical_context.transcript_count !== "number") {
        errors.push("historical_context.transcript_count must be a number");
      }
      if (typeof report.historical_context.transcript_available !== "boolean") {
        errors.push("historical_context.transcript_available must be a boolean");
      }
      if (!isStringArray(report.historical_context.missing_reasons)) {
        errors.push("historical_context.missing_reasons must be an array of strings");
      }
    }
  }

  if (report.valuation !== undefined) {
    if (!isObject(report.valuation)) {
      errors.push("valuation must be an object when provided");
    } else if (!isObject(report.valuation.assumptions)) {
      errors.push("valuation.assumptions must be an object");
    } else {
      if (report.valuation.assumptions.methodology !== "deterministic_dcf") {
        errors.push("valuation.assumptions.methodology must be deterministic_dcf");
      }
      if (typeof report.valuation.assumptions.projection_years !== "number") {
        errors.push("valuation.assumptions.projection_years must be a number");
      }
      if (typeof report.valuation.assumptions.terminal_growth_rate !== "number") {
        errors.push("valuation.assumptions.terminal_growth_rate must be a number");
      }
      if (typeof report.valuation.assumptions.wacc !== "number") {
        errors.push("valuation.assumptions.wacc must be a number");
      }
    }
  }

  if (report.trust_metadata !== undefined) {
    validateTrustMetadata(report.trust_metadata, "trust_metadata", errors);
  }

  if (!Array.isArray(report.sections) || report.sections.length === 0) {
    errors.push("sections must be a non-empty array");
  } else {
    report.sections.forEach((section, index) => {
      validateSection(section, `sections[${index}]`, errors);
    });
  }

  if (!isStringArray(report.flags)) {
    errors.push("flags must be an array of strings");
  }
  if (!isStringArray(report.data_sources)) {
    errors.push("data_sources must be an array of strings");
  }

  return errors;
}

export function assertIncomingAnalysisReport(report: unknown): AnalysisReport {
  const errors = validateIncomingAnalysisReport(report);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return report as AnalysisReport;
}
