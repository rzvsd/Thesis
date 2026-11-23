// Deep Dive report validator, part B (memo, due diligence, financial analysis, value discipline, structural).
// Copied unchanged from apps/product-api/src/report-validation.ts.
import { isIsoDateTime, isObject, isStringArray } from "./validation_common.ts";

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

export function validateValueDisciplineSignal(value: unknown, path: string, errors: string[]): void {
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
      "capital_discipline",
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

export function validateValueDiscipline(value: unknown, path: string, errors: string[]): void {
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
      "general",
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

export function validateStructuralContext(value: unknown, path: string, errors: string[]): void {
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
      for (
        const field of [
          "name",
          "exchange",
          "currency",
          "domicile_country",
          "region",
          "sector",
          "industry",
        ] as const
      ) {
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
          "current_account",
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
          String(entry.source_family),
        )
      ) {
        errors.push(`${path}.observations[${index}].source_family must be valid`);
      }
      if (!isObject(entry.retrieval)) {
        errors.push(`${path}.observations[${index}].retrieval must be an object`);
      } else {
        if (!isIsoDateTime(entry.retrieval.retrieved_at)) {
          errors.push(
            `${path}.observations[${index}].retrieval.retrieved_at must be an ISO datetime string`,
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
