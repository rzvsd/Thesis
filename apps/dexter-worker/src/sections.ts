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
  { id: "thesis_statement", title: "Thesis Statement", derived: true },
  { id: "what_changed", title: "What Changed", derived: true },
  { id: "valuation", title: "Valuation", derived: true },
  { id: "executive_summary", title: "Executive Summary", derived: true },
  {
    id: "quarter_over_quarter_changes",
    title: "Quarter-over-Quarter Changes",
    derived: false,
    liveGuidance:
      "Use the most recent quarterly comparison only. Focus on quarter-over-quarter change, keep the section concise, and avoid broad web exploration.",
    liveTimeoutMs: 30_000,
    liveRetryTimeoutMs: 10_000,
    liveMaxIterations: 1
  },
  {
    id: "year_over_year_changes",
    title: "Year-over-Year Changes",
    derived: false,
    liveGuidance:
      "Use the most recent year-over-year comparison only. Focus on the strongest annual change, keep the section concise, and avoid broad web exploration.",
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
    id: "management_commentary",
    title: "Management Commentary",
    derived: false,
    liveGuidance:
      "Use only the latest 10-K/10-Q MD&A and risk-factor evidence from filings. Do not use browser or filesystem tools. Return the 3 most material commentary and risk themes in 3 short bullets (max 140 words total) and stop once enough evidence is found.",
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
