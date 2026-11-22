import {
  marketPulseEditorialGenerationModes,
  marketPulseEditorialGenerationStatuses,
  userResearchDeltaStates,
  userResearchEvidenceKinds,
  userResearchOmissionFamilies,
  type MarketPulseReport
} from "../../../packages/contracts/src";

const userResearchDeltaStateSet = new Set<string>(userResearchDeltaStates);
const userResearchEvidenceKindSet = new Set<string>(userResearchEvidenceKinds);
const userResearchOmissionFamilySet = new Set<string>(userResearchOmissionFamilies);
const marketPulseEditorialGenerationModeSet = new Set<string>(marketPulseEditorialGenerationModes);
const marketPulseEditorialGenerationStatusSet = new Set<string>(marketPulseEditorialGenerationStatuses);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[],
  errors: string[]
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${path}.${key} is not allowed`);
    }
  }
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

function validateMarketTapeMove(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.instrument_id !== "string" || value.instrument_id.trim().length === 0) {
    errors.push(`${path}.instrument_id must be a non-empty string`);
  }
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    errors.push(`${path}.label must be a non-empty string`);
  }
  if (
    !["core_index", "volatility", "rates", "commodity", "currency", "credit", "sector"].includes(
      String(value.family)
    )
  ) {
    errors.push(`${path}.family must be valid`);
  }
  if (typeof value.period !== "string" || value.period.trim().length === 0) {
    errors.push(`${path}.period must be a non-empty string`);
  }
  if (!["up", "down", "flat"].includes(String(value.direction))) {
    errors.push(`${path}.direction must be valid`);
  }
  if (!isObject(value.retrieval)) {
    errors.push(`${path}.retrieval must be an object`);
  }
  if (!Array.isArray(value.missing_fields)) {
    errors.push(`${path}.missing_fields must be an array`);
  }
}

function validateMarketTape(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!isObject(value)) {
    errors.push("market_tape must be an object when provided");
    return;
  }

  if (typeof value.as_of !== "string" || value.as_of.trim().length === 0) {
    errors.push("market_tape.as_of must be a non-empty string");
  }
  if (!["full", "partial", "limited"].includes(String(value.coverage_state))) {
    errors.push("market_tape.coverage_state must be valid");
  }
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    errors.push("market_tape.summary must be a non-empty string");
  }
  if (!Array.isArray(value.indices)) {
    errors.push("market_tape.indices must be an array");
  } else {
    value.indices.forEach((entry, index) => {
      validateMarketTapeMove(entry, `market_tape.indices[${index}]`, errors);
    });
  }
  if (!Array.isArray(value.cross_asset)) {
    errors.push("market_tape.cross_asset must be an array");
  } else {
    value.cross_asset.forEach((entry, index) => {
      validateMarketTapeMove(entry, `market_tape.cross_asset[${index}]`, errors);
    });
  }
  if (value.sector_leadership !== undefined) {
    if (!isObject(value.sector_leadership)) {
      errors.push("market_tape.sector_leadership must be an object when provided");
    } else {
      if (
        typeof value.sector_leadership.basket_id !== "string" ||
        value.sector_leadership.basket_id.trim().length === 0
      ) {
        errors.push("market_tape.sector_leadership.basket_id must be a non-empty string");
      }
      if (!Array.isArray(value.sector_leadership.leaders)) {
        errors.push("market_tape.sector_leadership.leaders must be an array");
      } else {
        value.sector_leadership.leaders.forEach((entry, index) => {
          validateMarketTapeMove(entry, `market_tape.sector_leadership.leaders[${index}]`, errors);
        });
      }
      if (!Array.isArray(value.sector_leadership.laggards)) {
        errors.push("market_tape.sector_leadership.laggards must be an array");
      } else {
        value.sector_leadership.laggards.forEach((entry, index) => {
          validateMarketTapeMove(entry, `market_tape.sector_leadership.laggards[${index}]`, errors);
        });
      }
      if (typeof value.sector_leadership.notable !== "boolean") {
        errors.push("market_tape.sector_leadership.notable must be a boolean");
      }
    }
  }
  if (!Array.isArray(value.retrievals)) {
    errors.push("market_tape.retrievals must be an array");
  }
  if (!Array.isArray(value.omissions)) {
    errors.push("market_tape.omissions must be an array");
  }
}

function validateEditorialItem(value: unknown, path: string, errors: string[], watchItem = false): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!["market_tape", "macro", "calendar", "company_event", "coverage", "context"].includes(String(value.kind))) {
    errors.push(`${path}.kind must be valid`);
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    errors.push(`${path}.title must be a non-empty string`);
  }
  if (typeof value.body !== "string" || value.body.trim().length === 0) {
    errors.push(`${path}.body must be a non-empty string`);
  }
  if (!["baseline", "new", "updated", "unchanged", "omitted"].includes(String(value.freshness_state))) {
    errors.push(`${path}.freshness_state must be valid`);
  }
  if (!["high", "medium", "low"].includes(String(value.importance))) {
    errors.push(`${path}.importance must be valid`);
  }
  if (watchItem && value.watch_date !== undefined && typeof value.watch_date !== "string") {
    errors.push(`${path}.watch_date must be a string when provided`);
  }
  if (!Array.isArray(value.evidence)) {
    errors.push(`${path}.evidence must be an array`);
  } else {
    value.evidence.forEach((item, index) => {
      validateEvidenceItem(item, `${path}.evidence[${index}]`, errors);
    });
  }
}

function validateEditorialIssue(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isObject(value)) {
    errors.push("editorial_issue must be an object when provided");
    return;
  }

  for (const key of ["issue_id", "headline", "dek", "lead"]) {
    if (typeof value[key] !== "string" || String(value[key]).trim().length === 0) {
      errors.push(`editorial_issue.${key} must be a non-empty string`);
    }
  }
  if (value.prior_cycle_end !== undefined && !isIsoDateTime(value.prior_cycle_end)) {
    errors.push("editorial_issue.prior_cycle_end must be an ISO datetime string when provided");
  }
  if (!["baseline", "new", "updated", "unchanged", "omitted"].includes(String(value.freshness_state))) {
    errors.push("editorial_issue.freshness_state must be valid");
  }
  for (const key of ["in_this_issue", "coverage_notes"]) {
    if (!isStringArray(value[key])) {
      errors.push(`editorial_issue.${key} must be an array of strings`);
    }
  }
  for (const key of ["what_changed", "why_it_matters", "signal_vs_noise"]) {
    if (!Array.isArray(value[key])) {
      errors.push(`editorial_issue.${key} must be an array`);
    } else {
      value[key].forEach((item, index) => {
        validateEditorialItem(item, `editorial_issue.${key}[${index}]`, errors);
      });
    }
  }
  if (!Array.isArray(value.what_to_watch)) {
    errors.push("editorial_issue.what_to_watch must be an array");
  } else {
    value.what_to_watch.forEach((item, index) => {
      validateEditorialItem(item, `editorial_issue.what_to_watch[${index}]`, errors, true);
    });
  }
  if (!Array.isArray(value.evidence)) {
    errors.push("editorial_issue.evidence must be an array");
  } else {
    value.evidence.forEach((item, index) => {
      validateEvidenceItem(item, `editorial_issue.evidence[${index}]`, errors);
    });
  }
}

function validateMorningEdition(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isObject(value)) {
    errors.push("morning_edition must be an object when provided");
    return;
  }

  for (const key of [
    "headline_digest",
    "portfolio_radar",
    "market_board",
    "today_catalysts",
    "sector_pulse",
    "coverage_notes"
  ]) {
    if (!Array.isArray(value[key])) {
      errors.push(`morning_edition.${key} must be an array`);
    }
  }

  if (Array.isArray(value.headline_digest)) {
    value.headline_digest.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`morning_edition.headline_digest[${index}] must be an object`);
        return;
      }
      if (typeof item.headline !== "string" || item.headline.trim().length === 0) {
        errors.push(`morning_edition.headline_digest[${index}].headline must be a non-empty string`);
      }
      if (typeof item.source_name !== "string" || item.source_name.trim().length === 0) {
        errors.push(`morning_edition.headline_digest[${index}].source_name must be a non-empty string`);
      }
      if (item.source_url !== undefined && typeof item.source_url !== "string") {
        errors.push(`morning_edition.headline_digest[${index}].source_url must be a string when provided`);
      } else if (typeof item.source_url === "string" && !/^https?:\/\//i.test(item.source_url.trim())) {
        errors.push(`morning_edition.headline_digest[${index}].source_url must be an http(s) URL when provided`);
      }
      if (!Array.isArray(item.evidence)) {
        errors.push(`morning_edition.headline_digest[${index}].evidence must be an array`);
      } else {
        item.evidence.forEach((evidence, evidenceIndex) => {
          validateEvidenceItem(evidence, `morning_edition.headline_digest[${index}].evidence[${evidenceIndex}]`, errors);
        });
      }
    });
  }

  if (Array.isArray(value.portfolio_radar)) {
    value.portfolio_radar.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`morning_edition.portfolio_radar[${index}] must be an object`);
        return;
      }
      if (typeof item.ticker !== "string" || item.ticker.trim().length === 0) {
        errors.push(`morning_edition.portfolio_radar[${index}].ticker must be a non-empty string`);
      }
      if (!["up", "down", "flat"].includes(String(item.direction))) {
        errors.push(`morning_edition.portfolio_radar[${index}].direction must be valid`);
      }
      if (!Array.isArray(item.evidence)) {
        errors.push(`morning_edition.portfolio_radar[${index}].evidence must be an array`);
      }
    });
  }

  if (Array.isArray(value.market_board)) {
    value.market_board.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`morning_edition.market_board[${index}] must be an object`);
        return;
      }
      if (typeof item.label !== "string" || item.label.trim().length === 0) {
        errors.push(`morning_edition.market_board[${index}].label must be a non-empty string`);
      }
      if (!["up", "down", "flat"].includes(String(item.direction))) {
        errors.push(`morning_edition.market_board[${index}].direction must be valid`);
      }
      if (!Array.isArray(item.evidence)) {
        errors.push(`morning_edition.market_board[${index}].evidence must be an array`);
      }
    });
  }

  if (Array.isArray(value.today_catalysts)) {
    value.today_catalysts.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`morning_edition.today_catalysts[${index}] must be an object`);
        return;
      }
      if (typeof item.title !== "string" || item.title.trim().length === 0) {
        errors.push(`morning_edition.today_catalysts[${index}].title must be a non-empty string`);
      }
      if (!["macro", "fed", "earnings", "company", "market"].includes(String(item.category))) {
        errors.push(`morning_edition.today_catalysts[${index}].category must be valid`);
      }
      if (!["high", "medium", "low"].includes(String(item.impact))) {
        errors.push(`morning_edition.today_catalysts[${index}].impact must be valid`);
      }
    });
  }

  if (Array.isArray(value.sector_pulse)) {
    value.sector_pulse.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`morning_edition.sector_pulse[${index}] must be an object`);
        return;
      }
      if (typeof item.label !== "string" || item.label.trim().length === 0) {
        errors.push(`morning_edition.sector_pulse[${index}].label must be a non-empty string`);
      }
      if (!["up", "down", "flat"].includes(String(item.direction))) {
        errors.push(`morning_edition.sector_pulse[${index}].direction must be valid`);
      }
    });
  }

  if (!isStringArray(value.coverage_notes)) {
    errors.push("morning_edition.coverage_notes must be an array of strings");
  }
}

function validateEditorialGeneration(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isObject(value)) {
    errors.push("editorial_generation must be an object when provided");
    return;
  }
  validateAllowedKeys(
    value,
    "editorial_generation",
    [
      "mode",
      "status",
      "provider",
      "model",
      "prompt_version",
      "generated_at",
      "source_report_id",
      "coverage_notes"
    ],
    errors
  );
  if (!marketPulseEditorialGenerationModeSet.has(String(value.mode))) {
    errors.push("editorial_generation.mode must be valid");
  }
  if (!marketPulseEditorialGenerationStatusSet.has(String(value.status))) {
    errors.push("editorial_generation.status must be valid");
  }
  if (value.provider !== undefined && value.provider !== "openrouter") {
    errors.push("editorial_generation.provider must be openrouter when provided");
  }
  for (const key of ["model", "prompt_version", "generated_at", "source_report_id"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      errors.push(`editorial_generation.${key} must be a string when provided`);
    }
  }
  if (!isStringArray(value.coverage_notes)) {
    errors.push("editorial_generation.coverage_notes must be an array of strings");
  }
}

function validateMacroNews(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isObject(value)) {
    errors.push("macro_news must be an object when provided");
    return;
  }

  if (typeof value.as_of !== "string" || value.as_of.trim().length === 0) {
    errors.push("macro_news.as_of must be a non-empty string");
  }
  if (!["calm", "watch", "shock"].includes(String(value.state))) {
    errors.push("macro_news.state must be valid");
  }
  if (typeof value.lead !== "string" || value.lead.trim().length === 0) {
    errors.push("macro_news.lead must be a non-empty string");
  }
  if (!Array.isArray(value.items)) {
    errors.push("macro_news.items must be an array");
  } else {
    value.items.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`macro_news.items[${index}] must be an object`);
        return;
      }
      for (const key of ["headline", "source_name", "why_it_matters"]) {
        if (typeof item[key] !== "string" || String(item[key]).trim().length === 0) {
          errors.push(`macro_news.items[${index}].${key} must be a non-empty string`);
        }
      }
      if (!["geopolitical", "macro_policy", "central_bank", "war_conflict", "trade", "energy", "supply_chain"].includes(String(item.topic))) {
        errors.push(`macro_news.items[${index}].topic must be valid`);
      }
      if (!["normal", "notable", "shock"].includes(String(item.severity))) {
        errors.push(`macro_news.items[${index}].severity must be valid`);
      }
      if (!["reported", "corroborated", "official_confirmed"].includes(String(item.confirmation_state))) {
        errors.push(`macro_news.items[${index}].confirmation_state must be valid`);
      }
      if (typeof item.corroboration_count !== "number") {
        errors.push(`macro_news.items[${index}].corroboration_count must be a number`);
      }
      if (!isStringArray(item.affected_regions)) {
        errors.push(`macro_news.items[${index}].affected_regions must be an array of strings`);
      }
      if (!isStringArray(item.affected_assets)) {
        errors.push(`macro_news.items[${index}].affected_assets must be an array of strings`);
      }
      if (!Array.isArray(item.evidence)) {
        errors.push(`macro_news.items[${index}].evidence must be an array`);
      } else {
        item.evidence.forEach((evidence, evidenceIndex) => {
          validateEvidenceItem(evidence, `macro_news.items[${index}].evidence[${evidenceIndex}]`, errors);
        });
      }
    });
  }
  if (!Array.isArray(value.omissions)) {
    errors.push("macro_news.omissions must be an array");
  }
  if (!isStringArray(value.coverage_notes)) {
    errors.push("macro_news.coverage_notes must be an array of strings");
  }
}

function validateUserResearchEvidenceRef(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateAllowedKeys(value, path, ["kind", "ref_id", "label", "ticker", "captured_at"], errors);
  if (!userResearchEvidenceKindSet.has(String(value.kind))) {
    errors.push(`${path}.kind must be valid`);
  }
  if (typeof value.ref_id !== "string" || value.ref_id.trim().length === 0) {
    errors.push(`${path}.ref_id must be a non-empty string`);
  }
  for (const key of ["label", "ticker", "captured_at"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      errors.push(`${path}.${key} must be a string when provided`);
    }
  }
}

function validateUserResearchHolding(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateAllowedKeys(value, path, ["ticker", "quantity", "cost_basis", "label", "notes", "updated_at"], errors);
  if (typeof value.ticker !== "string" || value.ticker.trim().length === 0) {
    errors.push(`${path}.ticker must be a non-empty string`);
  }
  for (const key of ["quantity", "cost_basis"]) {
    if (value[key] !== undefined && typeof value[key] !== "number") {
      errors.push(`${path}.${key} must be a number when provided`);
    }
  }
  for (const key of ["label", "notes", "updated_at"]) {
    if (key === "updated_at" || value[key] !== undefined) {
      if (typeof value[key] !== "string" || String(value[key]).trim().length === 0) {
        errors.push(`${path}.${key} must be a non-empty string${key === "updated_at" ? "" : " when provided"}`);
      }
    }
  }
}

function validateUserResearchOmission(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateAllowedKeys(value, path, ["family", "code", "reason", "ticker"], errors);
  if (!userResearchOmissionFamilySet.has(String(value.family))) {
    errors.push(`${path}.family must be valid`);
  }
  for (const key of ["code", "reason"]) {
    if (typeof value[key] !== "string" || String(value[key]).trim().length === 0) {
      errors.push(`${path}.${key} must be a non-empty string`);
    }
  }
  if (value.ticker !== undefined && typeof value.ticker !== "string") {
    errors.push(`${path}.ticker must be a string when provided`);
  }
}

function validateUserResearchDailyDelta(value: Record<string, unknown>, path: string, errors: string[]): void {
  validateAllowedKeys(value, path, ["state", "title", "body", "evidence_refs"], errors);
  if (!userResearchDeltaStateSet.has(String(value.state))) {
    errors.push(`${path}.state must be valid`);
  }
  for (const key of ["title", "body"]) {
    if (typeof value[key] !== "string" || String(value[key]).trim().length === 0) {
      errors.push(`${path}.${key} must be a non-empty string`);
    }
  }
  if (!Array.isArray(value.evidence_refs)) {
    errors.push(`${path}.evidence_refs must be an array`);
  } else {
    value.evidence_refs.forEach((ref, index) =>
      validateUserResearchEvidenceRef(ref, `${path}.evidence_refs[${index}]`, errors)
    );
  }
}

function validateUserResearchState(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isObject(value)) {
    errors.push("user_research_state must be an object when provided");
    return;
  }
  validateAllowedKeys(
    value,
    "user_research_state",
    [
      "state_id",
      "user_id",
      "as_of",
      "generated_at",
      "prior_state_id",
      "watchlist_tickers",
      "holdings",
      "names",
      "omissions",
      "evidence_refs"
    ],
    errors
  );
  for (const key of ["state_id", "user_id", "as_of", "generated_at"]) {
    if (typeof value[key] !== "string" || String(value[key]).trim().length === 0) {
      errors.push(`user_research_state.${key} must be a non-empty string`);
    }
  }
  if (value.prior_state_id !== undefined && typeof value.prior_state_id !== "string") {
    errors.push("user_research_state.prior_state_id must be a string when provided");
  }
  for (const key of ["watchlist_tickers", "holdings", "names", "omissions", "evidence_refs"]) {
    if (!Array.isArray(value[key])) {
      errors.push(`user_research_state.${key} must be an array`);
    }
  }
  if (Array.isArray(value.watchlist_tickers) && !isStringArray(value.watchlist_tickers)) {
    errors.push("user_research_state.watchlist_tickers must be an array of strings");
  }
  if (Array.isArray(value.holdings)) {
    value.holdings.forEach((holding, index) =>
      validateUserResearchHolding(holding, `user_research_state.holdings[${index}]`, errors)
    );
  }
  if (Array.isArray(value.omissions)) {
    value.omissions.forEach((omission, index) =>
      validateUserResearchOmission(omission, `user_research_state.omissions[${index}]`, errors)
    );
  }
  if (Array.isArray(value.evidence_refs)) {
    value.evidence_refs.forEach((ref, index) =>
      validateUserResearchEvidenceRef(ref, `user_research_state.evidence_refs[${index}]`, errors)
    );
  }
  if (Array.isArray(value.names)) {
    value.names.forEach((name, index) => {
      if (!isObject(name)) {
        errors.push(`user_research_state.names[${index}] must be an object`);
        return;
      }
      validateAllowedKeys(
        name,
        `user_research_state.names[${index}]`,
        [
          "ticker",
          "company_name",
          "in_watchlist",
          "holding",
          "monitor_state",
          "freshness_state",
          "latest_report_id",
          "latest_report_generated_at",
          "latest_pulse_id",
          "daily_delta",
          "summary",
          "what_changed",
          "why_it_matters",
          "what_to_watch",
          "evidence_refs",
          "omissions"
        ],
        errors
      );
      if (typeof name.ticker !== "string" || name.ticker.trim().length === 0) {
        errors.push(`user_research_state.names[${index}].ticker must be a non-empty string`);
      }
      for (const key of ["company_name", "latest_report_id", "latest_report_generated_at", "latest_pulse_id"]) {
        if (name[key] !== undefined && typeof name[key] !== "string") {
          errors.push(`user_research_state.names[${index}].${key} must be a string when provided`);
        }
      }
      if (typeof name.in_watchlist !== "boolean") {
        errors.push(`user_research_state.names[${index}].in_watchlist must be a boolean`);
      }
      if (name.holding !== undefined) {
        validateUserResearchHolding(name.holding, `user_research_state.names[${index}].holding`, errors);
      }
      if (
        name.monitor_state !== undefined &&
        !["intact", "improved", "weakened", "unresolved"].includes(String(name.monitor_state))
      ) {
        errors.push(`user_research_state.names[${index}].monitor_state must be valid when provided`);
      }
      if (
        name.freshness_state !== undefined &&
        !["current", "aging", "stale", "triggered"].includes(String(name.freshness_state))
      ) {
        errors.push(`user_research_state.names[${index}].freshness_state must be valid when provided`);
      }
      if (!isObject(name.daily_delta)) {
        errors.push(`user_research_state.names[${index}].daily_delta must be an object`);
      } else {
        validateUserResearchDailyDelta(name.daily_delta, `user_research_state.names[${index}].daily_delta`, errors);
      }
      for (const key of ["summary", "what_changed", "why_it_matters", "what_to_watch"]) {
        if (typeof name[key] !== "string" || String(name[key]).trim().length === 0) {
          errors.push(`user_research_state.names[${index}].${key} must be a non-empty string`);
        }
      }
      if (!Array.isArray(name.evidence_refs)) {
        errors.push(`user_research_state.names[${index}].evidence_refs must be an array`);
      } else {
        name.evidence_refs.forEach((ref, refIndex) =>
          validateUserResearchEvidenceRef(
            ref,
            `user_research_state.names[${index}].evidence_refs[${refIndex}]`,
            errors
          )
        );
      }
      if (!Array.isArray(name.omissions)) {
        errors.push(`user_research_state.names[${index}].omissions must be an array`);
      } else {
        name.omissions.forEach((omission, omissionIndex) =>
          validateUserResearchOmission(
            omission,
            `user_research_state.names[${index}].omissions[${omissionIndex}]`,
            errors
          )
        );
      }
    });
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
  validateMarketTape(report.market_tape, errors);
  validateEditorialIssue(report.editorial_issue, errors);
  validateEditorialGeneration(report.editorial_generation, errors);
  validateMacroNews(report.macro_news, errors);
  validateMorningEdition(report.morning_edition, errors);
  validateContext(report.context, errors);
  validateStructuralContext(report.structural_context, errors);
  validateUserResearchState(report.user_research_state, errors);

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
      "market_tape",
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
      "what_changed",
      "why_it_matters",
      "what_to_watch",
      "signal_vs_noise",
      "macro_news",
      "market_board",
      "portfolio_radar",
      "today_catalysts",
      "headline_digest",
      "sector_pulse",
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
