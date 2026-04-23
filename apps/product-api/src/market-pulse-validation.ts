import type { MarketPulseReport } from "../../../packages/contracts/src";

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

function validateMacroStress(value: unknown, errors: string[]): void {
  if (!isObject(value)) {
    errors.push("macro_stress must be an object");
    return;
  }

  if (typeof value.snapshot_id !== "string" || value.snapshot_id.trim().length === 0) {
    errors.push("macro_stress.snapshot_id must be a non-empty string");
  }
  if (typeof value.as_of !== "string" || Number.isNaN(Date.parse(`${value.as_of}T00:00:00.000Z`))) {
    errors.push("macro_stress.as_of must be a valid YYYY-MM-DD date");
  }
  if (!isIsoDateTime(value.generated_at)) {
    errors.push("macro_stress.generated_at must be an ISO datetime string");
  }
  if (
    !["stable", "mixed", "elevated", "insufficient_data"].includes(
      String(value.state)
    )
  ) {
    errors.push("macro_stress.state must be valid");
  }
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    errors.push("macro_stress.summary must be a non-empty string");
  }
  if (typeof value.no_material_change !== "boolean") {
    errors.push("macro_stress.no_material_change must be a boolean");
  }

  if (!Array.isArray(value.inputs)) {
    errors.push("macro_stress.inputs must be an array");
  } else {
    value.inputs.forEach((input, index) => {
      if (!isObject(input)) {
        errors.push(`macro_stress.inputs[${index}] must be an object`);
        return;
      }
      if (typeof input.registry_id !== "string" || input.registry_id.trim().length === 0) {
        errors.push(`macro_stress.inputs[${index}].registry_id must be a non-empty string`);
      }
      if (typeof input.label !== "string" || input.label.trim().length === 0) {
        errors.push(`macro_stress.inputs[${index}].label must be a non-empty string`);
      }
      if (
        !["rates", "inflation", "labor", "growth", "energy"].includes(
          String(input.category)
        )
      ) {
        errors.push(`macro_stress.inputs[${index}].category must be valid`);
      }
      if (
        !["low", "medium", "high", "unknown"].includes(
          String(input.pressure)
        )
      ) {
        errors.push(`macro_stress.inputs[${index}].pressure must be valid`);
      }
      if (
        !["official", "partial", "missing"].includes(
          String(input.source_state)
        )
      ) {
        errors.push(`macro_stress.inputs[${index}].source_state must be valid`);
      }
      if (typeof input.reason !== "string" || input.reason.trim().length === 0) {
        errors.push(`macro_stress.inputs[${index}].reason must be a non-empty string`);
      }
      if (
        input.retrieved_at !== undefined &&
        input.retrieved_at !== null &&
        !isIsoDateTime(input.retrieved_at)
      ) {
        errors.push(`macro_stress.inputs[${index}].retrieved_at must be an ISO datetime string`);
      }
    });
  }

  if (!Array.isArray(value.omissions)) {
    errors.push("macro_stress.omissions must be an array");
  } else {
    value.omissions.forEach((omission, index) => {
      if (!isObject(omission)) {
        errors.push(`macro_stress.omissions[${index}] must be an object`);
        return;
      }
      if (typeof omission.registry_id !== "string" || omission.registry_id.trim().length === 0) {
        errors.push(`macro_stress.omissions[${index}].registry_id must be a non-empty string`);
      }
      if (typeof omission.reason_code !== "string" || omission.reason_code.trim().length === 0) {
        errors.push(`macro_stress.omissions[${index}].reason_code must be a non-empty string`);
      }
      if (typeof omission.reason_text !== "string" || omission.reason_text.trim().length === 0) {
        errors.push(`macro_stress.omissions[${index}].reason_text must be a non-empty string`);
      }
    });
  }
}

function validateContext(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!isObject(value)) {
    errors.push("context must be an object when provided");
    return;
  }

  if (
    !["official", "bounded_context", "partial", "missing"].includes(
      String(value.source_state)
    )
  ) {
    errors.push("context.source_state must be valid");
  }
  if (!isIsoDateTime(value.generated_at)) {
    errors.push("context.generated_at must be an ISO datetime string");
  }
  if (!Array.isArray(value.rights)) {
    errors.push("context.rights must be an array");
  }
  if (!Array.isArray(value.omissions)) {
    errors.push("context.omissions must be an array");
  }
}

function validateStructuralContext(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!isObject(value)) {
    errors.push("structural_context must be an object when provided");
    return;
  }

  if (!["issuer", "market_pulse"].includes(String(value.subject_type))) {
    errors.push("structural_context.subject_type must be valid");
  }
  if (typeof value.subject_id !== "string" || value.subject_id.trim().length === 0) {
    errors.push("structural_context.subject_id must be a non-empty string");
  }
  if (typeof value.as_of !== "string" || value.as_of.trim().length === 0) {
    errors.push("structural_context.as_of must be a non-empty string");
  }
  if (!["full", "partial", "limited"].includes(String(value.coverage_state))) {
    errors.push("structural_context.coverage_state must be valid");
  }
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    errors.push("structural_context.summary must be a non-empty string");
  }
  if (!Array.isArray(value.observations)) {
    errors.push("structural_context.observations must be an array");
  }
  if (!Array.isArray(value.omissions)) {
    errors.push("structural_context.omissions must be an array");
  }
  if (!Array.isArray(value.retrievals)) {
    errors.push("structural_context.retrievals must be an array");
  }
}

export function validateIncomingMarketPulseReport(report: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(report)) {
    return ["report must be an object"];
  }

  if (typeof report.report_id !== "string" || report.report_id.trim().length === 0) {
    errors.push("report_id must be a non-empty string");
  }
  if (typeof report.schema_version !== "string" || report.schema_version.trim().length === 0) {
    errors.push("schema_version must be a non-empty string");
  }
  if (!isIsoDateTime(report.generated_at)) {
    errors.push("generated_at must be an ISO datetime string");
  }
  if (!isIsoDateTime(report.cycle_start)) {
    errors.push("cycle_start must be an ISO datetime string");
  }
  if (!isIsoDateTime(report.cycle_end)) {
    errors.push("cycle_end must be an ISO datetime string");
  }
  if (!isStringArray(report.flags)) {
    errors.push("flags must be an array of strings");
  }

  validateMacroStress(report.macro_stress, errors);
  validateContext(report.context, errors);
  validateStructuralContext(report.structural_context, errors);

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

  if (!isObject(report.sections)) {
    errors.push("sections must be an object");
  } else {
    const requiredSections = [
      "macro_stress",
      "official_macro_pressure",
      "canonical_events",
      "bounded_context",
      "uncertainty_flags"
    ];
    for (const key of requiredSections) {
      validateSection(report.sections[key], `sections.${key}`, errors);
    }

    const optionalSections = [
      "market_moves",
      "macro_releases",
      "rates_fx_commodities",
      "news_summary",
      "no_material_change",
      "watchlist_overlay"
    ];
    for (const key of optionalSections) {
      if (report.sections[key] !== undefined) {
        validateSection(report.sections[key], `sections.${key}`, errors);
      }
    }
  }

  return errors;
}

export function assertIncomingMarketPulseReport(report: unknown): MarketPulseReport {
  const errors = validateIncomingMarketPulseReport(report);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return report as MarketPulseReport;
}
