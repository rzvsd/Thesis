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

function validateFilingIntelligence(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.prompt_version !== "string" || value.prompt_version.trim().length === 0) {
    errors.push(`${path}.prompt_version must be a non-empty string`);
  }
  if (!["deterministic_fixture", "live_prompt", "fallback"].includes(String(value.generation_mode))) {
    errors.push(`${path}.generation_mode must be valid`);
  }

  for (const field of ["comparison_filings", "metric_deltas", "language_deltas", "segment_deltas", "top_changes", "good", "bad", "interesting", "omissions", "evidence"] as const) {
    if (!Array.isArray(value[field])) {
      errors.push(`${path}.${field} must be an array`);
    }
  }

  if (!isObject(value.memo)) {
    errors.push(`${path}.memo must be an object`);
  } else {
    for (const field of ["the_filing_read", "what_changed", "the_good", "the_bad", "the_interesting", "management_tone", "risk_watch", "plain_english_takeaway", "what_to_watch_next"] as const) {
      if (typeof value.memo[field] !== "string" || value.memo[field].trim().length === 0) {
        errors.push(`${path}.memo.${field} must be a non-empty string`);
      }
    }
  }

  if (Array.isArray(value.metric_deltas)) {
    value.metric_deltas.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.metric_deltas[${index}] must be an object`);
        return;
      }
      for (const field of ["metric", "label", "basis", "current_period", "unit", "direction", "plain_english", "why_it_matters"] as const) {
        if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
          errors.push(`${path}.metric_deltas[${index}].${field} must be a non-empty string`);
        }
      }
      if (!Array.isArray(entry.evidence_refs)) {
        errors.push(`${path}.metric_deltas[${index}].evidence_refs must be an array`);
      }
    });
  }

  if (Array.isArray(value.evidence)) {
    value.evidence.forEach((entry, index) => {
      validateEvidenceItem(entry, `${path}.evidence[${index}]`, errors);
    });
  }
}

function validateFinancialIndicators(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  for (const field of ["prompt_version", "period", "basis"] as const) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }
  if (!["ttm", "annual", "mixed"].includes(String(value.basis))) {
    errors.push(`${path}.basis must be valid`);
  }

  for (const field of ["valuation", "profitability", "growth", "balance_sheet", "cash_flow_quality", "capital_allocation", "five_year_trends", "omissions", "evidence"] as const) {
    if (!Array.isArray(value[field])) {
      errors.push(`${path}.${field} must be an array`);
    }
  }

  for (const group of ["valuation", "profitability", "growth", "balance_sheet", "cash_flow_quality", "capital_allocation"] as const) {
    const entries = value[group];
    if (!Array.isArray(entries)) {
      continue;
    }
    entries.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.${group}[${index}] must be an object`);
        return;
      }
      for (const field of ["indicator_id", "label", "unit", "period", "state", "interpretation"] as const) {
        if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
          errors.push(`${path}.${group}[${index}].${field} must be a non-empty string`);
        }
      }
      if (!["currency", "pct", "ratio", "multiple", "count"].includes(String(entry.unit))) {
        errors.push(`${path}.${group}[${index}].unit must be valid`);
      }
      if (!["available", "missing", "invalid"].includes(String(entry.state))) {
        errors.push(`${path}.${group}[${index}].state must be valid`);
      }
      if (!Array.isArray(entry.evidence_refs)) {
        errors.push(`${path}.${group}[${index}].evidence_refs must be an array`);
      }
    });
  }

  if (!isObject(value.value_classification)) {
    errors.push(`${path}.value_classification must be an object`);
  } else {
    if (
      ![
        "classic_value",
        "quality_value",
        "quality_growth",
        "expensive_growth",
        "turnaround",
        "distressed",
        "value_trap_risk",
        "insufficient_data"
      ].includes(String(value.value_classification.classification))
    ) {
      errors.push(`${path}.value_classification.classification must be valid`);
    }
    if (!["high", "medium", "low"].includes(String(value.value_classification.confidence))) {
      errors.push(`${path}.value_classification.confidence must be valid`);
    }
    if (!Array.isArray(value.value_classification.reasons)) {
      errors.push(`${path}.value_classification.reasons must be an array`);
    }
    if (!Array.isArray(value.value_classification.trap_warnings)) {
      errors.push(`${path}.value_classification.trap_warnings must be an array`);
    }
  }

  if (!isObject(value.plain_english)) {
    errors.push(`${path}.plain_english must be an object`);
  } else {
    for (const field of ["value_lens", "business_quality", "balance_sheet_read", "cash_flow_read", "five_year_read", "plain_english_takeaway", "what_to_watch_next"] as const) {
      if (typeof value.plain_english[field] !== "string" || value.plain_english[field].trim().length === 0) {
        errors.push(`${path}.plain_english.${field} must be a non-empty string`);
      }
    }
  }

  if (Array.isArray(value.evidence)) {
    value.evidence.forEach((entry, index) => validateEvidenceItem(entry, `${path}.evidence[${index}]`, errors));
  }
}

function validateInvestmentMemo(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.prompt_version !== "string" || value.prompt_version.trim().length === 0) {
    errors.push(`${path}.prompt_version must be a non-empty string`);
  }
  if (
    !["deterministic_fixture", "live_prompt", "fallback"].includes(
      String(value.generation_mode)
    )
  ) {
    errors.push(`${path}.generation_mode must be valid`);
  }
  if (typeof value.company_angle !== "string" || value.company_angle.trim().length === 0) {
    errors.push(`${path}.company_angle must be a non-empty string`);
  }
  if (
    typeof value.decision_question !== "string" ||
    value.decision_question.trim().length === 0
  ) {
    errors.push(`${path}.decision_question must be a non-empty string`);
  }
  if (
    typeof value.sparse_data_honesty_note !== "string" ||
    value.sparse_data_honesty_note.trim().length === 0
  ) {
    errors.push(`${path}.sparse_data_honesty_note must be a non-empty string`);
  }
  if (!isStringArray(value.unsupported_claims)) {
    errors.push(`${path}.unsupported_claims must be an array of strings`);
  }

  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push(`${path}.sections must be a non-empty array`);
  } else {
    value.sections.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.sections[${index}] must be an object`);
        return;
      }
      if (
        ![
          "investment_thesis",
          "what_changed",
          "business_quality",
          "valuation",
          "risks"
        ].includes(String(entry.section_id))
      ) {
        errors.push(`${path}.sections[${index}].section_id must be valid`);
      }
      if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
        errors.push(`${path}.sections[${index}].title must be a non-empty string`);
      }
      if (typeof entry.narrative !== "string" || entry.narrative.trim().length === 0) {
        errors.push(`${path}.sections[${index}].narrative must be a non-empty string`);
      }
      if (!isStringArray(entry.key_points)) {
        errors.push(`${path}.sections[${index}].key_points must be an array of strings`);
      }
    });
  }

  if (!Array.isArray(value.material_claims)) {
    errors.push(`${path}.material_claims must be an array`);
  } else {
    value.material_claims.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.material_claims[${index}] must be an object`);
        return;
      }
      if (typeof entry.claim_id !== "string" || entry.claim_id.trim().length === 0) {
        errors.push(`${path}.material_claims[${index}].claim_id must be a non-empty string`);
      }
      if (
        ![
          "investment_thesis",
          "what_changed",
          "business_quality",
          "valuation",
          "risks"
        ].includes(String(entry.section_id))
      ) {
        errors.push(`${path}.material_claims[${index}].section_id must be valid`);
      }
      if (typeof entry.statement !== "string" || entry.statement.trim().length === 0) {
        errors.push(`${path}.material_claims[${index}].statement must be a non-empty string`);
      }
      if (!["material", "context"].includes(String(entry.materiality))) {
        errors.push(`${path}.material_claims[${index}].materiality must be valid`);
      }
      if (!Array.isArray(entry.supports) || entry.supports.length === 0) {
        errors.push(`${path}.material_claims[${index}].supports must be a non-empty array`);
        return;
      }
      entry.supports.forEach((support, supportIndex) => {
        if (!isObject(support)) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}] must be an object`
          );
          return;
        }
        if (!["metric", "evidence", "omission"].includes(String(support.support_type))) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}].support_type must be valid`
          );
        }
        if (typeof support.ref_id !== "string" || support.ref_id.trim().length === 0) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}].ref_id must be a non-empty string`
          );
        }
        if (typeof support.summary !== "string" || support.summary.trim().length === 0) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}].summary must be a non-empty string`
          );
        }
      });
    });
  }
}

function validateDueDiligence(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.prompt_version !== "string" || value.prompt_version.trim().length === 0) {
    errors.push(`${path}.prompt_version must be a non-empty string`);
  }
  if (
    !["deterministic_fixture", "live_prompt", "fallback"].includes(
      String(value.generation_mode)
    )
  ) {
    errors.push(`${path}.generation_mode must be valid`);
  }
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push(`${path}.sections must be a non-empty array`);
    return;
  }

  value.sections.forEach((entry, index) => {
    if (!isObject(entry)) {
      errors.push(`${path}.sections[${index}] must be an object`);
      return;
    }
    if (
      ![
        "financial_analysis",
        "competitive_positioning",
        "management_and_governance",
        "risks_and_challenges",
        "growth_opportunities_and_outlook",
        "valuation_and_thesis_stance"
      ].includes(String(entry.section_id))
    ) {
      errors.push(`${path}.sections[${index}].section_id must be valid`);
    }
    if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
      errors.push(`${path}.sections[${index}].title must be a non-empty string`);
    }
    if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) {
      errors.push(`${path}.sections[${index}].summary must be a non-empty string`);
    }
    if (!Array.isArray(entry.narrative_paragraphs) || entry.narrative_paragraphs.length === 0) {
      errors.push(`${path}.sections[${index}].narrative_paragraphs must be a non-empty array`);
    } else if (!entry.narrative_paragraphs.every((paragraph) =>
      typeof paragraph === "string" && paragraph.trim().length > 0
    )) {
      errors.push(`${path}.sections[${index}].narrative_paragraphs must contain non-empty strings`);
    }
    if (!isStringArray(entry.key_points)) {
      errors.push(`${path}.sections[${index}].key_points must be an array of strings`);
    }
    if (!isStringArray(entry.evidence_refs)) {
      errors.push(`${path}.sections[${index}].evidence_refs must be an array of strings`);
    }
    if (!isStringArray(entry.omissions)) {
      errors.push(`${path}.sections[${index}].omissions must be an array of strings`);
    }
    if (!["full", "partial", "limited"].includes(String(entry.coverage_state))) {
      errors.push(`${path}.sections[${index}].coverage_state must be valid`);
    }
    if (
      Array.isArray(entry.evidence_refs) &&
      Array.isArray(entry.omissions) &&
      entry.evidence_refs.length === 0 &&
      entry.omissions.length === 0
    ) {
      errors.push(
        `${path}.sections[${index}] must include evidence_refs or omissions so unsupported depth cannot slip through`
      );
    }
  });
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

function validateStructuralContext(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (!["issuer", "market_pulse"].includes(String(value.subject_type))) {
    errors.push(`${path}.subject_type must be valid`);
  }
  if (typeof value.subject_id !== "string" || value.subject_id.trim().length === 0) {
    errors.push(`${path}.subject_id must be a non-empty string`);
  }
  if (typeof value.as_of !== "string" || value.as_of.trim().length === 0) {
    errors.push(`${path}.as_of must be a non-empty string`);
  }
  if (!["full", "partial", "limited"].includes(String(value.coverage_state))) {
    errors.push(`${path}.coverage_state must be valid`);
  }
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    errors.push(`${path}.summary must be a non-empty string`);
  }

  if (value.issuer_metadata !== undefined) {
    if (!isObject(value.issuer_metadata)) {
      errors.push(`${path}.issuer_metadata must be an object when provided`);
    } else {
      for (const field of [
        "name",
        "exchange",
        "currency",
        "domicile_country",
        "region",
        "sector",
        "industry"
      ] as const) {
        const fieldValue = value.issuer_metadata[field];
        if (fieldValue !== undefined && typeof fieldValue !== "string") {
          errors.push(`${path}.issuer_metadata.${field} must be a string when provided`);
        }
      }
    }
  }

  if (!Array.isArray(value.observations)) {
    errors.push(`${path}.observations must be an array`);
  } else {
    value.observations.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.observations[${index}] must be an object`);
        return;
      }
      if (typeof entry.observation_id !== "string" || entry.observation_id.trim().length === 0) {
        errors.push(`${path}.observations[${index}].observation_id must be a non-empty string`);
      }
      if (
        ![
          "gdp_level",
          "gdp_per_capita",
          "population",
          "trade_openness",
          "debt_context",
          "inequality",
          "logistics",
          "infrastructure",
          "education",
          "energy_access",
          "sector_mix",
          "gdp_growth_outlook",
          "inflation_regime",
          "fiscal_balance",
          "public_debt",
          "fx_reserves",
          "current_account"
        ].includes(String(entry.family))
      ) {
        errors.push(`${path}.observations[${index}].family must be valid`);
      }
      for (const field of ["label", "summary", "geography", "period"] as const) {
        if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
          errors.push(`${path}.observations[${index}].${field} must be a non-empty string`);
        }
      }
      if (
        !["sec_edgar", "treasury", "bls", "bea", "eia", "world_bank", "imf"].includes(
          String(entry.source_family)
        )
      ) {
        errors.push(`${path}.observations[${index}].source_family must be valid`);
      }
      if (!isObject(entry.retrieval)) {
        errors.push(`${path}.observations[${index}].retrieval must be an object`);
      } else {
        if (!isIsoDateTime(entry.retrieval.retrieved_at)) {
          errors.push(
            `${path}.observations[${index}].retrieval.retrieved_at must be an ISO datetime string`
          );
        }
      }
      if (!Array.isArray(entry.missing_fields)) {
        errors.push(`${path}.observations[${index}].missing_fields must be an array`);
      }
    });
  }

  if (!Array.isArray(value.omissions)) {
    errors.push(`${path}.omissions must be an array`);
  } else {
    value.omissions.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.omissions[${index}] must be an object`);
        return;
      }
      if (typeof entry.omission_id !== "string" || entry.omission_id.trim().length === 0) {
        errors.push(`${path}.omissions[${index}].omission_id must be a non-empty string`);
      }
      if (typeof entry.reason_code !== "string" || entry.reason_code.trim().length === 0) {
        errors.push(`${path}.omissions[${index}].reason_code must be a non-empty string`);
      }
      if (typeof entry.reason_text !== "string" || entry.reason_text.trim().length === 0) {
        errors.push(`${path}.omissions[${index}].reason_text must be a non-empty string`);
      }
      if (typeof entry.blocking !== "boolean") {
        errors.push(`${path}.omissions[${index}].blocking must be a boolean`);
      }
    });
  }

  if (!Array.isArray(value.retrievals)) {
    errors.push(`${path}.retrievals must be an array`);
  } else {
    value.retrievals.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`${path}.retrievals[${index}] must be an object`);
        return;
      }
      if (!isIsoDateTime(entry.retrieved_at)) {
        errors.push(`${path}.retrievals[${index}].retrieved_at must be an ISO datetime string`);
      }
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
  if (report.issuer !== undefined) {
    if (!isObject(report.issuer)) {
      errors.push("issuer must be an object when provided");
    } else {
      if (typeof report.issuer.name !== "string" || report.issuer.name.trim().length === 0) {
        errors.push("issuer.name must be a non-empty string");
      }
      if (report.issuer.exchange !== undefined && typeof report.issuer.exchange !== "string") {
        errors.push("issuer.exchange must be a string when provided");
      }
      for (const field of [
        "currency",
        "domicile_country",
        "region",
        "sector",
        "industry"
      ] as const) {
        if (report.issuer[field] !== undefined && typeof report.issuer[field] !== "string") {
          errors.push(`issuer.${field} must be a string when provided`);
        }
      }
    }
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
  if (report.investment_memo !== undefined) {
    validateInvestmentMemo(report.investment_memo, "investment_memo", errors);
  }
  if (report.due_diligence !== undefined) {
    validateDueDiligence(report.due_diligence, "due_diligence", errors);
  }
  if (report.filing_intelligence !== undefined) {
    validateFilingIntelligence(report.filing_intelligence, "filing_intelligence", errors);
  }
  if (report.financial_indicators !== undefined) {
    validateFinancialIndicators(report.financial_indicators, "financial_indicators", errors);
  }
  if (report.structural_context !== undefined) {
    validateStructuralContext(report.structural_context, "structural_context", errors);
  }
  if (report.financial_analysis !== undefined) {
    validateFinancialAnalysis(report.financial_analysis, "financial_analysis", errors);
  }
  if (report.value_discipline !== undefined) {
    validateValueDiscipline(report.value_discipline, "value_discipline", errors);
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
