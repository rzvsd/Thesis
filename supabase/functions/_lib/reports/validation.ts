// Deep Dive report validator entry points. Copied unchanged from apps/product-api/src/report-validation.ts.
// GET /reports/:id and /r/:token use assertIncomingAnalysisReport; M2 uses it when a job completes.
import type { AnalysisReport } from "./types.ts";
import { isIsoDateTime, isObject, isStringArray } from "./validation_common.ts";
import {
  validateChangeSummary,
  validateCoverageTruth,
  validateEvidenceItem,
  validateExplainers,
  validateFilingIntelligence,
  validateFinancialIndicators,
  validateKillSwitchCondition,
  validateNameRelationshipDraft,
  validateSection,
  validateStoryHeader,
  validateTrustMetadata,
  validateVisualPanel,
} from "./validation_blocks_a.ts";
import {
  validateDueDiligence,
  validateFinancialAnalysis,
  validateInvestmentMemo,
  validateStructuralContext,
  validateValueDiscipline,
} from "./validation_blocks_b.ts";

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
  if (
    report.ticker !== undefined && (typeof report.ticker !== "string" || report.ticker.trim().length === 0)
  ) {
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
      for (
        const field of [
          "currency",
          "domicile_country",
          "region",
          "sector",
          "industry",
        ] as const
      ) {
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
        String(report.confidence.label),
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
          errors,
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
          errors,
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
