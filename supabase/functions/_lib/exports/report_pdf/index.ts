// Entry point: builds the Deep Dive PDF pages and renders them. Pure TypeScript, no browser.
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import type { AnalysisReport, Loose } from "../../reports/types.ts";
import { reportLabelMap } from "../../reports/label_map.ts";
import {
  buildDueDiligencePdfPages,
  extractDueDiligenceSectionMap,
  extractSectionText,
} from "./due_diligence.ts";
import {
  drawBusinessQualityPage,
  drawEvidenceAndRiskPage,
  drawExecutiveMemoPage,
  drawFinancialStatementPage,
  drawThesisAndChangePage,
  drawValuationPage,
} from "./pages_memo.ts";
import {
  AnalysisReportWithDueDiligence,
  CanonicalDueDiligenceSectionId,
  InstitutionalPdfExportResult,
  PdfPageContent,
  ReportViewModel,
} from "./theme.ts";
import {
  buildChangeCards,
  buildEvidenceCards,
  buildFinancialView,
  buildKillSwitchCards,
  buildMindChangeItems,
  buildMissingInputs,
  buildQualityChips,
  buildQualityRows,
  buildRiskItems,
  buildScenarioColumns,
  buildSignalChips,
  buildValuationTiles,
  findMemoSection,
} from "./view_builders.ts";
import {
  firstNonEmpty,
  formatPrice,
  formatReportDate,
  formatSignedPct,
  renderSimplePdf,
  sanitizeInline,
  shortenText,
} from "./writer.ts";

// The old server used headless Chrome when the report had due diligence sections and Chrome was installed.
// Edge Functions have no browser, so the rebuild always uses the built-in writer (DECISIONS D4).
export function buildInstitutionalPdfExport(report: AnalysisReport): InstitutionalPdfExportResult {
  return buildLegacyInstitutionalPdfExport(report);
}

export function buildLegacyInstitutionalPdfExport(report: AnalysisReport): InstitutionalPdfExportResult {
  const pages = buildInstitutionalPdfPages(report);
  const buffer = renderSimplePdf(pages);
  return {
    buffer,
    pageCount: pages.length,
    pageTitles: pages.map((page) => page.title),
  };
}

export function buildInstitutionalPdfPages(report: AnalysisReport): PdfPageContent[] {
  const dueDiligence = extractDueDiligenceSectionMap(report as AnalysisReportWithDueDiligence);
  const view = buildReportViewModel(report, dueDiligence);
  if (dueDiligence) {
    return buildDueDiligencePdfPages(report, view, dueDiligence);
  }
  return buildLegacyInstitutionalPdfPages(view);
}

export function buildLegacyInstitutionalPdfPages(view: ReportViewModel): PdfPageContent[] {
  return [
    {
      title: "Executive Memo",
      draw: (commands, pageNumber, totalPages) =>
        drawExecutiveMemoPage(commands, view, pageNumber, totalPages),
    },
    {
      title: "Thesis and Change",
      draw: (commands, pageNumber, totalPages) =>
        drawThesisAndChangePage(commands, view, pageNumber, totalPages),
    },
    {
      title: "Business Quality",
      draw: (commands, pageNumber, totalPages) =>
        drawBusinessQualityPage(commands, view, pageNumber, totalPages),
    },
    {
      title: "Financial Statement Analysis",
      draw: (commands, pageNumber, totalPages) =>
        drawFinancialStatementPage(commands, view, pageNumber, totalPages),
    },
    {
      title: "Valuation and Scenarios",
      draw: (commands, pageNumber, totalPages) => drawValuationPage(commands, view, pageNumber, totalPages),
    },
    {
      title: "Evidence and Risks",
      draw: (commands, pageNumber, totalPages) =>
        drawEvidenceAndRiskPage(commands, view, pageNumber, totalPages),
    },
  ];
}

export function buildReportViewModel(
  report: AnalysisReport,
  dueDiligence?: Partial<Record<CanonicalDueDiligenceSectionId, Record<string, unknown>>>,
): ReportViewModel {
  const ticker = sanitizeInline(report.ticker ?? "REPORT");
  const memoSections = report.investment_memo?.sections ?? [];
  const thesisSection = findMemoSection(memoSections, "investment_thesis");
  const changeSection = findMemoSection(memoSections, "what_changed");
  const qualitySection = findMemoSection(memoSections, "business_quality");
  const valuationSection = findMemoSection(memoSections, "valuation");
  const risksSection = findMemoSection(memoSections, "risks");
  const changeCards = buildChangeCards(report);
  const financialView = buildFinancialView(
    report.financial_analysis?.annual_history ?? [],
    extractSectionText(dueDiligence?.financial_analysis, ["summary", "narrative", "body", "analysis"]),
  );
  const coverageMissing = buildMissingInputs(report, dueDiligence);
  const riskItems = buildRiskItems(report, risksSection, dueDiligence?.risks_and_challenges);
  const mindChangeItems = buildMindChangeItems(report);
  const valuationRange = report.valuation
    ? {
      low: report.valuation.fair_value_low,
      mid: report.valuation.fair_value_mid,
      high: report.valuation.fair_value_high,
      spot: report.valuation.spot_price,
    }
    : undefined;

  return {
    ticker,
    companyLabel: ticker,
    reportDate: formatReportDate(report.generated_at),
    subtitle: firstNonEmpty(
      report.story_header?.headline,
      extractSectionText(dueDiligence?.competitive_positioning, ["summary", "headline", "narrative"]),
      thesisSection?.narrative,
      "Institutional due-diligence report.",
    ),
    signalChips: buildSignalChips(report, coverageMissing.length),
    qualityChips: buildQualityChips(report, coverageMissing.length),
    spotPriceLabel: report.valuation?.spot_price !== undefined
      ? `Spot ${formatPrice(report.valuation.spot_price)}`
      : "Spot unavailable",
    upsideLabel: report.valuation?.implied_upside_pct !== undefined
      ? `${formatSignedPct(report.valuation.implied_upside_pct)} vs base case`
      : "Valuation range unavailable",
    heroThesis: shortenText(
      firstNonEmpty(
        report.story_header?.thesis_summary,
        thesisSection?.narrative,
        report.sections.find((section: Loose) => section.section_id === "thesis_statement")?.body,
        extractSectionText(dueDiligence?.valuation_and_thesis_stance, ["summary", "narrative"]),
        "The available evidence is not yet strong enough to support a sharper investment claim.",
      ),
      190,
    ),
    decisionQuestion: shortenText(
      firstNonEmpty(
        report.investment_memo?.decision_question,
        "What would need to remain true for the thesis to stay investable?",
      ),
      130,
    ),
    executiveCards: [
      {
        title: "What matters now",
        body: shortenText(
          firstNonEmpty(
            report.story_header?.why_now,
            report.change_summary?.top_changes[0]?.why_it_matters,
            changeSection?.narrative,
            extractSectionText(dueDiligence?.growth_opportunities_and_outlook, ["summary", "narrative"]),
            "The next review window should focus on whether recent execution keeps supporting the base case.",
          ),
          150,
        ),
        tone: "gold",
      },
      {
        title: "What changed",
        body: shortenText(
          firstNonEmpty(
            report.change_summary?.top_changes[0]?.why_it_changed,
            report.change_summary?.current_view,
            changeSection?.narrative,
            "No prior comparable view is available, so this report establishes the current baseline.",
          ),
          150,
        ),
        tone: "neutral",
      },
      {
        title: "What could break the thesis",
        body: shortenText(
          firstNonEmpty(
            riskItems[0],
            report.kill_switch_conditions?.[0]?.condition_text,
            extractSectionText(dueDiligence?.risks_and_challenges, ["watch_item", "watch_items", "body"]),
            "The most important watch point is whether core evidence starts moving against the current base case.",
          ),
          150,
        ),
        tone: "warning",
      },
    ],
    valuationTiles: buildValuationTiles(report),
    valuationRange,
    centralArgument: shortenText(
      firstNonEmpty(
        thesisSection?.narrative,
        report.story_header?.headline,
        report.story_header?.thesis_summary,
        "The current investment argument is limited and should be treated as a watchlist view.",
      ),
      240,
    ),
    previousView: shortenText(
      firstNonEmpty(
        report.change_summary?.previous_view,
        "No prior comparable report is available, so there is no locked previous view yet.",
      ),
      180,
    ),
    currentView: shortenText(
      firstNonEmpty(
        report.change_summary?.current_view,
        thesisSection?.narrative,
        extractSectionText(dueDiligence?.valuation_and_thesis_stance, ["summary", "narrative"]),
        "The current view relies on the evidence available in this report.",
      ),
      180,
    ),
    implication: shortenText(
      firstNonEmpty(
        report.story_header?.reader_takeaway,
        valuationSection?.narrative,
        extractSectionText(dueDiligence?.growth_opportunities_and_outlook, ["summary", "narrative"]),
        report.coverage_truth?.summary,
        "The current evidence supports further review rather than blind conviction.",
      ),
      170,
    ),
    changeCards,
    qualityRows: buildQualityRows(report, qualitySection, risksSection),
    qualityContext: report.value_discipline
      ? reportLabelMap(report.value_discipline.context_label)
      : "General operating context",
    qualityInterpretation: shortenText(
      firstNonEmpty(
        extractSectionText(dueDiligence?.competitive_positioning, ["summary", "narrative", "analysis"]),
        report.value_discipline?.interpretation,
        qualitySection?.narrative,
        "Quality readings are informative, but they do not replace full competitive and valuation work.",
      ),
      180,
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
        extractSectionText(dueDiligence?.valuation_and_thesis_stance, ["summary", "narrative", "analysis"]),
        valuationSection?.narrative,
        report.valuation?.degraded_reason,
        "Valuation should be read as a scenario framework rather than a single-point answer.",
      ),
      200,
    ),
    evidenceCards: buildEvidenceCards(report),
    killSwitchCards: buildKillSwitchCards(report),
    missingInputs: coverageMissing,
    riskItems,
    mindChangeItems,
    coverageNote: shortenText(
      firstNonEmpty(
        extractSectionText(dueDiligence?.financial_analysis, ["summary", "narrative", "analysis"]),
        report.coverage_truth?.summary,
        report.investment_memo?.sparse_data_honesty_note,
        "Coverage is constrained by the available evidence and should be read with that limitation in mind.",
      ),
      180,
    ),
  };
}
