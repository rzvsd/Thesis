import type { ReportSectionStatus } from "../../../packages/contracts/src";

export interface SectionDefinition {
  id: string;
  title: string;
  derived: boolean;
  liveGuidance?: string;
  executionPriority?: number;
  liveTimeoutMs?: number;
  liveRetryTimeoutMs?: number;
  liveMaxIterations?: number;
}

export const allSectionDefinitions: readonly SectionDefinition[] = [
  { id: "executive_summary", title: "Executive Summary", derived: true },
  {
    id: "qoq_yoy_changes",
    title: "Quarter-over-Quarter and Year-over-Year Changes",
    derived: false,
    liveGuidance:
      "Use recent quarterly and annual financial metrics only. Focus on the strongest quarter-over-quarter and year-over-year changes, keep the section concise, and avoid broad web exploration.",
    liveTimeoutMs: 30_000,
    liveRetryTimeoutMs: 10_000,
    liveMaxIterations: 1
  },
  {
    id: "revenue_margin_analysis",
    title: "Revenue and Margin Analysis",
    derived: false,
    liveGuidance:
      "Use revenue, gross margin, operating margin, and net margin evidence from recent financial statements. Prefer financial metrics over general news and keep the section tightly evidence-led.",
    liveTimeoutMs: 30_000,
    liveRetryTimeoutMs: 10_000,
    liveMaxIterations: 1
  },
  {
    id: "debt_liquidity",
    title: "Debt and Liquidity",
    derived: false,
    liveGuidance:
      "Use balance sheet and cash-flow evidence only. Focus on debt levels, liquidity, and material changes without expanding into unrelated business commentary.",
    liveTimeoutMs: 30_000,
    liveRetryTimeoutMs: 10_000,
    liveMaxIterations: 1
  },
  {
    id: "acquisitions_major_events",
    title: "Acquisitions and Major Events",
    derived: false,
    liveGuidance:
      "Use SEC filings first (10-K/10-Q/8-K) for material acquisitions or major events. Do not use browser or filesystem tools. Use at most one news check only if filings are insufficient. Return 3 short bullets (max 140 words total) and say clearly if no material event is found.",
    executionPriority: 10,
    liveTimeoutMs: 45_000,
    liveRetryTimeoutMs: 15_000,
    liveMaxIterations: 1
  },
  {
    id: "management_commentary_risk_factors",
    title: "Management Commentary and Risk Factors",
    derived: false,
    liveGuidance:
      "Use only the latest 10-K/10-Q MD&A and risk-factor evidence from filings. Do not use browser or filesystem tools. Return the 3 most material themes/risks in 3 short bullets (max 140 words total) and stop once enough evidence is found.",
    executionPriority: 10,
    liveTimeoutMs: 45_000,
    liveRetryTimeoutMs: 15_000,
    liveMaxIterations: 1
  },
  { id: "research_signal", title: "Research Signal", derived: true },
  {
    id: "confidence_score",
    title: "Confidence Score and Limiting Factors",
    derived: true
  },
  { id: "evidence_references", title: "Evidence References", derived: true }
] as const;

export const executableSectionDefinitions = allSectionDefinitions.filter(
  (definition) => !definition.derived
);

export function selectSectionDefinitions(requestedSections?: string[]): SectionDefinition[] {
  if (!requestedSections || requestedSections.length === 0) {
    return [...allSectionDefinitions];
  }

  const requested = new Set(requestedSections);
  return allSectionDefinitions.filter(
    (definition) => definition.derived || requested.has(definition.id)
  );
}

export function buildStatusBody(
  title: string,
  status: ReportSectionStatus,
  detail: string
): string {
  switch (status) {
    case "complete":
      return detail;
    case "data_incomplete":
      return `${title} is partially available. ${detail}`;
    case "data_unavailable":
      return `${title} could not be completed because the required data was unavailable. ${detail}`;
    case "failed":
      return `${title} could not be completed because the section executor failed after retry. ${detail}`;
  }

  return `${title} status is unknown. ${detail}`;
}
