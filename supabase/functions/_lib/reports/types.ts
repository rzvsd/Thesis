// Loose stand-ins for the shapes in packages/contracts/src. Owner: M1.
// Deno cannot import that package (extensionless imports and zod schemas), so the logic ported from
// apps/product-api uses these names. The JSON on the wire is unchanged: contract.md and the old types are the source.
// deno-lint-ignore-file no-explicit-any

export type AnalysisReport = any;
export type MarketPulseReport = any;
export type UserResearchState = any;
export type ReportSection = any;
export type EvidenceItem = any;
export type StructuralContextPack = any;
export type FilingIntelligenceMetricDelta = any;
export type FinancialIndicator = any;
export type FinancialIndicatorBenchmark = any;
export type FinancialIndicatorTrend = any;
export type FinancialHistoryRow = any;
export type InvestorEducationBox = any;

export type ReportType = "deep_dive" | "market_pulse";

// One row of app.reports (written by M2 for deep_dive and by M3 for market_pulse).
export interface ReportRecord {
  id: string;
  jobId: string;
  type: ReportType;
  ticker?: string;
  schemaVersion: string;
  artifactKey: string;
  fingerprint?: string;
  freshnessExpiresAt?: string;
  createdAt: string;
  isCurrent: boolean;
  llmUsage?: Record<string, unknown>;
}
export type Loose = any;
