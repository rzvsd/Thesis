// Types, page size, colours and fonts for the report PDF.
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import type { AnalysisReport } from "../../reports/types.ts";

export type PdfRgb = [number, number, number];
export type PdfFontKey = "body" | "bodyBold" | "display" | "mono";
export type PdfTone = "positive" | "negative" | "warning" | "neutral" | "gold";

export interface PdfPageContent {
  title: string;
  draw: (commands: string[], pageNumber: number, totalPages: number) => void;
}

export interface ReportChip {
  label: string;
  tone: PdfTone;
}

export interface ExecutiveCard {
  title: string;
  body: string;
  tone: PdfTone;
}

export interface ChangeCard {
  title: string;
  body: string;
}

export interface MetricTile {
  label: string;
  value: string;
  tone: PdfTone;
}

export interface QualityScoreRow {
  factor: string;
  reading: string;
  signal: string;
  tone: PdfTone;
  evidence: string;
}

export interface FinancialTableRow {
  label: string;
  values: string[];
}

export interface ScenarioColumn {
  label: string;
  fairValue: string;
  impliedMove: string;
  keyAssumption: string;
  mainRisk: string;
  tone: PdfTone;
}

export interface EvidenceCard {
  title: string;
  body: string;
}

export interface ValuationRangeView {
  low?: number;
  mid?: number;
  high?: number;
  spot?: number;
}

export interface MarginChartView {
  labels: string[];
  grossMargins: Array<number | undefined>;
  operatingMargins: Array<number | undefined>;
}

export interface ReportViewModel {
  ticker: string;
  companyLabel: string;
  reportDate: string;
  subtitle: string;
  signalChips: ReportChip[];
  qualityChips: ReportChip[];
  spotPriceLabel: string;
  upsideLabel: string;
  heroThesis: string;
  decisionQuestion: string;
  executiveCards: ExecutiveCard[];
  valuationTiles: MetricTile[];
  valuationRange?: ValuationRangeView;
  centralArgument: string;
  previousView: string;
  currentView: string;
  implication: string;
  changeCards: ChangeCard[];
  qualityRows: QualityScoreRow[];
  qualityContext: string;
  qualityInterpretation: string;
  financialYears: string[];
  financialRows: FinancialTableRow[];
  financialNote: string;
  marginChart?: MarginChartView;
  scenarioColumns: ScenarioColumn[];
  valuationFrameworkLabel: string;
  valuationNarrative: string;
  evidenceCards: EvidenceCard[];
  killSwitchCards: ExecutiveCard[];
  missingInputs: string[];
  riskItems: string[];
  mindChangeItems: string[];
  coverageNote: string;
}

export type CanonicalDueDiligenceSectionId =
  | "financial_analysis"
  | "competitive_positioning"
  | "management_and_governance"
  | "risks_and_challenges"
  | "growth_opportunities_and_outlook"
  | "valuation_and_thesis_stance";

export type AnalysisReportWithDueDiligence = AnalysisReport & {
  due_diligence?: unknown;
};

export interface DetailPair {
  label: string;
  value: string;
}

export interface ValueSignalRow {
  label: string;
  family: string;
  status: string;
  tone: PdfTone;
  reason: string;
}

export interface DueDiligenceSectionView {
  id: CanonicalDueDiligenceSectionId;
  title: string;
  subtitle: string;
  summary: string;
  narrative: string;
  bullets: string[];
  detailPairs: DetailPair[];
  omissions: string[];
}

export interface DueDiligenceViewModel {
  base: ReportViewModel;
  sectionCount: number;
  sparse: boolean;
  financialAnalysis: DueDiligenceSectionView;
  competitivePositioning: DueDiligenceSectionView;
  managementAndGovernance: DueDiligenceSectionView;
  risksAndChallenges: DueDiligenceSectionView;
  growthOpportunitiesAndOutlook: DueDiligenceSectionView;
  valuationAndThesisStance: DueDiligenceSectionView;
  financialMetricTiles: MetricTile[];
  valueSignalRows: ValueSignalRow[];
  valuationAssumptions: DetailPair[];
  evidenceSupport: DetailPair[];
  appendixNotes: string[];
  sourceNotes: string[];
}

export interface InstitutionalPdfExportResult {
  buffer: Uint8Array;
  pageCount: number;
  pageTitles: string[];
}

export const pageWidth = 612;
export const pageHeight = 792;
export const pageMargin = 42;
export const contentWidth = pageWidth - pageMargin * 2;

export const ivory: PdfRgb = [0.972, 0.965, 0.945];
export const panelIvory: PdfRgb = [0.987, 0.983, 0.973];
export const panelSlate: PdfRgb = [0.944, 0.949, 0.954];
export const charcoal: PdfRgb = [0.108, 0.126, 0.145];
export const ink: PdfRgb = [0.161, 0.173, 0.188];
export const muted: PdfRgb = [0.446, 0.47, 0.5];
export const divider: PdfRgb = [0.826, 0.822, 0.806];
export const gold: PdfRgb = [0.725, 0.608, 0.365];
export const goldSoft: PdfRgb = [0.949, 0.929, 0.871];
export const positive: PdfRgb = [0.286, 0.545, 0.373];
export const positiveSoft: PdfRgb = [0.899, 0.954, 0.918];
export const negative: PdfRgb = [0.753, 0.333, 0.317];
export const negativeSoft: PdfRgb = [0.972, 0.918, 0.914];
export const warning: PdfRgb = [0.761, 0.573, 0.204];
export const warningSoft: PdfRgb = [0.982, 0.953, 0.87];
export const white: PdfRgb = [1, 1, 1];

export const fontResources: Record<PdfFontKey, { resource: string; baseFont: string }> = {
  body: { resource: "F1", baseFont: "Helvetica" },
  bodyBold: { resource: "F2", baseFont: "Helvetica-Bold" },
  display: { resource: "F3", baseFont: "Times-Bold" },
  mono: { resource: "F4", baseFont: "Courier" },
};
