// Deep Dive report validator, part A (evidence, sections, trust, kill switch, panels, filing, indicators).
// Copied unchanged from apps/product-api/src/report-validation.ts.
import { isIsoDateTime, isObject, isStringArray } from "./validation_common.ts";

export function validateEvidenceItem(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.evidence_id !== "string" || value.evidence_id.trim().length === 0) {
    errors.push(`${path}.evidence_id must be a non-empty string`);
  }
  if (
    !["filing", "article", "financial_data", "macro_data"].includes(
      String(value.source_type),
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

export function validateSection(value: unknown, path: string, errors: string[]): void {
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

export function validateTrustMetadata(value: unknown, path: string, errors: string[]): void {
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
          `${path}.contradictions[${index}].description must be a non-empty string`,
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
          `${path}.quote_provenance[${index}].source_name must be a non-empty string`,
        );
      }
      if (
        !["filing", "article", "financial_data", "macro_data"].includes(
          String(item.source_type),
        )
      ) {
        errors.push(`${path}.quote_provenance[${index}].source_type must be valid`);
      }
      if (item.retrieved_at !== undefined && !isIsoDateTime(item.retrieved_at)) {
        errors.push(
          `${path}.quote_provenance[${index}].retrieved_at must be an ISO datetime string`,
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

export function validateKillSwitchCondition(value: unknown, path: string, errors: string[]): void {
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
      "custom",
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

export function validateNameRelationshipDraft(value: unknown, path: string, errors: string[]): void {
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

export function validateStoryHeader(value: unknown, path: string, errors: string[]): void {
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

export function validateChangeSummary(value: unknown, path: string, errors: string[]): void {
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

export function validateVisualPanel(value: unknown, path: string, errors: string[]): void {
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
      "scenario_compare",
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

export function validateExplainers(value: unknown, path: string, errors: string[]): void {
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

export function validateCoverageTruth(value: unknown, path: string, errors: string[]): void {
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

export function validateFilingIntelligence(value: unknown, path: string, errors: string[]): void {
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

  for (
    const field of [
      "comparison_filings",
      "metric_deltas",
      "language_deltas",
      "segment_deltas",
      "top_changes",
      "good",
      "bad",
      "interesting",
      "omissions",
      "evidence",
    ] as const
  ) {
    if (!Array.isArray(value[field])) {
      errors.push(`${path}.${field} must be an array`);
    }
  }

  if (!isObject(value.memo)) {
    errors.push(`${path}.memo must be an object`);
  } else {
    for (
      const field of [
        "the_filing_read",
        "what_changed",
        "the_good",
        "the_bad",
        "the_interesting",
        "management_tone",
        "risk_watch",
        "plain_english_takeaway",
        "what_to_watch_next",
      ] as const
    ) {
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
      for (
        const field of [
          "metric",
          "label",
          "basis",
          "current_period",
          "unit",
          "direction",
          "plain_english",
          "why_it_matters",
        ] as const
      ) {
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

export function validateFinancialIndicators(value: unknown, path: string, errors: string[]): void {
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
  if (value.price_reference !== undefined) {
    if (!isObject(value.price_reference)) {
      errors.push(`${path}.price_reference must be an object`);
    } else {
      for (
        const field of [
          "source_name",
          "retrieved_at",
          "price_date",
          "currency",
          "price_kind",
          "provenance_note",
        ] as const
      ) {
        if (
          typeof value.price_reference[field] !== "string" || value.price_reference[field].trim().length === 0
        ) {
          errors.push(`${path}.price_reference.${field} must be a non-empty string`);
        }
      }
      if (
        !["live", "delayed", "close", "fixture", "manual"].includes(String(value.price_reference.price_kind))
      ) {
        errors.push(`${path}.price_reference.price_kind must be valid`);
      }
      if (typeof value.price_reference.value !== "number" || !Number.isFinite(value.price_reference.value)) {
        errors.push(`${path}.price_reference.value must be a finite number`);
      }
    }
  }
  if (value.calculation_basis !== undefined) {
    if (!isObject(value.calculation_basis)) {
      errors.push(`${path}.calculation_basis must be an object`);
    } else {
      if (!Array.isArray(value.calculation_basis.ttm_periods)) {
        errors.push(`${path}.calculation_basis.ttm_periods must be an array`);
      }
      if (
        typeof value.calculation_basis.note !== "string" || value.calculation_basis.note.trim().length === 0
      ) {
        errors.push(`${path}.calculation_basis.note must be a non-empty string`);
      }
    }
  }

  for (
    const field of [
      "valuation",
      "profitability",
      "growth",
      "balance_sheet",
      "cash_flow_quality",
      "capital_allocation",
      "five_year_trends",
      "omissions",
      "evidence",
    ] as const
  ) {
    if (!Array.isArray(value[field])) {
      errors.push(`${path}.${field} must be an array`);
    }
  }

  for (
    const group of [
      "valuation",
      "profitability",
      "growth",
      "balance_sheet",
      "cash_flow_quality",
      "capital_allocation",
    ] as const
  ) {
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

  if (value.benchmarks !== undefined) {
    if (!Array.isArray(value.benchmarks)) {
      errors.push(`${path}.benchmarks must be an array`);
    } else {
      value.benchmarks.forEach((entry, index) => {
        if (!isObject(entry)) {
          errors.push(`${path}.benchmarks[${index}] must be an object`);
          return;
        }
        for (
          const field of ["indicator_id", "label", "cohort", "unit", "comparison", "plain_english"] as const
        ) {
          if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
            errors.push(`${path}.benchmarks[${index}].${field} must be a non-empty string`);
          }
        }
        if (!["below", "near", "above", "unavailable"].includes(String(entry.comparison))) {
          errors.push(`${path}.benchmarks[${index}].comparison must be valid`);
        }
      });
    }
  }

  if (value.education !== undefined) {
    if (!Array.isArray(value.education)) {
      errors.push(`${path}.education must be an array`);
    } else {
      value.education.forEach((entry, index) => {
        if (!isObject(entry)) {
          errors.push(`${path}.education[${index}] must be an object`);
          return;
        }
        for (const field of ["topic", "title", "body"] as const) {
          if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
            errors.push(`${path}.education[${index}].${field} must be a non-empty string`);
          }
        }
        if (
          !["classification", "value_trap", "valuation_multiple", "cash_flow_quality", "debt_risk", "roic"]
            .includes(String(entry.topic))
        ) {
          errors.push(`${path}.education[${index}].topic must be valid`);
        }
        if (!Array.isArray(entry.evidence_refs)) {
          errors.push(`${path}.education[${index}].evidence_refs must be an array`);
        }
      });
    }
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
        "insufficient_data",
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
    for (
      const field of [
        "value_lens",
        "business_quality",
        "balance_sheet_read",
        "cash_flow_read",
        "five_year_read",
        "plain_english_takeaway",
        "what_to_watch_next",
      ] as const
    ) {
      if (typeof value.plain_english[field] !== "string" || value.plain_english[field].trim().length === 0) {
        errors.push(`${path}.plain_english.${field} must be a non-empty string`);
      }
    }
  }

  if (Array.isArray(value.evidence)) {
    value.evidence.forEach((entry, index) =>
      validateEvidenceItem(entry, `${path}.evidence[${index}]`, errors)
    );
  }
}
