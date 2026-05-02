import type { ReportSection } from "../../../../../packages/contracts/src";
import type { ClaimRiskEvaluation } from "./claim-risk-evaluator";

export function buildPerspectiveSummaries(input: {
  ticker: string;
  sections: ReportSection[];
  evaluation: ClaimRiskEvaluation;
}) {
  const completeWithEvidence = input.sections.filter((section) =>
    section.status === "complete" && section.evidence.length > 0
  );
  const degraded = input.sections.filter((section) =>
    section.status !== "complete" || section.evidence.length === 0
  );
  const confidence = confidenceFromScore(input.evaluation.score);

  return {
    supporting_view: {
      summary: completeWithEvidence.length > 0
        ? `${input.ticker} has ${completeWithEvidence.length} evidence-backed sections available for the current review.`
        : `${input.ticker} has limited evidence-backed support in this run.`,
      evidence_refs: input.evaluation.evidenceRefs.slice(0, 6),
      confidence
    },
    challenging_view: {
      summary: degraded.length > 0
        ? `${degraded.length} sections need more support before the thesis can be treated as fully evidenced.`
        : "No major section-level evidence gap was detected by the deterministic evaluator.",
      evidence_refs: input.evaluation.evidenceRefs.slice(0, 4),
      confidence: degraded.length > 0 ? "medium" as const : confidence
    },
    unresolved_view: {
      summary: input.evaluation.missingEvidence.length > 0
        ? "Some claims remain unresolved because supporting evidence or complete section output is missing."
        : "The deterministic evaluator did not find unresolved section coverage in this run.",
      missing_evidence: input.evaluation.missingEvidence,
      confidence: input.evaluation.missingEvidence.length > 0 ? "medium" as const : confidence
    }
  };
}

function confidenceFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
}
