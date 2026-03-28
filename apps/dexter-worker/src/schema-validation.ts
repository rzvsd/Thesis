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
