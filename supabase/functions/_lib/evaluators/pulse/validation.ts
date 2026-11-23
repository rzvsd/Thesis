// Market Pulse shape checks, part 2. Copied from apps/product-api/src/market-pulse-validation.ts
// (keep tested logic). Part 1 is validation_parts.ts. assertIncomingMarketPulseReport runs on every build.
import {
  marketPulseEditorialGenerationModes,
  marketPulseEditorialGenerationStatuses,
  type MarketPulseReport,
  userResearchDeltaStates,
  userResearchEvidenceKinds,
  userResearchOmissionFamilies,
} from "./contracts.ts";
import {
  isIsoDateTime,
  isObject,
  isStringArray,
  validateAllowedKeys,
  validateContext,
  validateEditorialIssue,
  validateEvidenceItem,
  validateMacroStress,
  validateMarketTape,
  validateMorningEdition,
  validateSection,
  validateStructuralContext,
} from "./validation_parts.ts";

const userResearchDeltaStateSet = new Set<string>(userResearchDeltaStates);
const userResearchEvidenceKindSet = new Set<string>(userResearchEvidenceKinds);
const userResearchOmissionFamilySet = new Set<string>(userResearchOmissionFamilies);
const marketPulseEditorialGenerationModeSet = new Set<string>(marketPulseEditorialGenerationModes);
const marketPulseEditorialGenerationStatusSet = new Set<string>(marketPulseEditorialGenerationStatuses);

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
      "coverage_notes",
    ],
    errors,
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
      if (
        !["geopolitical", "macro_policy", "central_bank", "war_conflict", "trade", "energy", "supply_chain"]
          .includes(String(item.topic))
      ) {
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
  validateAllowedKeys(
    value,
    path,
    ["ticker", "quantity", "cost_basis", "label", "notes", "updated_at"],
    errors,
  );
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
        errors.push(
          `${path}.${key} must be a non-empty string${key === "updated_at" ? "" : " when provided"}`,
        );
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

function validateUserResearchDailyDelta(
  value: Record<string, unknown>,
  path: string,
  errors: string[],
): void {
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
      "evidence_refs",
    ],
    errors,
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
          "omissions",
        ],
        errors,
      );
      if (typeof name.ticker !== "string" || name.ticker.trim().length === 0) {
        errors.push(`user_research_state.names[${index}].ticker must be a non-empty string`);
      }
      for (
        const key of ["company_name", "latest_report_id", "latest_report_generated_at", "latest_pulse_id"]
      ) {
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
        validateUserResearchDailyDelta(
          name.daily_delta,
          `user_research_state.names[${index}].daily_delta`,
          errors,
        );
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
            errors,
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
            errors,
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
        String(report.confidence.label),
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
      "uncertainty_flags",
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
      "watchlist_overlay",
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
