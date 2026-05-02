import type { DexterToolResult } from "./tool-contract";
import type { EvidenceDebateToolData } from "./evidence-debate/evidence-debate-tool";
import type { FinancialAnalysisToolData } from "./financial-analysis/financial-analysis-tool";
import type { RecentContextToolData } from "./recent-context/recent-context-tool";

export interface DexterEvidenceToolContext {
  financialAnalysis?: DexterToolResult<FinancialAnalysisToolData>;
  evidenceDebate?: DexterToolResult<EvidenceDebateToolData>;
  recentContext?: DexterToolResult<RecentContextToolData>;
}

export function renderToolContextForPrompt(context: DexterEvidenceToolContext): string {
  const lines: string[] = ["TOOL CONTEXT"];

  if (context.financialAnalysis?.ok && context.financialAnalysis.data) {
    lines.push("Financial validators:");
    context.financialAnalysis.data.metrics.forEach((metric) => {
      lines.push(`- ${metric.metric}: ${formatValue(metric.value)} ${metric.unit}, ${metric.state}`);
    });
  }

  if (context.evidenceDebate?.ok && context.evidenceDebate.data) {
    lines.push("Evidence debate:");
    lines.push(`- supporting view: ${context.evidenceDebate.data.supporting_view.summary}`);
    lines.push(`- challenging view: ${context.evidenceDebate.data.challenging_view.summary}`);
    lines.push(`- unresolved: ${context.evidenceDebate.data.unresolved_view.summary}`);
  }

  if (context.recentContext?.ok && context.recentContext.data) {
    lines.push("Recent context:");
    context.recentContext.data.findings.slice(0, 8).forEach((finding) => {
      const visibility = finding.customer_safe ? "CUSTOMER SAFE METADATA" : "INTERNAL ONLY";
      lines.push(
        `- ${visibility}, ${finding.source_family}: topic ${finding.topic}, stance ${finding.stance ?? "unclear"}`
      );
    });
    lines.push(
      "Hard rule: Internal-only context cannot be quoted, summarized, or attributed in customer-facing copy. It can only guide what to verify."
    );
  }

  return lines.length === 1 ? "" : lines.join("\n");
}

function formatValue(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "missing";
}
