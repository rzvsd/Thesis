import type { EvidenceItem, ReportSection } from "../../../../../packages/contracts/src";
import type { DexterToolResult, DexterToolRuntimeConfig } from "../tool-contract";
import { buildToolOmission } from "../tool-errors";
import { evidenceFromToolFinding } from "../tool-evidence";
import { containsTradingAdvice } from "../tool-policy";
import type { FinancialAnalysisToolData } from "../financial-analysis/financial-analysis-tool";
import { evaluateClaimRisk } from "./claim-risk-evaluator";
import { buildPerspectiveSummaries } from "./perspective-evaluator";

export interface EvidenceDebateToolInput {
  ticker: string;
  thesisStatement?: string;
  sections: Array<{
    section_id: string;
    title: string;
    body: string;
    evidence: EvidenceItem[];
    status: "complete" | "data_incomplete" | "data_unavailable" | "failed";
  }>;
  financialTool?: FinancialAnalysisToolData;
}

export interface EvidenceDebateToolData {
  supporting_view: {
    summary: string;
    evidence_refs: string[];
    confidence: "high" | "medium" | "low";
  };
  challenging_view: {
    summary: string;
    evidence_refs: string[];
    confidence: "high" | "medium" | "low";
  };
  unresolved_view: {
    summary: string;
    missing_evidence: string[];
    confidence: "high" | "medium" | "low";
  };
  claim_quality_score: number;
  reasons: string[];
}

export async function runEvidenceDebateTool(
  input: EvidenceDebateToolInput,
  config: DexterToolRuntimeConfig
): Promise<DexterToolResult<EvidenceDebateToolData>> {
  const { runDexterTool } = await import("../tool-runner");
  return runDexterTool(
    "evidence_debate",
    {
      enabled: config.toolsEnabled && config.evidenceDebateToolEnabled,
      timeoutMs: config.toolTimeoutMs
    },
    async () => buildEvidenceDebateToolResult(input)
  );
}

export async function buildEvidenceDebateToolResult(
  input: EvidenceDebateToolInput,
  generatedAt = new Date().toISOString()
): Promise<DexterToolResult<EvidenceDebateToolData>> {
  const sections = input.sections as ReportSection[];
  const evaluation = evaluateClaimRisk({
    sections,
    financialTool: input.financialTool
  });
  const perspectives = buildPerspectiveSummaries({
    ticker: input.ticker,
    sections,
    evaluation
  });
  const data: EvidenceDebateToolData = {
    ...perspectives,
    claim_quality_score: evaluation.score,
    reasons: evaluation.reasons
  };
  const serialized = JSON.stringify(data);
  const omissions = evaluation.missingEvidence.map((sectionId) =>
    buildToolOmission({
      family: sectionId,
      reason_code: "insufficient_input",
      reason_text: `${sectionId} lacked complete evidence for debate evaluation.`
    })
  );
  const evidence = [
    evidenceFromToolFinding({
      toolName: "evidence_debate",
      sourceFamily: "analysis_internal",
      title: `${input.ticker} evidence debate evaluator`,
      excerpt: `Claim quality score ${evaluation.score.toFixed(2)}. ${evaluation.reasons.join(" ")}`,
      retrievedAt: generatedAt,
      customerSafe: false
    })
  ];

  return {
    tool_name: "evidence_debate",
    ok: true,
    generated_at: generatedAt,
    data,
    evidence,
    omissions,
    confidence: evaluation.score >= 0.7 ? "high" : evaluation.score >= 0.4 ? "medium" : "low",
    visibility: "internal_only",
    customer_safe: false,
    notes: containsTradingAdvice(serialized) ? ["policy_check_failed"] : evaluation.reasons
  };
}
