// Ported from apps/product-api/src/report-validation.ts. Logic is unchanged; only imports differ.

import { isIsoDateTime, isObject, isStringArray } from "./report-validation-core.ts";

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
