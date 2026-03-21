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
