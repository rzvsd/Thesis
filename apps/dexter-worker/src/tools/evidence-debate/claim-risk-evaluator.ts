import type { EvidenceItem, ReportSection } from "../../../../../packages/contracts/src";
import type { FinancialAnalysisToolData } from "../financial-analysis/financial-analysis-tool";

export interface ClaimRiskEvaluation {
  score: number;
  reasons: string[];
  evidenceRefs: string[];
  missingEvidence: string[];
}

export function evaluateClaimRisk(input: {
  sections: ReportSection[];
  financialTool?: FinancialAnalysisToolData;
}): ClaimRiskEvaluation {
  const allEvidence = input.sections.flatMap((section) => section.evidence);
  const evidenceRefs = uniqueEvidenceRefs(allEvidence);
  const completeSections = input.sections.filter((section) => section.status === "complete").length;
  const degradedSections = input.sections.filter((section) => section.status !== "complete").length;
  const officialEvidence = allEvidence.filter((item) =>
    ["filing", "financial_data", "macro_data"].includes(item.source_type)
  ).length;
  const redFlagPenalty = input.financialTool?.red_flags.reduce((sum, flag) => {
    if (flag.severity === "high") {
      return sum + 0.18;
    }
    if (flag.severity === "medium") {
      return sum + 0.1;
    }
    return sum + 0.04;
  }, 0) ?? 0;

  let score = 0.35;
  score += Math.min(0.25, completeSections * 0.04);
  score += Math.min(0.25, officialEvidence * 0.03);
  score -= Math.min(0.25, degradedSections * 0.06);
  score -= allEvidence.length === 0 ? 0.25 : 0;
  score -= redFlagPenalty;
  score = Math.max(0, Math.min(1, score));

  const reasons: string[] = [];
  if (completeSections > 0) {
    reasons.push(`${completeSections} completed sections were available for evidence review.`);
  }
  if (officialEvidence > 0) {
    reasons.push(`${officialEvidence} official or financial evidence items supported the review.`);
  }
  if (degradedSections > 0) {
    reasons.push(`${degradedSections} sections were incomplete, unavailable, or failed.`);
  }
  if (redFlagPenalty > 0) {
    reasons.push("Financial validator red flags reduced claim quality.");
  }
  if (allEvidence.length === 0) {
    reasons.push("No section evidence was available.");
  }

  return {
    score,
    reasons,
    evidenceRefs,
    missingEvidence: input.sections
      .filter((section) => section.status !== "complete" || section.evidence.length === 0)
      .map((section) => section.section_id)
      .slice(0, 8)
  };
}

function uniqueEvidenceRefs(evidence: EvidenceItem[]): string[] {
  return [...new Set(evidence.map((item) => item.evidence_id).filter((id) => id.trim().length > 0))].slice(0, 12);
}
