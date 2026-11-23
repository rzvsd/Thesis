// Ported from apps/product-api/src/report-validation.ts. Logic is unchanged; only imports differ.

import { isObject, isStringArray, validateEvidenceItem } from "./report-validation-core.ts";

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

export function validateInvestmentMemo(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.prompt_version !== "string" || value.prompt_version.trim().length === 0) {
    errors.push(`${path}.prompt_version must be a non-empty string`);
  }
  if (
    !["deterministic_fixture", "live_prompt", "fallback"].includes(
      String(value.generation_mode),
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
          "risks",
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
          "risks",
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
            `${path}.material_claims[${index}].supports[${supportIndex}] must be an object`,
          );
          return;
        }
        if (!["metric", "evidence", "omission"].includes(String(support.support_type))) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}].support_type must be valid`,
          );
        }
        if (typeof support.ref_id !== "string" || support.ref_id.trim().length === 0) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}].ref_id must be a non-empty string`,
          );
        }
        if (typeof support.summary !== "string" || support.summary.trim().length === 0) {
          errors.push(
            `${path}.material_claims[${index}].supports[${supportIndex}].summary must be a non-empty string`,
          );
        }
      });
    });
  }
}

export function validateDueDiligence(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.prompt_version !== "string" || value.prompt_version.trim().length === 0) {
    errors.push(`${path}.prompt_version must be a non-empty string`);
  }
  if (
    !["deterministic_fixture", "live_prompt", "fallback"].includes(
      String(value.generation_mode),
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
        "valuation_and_thesis_stance",
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
    } else if (
      !entry.narrative_paragraphs.every((paragraph) =>
        typeof paragraph === "string" && paragraph.trim().length > 0
      )
    ) {
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
        `${path}.sections[${index}] must include evidence_refs or omissions so unsupported depth cannot slip through`,
      );
    }
  });
}

export function validateFinancialHistoryRow(value: unknown, path: string, errors: string[]): void {
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
  for (
    const field of [
      "revenue",
      "gross_margin",
      "operating_margin",
      "net_income",
      "free_cash_flow",
      "debt_total",
      "cash_and_equivalents",
      "shares_outstanding",
    ] as const
  ) {
    if (value[field] !== undefined && typeof value[field] !== "number") {
      errors.push(`${path}.${field} must be a number when provided`);
    }
  }
}

export function validateFinancialDerivedMetric(value: unknown, path: string, errors: string[]): void {
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
      String(value.direction),
    )
  ) {
    errors.push(`${path}.direction must be valid`);
  }
  if (value.note !== undefined && typeof value.note !== "string") {
    errors.push(`${path}.note must be a string when provided`);
  }
}

export function validateFinancialOmission(value: unknown, path: string, errors: string[]): void {
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

export function validateFinancialAnalysis(value: unknown, path: string, errors: string[]): void {
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
