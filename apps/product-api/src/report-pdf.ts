import type {
  AnalysisReport,
  FinancialHistoryRow,
  InvestmentMemoSection,
  ValueDisciplineSignal
} from "../../../packages/contracts/src";
import { reportLabelMap, reportSentenceMap } from "./report-label-map";

type PdfRgb = [number, number, number];
type PdfFontKey = "body" | "bodyBold" | "display" | "mono";
type PdfTone = "positive" | "negative" | "warning" | "neutral" | "gold";

interface PdfPageContent {
  title: string;
  draw: (commands: string[], pageNumber: number, totalPages: number) => void;
}

interface ReportChip {
  label: string;
  tone: PdfTone;
}

interface ExecutiveCard {
  title: string;
  body: string;
  tone: PdfTone;
}

interface ChangeCard {
  title: string;
  body: string;
}

interface MetricTile {
  label: string;
  value: string;
  tone: PdfTone;
}

interface QualityScoreRow {
  factor: string;
  reading: string;
  signal: string;
  tone: PdfTone;
  evidence: string;
}

interface FinancialTableRow {
  label: string;
  values: string[];
}

interface ScenarioColumn {
  label: string;
  fairValue: string;
  impliedMove: string;
  keyAssumption: string;
  mainRisk: string;
  tone: PdfTone;
}

interface EvidenceCard {
  title: string;
  body: string;
}

interface ValuationRangeView {
  low?: number;
  mid?: number;
  high?: number;
  spot?: number;
}

interface MarginChartView {
  labels: string[];
  grossMargins: Array<number | undefined>;
  operatingMargins: Array<number | undefined>;
}

interface ReportViewModel {
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

export interface InstitutionalPdfExportResult {
  buffer: Buffer;
  pageCount: number;
  pageTitles: string[];
}

const pageWidth = 612;
const pageHeight = 792;
const pageMargin = 42;
const contentWidth = pageWidth - pageMargin * 2;

const ivory: PdfRgb = [0.972, 0.965, 0.945];
const panelIvory: PdfRgb = [0.987, 0.983, 0.973];
const panelSlate: PdfRgb = [0.944, 0.949, 0.954];
const charcoal: PdfRgb = [0.108, 0.126, 0.145];
const ink: PdfRgb = [0.161, 0.173, 0.188];
const muted: PdfRgb = [0.446, 0.47, 0.5];
const divider: PdfRgb = [0.826, 0.822, 0.806];
const gold: PdfRgb = [0.725, 0.608, 0.365];
const goldSoft: PdfRgb = [0.949, 0.929, 0.871];
const positive: PdfRgb = [0.286, 0.545, 0.373];
const positiveSoft: PdfRgb = [0.899, 0.954, 0.918];
const negative: PdfRgb = [0.753, 0.333, 0.317];
const negativeSoft: PdfRgb = [0.972, 0.918, 0.914];
const warning: PdfRgb = [0.761, 0.573, 0.204];
const warningSoft: PdfRgb = [0.982, 0.953, 0.87];
const white: PdfRgb = [1, 1, 1];

const fontResources: Record<PdfFontKey, { resource: string; baseFont: string }> = {
  body: { resource: "F1", baseFont: "Helvetica" },
  bodyBold: { resource: "F2", baseFont: "Helvetica-Bold" },
  display: { resource: "F3", baseFont: "Times-Bold" },
  mono: { resource: "F4", baseFont: "Courier" }
};

export function buildInstitutionalPdfExport(report: AnalysisReport): InstitutionalPdfExportResult {
  const pages = buildInstitutionalPdfPages(report);
  const buffer = renderSimplePdf(pages);
  return {
    buffer,
    pageCount: pages.length,
    pageTitles: pages.map((page) => page.title)
  };
}

export function buildInstitutionalPdfPages(report: AnalysisReport): PdfPageContent[] {
  const view = buildReportViewModel(report);
  return [
    {
      title: "Executive Memo",
      draw: (commands, pageNumber, totalPages) => drawExecutiveMemoPage(commands, view, pageNumber, totalPages)
    },
    {
      title: "Thesis and Change",
      draw: (commands, pageNumber, totalPages) => drawThesisAndChangePage(commands, view, pageNumber, totalPages)
    },
    {
      title: "Business Quality",
      draw: (commands, pageNumber, totalPages) => drawBusinessQualityPage(commands, view, pageNumber, totalPages)
    },
    {
      title: "Financial Statement Analysis",
      draw: (commands, pageNumber, totalPages) =>
        drawFinancialStatementPage(commands, view, pageNumber, totalPages)
    },
    {
      title: "Valuation and Scenarios",
      draw: (commands, pageNumber, totalPages) => drawValuationPage(commands, view, pageNumber, totalPages)
    },
    {
      title: "Evidence and Risks",
      draw: (commands, pageNumber, totalPages) => drawEvidenceAndRiskPage(commands, view, pageNumber, totalPages)
    }
  ];
}

function buildReportViewModel(report: AnalysisReport): ReportViewModel {
  const ticker = sanitizeInline(report.ticker ?? "REPORT");
  const memoSections = report.investment_memo?.sections ?? [];
  const thesisSection = findMemoSection(memoSections, "investment_thesis");
  const changeSection = findMemoSection(memoSections, "what_changed");
  const qualitySection = findMemoSection(memoSections, "business_quality");
  const valuationSection = findMemoSection(memoSections, "valuation");
  const risksSection = findMemoSection(memoSections, "risks");
  const changeCards = buildChangeCards(report);
  const financialView = buildFinancialView(report.financial_analysis?.annual_history ?? []);
  const coverageMissing = buildMissingInputs(report);
  const riskItems = buildRiskItems(report, risksSection);
  const mindChangeItems = buildMindChangeItems(report);
  const valuationRange = report.valuation
    ? {
        low: report.valuation.fair_value_low,
        mid: report.valuation.fair_value_mid,
        high: report.valuation.fair_value_high,
        spot: report.valuation.spot_price
      }
    : undefined;

  return {
    ticker,
    companyLabel: ticker,
    reportDate: formatReportDate(report.generated_at),
    subtitle: firstNonEmpty(
      report.story_header?.headline,
      thesisSection?.narrative,
      "Evidence-led investment memo."
    ),
    signalChips: buildSignalChips(report, coverageMissing.length),
    qualityChips: buildQualityChips(report, coverageMissing.length),
    spotPriceLabel:
      report.valuation?.spot_price !== undefined
        ? `Spot ${formatPrice(report.valuation.spot_price)}`
        : "Spot unavailable",
    upsideLabel:
      report.valuation?.implied_upside_pct !== undefined
        ? `${formatSignedPct(report.valuation.implied_upside_pct)} vs base case`
        : "Valuation range unavailable",
    heroThesis: shortenText(
      firstNonEmpty(
        report.story_header?.thesis_summary,
        thesisSection?.narrative,
        report.sections.find((section) => section.section_id === "thesis_statement")?.body,
        "The available evidence is not yet strong enough to support a sharper investment claim."
      ),
      190
    ),
    decisionQuestion: shortenText(
      firstNonEmpty(
        report.investment_memo?.decision_question,
        "What would need to remain true for the thesis to stay investable?"
      ),
      130
    ),
    executiveCards: [
      {
        title: "What matters now",
        body: shortenText(
          firstNonEmpty(
            report.story_header?.why_now,
            report.change_summary?.top_changes[0]?.why_it_matters,
            changeSection?.narrative,
            "The next review window should focus on whether recent execution keeps supporting the base case."
          ),
          150
        ),
        tone: "gold"
      },
      {
        title: "What changed",
        body: shortenText(
          firstNonEmpty(
            report.change_summary?.top_changes[0]?.why_it_changed,
            report.change_summary?.current_view,
            changeSection?.narrative,
            "No prior comparable view is available, so this report establishes the current baseline."
          ),
          150
        ),
        tone: "neutral"
      },
      {
        title: "What could break the thesis",
        body: shortenText(
          firstNonEmpty(
            riskItems[0],
            report.kill_switch_conditions?.[0]?.condition_text,
            "The most important watch point is whether core evidence starts moving against the current base case."
          ),
          150
        ),
        tone: "warning"
      }
    ],
    valuationTiles: buildValuationTiles(report),
    valuationRange,
    centralArgument: shortenText(
      firstNonEmpty(
        thesisSection?.narrative,
        report.story_header?.headline,
        report.story_header?.thesis_summary,
        "The current investment argument is limited and should be treated as a watchlist view."
      ),
      240
    ),
    previousView: shortenText(
      firstNonEmpty(
        report.change_summary?.previous_view,
        "No prior comparable report is available, so there is no locked previous view yet."
      ),
      180
    ),
    currentView: shortenText(
      firstNonEmpty(
        report.change_summary?.current_view,
        thesisSection?.narrative,
        "The current view relies on the evidence available in this run."
      ),
      180
    ),
    implication: shortenText(
      firstNonEmpty(
        report.story_header?.reader_takeaway,
        valuationSection?.narrative,
        report.coverage_truth?.summary,
        "The current evidence supports further review rather than blind conviction."
      ),
      170
    ),
    changeCards,
    qualityRows: buildQualityRows(report, qualitySection, risksSection),
    qualityContext: report.value_discipline
      ? reportLabelMap(report.value_discipline.context_label)
      : "General operating context",
    qualityInterpretation: shortenText(
      firstNonEmpty(
        report.value_discipline?.interpretation,
        qualitySection?.narrative,
        "Quality readings are informative, but they do not replace full competitive and valuation work."
      ),
      180
    ),
    financialYears: financialView.years,
    financialRows: financialView.rows,
    financialNote: financialView.note,
    marginChart: financialView.chart,
    scenarioColumns: buildScenarioColumns(report, valuationSection, risksSection),
    valuationFrameworkLabel: report.valuation
      ? reportLabelMap(report.valuation.assumptions.methodology)
      : "Valuation framework unavailable",
    valuationNarrative: shortenText(
      firstNonEmpty(
        valuationSection?.narrative,
        report.valuation?.degraded_reason,
        "Valuation should be read as a scenario framework rather than a single-point answer."
      ),
      200
    ),
    evidenceCards: buildEvidenceCards(report),
    killSwitchCards: buildKillSwitchCards(report),
    missingInputs: coverageMissing,
    riskItems,
    mindChangeItems,
    coverageNote: shortenText(
      firstNonEmpty(
        report.coverage_truth?.summary,
        report.investment_memo?.sparse_data_honesty_note,
        "Coverage is constrained by the available evidence and should be read with that limitation in mind."
      ),
      180
    )
  };
}

function drawExecutiveMemoPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number
): void {
  drawPageFrame(commands, view, "Executive Memo", pageNumber, totalPages);

  drawPanel(commands, pageMargin, 54, contentWidth, 188, {
    fill: charcoal,
    stroke: charcoal,
    lineWidth: 0.8
  });
  drawPanel(commands, pageMargin, 54, contentWidth, 4, { fill: gold });

  drawText(commands, pageMargin + 18, 72, "Thesis Investment Memo", {
    font: "bodyBold",
    size: 10,
    color: gold,
    tracking: 0.9
  });
  drawText(commands, pageMargin + 18, 96, view.companyLabel, {
    font: "display",
    size: 30,
    color: white
  });
  drawText(commands, pageMargin + 18, 128, view.subtitle, {
    font: "body",
    size: 13,
    color: [0.871, 0.882, 0.898]
  });
  drawTextBlock(commands, pageMargin + 18, 156, 308, view.heroThesis, {
    font: "body",
    size: 11,
    leading: 15,
    color: white,
    maxLines: 5
  });

  drawChipGrid(commands, pageWidth - pageMargin - 182, 74, 164, view.signalChips);
  drawText(commands, pageWidth - pageMargin - 18, 154, view.spotPriceLabel, {
    font: "display",
    size: 24,
    color: white,
    align: "right"
  });
  drawText(commands, pageWidth - pageMargin - 18, 186, view.upsideLabel, {
    font: "bodyBold",
    size: 11,
    color: gold,
    align: "right"
  });

  drawThesisBox(
    commands,
    pageMargin,
    256,
    contentWidth,
    74,
    "Decision question",
    view.decisionQuestion
  );

  const cardWidth = (contentWidth - 24) / 3;
  view.executiveCards.forEach((card, index) => {
    drawInfoCard(commands, pageMargin + index * (cardWidth + 12), 346, cardWidth, 126, card.title, card.body, card.tone);
  });

  drawPanel(commands, pageMargin, 490, contentWidth, 188, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, pageMargin + 18, 510, "Mini valuation range", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawText(commands, pageMargin + 18, 536, "Low, base, and high-value anchors with spot context.", {
    font: "body",
    size: 9,
    color: muted
  });
  drawValuationRange(commands, pageMargin + 18, 552, contentWidth - 36, 62, view.valuationRange, {
    lowLabel: "Low",
    midLabel: "Base",
    highLabel: "High",
    spotLabel: "Spot"
  });
  drawMetricTileStrip(commands, pageMargin + 18, 610, contentWidth - 36, view.valuationTiles);
}

function drawThesisAndChangePage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number
): void {
  drawPageFrame(commands, view, "Thesis and Change", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Thesis and Change",
    "Before, now, and implication in one editorial view."
  );

  drawThesisBox(commands, pageMargin, 98, contentWidth, 94, "Central investment argument", view.centralArgument);

  const laneWidth = (contentWidth - 24) / 3;
  drawLabeledPanel(commands, pageMargin, 210, laneWidth, 128, "Previous view", view.previousView, "neutral");
  drawLabeledPanel(commands, pageMargin + laneWidth + 12, 210, laneWidth, 128, "Current view", view.currentView, "gold");
  drawLabeledPanel(
    commands,
    pageMargin + (laneWidth + 12) * 2,
    210,
    laneWidth,
    128,
    "Why it matters",
    view.implication,
    "warning"
  );

  drawPanel(commands, pageMargin, 356, contentWidth, 292, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, pageMargin + 18, 376, "What changed", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawText(commands, pageMargin + 18, 402, "Three concise change notes, written for a human reader rather than a JSON parser.", {
    font: "body",
    size: 9,
    color: muted
  });

  const changeWidth = (contentWidth - 36) / 3;
  view.changeCards.forEach((card, index) => {
    drawInfoCard(
      commands,
      pageMargin + 18 + index * (changeWidth + 9),
      420,
      changeWidth,
      156,
      card.title,
      card.body,
      index === 0 ? "gold" : index === 1 ? "neutral" : "warning"
    );
  });

  drawThesisBox(commands, pageMargin + 18, 586, contentWidth - 36, 52, "Decision frame", view.decisionQuestion);
}

function drawBusinessQualityPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number
): void {
  drawPageFrame(commands, view, "Business Quality", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Business Quality",
    "A scorecard view of quality, resilience, and uncertainty."
  );

  drawChipRow(commands, pageMargin, 98, contentWidth, view.qualityChips);

  drawPanel(commands, pageMargin, 142, contentWidth, 316, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, pageMargin + 18, 162, "Business quality scorecard", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawText(commands, pageMargin + 18, 188, "Factor", {
    font: "bodyBold",
    size: 9,
    color: muted
  });
  drawText(commands, pageMargin + 134, 188, "Reading", {
    font: "bodyBold",
    size: 9,
    color: muted
  });
  drawText(commands, pageMargin + 302, 188, "Signal", {
    font: "bodyBold",
    size: 9,
    color: muted
  });
  drawText(commands, pageMargin + 382, 188, "Evidence note", {
    font: "bodyBold",
    size: 9,
    color: muted
  });

  let rowTop = 204;
  view.qualityRows.forEach((row, index) => {
    drawPanel(commands, pageMargin + 14, rowTop, contentWidth - 28, 48, {
      fill: index % 2 === 0 ? white : panelSlate,
      stroke: divider,
      lineWidth: 0.4
    });
    drawText(commands, pageMargin + 24, rowTop + 18, row.factor, {
      font: "bodyBold",
      size: 9.5,
      color: ink
    });
    drawTextBlock(commands, pageMargin + 134, rowTop + 12, 152, row.reading, {
      font: "body",
      size: 8.5,
      leading: 11,
      color: ink,
      maxLines: 3
    });
    drawStatusChip(commands, pageMargin + 302, rowTop + 12, 66, row.signal, row.tone);
    drawTextBlock(commands, pageMargin + 382, rowTop + 12, 126, row.evidence, {
      font: "body",
      size: 8.5,
      leading: 11,
      color: muted,
      maxLines: 3
    });
    rowTop += 48;
  });

  drawLabeledPanel(commands, pageMargin, 476, contentWidth, 74, "Quality context", view.qualityContext, "gold");
  drawThesisBox(commands, pageMargin, 568, contentWidth, 96, "Interpretation", view.qualityInterpretation);
}

function drawFinancialStatementPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number
): void {
  drawPageFrame(commands, view, "Financial Statement Analysis", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Financial Statement Analysis",
    "Structured financial history first, chart second."
  );

  drawFinancialTable(commands, pageMargin, 98, contentWidth, 286, view.financialYears, view.financialRows);

  drawPanel(commands, pageMargin, 404, contentWidth, 232, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, pageMargin + 18, 424, "Margin profile", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawText(commands, pageMargin + 18, 450, "Gross margin and operating margin across reported annual periods.", {
    font: "body",
    size: 9,
    color: muted
  });
  drawMarginChart(commands, pageMargin + 18, 464, contentWidth - 36, 142, view.marginChart);
  drawTextBlock(commands, pageMargin + 18, 618, contentWidth - 36, view.financialNote, {
    font: "body",
    size: 9,
    leading: 12,
    color: muted,
    maxLines: 3
  });
}

function drawValuationPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number
): void {
  drawPageFrame(commands, view, "Valuation and Scenarios", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Valuation and Scenarios",
    "A scenario framework, not a false-precision point estimate."
  );

  drawLabeledPanel(commands, pageMargin, 98, contentWidth, 76, "Framework", view.valuationFrameworkLabel, "gold");
  drawScenarioTable(commands, pageMargin, 194, contentWidth, 272, view.scenarioColumns);

  drawPanel(commands, pageMargin, 486, contentWidth, 170, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, pageMargin + 18, 506, "Valuation range", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawText(commands, pageMargin + 18, 532, "Compact bridge from downside, base case, upside, and spot price.", {
    font: "body",
    size: 9,
    color: muted
  });
  drawValuationRange(commands, pageMargin + 18, 548, contentWidth - 36, 58, view.valuationRange, {
    lowLabel: "Bear",
    midLabel: "Base",
    highLabel: "Bull",
    spotLabel: "Spot"
  });
  drawMetricTileStrip(commands, pageMargin + 18, 606, contentWidth - 36, view.valuationTiles);
  drawThesisBox(commands, pageMargin, 666, contentWidth, 44, "Valuation read-through", view.valuationNarrative);
}

function drawEvidenceAndRiskPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number
): void {
  drawPageFrame(commands, view, "Evidence and Risks", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Evidence, Risks, and What Would Change Our Mind",
    "The trust-building page: evidence, limits, and thesis breakers."
  );

  drawPanel(commands, pageMargin, 98, contentWidth, 132, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, pageMargin + 18, 118, "Active kill-switch coverage", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawText(commands, pageMargin + 18, 144, "Three conditions that would weaken the thesis fast enough to warrant a fresh read.", {
    font: "body",
    size: 9,
    color: muted
  });
  const visibleKillSwitches = view.killSwitchCards.slice(0, 3);
  const killSwitchWidth =
    (contentWidth - 18 * 2 - 9 * Math.max(visibleKillSwitches.length - 1, 0)) / Math.max(visibleKillSwitches.length, 1);
  visibleKillSwitches.forEach((card, index) => {
    drawCompactNarrativeCard(
      commands,
      pageMargin + 18 + index * (killSwitchWidth + 9),
      158,
      killSwitchWidth,
      56,
      card.title,
      card.body,
      card.tone
    );
  });

  const columnWidth = (contentWidth - 16) / 2;
  drawEvidencePanel(commands, pageMargin, 246, columnWidth, 224, view.evidenceCards);
  drawCoverageNote(commands, pageMargin, 482, columnWidth, 160, view.coverageNote, view.missingInputs);
  drawRiskList(commands, pageMargin + columnWidth + 16, 246, columnWidth, 224, "Top risks", view.riskItems, "warning");
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    482,
    columnWidth,
    160,
    "What would change our mind",
    view.mindChangeItems,
    "gold"
  );
}

function drawPageFrame(
  commands: string[],
  view: ReportViewModel,
  sectionTitle: string,
  pageNumber: number,
  totalPages: number
): void {
  drawPanel(commands, 0, 0, pageWidth, pageHeight, { fill: ivory });
  drawText(commands, pageMargin, 24, "THESIS", {
    font: "bodyBold",
    size: 10,
    color: gold,
    tracking: 1.1
  });
  drawText(commands, pageWidth / 2, 24, sectionTitle, {
    font: "bodyBold",
    size: 9,
    color: muted,
    align: "center",
    tracking: 0.6
  });
  drawText(commands, pageWidth - pageMargin, 24, `${view.companyLabel} | ${view.reportDate}`, {
    font: "body",
    size: 9,
    color: muted,
    align: "right"
  });
  drawDivider(commands, pageMargin, 34, pageWidth - pageMargin, 34);
  drawDivider(commands, pageMargin, 736, pageWidth - pageMargin, 736);
  drawText(commands, pageMargin, 748, "Generated by Thesis | Premium research memo", {
    font: "body",
    size: 8.5,
    color: muted
  });
  drawText(commands, pageWidth - pageMargin, 748, `Page ${pageNumber} of ${totalPages}`, {
    font: "body",
    size: 8.5,
    color: muted,
    align: "right"
  });
}

function drawSectionHeading(commands: string[], title: string, subtitle: string): void {
  drawText(commands, pageMargin, 58, title, {
    font: "display",
    size: 22,
    color: charcoal
  });
  drawText(commands, pageMargin, 84, subtitle, {
    font: "body",
    size: 10,
    color: muted
  });
}

function drawChipGrid(commands: string[], x: number, top: number, width: number, chips: ReportChip[]): void {
  const columnWidth = (width - 10) / 2;
  chips.forEach((chip, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawStatusChip(commands, x + column * (columnWidth + 10), top + row * 30, columnWidth, chip.label, chip.tone);
  });
}

function drawChipRow(commands: string[], x: number, top: number, width: number, chips: ReportChip[]): void {
  const visible = chips.slice(0, 3);
  const chipWidth = (width - 20) / Math.max(visible.length, 1);
  visible.forEach((chip, index) => {
    drawStatusChip(commands, x + index * (chipWidth + 10), top, chipWidth, chip.label, chip.tone);
  });
}

function drawStatusChip(
  commands: string[],
  x: number,
  top: number,
  width: number,
  label: string,
  tone: PdfTone
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, 22, {
    fill: palette.fill,
    stroke: palette.stroke,
    lineWidth: 0.6
  });
  const parts = label.split(": ");
  if (parts.length === 2) {
    const eyebrow = parts[0] ?? label;
    const value = parts[1] ?? "";
    drawText(commands, x + width / 2, top + 4, eyebrow, {
      font: "bodyBold",
      size: 6.5,
      color: palette.text,
      align: "center"
    });
    drawText(commands, x + width / 2, top + 11, value, {
      font: "bodyBold",
      size: 8,
      color: palette.text,
      align: "center"
    });
    return;
  }
  drawText(commands, x + width / 2, top + 7, label, {
    font: "bodyBold",
    size: 8.5,
    color: palette.text,
    align: "center"
  });
}

function drawMetricTileStrip(
  commands: string[],
  x: number,
  top: number,
  width: number,
  tiles: MetricTile[]
): void {
  const visible = tiles.slice(0, 4);
  if (visible.length === 0) {
    return;
  }
  const tileWidth = (width - 12 * (visible.length - 1)) / visible.length;
  visible.forEach((tile, index) => {
    drawMetricTile(commands, x + index * (tileWidth + 12), top, tileWidth, tile);
  });
}

function drawMetricTile(commands: string[], x: number, top: number, width: number, tile: MetricTile): void {
  const palette = tonePalette(tile.tone);
  drawPanel(commands, x, top, width, 44, {
    fill: tile.tone === "neutral" ? white : palette.softFill,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 12, top + 12, tile.label, {
    font: "bodyBold",
    size: 8.5,
    color: tile.tone === "neutral" ? muted : palette.stroke
  });
  drawText(commands, x + 12, top + 29, tile.value, {
    font: "bodyBold",
    size: 11,
    color: charcoal
  });
}

function drawCompactNarrativeCard(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  title: string,
  body: string,
  tone: PdfTone
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, height, {
    fill: tone === "neutral" ? white : palette.softFill,
    stroke: divider,
    lineWidth: 0.8
  });
  drawPanel(commands, x, top, width, 4, { fill: palette.stroke });
  drawText(commands, x + 12, top + 16, title, {
    font: "bodyBold",
    size: 8.5,
    color: charcoal
  });
  drawTextBlock(commands, x + 12, top + 30, width - 24, body, {
    font: "body",
    size: 8,
    leading: 10,
    color: ink,
    maxLines: 3
  });
}

function drawInfoCard(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  title: string,
  body: string,
  tone: PdfTone
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, height, {
    fill: tone === "neutral" ? panelIvory : palette.softFill,
    stroke: divider,
    lineWidth: 0.8
  });
  drawPanel(commands, x, top, width, 4, { fill: palette.stroke });
  drawText(commands, x + 14, top + 18, title, {
    font: "bodyBold",
    size: 10,
    color: charcoal
  });
  drawTextBlock(commands, x + 14, top + 38, width - 28, body, {
    font: "body",
    size: 9,
    leading: 12,
    color: ink,
    maxLines: 7
  });
}

function drawThesisBox(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  label: string,
  body: string
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 18, label, {
    font: "bodyBold",
    size: 10,
    color: muted,
    tracking: 0.4
  });
  drawTextBlock(commands, x + 18, top + 38, width - 36, body, {
    font: "body",
    size: 10,
    leading: 14,
    color: ink,
    maxLines: 5
  });
}

function drawLabeledPanel(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  label: string,
  body: string,
  tone: PdfTone
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, height, {
    fill: tone === "neutral" ? panelIvory : palette.softFill,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 18, label, {
    font: "bodyBold",
    size: 10,
    color: tone === "neutral" ? muted : palette.stroke
  });
  drawTextBlock(commands, x + 18, top + 40, width - 36, body, {
    font: "body",
    size: 9.5,
    leading: 13,
    color: ink,
    maxLines: 8
  });
}

function drawFinancialTable(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  years: string[],
  rows: FinancialTableRow[]
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 20, "Financial progression", {
    font: "display",
    size: 18,
    color: charcoal
  });

  const headerTop = top + 54;
  const labelColumnWidth = 136;
  const valueColumnWidth = (width - labelColumnWidth - 28) / Math.max(years.length, 1);
  drawPanel(commands, x + 14, headerTop, width - 28, 28, {
    fill: panelSlate,
    stroke: divider,
    lineWidth: 0.4
  });
  drawText(commands, x + 24, headerTop + 10, "Metric", {
    font: "bodyBold",
    size: 9,
    color: muted
  });
  years.forEach((year, index) => {
    if (index === years.length - 1) {
      drawPanel(
        commands,
        x + 14 + labelColumnWidth + valueColumnWidth * index,
        headerTop,
        valueColumnWidth,
        28,
        {
          fill: goldSoft,
          stroke: divider,
          lineWidth: 0.35
        }
      );
    }
    drawText(commands, x + 14 + labelColumnWidth + valueColumnWidth * (index + 1) - 10, headerTop + 10, year, {
      font: "bodyBold",
      size: 9,
      color: index === years.length - 1 ? charcoal : muted,
      align: "right"
    });
  });

  let rowTop = headerTop + 28;
  rows.forEach((row, index) => {
    drawPanel(commands, x + 14, rowTop, width - 28, 34, {
      fill: index % 2 === 0 ? white : panelSlate,
      stroke: divider,
      lineWidth: 0.35
    });
    drawPanel(
      commands,
      x + 14 + labelColumnWidth + valueColumnWidth * Math.max(years.length - 1, 0),
      rowTop,
      valueColumnWidth,
      34,
      {
        fill: [0.979, 0.969, 0.934],
        stroke: divider,
        lineWidth: 0.2
      }
    );
    drawText(commands, x + 24, rowTop + 11, row.label, {
      font: "bodyBold",
      size: 9.5,
      color: ink
    });
    row.values.forEach((value, valueIndex) => {
      drawText(
        commands,
        x + 14 + labelColumnWidth + valueColumnWidth * (valueIndex + 1) - 10,
        rowTop + 11,
        value,
        {
          font: valueIndex === years.length - 1 ? "bodyBold" : "body",
          size: 9,
          color: ink,
          align: "right"
        }
      );
    });
    rowTop += 34;
  });
}

function drawScenarioTable(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  scenarios: ScenarioColumn[]
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 20, "Scenario table", {
    font: "display",
    size: 18,
    color: charcoal
  });

  const labelColumnWidth = 112;
  const scenarioWidth = (width - labelColumnWidth - 28) / Math.max(scenarios.length, 1);
  const tableTop = top + 56;
  const headerHeight = 28;
  const bodyRowHeights = [30, 48, 56, 56] as const;
  const bodyRowLabels = ["Fair value", "Implied move", "Key assumption", "Main risk"] as const;

  drawPanel(commands, x + 14, tableTop, width - 28, headerHeight, {
    fill: panelSlate,
    stroke: divider,
    lineWidth: 0.35
  });
  scenarios.forEach((scenario, index) => {
    drawText(
      commands,
      x + 14 + labelColumnWidth + scenarioWidth * index + scenarioWidth / 2,
      tableTop + 9,
      scenario.label,
      {
        font: "bodyBold",
        size: 9,
        color: tonePalette(scenario.tone).stroke,
        align: "center"
      }
    );
  });

  let currentTop = tableTop + headerHeight;
  const rows: [string[], string[], string[], string[]] = [
    scenarios.map((scenario) => scenario.fairValue),
    scenarios.map((scenario) => scenario.impliedMove),
    scenarios.map((scenario) => scenario.keyAssumption),
    scenarios.map((scenario) => scenario.mainRisk)
  ];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rowValues = rows[rowIndex];
    const rowHeight: number = bodyRowHeights[rowIndex] ?? 56;
    const rowLabel = bodyRowLabels[rowIndex] ?? "Detail";
    if (!rowValues) {
      continue;
    }
    drawPanel(commands, x + 14, currentTop, width - 28, rowHeight, {
      fill: rowIndex % 2 === 0 ? white : panelSlate,
      stroke: divider,
      lineWidth: 0.35
    });
    drawText(commands, x + 24, currentTop + 10, rowLabel, {
      font: "bodyBold",
      size: 9,
      color: ink
    });
    rowValues.forEach((value, valueIndex) => {
      if (rowIndex < 2) {
        drawText(
          commands,
          x + 14 + labelColumnWidth + scenarioWidth * valueIndex + scenarioWidth / 2,
          currentTop + 10,
          value,
          {
            font: "body",
            size: 9,
            color: ink,
            align: "center"
          }
        );
      } else {
        drawTextBlock(
          commands,
          x + 14 + labelColumnWidth + scenarioWidth * valueIndex + 10,
          currentTop + 9,
          scenarioWidth - 20,
          value,
          {
            font: "body",
            size: 8.5,
            leading: 11,
            color: ink,
            maxLines: rowIndex === 2 ? 4 : 5
          }
        );
      }
    });
    currentTop += rowHeight;
  }
}

function drawValuationRange(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  range: ValuationRangeView | undefined,
  labels: {
    lowLabel: string;
    midLabel: string;
    highLabel: string;
    spotLabel: string;
  }
): void {
  const baselineTop = top + 38;
  drawDivider(commands, x, baselineTop, x + width, baselineTop);

  if (!range || !hasAtLeastOneValue([range.low, range.mid, range.high, range.spot])) {
    drawText(commands, x, top + 10, "Valuation range is not available for this report.", {
      font: "body",
      size: 9,
      color: muted
    });
    return;
  }

  const values = [range.low, range.mid, range.high, range.spot].filter(isFiniteNumber);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue === minValue ? Math.max(Math.abs(maxValue), 1) : maxValue - minValue;
  const position = (value: number | undefined): number | undefined =>
    value === undefined ? undefined : x + ((value - minValue) / span) * width;

  const lowX = position(range.low);
  const highX = position(range.high);
  if (lowX !== undefined && highX !== undefined) {
    drawPanel(commands, lowX, baselineTop - 8, Math.max(18, highX - lowX), 16, {
      fill: goldSoft,
      stroke: gold,
      lineWidth: 0.6
    });
  }

  drawValuationMarker(commands, position(range.low), baselineTop, labels.lowLabel, range.low, gold, true);
  drawValuationMarker(commands, position(range.mid), baselineTop, labels.midLabel, range.mid, charcoal, false);
  drawValuationMarker(commands, position(range.high), baselineTop, labels.highLabel, range.high, positive, true);
  drawValuationMarker(commands, position(range.spot), baselineTop, labels.spotLabel, range.spot, charcoal, false, true);
  drawText(commands, x, top + 58, formatPrice(minValue), {
    font: "body",
    size: 8,
    color: muted
  });
  drawText(commands, x + width, top + 58, formatPrice(maxValue), {
    font: "body",
    size: 8,
    color: muted,
    align: "right"
  });
}

function drawValuationMarker(
  commands: string[],
  x: number | undefined,
  baselineTop: number,
  label: string,
  value: number | undefined,
  color: PdfRgb,
  above: boolean,
  filled = false
): void {
  if (x === undefined || value === undefined) {
    return;
  }
  const centerY = pageHeight - baselineTop;
  appendCircle(commands, x, centerY, 4, filled ? color : white, color);
  const labelTop = above ? baselineTop - 26 : baselineTop + 12;
  drawText(commands, x, labelTop, `${label} ${formatPrice(value)}`, {
    font: "bodyBold",
    size: 8,
    color: ink,
    align: "center"
  });
}

function drawMarginChart(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  chart: MarginChartView | undefined
): void {
  if (!chart || chart.labels.length === 0) {
    drawText(commands, x, top + 12, "Comparable annual margin history is not available for this run.", {
      font: "body",
      size: 9,
      color: muted
    });
    return;
  }

  const chartTop = top + 10;
  const chartLeft = x + 26;
  const chartWidth = width - 44;
  const chartHeight = height - 52;
  const maxValue = Math.max(
    0.4,
    ...chart.grossMargins.map((value) => value ?? 0),
    ...chart.operatingMargins.map((value) => value ?? 0)
  );

  for (let step = 0; step <= 4; step += 1) {
    const y = chartTop + chartHeight - (chartHeight / 4) * step;
    drawDivider(commands, chartLeft, y, chartLeft + chartWidth, y, 0.3);
    drawText(commands, x, y - 4, formatPct((maxValue / 4) * step, 0), {
      font: "body",
      size: 7.5,
      color: muted
    });
  }

  const groupWidth = chartWidth / chart.labels.length;
  const barWidth = Math.min(22, (groupWidth - 18) / 2);
  chart.labels.forEach((label, index) => {
    const baseX = chartLeft + index * groupWidth + groupWidth / 2;
    const gross = chart.grossMargins[index];
    const operating = chart.operatingMargins[index];
    if (gross !== undefined) {
      const barHeight = (gross / maxValue) * (chartHeight - 12);
      drawPanel(commands, baseX - barWidth - 3, chartTop + chartHeight - barHeight, barWidth, barHeight, {
        fill: goldSoft,
        stroke: gold,
        lineWidth: 0.5
      });
    }
    if (operating !== undefined) {
      const barHeight = (operating / maxValue) * (chartHeight - 12);
      drawPanel(commands, baseX + 3, chartTop + chartHeight - barHeight, barWidth, barHeight, {
        fill: charcoal,
        stroke: charcoal,
        lineWidth: 0.5
      });
    }
    drawText(commands, baseX, chartTop + chartHeight + 8, label, {
      font: "body",
      size: 8,
      color: ink,
      align: "center"
    });
  });

  drawPanel(commands, x + width - 148, top + 2, 12, 12, { fill: goldSoft, stroke: gold, lineWidth: 0.5 });
  drawText(commands, x + width - 130, top + 2, "Gross margin", {
    font: "body",
    size: 8,
    color: ink
  });
  drawPanel(commands, x + width - 68, top + 2, 12, 12, { fill: charcoal, stroke: charcoal, lineWidth: 0.5 });
  drawText(commands, x + width - 50, top + 2, "Operating margin", {
    font: "body",
    size: 8,
    color: ink
  });
}

function drawEvidencePanel(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  cards: EvidenceCard[]
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 20, "Key evidence used", {
    font: "display",
    size: 18,
    color: charcoal
  });

  const visible = cards.slice(0, 4);
  if (visible.length === 1) {
    const soloCard = visible[0];
    if (!soloCard) {
      return;
    }
    drawInfoCard(commands, x + 18, top + 54, width - 36, 104, soloCard.title, soloCard.body, "neutral");
    drawTextBlock(
      commands,
      x + 18,
      top + 178,
      width - 36,
      "The memo uses attached evidence excerpts when they exist and does not invent them when they do not.",
      {
        font: "body",
        size: 9,
        leading: 12,
        color: muted,
        maxLines: 3
      }
    );
    return;
  }

  const innerWidth = (width - 34) / 2;
  visible.forEach((card, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawInfoCard(
      commands,
      x + 10 + column * (innerWidth + 14),
      top + 50 + row * 90,
      innerWidth,
      78,
      card.title,
      card.body,
      row === 0 ? "neutral" : "gold"
    );
  });
}

function drawCoverageNote(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  summary: string,
  missingInputs: string[]
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 20, "Coverage limitations", {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawTextBlock(commands, x + 18, top + 46, width - 36, summary, {
    font: "body",
    size: 9.5,
    leading: 13,
    color: ink,
    maxLines: 4
  });
  drawBulletList(commands, x + 18, top + 92, width - 36, missingInputs.slice(0, 4), {
    font: "body",
    size: 9,
    leading: 12,
    color: muted,
    bulletColor: gold
  });
}

function drawRiskList(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  title: string,
  items: string[],
  tone: PdfTone
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, height, {
    fill: tone === "gold" ? goldSoft : panelIvory,
    stroke: divider,
    lineWidth: 0.8
  });
  drawText(commands, x + 18, top + 20, title, {
    font: "display",
    size: 18,
    color: charcoal
  });
  drawBulletList(commands, x + 18, top + 48, width - 36, items.slice(0, 4), {
    font: "body",
    size: 9.5,
    leading: 14,
    color: ink,
    bulletColor: palette.stroke
  });
}

function drawBulletList(
  commands: string[],
  x: number,
  top: number,
  width: number,
  items: string[],
  options: {
    font: PdfFontKey;
    size: number;
    leading: number;
    color: PdfRgb;
    bulletColor: PdfRgb;
  }
): number {
  let currentTop = top;
  const safeItems = items.length > 0 ? items : ["No explicit item was emitted for this section."];
  for (const item of safeItems) {
    const lines = wrapText(item, width - 18, options.size, options.font);
    appendCircle(commands, x + 4.5, pageHeight - currentTop - 9.5, 2.2, options.bulletColor, options.bulletColor);
    lines.slice(0, 4).forEach((line, lineIndex) => {
      drawText(commands, x + 16, currentTop + lineIndex * options.leading, line, {
        font: options.font,
        size: options.size,
        color: options.color
      });
    });
    currentTop += Math.max(options.leading, lines.slice(0, 4).length * options.leading) + 4;
  }
  return currentTop;
}

function drawTextBlock(
  commands: string[],
  x: number,
  top: number,
  width: number,
  text: string,
  options: {
    font: PdfFontKey;
    size: number;
    leading: number;
    color: PdfRgb;
    align?: "left" | "right" | "center";
    maxLines?: number;
  }
): number {
  const lines = wrapText(text, width, options.size, options.font);
  const limited = options.maxLines ? lines.slice(0, options.maxLines) : lines;
  limited.forEach((line, index) => {
    drawText(commands, x, top + index * options.leading, line, {
      font: options.font,
      size: options.size,
      color: options.color,
      align: options.align
    });
  });
  return top + limited.length * options.leading;
}

function drawText(
  commands: string[],
  x: number,
  top: number,
  text: string,
  options: {
    font: PdfFontKey;
    size: number;
    color: PdfRgb;
    align?: "left" | "right" | "center";
    tracking?: number;
  }
): void {
  const safeText = sanitizeInline(text);
  const width = estimateTextWidth(safeText, options.size, options.font, options.tracking ?? 0);
  const drawX =
    options.align === "right"
      ? x - width
      : options.align === "center"
        ? x - width / 2
        : x;
  appendText(
    commands,
    drawX,
    pageHeight - top - options.size,
    options.size,
    safeText,
    options.color,
    options.font,
    options.tracking ?? 0
  );
}

function drawPanel(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  options: {
    fill?: PdfRgb;
    stroke?: PdfRgb;
    lineWidth?: number;
  }
): void {
  appendRect(
    commands,
    x,
    pageHeight - top - height,
    width,
    height,
    options.fill,
    options.stroke,
    options.lineWidth ?? 0.8
  );
}

function drawDivider(commands: string[], x1: number, top1: number, x2: number, top2: number, width = 0.6): void {
  appendLine(commands, x1, pageHeight - top1, x2, pageHeight - top2, divider, width);
}

function tonePalette(tone: PdfTone): {
  fill: PdfRgb;
  softFill: PdfRgb;
  stroke: PdfRgb;
  text: PdfRgb;
} {
  switch (tone) {
    case "positive":
      return { fill: positiveSoft, softFill: positiveSoft, stroke: positive, text: positive };
    case "negative":
      return { fill: negativeSoft, softFill: negativeSoft, stroke: negative, text: negative };
    case "warning":
      return { fill: warningSoft, softFill: warningSoft, stroke: warning, text: warning };
    case "gold":
      return { fill: goldSoft, softFill: goldSoft, stroke: gold, text: gold };
    case "neutral":
    default:
      return { fill: panelIvory, softFill: panelIvory, stroke: muted, text: ink };
  }
}

function buildSignalChips(report: AnalysisReport, missingCount: number): ReportChip[] {
  const signalValue = report.signal?.value ?? "no_signal";
  const signalLabel =
    signalValue === "positive"
      ? "Signal: Positive"
      : signalValue === "negative"
        ? "Signal: Negative"
        : signalValue === "neutral"
          ? "Signal: Neutral"
          : "Signal: Watch";

  const signalTone: PdfTone =
    signalValue === "positive"
      ? "positive"
      : signalValue === "negative"
        ? "negative"
        : signalValue === "neutral"
          ? "neutral"
          : "warning";

  const confidenceLabel =
    report.confidence.label === "high"
      ? "Confidence: High"
      : report.confidence.label === "medium"
        ? "Confidence: Medium"
        : "Confidence: Limited";

  const valuationStance = buildValuationStance(report);
  const coverageLabel = buildCoverageChip(report, missingCount);

  return [
    { label: signalLabel, tone: signalTone },
    {
      label: confidenceLabel,
      tone: report.confidence.score >= 0.7 ? "positive" : report.confidence.score >= 0.45 ? "gold" : "warning"
    },
    valuationStance,
    coverageLabel
  ];
}

function buildQualityChips(report: AnalysisReport, missingCount: number): ReportChip[] {
  const score = report.value_discipline;
  return [
    {
      label: `Score: ${score ? `${score.score}/${score.max_score}` : "Limited"}`,
      tone: score && score.score >= Math.ceil(score.max_score * 0.66) ? "positive" : score ? "gold" : "warning"
    },
    {
      label: `Completeness: ${humanizeInlineWord(score?.completeness ?? "limited")}`,
      tone: score?.completeness === "complete" ? "positive" : score?.completeness === "partial" ? "gold" : "warning"
    },
    {
      label: `Missing inputs: ${String(missingCount)}`,
      tone: missingCount === 0 ? "positive" : missingCount <= 2 ? "gold" : "warning"
    }
  ];
}

function buildValuationTiles(report: AnalysisReport): MetricTile[] {
  if (!report.valuation) {
    return [];
  }
  const tiles: MetricTile[] = [
    { label: "Low", value: formatPrice(report.valuation.fair_value_low), tone: "warning" },
    { label: "Spot", value: formatPrice(report.valuation.spot_price), tone: "neutral" },
    { label: "Base", value: formatPrice(report.valuation.fair_value_mid), tone: "gold" },
    { label: "High", value: formatPrice(report.valuation.fair_value_high), tone: "positive" }
  ];
  return tiles.filter((tile) => tile.value !== "n/a");
}

function buildValuationStance(report: AnalysisReport): ReportChip {
  if (!report.valuation || report.valuation.spot_price === undefined || report.valuation.fair_value_mid === undefined) {
    return { label: "Valuation: Limited", tone: "warning" };
  }
  const spread = (report.valuation.fair_value_mid - report.valuation.spot_price) / report.valuation.spot_price;
  if (spread > 0.1) {
    return { label: "Valuation: Discount", tone: "positive" };
  }
  if (spread < -0.1) {
    return { label: "Valuation: Premium", tone: "negative" };
  }
  return { label: "Valuation: Near Base", tone: "gold" };
}

function buildKillSwitchCards(report: AnalysisReport): ExecutiveCard[] {
  const conditions = report.kill_switch_conditions ?? [];
  if (conditions.length === 0) {
    return [
      {
        title: "Coverage note",
        body: "No explicit kill-switch rules were attached to this run, so the memo keeps risk framing qualitative.",
        tone: "warning"
      }
    ];
  }

  return conditions.slice(0, 3).map((condition, index) => ({
    title: reportLabelMap(condition.signal_type),
    body: shortenText(condition.condition_text, 100),
    tone: index === 0 ? "warning" : index === 1 ? "gold" : "neutral"
  }));
}

function buildCoverageChip(report: AnalysisReport, missingCount: number): ReportChip {
  if (missingCount === 0 && report.confidence.score >= 0.7) {
    return { label: "Coverage: Strong", tone: "positive" };
  }
  if (missingCount <= 2) {
    return { label: "Coverage: Moderate", tone: "gold" };
  }
  return { label: "Coverage: Limited", tone: "warning" };
}

function buildChangeCards(report: AnalysisReport): ChangeCard[] {
  const changes = report.change_summary?.top_changes ?? [];
  if (changes.length === 0) {
    return [
      {
        title: "Fresh baseline",
        body: "No prior comparable report was available, so this memo establishes the current reference view."
      },
      {
        title: "Current stance",
        body: shortenText(
          firstNonEmpty(report.story_header?.reader_takeaway, report.story_header?.thesis_summary, "The current stance should be treated as a working view."),
          130
        )
      },
      {
        title: "Attention point",
        body: "Future reports should focus on whether new evidence materially strengthens or weakens the current case."
      }
    ];
  }

  const cards = changes.slice(0, 3).map((change) => ({
    title: shortenText(change.title, 34),
    body: shortenText(firstNonEmpty(change.why_it_matters, change.why_it_changed), 132)
  }));

  while (cards.length < 3) {
    if (cards.length === 1) {
      cards.push({
        title: "Coverage read",
        body: shortenText(
          firstNonEmpty(
            report.story_header?.reader_takeaway,
            report.coverage_truth?.summary,
            "The current memo is usable, but it still depends on continued evidence quality."
          ),
          132
        )
      });
      continue;
    }
    cards.push({
      title: "Watch next",
      body: shortenText(
        firstNonEmpty(
          report.watch_items?.[0],
          report.kill_switch_conditions?.[0]?.condition_text,
          "The next review should focus on what could most quickly weaken the thesis."
        ),
        132
      )
    });
  }

  return cards;
}

function buildQualityRows(
  report: AnalysisReport,
  qualitySection: InvestmentMemoSection | undefined,
  risksSection: InvestmentMemoSection | undefined
): QualityScoreRow[] {
  const signals = report.value_discipline?.signals ?? [];
  const profitability = findSignal(signals, (signal) => signal.family === "profitability");
  const margin = findSignal(
    signals,
    (signal) => signal.key === "operating_margin_up" || signal.family === "operating_efficiency"
  );
  const cashConversion = findSignal(
    signals,
    (signal) => signal.key === "cash_conversion_consistent" || signal.family === "earnings_quality"
  );
  const capitalDiscipline = findSignal(
    signals,
    (signal) => signal.key === "share_count_discipline" || signal.family === "capital_discipline"
  );
  const uncertaintyText = firstNonEmpty(
    buildMissingInputs(report)[0],
    risksSection?.key_points[0],
    report.kill_switch_conditions?.[0]?.condition_text,
    "The main uncertainty is whether fresh evidence continues to support the current base case."
  );

  return [
    buildQualityRow(
      "Business model quality",
      firstNonEmpty(
        qualitySection?.narrative,
        report.story_header?.headline,
        "Business quality remains anchored to evidence rather than enthusiasm."
      ),
      profitability,
      report.coverage_truth?.summary
    ),
    buildQualityRow(
      "Margin resilience",
      firstNonEmpty(
        report.change_summary?.current_view,
        report.change_summary?.top_changes[0]?.why_it_changed,
        "Margin behavior should be watched for confirmation in the next reporting window."
      ),
      margin,
      margin?.reason ?? report.story_header?.why_now
    ),
    buildQualityRow(
      "Cash conversion",
      firstNonEmpty(
        report.story_header?.thesis_summary,
        "Free-cash-flow durability remains central to the investment case."
      ),
      cashConversion,
      cashConversion?.reason ?? report.sections[0]?.evidence[0]?.excerpt
    ),
    buildQualityRow(
      "Capital discipline",
      firstNonEmpty(
        report.value_discipline?.does_not_prove,
        "Capital allocation still matters even when operating quality looks supportive."
      ),
      capitalDiscipline,
      capitalDiscipline?.reason ?? report.value_discipline?.interpretation
    ),
    {
      factor: "Key uncertainty",
      reading: shortenText(firstNonEmpty(risksSection?.narrative, report.coverage_truth?.summary, uncertaintyText), 92),
      signal: "Watch",
      tone: "warning",
      evidence: shortenText(uncertaintyText, 92)
    }
  ];
}

function buildQualityRow(
  factor: string,
  reading: string,
  signal: ValueDisciplineSignal | undefined,
  evidenceFallback: string | undefined
): QualityScoreRow {
  return {
    factor,
    reading: shortenText(reading, 92),
    signal: mapSignalStatus(signal?.status),
    tone: mapSignalTone(signal?.status),
    evidence: shortenText(firstNonEmpty(signal?.reason, evidenceFallback, "Evidence is limited for this factor."), 92)
  };
}

function buildFinancialView(annualHistory: FinancialHistoryRow[]): {
  years: string[];
  rows: FinancialTableRow[];
  note: string;
  chart?: MarginChartView;
} {
  const history = normalizeFinancialHistory(annualHistory);
  const years = history.map((row) => sanitizeInline(row.period));
  const revenueGrowth = history.map((row, index) => {
    if (index === 0) {
      return undefined;
    }
    const prior = history[index - 1]?.revenue;
    const current = row.revenue;
    if (!prior || !current) {
      return undefined;
    }
    return (current - prior) / prior;
  });

  return {
    years,
    rows: [
      {
        label: "Revenue",
        values: history.map((row) => formatFinancialAmount(row.revenue))
      },
      {
        label: "Gross margin",
        values: history.map((row) => formatPct(row.gross_margin))
      },
      {
        label: "Operating margin",
        values: history.map((row) => formatPct(row.operating_margin))
      },
      {
        label: "Free cash flow",
        values: history.map((row) => formatFinancialAmount(row.free_cash_flow))
      },
      {
        label: "Revenue growth",
        values: revenueGrowth.map((value) => formatPct(value))
      }
    ],
    note:
      history.filter((row) => row.gross_margin !== undefined || row.operating_margin !== undefined).length >= 2
        ? "Figures are shown in investor-friendly shorthand. Revenue and free cash flow are abbreviated for readability, while margins are shown as percentages."
        : "Only limited financial history was available, so the chart remains intentionally restrained.",
    chart:
      history.filter((row) => row.gross_margin !== undefined || row.operating_margin !== undefined).length >= 2
        ? {
            labels: years,
            grossMargins: history.map((row) => row.gross_margin),
            operatingMargins: history.map((row) => row.operating_margin)
          }
        : undefined
  };
}

function buildScenarioColumns(
  report: AnalysisReport,
  valuationSection: InvestmentMemoSection | undefined,
  risksSection: InvestmentMemoSection | undefined
): ScenarioColumn[] {
  if (!report.valuation) {
    const fallback = "Valuation was not available for this run.";
    return [
      { label: "Bear", fairValue: "n/a", impliedMove: "n/a", keyAssumption: fallback, mainRisk: fallback, tone: "warning" },
      { label: "Base", fairValue: "n/a", impliedMove: "n/a", keyAssumption: fallback, mainRisk: fallback, tone: "neutral" },
      { label: "Bull", fairValue: "n/a", impliedMove: "n/a", keyAssumption: fallback, mainRisk: fallback, tone: "gold" }
    ];
  }

  const spot = report.valuation.spot_price;
  const baseAssumption = `Uses the current base assumptions: ${formatPct(report.valuation.assumptions.wacc)} WACC and ${formatPct(report.valuation.assumptions.terminal_growth_rate)} terminal growth.`;
  const primaryRisk = shortenText(
    firstNonEmpty(
      risksSection?.key_points[0],
      report.kill_switch_conditions?.[0]?.condition_text,
      "Execution slips against the current base case."
    ),
    82
  );

  return [
    {
      label: "Bear",
      fairValue: formatPrice(report.valuation.fair_value_low),
      impliedMove: formatSignedPct(computeMove(report.valuation.fair_value_low, spot)),
      keyAssumption: "Downside assumes weaker conversion from revenue into durable margin and cash flow.",
      mainRisk: shortenText(firstNonEmpty(report.valuation.degraded_reason, primaryRisk), 82),
      tone: "warning"
    },
    {
      label: "Base",
      fairValue: formatPrice(report.valuation.fair_value_mid),
      impliedMove: formatSignedPct(computeMove(report.valuation.fair_value_mid, spot)),
      keyAssumption: shortenText(firstNonEmpty(valuationSection?.narrative, baseAssumption), 82),
      mainRisk: primaryRisk,
      tone: "neutral"
    },
    {
      label: "Bull",
      fairValue: formatPrice(report.valuation.fair_value_high),
      impliedMove: formatSignedPct(computeMove(report.valuation.fair_value_high, spot)),
      keyAssumption: "Upside requires stronger margin durability and cleaner free-cash-flow follow-through than the current base case.",
      mainRisk: "Upside fades quickly if execution misses or the valuation range compresses.",
      tone: "gold"
    }
  ];
}

function buildEvidenceCards(report: AnalysisReport): EvidenceCard[] {
  const cards: EvidenceCard[] = [];
  for (const section of report.sections) {
    for (const evidence of section.evidence) {
      cards.push({
        title: shortenText(section.title, 36),
        body: shortenText(evidence.excerpt, 100)
      });
      if (cards.length === 4) {
        return cards;
      }
    }
  }
  if (cards.length > 0) {
    return cards;
  }
  return [
    {
      title: "Evidence note",
      body: "No evidence snippets were attached to this report artifact, so the export does not pretend otherwise."
    },
    {
      title: "Coverage note",
      body: shortenText(firstNonEmpty(report.coverage_truth?.summary, "Evidence coverage is limited in this run."), 100)
    }
  ];
}

function buildMissingInputs(report: AnalysisReport): string[] {
  const notes = new Set<string>();
  for (const missing of report.coverage_truth?.missing ?? []) {
    notes.add(reportSentenceMap(missing));
  }
  for (const omission of report.financial_analysis?.omissions ?? []) {
    notes.add(shortenText(`${reportLabelMap(omission.label)}: ${sanitizeInline(omission.reason)}`, 104));
  }
  for (const limitingFactor of report.confidence.limiting_factors ?? []) {
    notes.add(reportSentenceMap(limitingFactor));
  }
  return [...notes].slice(0, 5);
}

function buildRiskItems(report: AnalysisReport, risksSection: InvestmentMemoSection | undefined): string[] {
  const items = [
    ...(risksSection?.key_points ?? []),
    ...(report.kill_switch_conditions ?? []).map((condition) =>
      `${reportLabelMap(condition.signal_type)}: ${sanitizeInline(condition.condition_text)}`
    )
  ]
    .map((item) => shortenText(item, 100))
    .filter((item) => item.length > 0);

  if (items.length > 0) {
    return items.slice(0, 5);
  }

  return [
    shortenText(
      firstNonEmpty(
        report.coverage_truth?.summary,
        "Risk coverage is limited because explicit risk items were not emitted in this run."
      ),
      100
    )
  ];
}

function buildMindChangeItems(report: AnalysisReport): string[] {
  const items = [
    ...(report.watch_items ?? []),
    ...(report.kill_switch_conditions ?? []).map((condition) => sanitizeInline(condition.condition_text))
  ]
    .map((item) => shortenText(item, 100))
    .filter((item) => item.length > 0);

  if (items.length > 0) {
    return items.slice(0, 5);
  }

  return ["A material shift in evidence quality, valuation support, or execution would warrant a fresh read of the thesis."];
}

function findMemoSection(
  sections: InvestmentMemoSection[],
  sectionId: InvestmentMemoSection["section_id"]
): InvestmentMemoSection | undefined {
  return sections.find((section) => section.section_id === sectionId);
}

function findSignal(
  signals: ValueDisciplineSignal[],
  predicate: (signal: ValueDisciplineSignal) => boolean
): ValueDisciplineSignal | undefined {
  return signals.find(predicate);
}

function mapSignalStatus(status: ValueDisciplineSignal["status"] | undefined): string {
  if (status === "pass") {
    return "Supportive";
  }
  if (status === "fail") {
    return "Concern";
  }
  return "Limited";
}

function mapSignalTone(status: ValueDisciplineSignal["status"] | undefined): PdfTone {
  if (status === "pass") {
    return "positive";
  }
  if (status === "fail") {
    return "negative";
  }
  return "warning";
}

function normalizeFinancialHistory(annualHistory: FinancialHistoryRow[]): FinancialHistoryRow[] {
  const sorted = [...annualHistory].sort((left, right) => left.fiscal_year - right.fiscal_year);
  if (sorted.length === 0) {
    return [
      { period: "FY-2022", period_type: "annual", fiscal_year: 2022 },
      { period: "FY-2023", period_type: "annual", fiscal_year: 2023 },
      { period: "FY-2024", period_type: "annual", fiscal_year: 2024 },
      { period: "FY-2025", period_type: "annual", fiscal_year: 2025 }
    ];
  }

  const lastYear = sorted[sorted.length - 1]?.fiscal_year ?? 2025;
  const targetYears = Array.from({ length: 4 }, (_, index) => lastYear - 3 + index);
  const rowsByYear = new Map(sorted.map((row) => [row.fiscal_year, row]));
  return targetYears.map((year) => rowsByYear.get(year) ?? { period: `FY-${year}`, period_type: "annual", fiscal_year: year });
}

function renderSimplePdf(pages: PdfPageContent[]): Buffer {
  const objects = new Map<number, string>();
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  let nextObjectId = 3;
  const fontObjectIds = new Map<PdfFontKey, number>();

  for (const fontKey of Object.keys(fontResources) as PdfFontKey[]) {
    fontObjectIds.set(fontKey, nextObjectId);
    objects.set(
      nextObjectId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /${fontResources[fontKey].baseFont} >>`
    );
    nextObjectId += 1;
  }

  objects.set(catalogObjectId, `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const pageObjectIds: number[] = [];
  pages.forEach((page, index) => {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    const commands: string[] = [];
    page.draw(commands, index + 1, pages.length);
    const contentStream = commands.join("\n");
    pageObjectIds.push(pageObjectId);

    const resourceEntries = (Object.keys(fontResources) as PdfFontKey[])
      .map((fontKey) => `/${fontResources[fontKey].resource} ${fontObjectIds.get(fontKey)} 0 R`)
      .join(" ");

    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << ${resourceEntries} >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.set(
      contentObjectId,
      `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`
    );
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.set(pagesObjectId, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  const maxObjectId = nextObjectId - 1;
  const offsets: number[] = new Array(maxObjectId + 1).fill(0);
  let output = "%PDF-1.4\n";

  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    const objectBody = objects.get(objectId);
    if (!objectBody) {
      throw new Error(`Missing PDF object ${objectId}.`);
    }
    offsets[objectId] = Buffer.byteLength(output, "utf8");
    output += `${objectId} 0 obj\n${objectBody}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${maxObjectId + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    output += `${(offsets[objectId] ?? 0).toString().padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${maxObjectId + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "utf8");
}

function appendText(
  commands: string[],
  x: number,
  y: number,
  fontSize: number,
  text: string,
  color: PdfRgb,
  font: PdfFontKey,
  tracking = 0
): void {
  commands.push("BT");
  commands.push(`${colorToCommand(color)} rg`);
  commands.push(`/${fontResources[font].resource} ${fontSize} Tf`);
  if (tracking !== 0) {
    commands.push(`${roundPdfNumber(tracking)} Tc`);
  }
  commands.push(`1 0 0 1 ${roundPdfNumber(x)} ${roundPdfNumber(y)} Tm`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push("ET");
}

function appendRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: PdfRgb,
  strokeColor?: PdfRgb,
  lineWidth = 0.8
): void {
  commands.push("q");
  if (fillColor) {
    commands.push(`${colorToCommand(fillColor)} rg`);
  }
  if (strokeColor) {
    commands.push(`${colorToCommand(strokeColor)} RG`);
    commands.push(`${roundPdfNumber(lineWidth)} w`);
  }
  commands.push(`${roundPdfNumber(x)} ${roundPdfNumber(y)} ${roundPdfNumber(width)} ${roundPdfNumber(height)} re`);
  if (fillColor && strokeColor) {
    commands.push("B");
  } else if (fillColor) {
    commands.push("f");
  } else if (strokeColor) {
    commands.push("S");
  }
  commands.push("Q");
}

function appendLine(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: PdfRgb,
  lineWidth = 0.8
): void {
  commands.push("q");
  commands.push(`${colorToCommand(color)} RG`);
  commands.push(`${roundPdfNumber(lineWidth)} w`);
  commands.push(`${roundPdfNumber(x1)} ${roundPdfNumber(y1)} m`);
  commands.push(`${roundPdfNumber(x2)} ${roundPdfNumber(y2)} l`);
  commands.push("S");
  commands.push("Q");
}

function appendCircle(commands: string[], centerX: number, centerY: number, radius: number, fill: PdfRgb, stroke: PdfRgb): void {
  const control = radius * 0.552284749831;
  commands.push("q");
  commands.push(`${colorToCommand(fill)} rg`);
  commands.push(`${colorToCommand(stroke)} RG`);
  commands.push("0.5 w");
  commands.push(`${roundPdfNumber(centerX)} ${roundPdfNumber(centerY + radius)} m`);
  commands.push(
    `${roundPdfNumber(centerX + control)} ${roundPdfNumber(centerY + radius)} ${roundPdfNumber(centerX + radius)} ${roundPdfNumber(centerY + control)} ${roundPdfNumber(centerX + radius)} ${roundPdfNumber(centerY)} c`
  );
  commands.push(
    `${roundPdfNumber(centerX + radius)} ${roundPdfNumber(centerY - control)} ${roundPdfNumber(centerX + control)} ${roundPdfNumber(centerY - radius)} ${roundPdfNumber(centerX)} ${roundPdfNumber(centerY - radius)} c`
  );
  commands.push(
    `${roundPdfNumber(centerX - control)} ${roundPdfNumber(centerY - radius)} ${roundPdfNumber(centerX - radius)} ${roundPdfNumber(centerY - control)} ${roundPdfNumber(centerX - radius)} ${roundPdfNumber(centerY)} c`
  );
  commands.push(
    `${roundPdfNumber(centerX - radius)} ${roundPdfNumber(centerY + control)} ${roundPdfNumber(centerX - control)} ${roundPdfNumber(centerY + radius)} ${roundPdfNumber(centerX)} ${roundPdfNumber(centerY + radius)} c`
  );
  commands.push("B");
  commands.push("Q");
}

function wrapText(text: string, maxWidth: number, fontSize: number, font: PdfFontKey): string[] {
  const normalized = sanitizeInline(text);
  if (!normalized) {
    return [""];
  }
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize, font) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [normalized];
}

function estimateTextWidth(text: string, fontSize: number, font: PdfFontKey, tracking = 0): number {
  const factor =
    font === "mono" ? 0.6 : font === "display" ? 0.56 : font === "bodyBold" ? 0.54 : 0.5;
  const safe = sanitizeInline(text);
  return safe.length * fontSize * factor + Math.max(0, safe.length - 1) * tracking;
}

function colorToCommand(color: PdfRgb): string {
  return color.map((entry) => entry.toFixed(3)).join(" ");
}

function roundPdfNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function escapePdfText(value: string): string {
  return sanitizeInline(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function sanitizeInline(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenText(text: string, maxLength: number): string {
  const safe = sanitizeInline(text);
  if (safe.length <= maxLength) {
    return safe;
  }
  const trimmed = safe.slice(0, maxLength - 1);
  const breakIndex = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, breakIndex > 32 ? breakIndex : maxLength - 1).trim()}.`;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const safe = sanitizeInline(value);
    if (safe.length > 0) {
      return safe;
    }
  }
  return "";
}

function humanizeInlineWord(value: string): string {
  return sanitizeInline(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`)
    .join(" ");
}

function hasAtLeastOneValue(values: Array<number | undefined>): boolean {
  return values.some(isFiniteNumber);
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function formatReportDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatFinancialAmount(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(1)}M`;
}

function formatPct(value: number | undefined, digits = 1): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function computeMove(value: number | undefined, spot: number | undefined): number | undefined {
  if (value === undefined || spot === undefined || spot === 0) {
    return undefined;
  }
  return (value - spot) / spot;
}
