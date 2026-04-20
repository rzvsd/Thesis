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
  if (value.relationship_id !== undefined && typeof value.relationship_id !== "string") {
    errors.push(`${path}.relationship_id must be a string when provided`);
  }
  if (typeof value.source_ticker !== "string" || value.source_ticker.trim().length === 0) {
    errors.push(`${path}.source_ticker must be a non-empty string`);
  }
  if (typeof value.target_ticker !== "string" || value.target_ticker.trim().length === 0) {
    errors.push(`${path}.target_ticker must be a non-empty string`);
  }
  if (!["supplier", "competitor", "partner", "sector"].includes(String(value.relationship_type))) {
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
  if (typeof value.evidence_text !== "string" || value.evidence_text.trim().length === 0) {
    errors.push(`${path}.evidence_text must be a non-empty string`);
  }
  if (typeof value.rationale !== "string" || value.rationale.trim().length === 0) {
    errors.push(`${path}.rationale must be a non-empty string`);
  }
  if (value.prompt_version !== undefined && typeof value.prompt_version !== "string") {
    errors.push(`${path}.prompt_version must be a string when provided`);
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
  value.top_changes.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(`${path}.top_changes[${index}] must be an object`);
      return;
    }
    for (const field of ["title", "why_it_changed", "why_it_matters"] as const) {
      if (typeof item[field] !== "string" || item[field].trim().length === 0) {
        errors.push(`${path}.top_changes[${index}].${field} must be a non-empty string`);
      }
    }
    if (!["up", "down", "mixed", "watch"].includes(String(item.direction))) {
      errors.push(`${path}.top_changes[${index}].direction must be valid`);
    }
    if (!["high", "medium", "low"].includes(String(item.impact_level))) {
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
  if (value.eyebrow !== undefined && typeof value.eyebrow !== "string") {
    errors.push(`${path}.eyebrow must be a string when provided`);
  }
  if (value.summary !== undefined && typeof value.summary !== "string") {
    errors.push(`${path}.summary must be a string when provided`);
  }

  if (type === "metric_delta") {
    if (!Array.isArray(value.metrics) || value.metrics.length === 0) {
      errors.push(`${path}.metrics must be a non-empty array`);
      return;
    }
    value.metrics.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`${path}.metrics[${index}] must be an object`);
        return;
      }
      if (typeof item.label !== "string" || item.label.trim().length === 0) {
        errors.push(`${path}.metrics[${index}].label must be a non-empty string`);
      }
      if (!["qoq", "yoy", "absolute"].includes(String(item.basis))) {
        errors.push(`${path}.metrics[${index}].basis must be valid`);
      }
      if (!["up", "down", "flat", "unavailable"].includes(String(item.direction))) {
        errors.push(`${path}.metrics[${index}].direction must be valid`);
      }
      if (item.note !== undefined && typeof item.note !== "string") {
        errors.push(`${path}.metrics[${index}].note must be a string when provided`);
      }
    });
  }

  if (type === "timeline" || type === "valuation_bridge") {
    const key = type === "timeline" ? "points" : "points";
    const points = value[key];
    if (!Array.isArray(points) || points.length === 0) {
      errors.push(`${path}.${key} must be a non-empty array`);
      return;
    }
    points.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`${path}.${key}[${index}] must be an object`);
        return;
      }
      if (typeof item.label !== "string" || item.label.trim().length === 0) {
        errors.push(`${path}.${key}[${index}].label must be a non-empty string`);
      }
      if (type === "timeline") {
        if (typeof item.value !== "string" || item.value.trim().length === 0) {
          errors.push(`${path}.${key}[${index}].value must be a non-empty string`);
        }
        if (
          item.emphasis !== undefined &&
          !["current", "reference", "milestone"].includes(String(item.emphasis))
        ) {
          errors.push(`${path}.${key}[${index}].emphasis must be valid when provided`);
        }
      } else {
        if (typeof item.value !== "number" || Number.isNaN(item.value)) {
          errors.push(`${path}.${key}[${index}].value must be a valid number`);
        }
        if (!["spot", "low", "mid", "high"].includes(String(item.tone))) {
          errors.push(`${path}.${key}[${index}].tone must be valid`);
        }
      }
    });
  }

  if (type === "range_band") {
    if (
      value.low_value === undefined &&
      value.mid_value === undefined &&
      value.high_value === undefined &&
      value.reference_value === undefined
    ) {
      errors.push(`${path} must include at least one numeric range value`);
    }
  }

  if (type === "trust_scorecard") {
    if (
      value.freshness_state !== undefined &&
      !["fresh", "degraded", "stale"].includes(String(value.freshness_state))
    ) {
      errors.push(`${path}.freshness_state must be valid when provided`);
    }
    if (
      value.contradiction_state !== undefined &&
      !["none", "present"].includes(String(value.contradiction_state))
    ) {
      errors.push(`${path}.contradiction_state must be valid when provided`);
    }
    if (
      value.valuation_state !== undefined &&
      !["available", "degraded", "omitted"].includes(String(value.valuation_state))
    ) {
      errors.push(`${path}.valuation_state must be valid when provided`);
    }
  }

  if (type === "evidence_ladder") {
    if (!Array.isArray(value.rungs) || value.rungs.length === 0) {
      errors.push(`${path}.rungs must be a non-empty array`);
      return;
    }
    value.rungs.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`${path}.rungs[${index}] must be an object`);
        return;
      }
      if (typeof item.label !== "string" || item.label.trim().length === 0) {
        errors.push(`${path}.rungs[${index}].label must be a non-empty string`);
      }
      if (typeof item.count !== "number" || item.count < 0) {
        errors.push(`${path}.rungs[${index}].count must be a non-negative number`);
      }
      if (!["strong", "moderate", "light"].includes(String(item.tone))) {
        errors.push(`${path}.rungs[${index}].tone must be valid`);
      }
    });
  }

  if (type === "scenario_compare") {
    if (typeof value.base_label !== "string" || value.base_label.trim().length === 0) {
      errors.push(`${path}.base_label must be a non-empty string`);
    }
    if (typeof value.scenario_label !== "string" || value.scenario_label.trim().length === 0) {
      errors.push(`${path}.scenario_label must be a non-empty string`);
    }
    if (value.delta_text !== undefined && typeof value.delta_text !== "string") {
      errors.push(`${path}.delta_text must be a string when provided`);
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

  if (report.kill_switch_conditions !== undefined) {
    if (!Array.isArray(report.kill_switch_conditions)) {
      errors.push("kill_switch_conditions must be an array when provided");
    } else {
      if (
        report.kill_switch_conditions.length < 3 ||
        report.kill_switch_conditions.length > 5
      ) {
        errors.push("kill_switch_conditions must contain between 3 and 5 conditions");
      }
      report.kill_switch_conditions.forEach((condition, index) => {
        validateKillSwitchCondition(
          condition,
          `kill_switch_conditions[${index}]`,
          errors
        );
      });
    }
  }

  if (report.name_relationships !== undefined) {
    if (!Array.isArray(report.name_relationships)) {
      errors.push("name_relationships must be an array when provided");
    } else {
      report.name_relationships.forEach((relationship, index) => {
        validateNameRelationshipDraft(
          relationship,
          `name_relationships[${index}]`,
          errors
        );
      });
    }
  }

  if (report.story_header !== undefined) {
    validateStoryHeader(report.story_header, "story_header", errors);
  }

  if (report.change_summary !== undefined) {
    validateChangeSummary(report.change_summary, "change_summary", errors);
  }

  if (report.visual_panels !== undefined) {
    if (!Array.isArray(report.visual_panels)) {
      errors.push("visual_panels must be an array when provided");
    } else {
      report.visual_panels.forEach((panel, index) => {
        validateVisualPanel(panel, `visual_panels[${index}]`, errors);
      });
    }
  }

  if (report.explainers !== undefined) {
    validateExplainers(report.explainers, "explainers", errors);
  }

  if (report.watch_items !== undefined && !isStringArray(report.watch_items)) {
    errors.push("watch_items must be an array of strings when provided");
  }

  if (report.coverage_truth !== undefined) {
    validateCoverageTruth(report.coverage_truth, "coverage_truth", errors);
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
