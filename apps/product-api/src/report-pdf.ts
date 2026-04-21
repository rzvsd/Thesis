import type {
  AnalysisReport,
  FinancialHistoryRow,
  FinancialOmission,
  InvestmentMemoSection
} from "../../../packages/contracts/src";

interface PdfPageContent {
  title: string;
  lines: string[];
  exhibits: PdfExhibit[];
}

interface MetricSummaryRow {
  label: string;
  status: string;
  direction: string;
  value?: number;
  note?: string;
}

type PdfTone = "spot" | "low" | "mid" | "high" | "neutral" | "positive" | "negative" | "warning";
type PdfRiskTone = "high" | "medium" | "low" | "neutral";

type PdfExhibit =
  | PdfRangeBandExhibit
  | PdfGroupedBarExhibit
  | PdfScorecardExhibit
  | PdfWaterfallExhibit
  | PdfStatusBarExhibit
  | PdfOmissionPanelExhibit;

interface PdfExhibitBase {
  kind: string;
  title: string;
  summary?: string;
  height: number;
}

interface PdfRangeBandExhibit extends PdfExhibitBase {
  kind: "range_band";
  low?: number;
  mid?: number;
  high?: number;
  reference?: number;
  valueLabel: string;
  referenceLabel: string;
}

interface PdfGroupedBarSeries {
  label: string;
  tone: PdfTone;
}

interface PdfGroupedBarCategory {
  label: string;
  values: Array<number | undefined>;
}

interface PdfGroupedBarExhibit extends PdfExhibitBase {
  kind: "grouped_bars";
  unitLabel: string;
  series: PdfGroupedBarSeries[];
  categories: PdfGroupedBarCategory[];
}

interface PdfScorecardItem {
  label: string;
  status: "pass" | "fail" | "unavailable" | "watch";
  detail?: string;
}

interface PdfScorecardExhibit extends PdfExhibitBase {
  kind: "scorecard";
  items: PdfScorecardItem[];
}

interface PdfWaterfallPoint {
  label: string;
  value?: number;
  tone: PdfTone;
}

interface PdfWaterfallExhibit extends PdfExhibitBase {
  kind: "waterfall";
  unitLabel: string;
  points: PdfWaterfallPoint[];
}

interface PdfStatusBarItem {
  label: string;
  value: number;
  tone: PdfRiskTone;
}

interface PdfStatusBarExhibit extends PdfExhibitBase {
  kind: "status_bars";
  unitLabel: string;
  items: PdfStatusBarItem[];
}

interface PdfOmissionPanelExhibit extends PdfExhibitBase {
  kind: "omission_panel";
  message: string;
}

type PdfRgb = [number, number, number];

export interface InstitutionalPdfExportResult {
  buffer: Buffer;
  pageCount: number;
  pageTitles: string[];
}

const lineWrapWidth = 90;
const pageWidth = 612;
const pageHeight = 792;
const leftMargin = 72;
const contentWidth = 468;
const titleY = 758;
const bodyStartY = 724;
const footerY = 36;
const minTextY = 70;
const lineHeight = 14;
const exhibitGap = 12;
const thesisInk: PdfRgb = [0.07, 0.07, 0.07];
const thesisMuted: PdfRgb = [0.43, 0.43, 0.43];
const thesisBorder: PdfRgb = [0.15, 0.15, 0.15];
const thesisGold: PdfRgb = [0.77, 0.63, 0.35];
const thesisGoldSoft: PdfRgb = [0.95, 0.92, 0.84];
const thesisPositive: PdfRgb = [0.29, 0.62, 0.38];
const thesisNegative: PdfRgb = [0.82, 0.35, 0.34];
const thesisWarning: PdfRgb = [0.91, 0.67, 0.17];
const thesisNeutral: PdfRgb = [0.48, 0.52, 0.57];
const thesisFill: PdfRgb = [0.98, 0.97, 0.95];

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
  const ticker = sanitizeInline(report.ticker ?? "UNKNOWN");
  const generatedAt = sanitizeInline(report.generated_at);
  const signal = sanitizeInline(report.signal?.value?.toUpperCase() ?? "NO_SIGNAL");
  const confidence = `${sanitizeInline(report.confidence.label.toUpperCase())} (${report.confidence.score.toFixed(2)})`;
  const memoSections = report.investment_memo?.sections ?? [];
  const memoThesis = findMemoSection(memoSections, "investment_thesis");
  const memoChanged = findMemoSection(memoSections, "what_changed");
  const memoQuality = findMemoSection(memoSections, "business_quality");
  const memoValuation = findMemoSection(memoSections, "valuation");
  const memoRisks = findMemoSection(memoSections, "risks");

  const page1 = createPage(
    "Page 1 - Cover and One-Page Memo",
    (lines) => {
      lines.push(`Ticker: ${ticker}`);
      lines.push(`Report date: ${generatedAt}`);
      lines.push(`Signal: ${signal}`);
      lines.push(`Confidence: ${confidence}`);
      pushSectionText(lines, "Thesis summary", report.story_header?.thesis_summary ?? memoThesis?.narrative);
      pushSectionText(lines, "Decision question", report.investment_memo?.decision_question);
      pushBulletList(
        lines,
        "Top reasons this matters now",
        memoThesis?.key_points ?? report.watch_items,
        "No explicit reason list was emitted by the report artifact."
      );
      pushBulletList(
        lines,
        "Top thesis risks",
        memoRisks?.key_points,
        "Risk list is limited in this report and should be reviewed in proof sections."
      );
      pushSectionText(lines, "Coverage truth", report.coverage_truth?.summary);
      pushBulletList(lines, "What would change our mind", report.watch_items, "No explicit watch-list items were emitted.");
    },
    [buildCoverRangeBandExhibit(report)]
  );

  const page2 = createPage(
    "Page 2 - Investment Thesis and What Changed",
    (lines) => {
      pushSectionText(lines, "Central investment argument", memoThesis?.narrative ?? report.story_header?.headline);
      pushSectionText(lines, "Why now", report.story_header?.why_now);
      pushSectionText(lines, "Reader takeaway", report.story_header?.reader_takeaway);
      pushSectionText(lines, "Previous view", report.change_summary?.previous_view);
      pushSectionText(lines, "Current view", report.change_summary?.current_view);
      if ((report.change_summary?.top_changes.length ?? 0) > 0) {
        lines.push("Top changes:");
        for (const change of report.change_summary?.top_changes ?? []) {
          lines.push(
            `- ${sanitizeInline(change.title)} [${sanitizeInline(change.direction)}/${sanitizeInline(change.impact_level)}]: ${sanitizeInline(change.why_it_matters)}`
          );
        }
      } else {
        lines.push("Top changes: omitted (no prior comparable report or change stack).");
      }
      pushSectionText(lines, "What changed narrative", memoChanged?.narrative);
    },
    []
  );

  const page3 = createPage(
    "Page 3 - Business Quality",
    (lines) => {
      pushSectionText(lines, "Business model and quality narrative", memoQuality?.narrative);
      pushBulletList(lines, "Business quality highlights", memoQuality?.key_points, "Business quality highlights were not fully emitted.");
      if (report.value_discipline) {
        lines.push(`Context label: ${sanitizeInline(report.value_discipline.context_label)}`);
        pushSectionText(lines, "Context interpretation", report.value_discipline.interpretation);
      } else {
        lines.push("Business context: omitted (value discipline block unavailable).");
      }
      pushSectionText(lines, "Uncertainty and missing inputs", report.coverage_truth?.missing.join("; "));
    },
    []
  );

  const page4 = createPage(
    "Page 4 - Financial Statement Analysis",
    (lines) => {
      pushFinancialHistory(lines, "Annual history", report.financial_analysis?.annual_history ?? []);
      pushFinancialHistory(lines, "Quarterly history", report.financial_analysis?.quarterly_history ?? []);
      pushMetricSummaries(lines, "Trend metrics", report.financial_analysis?.trend_metrics ?? []);
      pushMetricSummaries(lines, "Quality metrics", report.financial_analysis?.quality_metrics ?? []);
      pushFinancialOmissions(lines, report.financial_analysis?.omissions ?? []);
    },
    [buildFinancialExhibit(report)]
  );

  const page5 = createPage(
    "Page 5 - Value Discipline Scorecard",
    (lines) => {
      if (!report.value_discipline) {
        lines.push("Value discipline scorecard: omitted (no value_discipline block).");
        return;
      }
      lines.push(
        `Score: ${report.value_discipline.score}/${report.value_discipline.max_score} | available signals: ${report.value_discipline.available_signals} | completeness: ${sanitizeInline(report.value_discipline.completeness)}`
      );
      lines.push(`Context: ${sanitizeInline(report.value_discipline.context_label)}`);
      pushSectionText(lines, "Interpretation", report.value_discipline.interpretation);
      pushBulletList(lines, "Missing signals", report.value_discipline.missing_signals, "No missing signals declared.");
      lines.push("Signal families:");
      for (const signalItem of report.value_discipline.signals.slice(0, 18)) {
        lines.push(
          `- ${sanitizeInline(signalItem.family)} | ${sanitizeInline(signalItem.label)} | ${sanitizeInline(signalItem.status)} | ${sanitizeInline(signalItem.reason)}`
        );
      }
      pushSectionText(lines, "What this score does not prove", report.value_discipline.does_not_prove);
      if (report.value_discipline.value_trap_warning.triggered) {
        pushSectionText(lines, "Value-trap warning", report.value_discipline.value_trap_warning.summary);
      }
    },
    [buildValueDisciplineExhibit(report)]
  );

  const page6 = createPage(
    "Page 6 - Valuation and Scenarios",
    (lines) => {
      if (!report.valuation) {
        lines.push("Valuation: omitted (valuation block unavailable).");
        return;
      }
      lines.push(
        `Fair value low/mid/high: ${formatNumber(report.valuation.fair_value_low)} / ${formatNumber(report.valuation.fair_value_mid)} / ${formatNumber(report.valuation.fair_value_high)}`
      );
      lines.push(`Spot price: ${formatNumber(report.valuation.spot_price)} | Implied upside: ${formatPct(report.valuation.implied_upside_pct)}`);
      lines.push(`Methodology: ${sanitizeInline(report.valuation.assumptions.methodology)}`);
      lines.push(`Projection years: ${report.valuation.assumptions.projection_years}`);
      lines.push(`Terminal growth: ${formatPct(report.valuation.assumptions.terminal_growth_rate)}`);
      lines.push(`WACC: ${formatPct(report.valuation.assumptions.wacc)}`);
      if (report.valuation.degraded_reason) {
        pushSectionText(lines, "Valuation degraded reason", report.valuation.degraded_reason);
      }
      pushSectionText(lines, "Valuation narrative", memoValuation?.narrative);
      pushBulletList(lines, "Valuation key points", memoValuation?.key_points, "No valuation key-point list was emitted.");
    },
    [buildValuationBridgeExhibit(report)]
  );

  const page7 = createPage(
    "Page 7 - Risks, Catalysts, and Kill Switches",
    (lines) => {
      pushSectionText(lines, "Risk narrative", memoRisks?.narrative);
      pushBulletList(lines, "Risk highlights", memoRisks?.key_points, "No risk bullet list was emitted.");
      pushBulletList(lines, "Watch items", report.watch_items, "No watch items were emitted.");
      if ((report.kill_switch_conditions?.length ?? 0) > 0) {
        lines.push("Kill-switch conditions:");
        for (const condition of report.kill_switch_conditions ?? []) {
          lines.push(
            `- ${sanitizeInline(condition.condition_id ?? "n/a")} | ${sanitizeInline(condition.signal_type ?? "n/a")} | ${sanitizeInline(condition.direction ?? "n/a")} | ${sanitizeInline(condition.condition_text ?? "n/a")}`
          );
        }
      } else {
        lines.push("Kill-switch conditions: omitted (none attached to this report artifact).");
      }
    },
    [buildKillSwitchCoverageExhibit(report)]
  );

  const page8 = createPage(
    "Page 8 - Evidence Book",
    (lines) => {
      const evidenceRows = extractEvidenceRows(report);
      if (evidenceRows.length === 0) {
        lines.push("Evidence ladder: omitted (no evidence rows found in section payload).");
        return;
      }
      lines.push(`Evidence count: ${evidenceRows.length}`);
      for (const row of evidenceRows.slice(0, 30)) {
        lines.push(`- ${sanitizeInline(row.sectionTitle)} | ${sanitizeInline(row.sourceName)} | ${sanitizeInline(row.excerpt)}`);
      }
    },
    []
  );

  const page9 = createPage(
    "Page 9 - Appendix",
    (lines) => {
      lines.push(`Report ID: ${sanitizeInline(report.report_id)}`);
      lines.push(`Job ID: ${sanitizeInline(report.job_id)}`);
      lines.push(`Schema version: ${sanitizeInline(report.schema_version)}`);
      lines.push(`Generated at: ${generatedAt}`);
      lines.push(`Prompt version: ${sanitizeInline(report.investment_memo?.prompt_version ?? "not_emitted")}`);
      pushBulletList(lines, "Data sources", report.data_sources, "No data sources were emitted.");
      pushBulletList(lines, "Flags", report.flags, "No runtime flags were emitted.");
      pushFinancialOmissions(lines, report.financial_analysis?.omissions ?? []);
      pushBulletList(lines, "Coverage missing", report.coverage_truth?.missing, "No coverage-missing list was emitted.");
    },
    []
  );

  return [page1, page2, page3, page4, page5, page6, page7, page8, page9];
}

function createPage(title: string, fill: (lines: string[]) => void, exhibits: PdfExhibit[]): PdfPageContent {
  const lines: string[] = [];
  fill(lines);
  const wrapped: string[] = [];
  for (const line of lines) {
    for (const wrappedLine of wrapText(line, lineWrapWidth)) {
      wrapped.push(wrappedLine);
    }
  }

  const reservedExhibitHeight =
    exhibits.length === 0 ? 0 : exhibits.reduce((sum, exhibit) => sum + exhibit.height, 0) + exhibitGap * (exhibits.length + 1);
  const maxTextHeight = Math.max(120, bodyStartY - minTextY - reservedExhibitHeight);
  const maxLines = Math.max(8, Math.floor(maxTextHeight / lineHeight));
  const normalized =
    wrapped.length <= maxLines
      ? wrapped
      : [
          ...wrapped.slice(0, maxLines - 1),
          "[Content truncated in PDF page; canonical JSON artifact remains complete.]"
        ];
  return { title, lines: normalized, exhibits };
}

function buildCoverRangeBandExhibit(report: AnalysisReport): PdfExhibit {
  if (!report.valuation || !hasAtLeastOneValue([report.valuation.fair_value_low, report.valuation.fair_value_mid, report.valuation.fair_value_high, report.valuation.spot_price])) {
    return {
      kind: "omission_panel",
      title: "Exhibit - Valuation Range",
      summary: "M5.2 omission-aware fallback",
      message: "No reliable fair-value band is available for this report, so Thesis renders an honest omission panel instead of a fake valuation chart.",
      height: 116
    };
  }

  return {
    kind: "range_band",
    title: "Exhibit - Valuation Range",
    summary: "Reference price versus fair-value corridor",
    low: report.valuation.fair_value_low,
    mid: report.valuation.fair_value_mid,
    high: report.valuation.fair_value_high,
    reference: report.valuation.spot_price,
    valueLabel: "Fair value",
    referenceLabel: "Spot",
    height: 128
  };
}

function buildFinancialExhibit(report: AnalysisReport): PdfExhibit {
  const annualHistory = sortFinancialHistory(report.financial_analysis?.annual_history ?? []).slice(-4);
  const marginRows = annualHistory.filter((row) => row.gross_margin !== undefined || row.operating_margin !== undefined);
  if (marginRows.length >= 2) {
    return {
      kind: "grouped_bars",
      title: "Exhibit - Margin Profile",
      summary: "Gross and operating margin progression by fiscal period",
      unitLabel: "Percent",
      series: [
        { label: "Gross margin", tone: "mid" },
        { label: "Operating margin", tone: "spot" }
      ],
      categories: marginRows.map((row) => ({
        label: sanitizeInline(row.period),
        values: [
          row.gross_margin === undefined ? undefined : row.gross_margin * 100,
          row.operating_margin === undefined ? undefined : row.operating_margin * 100
        ]
      })),
      height: 174
    };
  }

  const revenueRows = annualHistory.filter((row) => row.revenue !== undefined);
  if (revenueRows.length >= 2) {
    return {
      kind: "grouped_bars",
      title: "Exhibit - Revenue Trend",
      summary: "Annual revenue progression from reported history",
      unitLabel: "Currency",
      series: [{ label: "Revenue", tone: "mid" }],
      categories: revenueRows.map((row) => ({
        label: sanitizeInline(row.period),
        values: [row.revenue]
      })),
      height: 174
    };
  }

  return {
    kind: "omission_panel",
    title: "Exhibit - Financial Trend",
    summary: "M5.2 omission-aware fallback",
    message: "There are not enough comparable reported periods to justify a multi-period financial exhibit on this page.",
    height: 124
  };
}

function buildValueDisciplineExhibit(report: AnalysisReport): PdfExhibit {
  if (!report.value_discipline || report.value_discipline.signals.length === 0) {
    return {
      kind: "omission_panel",
      title: "Exhibit - Value Discipline Signal Map",
      summary: "M5.2 omission-aware fallback",
      message: "The report does not contain enough signal-level value-discipline data to render a scorecard exhibit honestly.",
      height: 132
    };
  }

  return {
    kind: "scorecard",
    title: "Exhibit - Value Discipline Signal Map",
    summary: `${report.value_discipline.available_signals}/${report.value_discipline.max_score} available signals in ${sanitizeInline(report.value_discipline.context_label)} context`,
    items: report.value_discipline.signals.slice(0, 8).map((signal) => ({
      label: `${sanitizeInline(signal.label)} (${sanitizeInline(signal.family)})`,
      status: signal.status === "pass" ? "pass" : signal.status === "fail" ? "fail" : "unavailable",
      detail: sanitizeInline(signal.reason)
    })),
    height: 184
  };
}

function buildValuationBridgeExhibit(report: AnalysisReport): PdfExhibit {
  if (!report.valuation || !hasAtLeastOneValue([report.valuation.spot_price, report.valuation.fair_value_low, report.valuation.fair_value_mid, report.valuation.fair_value_high])) {
    return {
      kind: "omission_panel",
      title: "Exhibit - Valuation Bridge",
      summary: "M5.2 omission-aware fallback",
      message: report.valuation?.degraded_reason
        ? sanitizeInline(report.valuation.degraded_reason)
        : "Valuation inputs are not sufficient to render a bridge-style exhibit honestly.",
      height: 128
    };
  }

  return {
    kind: "waterfall",
    title: "Exhibit - Valuation Bridge",
    summary: "Spot versus low, mid, and high valuation anchors",
    unitLabel: "Price",
    points: [
      { label: "Spot", value: report.valuation.spot_price, tone: "spot" },
      { label: "Low", value: report.valuation.fair_value_low, tone: "low" },
      { label: "Mid", value: report.valuation.fair_value_mid, tone: "mid" },
      { label: "High", value: report.valuation.fair_value_high, tone: "high" }
    ],
    height: 166
  };
}

function buildKillSwitchCoverageExhibit(report: AnalysisReport): PdfExhibit {
  const conditions = report.kill_switch_conditions ?? [];
  if (conditions.length === 0) {
    return {
      kind: "omission_panel",
      title: "Exhibit - Kill-Switch Coverage",
      summary: "M5.2 omission-aware fallback",
      message: "No kill-switch rule set is attached to this report artifact, so Thesis does not imply risk coverage that has not been configured.",
      height: 118
    };
  }

  const counts = new Map<string, number>();
  for (const condition of conditions) {
    const key = sanitizeInline(condition.signal_type ?? "unknown");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const items = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value], index) => ({
      label,
      value,
      tone: index === 0 ? "high" : index === 1 ? "medium" : "low"
    })) satisfies PdfStatusBarItem[];

  return {
    kind: "status_bars",
    title: "Exhibit - Kill-Switch Coverage",
    summary: "Active kill-switch conditions by signal family",
    unitLabel: "Rules",
    items,
    height: 148
  };
}

function pushSectionText(lines: string[], label: string, text: string | undefined): void {
  if (!text || text.trim().length === 0) {
    lines.push(`${label}: omitted.`);
    return;
  }
  lines.push(`${label}: ${sanitizeInline(text)}`);
}

function pushBulletList(lines: string[], label: string, items: string[] | undefined, fallback: string): void {
  if (!items || items.length === 0) {
    lines.push(`${label}: ${fallback}`);
    return;
  }
  lines.push(`${label}:`);
  for (const item of items.slice(0, 12)) {
    lines.push(`- ${sanitizeInline(item)}`);
  }
}

function pushFinancialHistory(lines: string[], label: string, rows: FinancialHistoryRow[]): void {
  if (rows.length === 0) {
    lines.push(`${label}: omitted.`);
    return;
  }
  lines.push(`${label}:`);
  for (const row of rows.slice(0, 6)) {
    lines.push(
      `- ${sanitizeInline(row.period)} | Rev ${formatNumber(row.revenue)} | Gross margin ${formatPct(row.gross_margin)} | Op margin ${formatPct(row.operating_margin)} | FCF ${formatNumber(row.free_cash_flow)}`
    );
  }
}

function pushMetricSummaries(lines: string[], label: string, metrics: MetricSummaryRow[]): void {
  if (!metrics || metrics.length === 0) {
    lines.push(`${label}: omitted.`);
    return;
  }
  lines.push(`${label}:`);
  for (const metric of metrics.slice(0, 12)) {
    lines.push(
      `- ${sanitizeInline(metric.label)} | status ${sanitizeInline(metric.status)} | direction ${sanitizeInline(metric.direction)} | value ${metric.value === undefined ? "n/a" : formatNumber(metric.value)}${metric.note ? ` | ${sanitizeInline(metric.note)}` : ""}`
    );
  }
}

function pushFinancialOmissions(lines: string[], omissions: FinancialOmission[]): void {
  if (omissions.length === 0) {
    lines.push("Financial omissions: none declared.");
    return;
  }
  lines.push("Financial omissions:");
  for (const omission of omissions.slice(0, 12)) {
    lines.push(
      `- ${sanitizeInline(omission.label)} | ${sanitizeInline(omission.reason)} | impacts ${sanitizeInline(omission.impacts.join(", "))}`
    );
  }
}

function findMemoSection(
  sections: InvestmentMemoSection[],
  sectionId: InvestmentMemoSection["section_id"]
): InvestmentMemoSection | undefined {
  return sections.find((section) => section.section_id === sectionId);
}

function extractEvidenceRows(report: AnalysisReport): Array<{
  sectionTitle: string;
  sourceName: string;
  excerpt: string;
}> {
  const rows: Array<{ sectionTitle: string; sourceName: string; excerpt: string }> = [];
  for (const section of report.sections) {
    for (const evidence of section.evidence) {
      rows.push({
        sectionTitle: section.title,
        sourceName: evidence.source_name,
        excerpt: evidence.excerpt
      });
    }
  }
  return rows;
}

function renderSimplePdf(pages: PdfPageContent[]): Buffer {
  const objects = new Map<number, string>();
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  const fontObjectId = 3;
  let nextObjectId = 4;
  const pageObjectIds: number[] = [];

  objects.set(catalogObjectId, `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);
  objects.set(fontObjectId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((page, index) => {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    pageObjectIds.push(pageObjectId);

    const contentStream = buildPageStream(page, index + 1, pages.length);
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
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
    const offset = offsets[objectId] ?? 0;
    output += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${maxObjectId + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "utf8");
}

function buildPageStream(page: PdfPageContent, pageNumber: number, totalPages: number): string {
  const commands: string[] = [];
  appendLine(commands, leftMargin, 744, leftMargin + contentWidth, 744, thesisGold, 1.4);
  appendText(commands, leftMargin, titleY, 16, page.title, thesisInk);

  let y = bodyStartY;
  for (const line of page.lines) {
    if (y < minTextY) {
      break;
    }
    appendText(commands, leftMargin, y, 10, line, thesisInk);
    y -= lineHeight;
  }

  if (page.exhibits.length > 0) {
    const totalExhibitHeight =
      page.exhibits.reduce((sum, exhibit) => sum + exhibit.height, 0) + exhibitGap * (page.exhibits.length - 1);
    let currentTop = minTextY + totalExhibitHeight;
    for (const exhibit of page.exhibits) {
      const exhibitY = currentTop - exhibit.height;
      appendExhibit(commands, exhibit, leftMargin, exhibitY, contentWidth, exhibit.height);
      currentTop = exhibitY - exhibitGap;
    }
  }

  appendText(commands, leftMargin, footerY, 10, `Page ${pageNumber} of ${totalPages}`, thesisMuted);
  return commands.join("\n");
}

function appendExhibit(commands: string[], exhibit: PdfExhibit, x: number, y: number, width: number, height: number): void {
  appendRect(commands, x, y, width, height, thesisFill, thesisBorder, 0.8);
  appendRect(commands, x, y + height - 24, width, 24, thesisGoldSoft, undefined, 0);
  appendText(commands, x + 12, y + height - 16, 11, exhibit.title, thesisInk);
  if (exhibit.summary) {
    appendText(commands, x + 12, y + height - 31, 8, exhibit.summary, thesisMuted);
  }

  switch (exhibit.kind) {
    case "range_band":
      drawRangeBandExhibit(commands, exhibit, x, y, width, height);
      return;
    case "grouped_bars":
      drawGroupedBarExhibit(commands, exhibit, x, y, width, height);
      return;
    case "scorecard":
      drawScorecardExhibit(commands, exhibit, x, y, width, height);
      return;
    case "waterfall":
      drawWaterfallExhibit(commands, exhibit, x, y, width, height);
      return;
    case "status_bars":
      drawStatusBarExhibit(commands, exhibit, x, y, width, height);
      return;
    case "omission_panel":
      drawOmissionPanelExhibit(commands, exhibit, x, y, width, height);
      return;
  }
}

function drawRangeBandExhibit(
  commands: string[],
  exhibit: PdfRangeBandExhibit,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const values = [exhibit.low, exhibit.mid, exhibit.high, exhibit.reference].filter(isFiniteNumber);
  if (values.length === 0) {
    drawOmissionPanelExhibit(
      commands,
      {
        kind: "omission_panel",
        title: exhibit.title,
        summary: exhibit.summary,
        message: "No valuation values were available for this exhibit.",
        height
      },
      x,
      y,
      width,
      height
    );
    return;
  }

  const chartX = x + 18;
  const chartY = y + 28;
  const chartWidth = width - 36;
  const baselineY = chartY + 28;
  const labelY = chartY + 8;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue === minValue ? Math.max(Math.abs(maxValue), 1) : maxValue - minValue;
  const safeMap = (value: number | undefined) =>
    value === undefined ? undefined : chartX + ((value - minValue) / span) * chartWidth;

  appendText(commands, chartX, y + height - 44, 8, `${exhibit.valueLabel}: ${formatNumber(exhibit.low)} to ${formatNumber(exhibit.high)}`, thesisMuted);
  appendLine(commands, chartX, baselineY, chartX + chartWidth, baselineY, thesisBorder, 1);

  const lowX = safeMap(exhibit.low);
  const highX = safeMap(exhibit.high);
  if (lowX !== undefined && highX !== undefined) {
    appendRect(commands, lowX, baselineY - 6, Math.max(10, highX - lowX), 12, thesisGoldSoft, thesisGold, 0.8);
  }

  const markPoint = (value: number | undefined, label: string, tone: PdfTone, offsetY: number): void => {
    const pointX = safeMap(value);
    if (pointX === undefined) {
      return;
    }
    appendCircle(commands, pointX, baselineY, 4.2, toneToColor(tone), thesisBorder);
    appendText(commands, pointX - 18, baselineY + offsetY, 8, `${label} ${formatNumber(value)}`, thesisInk);
  };

  markPoint(exhibit.low, "Low", "low", 12);
  markPoint(exhibit.mid, "Mid", "mid", -16);
  markPoint(exhibit.high, "High", "high", 12);
  markPoint(exhibit.reference, exhibit.referenceLabel, "spot", -30);

  appendText(commands, chartX, labelY, 8, `${formatNumber(minValue)}`, thesisMuted);
  appendText(commands, chartX + chartWidth - 22, labelY, 8, `${formatNumber(maxValue)}`, thesisMuted);
}

function drawGroupedBarExhibit(
  commands: string[],
  exhibit: PdfGroupedBarExhibit,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const chartX = x + 28;
  const chartY = y + 32;
  const chartWidth = width - 56;
  const chartHeight = height - 84;
  const values = exhibit.categories.flatMap((category) => category.values.filter(isFiniteNumber));
  if (values.length === 0) {
    drawOmissionPanelExhibit(
      commands,
      {
        kind: "omission_panel",
        title: exhibit.title,
        summary: exhibit.summary,
        message: "This exhibit has no comparable numeric series to render.",
        height
      },
      x,
      y,
      width,
      height
    );
    return;
  }

  const maxValue = Math.max(...values, 0.0001);
  appendLine(commands, chartX, chartY, chartX, chartY + chartHeight, thesisBorder, 0.8);
  appendLine(commands, chartX, chartY, chartX + chartWidth, chartY, thesisBorder, 0.8);
  appendText(commands, chartX, y + height - 44, 8, `Unit: ${exhibit.unitLabel}`, thesisMuted);
  if (exhibit.series.length >= 2) {
    appendText(
      commands,
      chartX,
      y + height - 56,
      8,
      `${exhibit.series[0]?.label ?? "Series A"} = gold | ${exhibit.series[1]?.label ?? "Series B"} = ink`,
      thesisMuted
    );
  }

  const groupWidth = chartWidth / Math.max(exhibit.categories.length, 1);
  const barClusterWidth = groupWidth * 0.72;
  const barWidth = Math.max(8, barClusterWidth / Math.max(exhibit.series.length, 1) - 4);

  exhibit.categories.forEach((category, categoryIndex) => {
    const clusterStartX = chartX + categoryIndex * groupWidth + (groupWidth - barClusterWidth) / 2;
    category.values.forEach((value, valueIndex) => {
      if (value === undefined) {
        return;
      }
      const barHeight = (value / maxValue) * (chartHeight - 20);
      const barX = clusterStartX + valueIndex * (barWidth + 4);
      appendRect(commands, barX, chartY, barWidth, barHeight, toneToColor(exhibit.series[valueIndex]?.tone ?? "neutral"), thesisBorder, 0.4);
    });
    appendText(commands, clusterStartX, chartY - 12, 7, category.label, thesisInk);
  });

  appendText(commands, chartX - 8, chartY + chartHeight - 4, 8, formatCompact(valuesMaxRounded(maxValue)), thesisMuted);
}

function drawScorecardExhibit(
  commands: string[],
  exhibit: PdfScorecardExhibit,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const startY = y + height - 50;
  const rowHeight = 18;
  const labelX = x + 20;
  const statusX = x + width - 88;
  exhibit.items.slice(0, 7).forEach((item, index) => {
    const rowY = startY - index * rowHeight;
    appendLine(commands, x + 14, rowY - 5, x + width - 14, rowY - 5, thesisGoldSoft, 0.4);
    appendRect(commands, labelX, rowY - 8, 8, 8, statusToColor(item.status), thesisBorder, 0.3);
    appendText(commands, labelX + 14, rowY - 2, 8.5, item.label, thesisInk);
    appendText(commands, statusX, rowY - 2, 8, item.status.toUpperCase(), thesisMuted);
  });
}

function drawWaterfallExhibit(
  commands: string[],
  exhibit: PdfWaterfallExhibit,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const chartX = x + 24;
  const chartY = y + 28;
  const chartWidth = width - 48;
  const chartHeight = height - 72;
  const numericPoints = exhibit.points.filter((point) => point.value !== undefined);
  if (numericPoints.length === 0) {
    drawOmissionPanelExhibit(
      commands,
      {
        kind: "omission_panel",
        title: exhibit.title,
        summary: exhibit.summary,
        message: "No valuation anchors were available for this exhibit.",
        height
      },
      x,
      y,
      width,
      height
    );
    return;
  }

  const values = numericPoints.map((point) => point.value as number);
  const maxValue = Math.max(...values, 0.0001);
  const barWidth = Math.min(54, chartWidth / Math.max(exhibit.points.length, 1) - 14);
  appendLine(commands, chartX, chartY, chartX + chartWidth, chartY, thesisBorder, 0.8);
  appendText(commands, chartX, y + height - 44, 8, `Unit: ${exhibit.unitLabel}`, thesisMuted);

  exhibit.points.forEach((point, index) => {
    const barX = chartX + index * ((chartWidth - barWidth) / Math.max(exhibit.points.length - 1, 1));
    if (point.value !== undefined) {
      const barHeight = (point.value / maxValue) * (chartHeight - 18);
      appendRect(commands, barX, chartY, barWidth, barHeight, toneToColor(point.tone), thesisBorder, 0.4);
      appendText(commands, barX, chartY + barHeight + 8, 8, formatCompact(point.value), thesisInk);
    }
    appendText(commands, barX, chartY - 12, 8, point.label, thesisInk);
  });
}

function drawStatusBarExhibit(
  commands: string[],
  exhibit: PdfStatusBarExhibit,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const chartX = x + 22;
  const chartY = y + 30;
  const chartWidth = width - 44;
  const values = exhibit.items.map((item) => item.value);
  const maxValue = Math.max(...values, 1);
  appendText(commands, chartX, y + height - 44, 8, `Unit: ${exhibit.unitLabel}`, thesisMuted);
  exhibit.items.forEach((item, index) => {
    const rowY = chartY + (exhibit.items.length - index - 1) * 18;
    const barWidth = (item.value / maxValue) * (chartWidth - 120);
    appendText(commands, chartX, rowY + 4, 8, item.label, thesisInk);
    appendRect(commands, chartX + 92, rowY, barWidth, 10, riskToneColor(item.tone), thesisBorder, 0.3);
    appendText(commands, chartX + 98 + barWidth, rowY + 4, 8, `${item.value}`, thesisMuted);
  });
}

function drawOmissionPanelExhibit(
  commands: string[],
  exhibit: PdfOmissionPanelExhibit,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  appendRect(commands, x + 18, y + 22, width - 36, height - 56, thesisGoldSoft, thesisGold, 0.6);
  const lines = wrapText(exhibit.message, 70).slice(0, 5);
  appendText(commands, x + 30, y + height - 58, 9, "Omission-aware fallback", thesisInk);
  lines.forEach((line, index) => {
    appendText(commands, x + 30, y + height - 74 - index * 12, 8.5, line, thesisMuted);
  });
}

function appendText(commands: string[], x: number, y: number, fontSize: number, text: string, color: PdfRgb): void {
  commands.push("BT");
  commands.push(`${colorToFill(color)} rg`);
  commands.push(`/F1 ${fontSize} Tf`);
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
  lineWidth = 1
): void {
  commands.push("q");
  if (fillColor) {
    commands.push(`${colorToFill(fillColor)} rg`);
  }
  if (strokeColor) {
    commands.push(`${colorToStroke(strokeColor)} RG`);
    commands.push(`${lineWidth} w`);
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
  lineWidth = 1
): void {
  commands.push("q");
  commands.push(`${colorToStroke(color)} RG`);
  commands.push(`${lineWidth} w`);
  commands.push(`${roundPdfNumber(x1)} ${roundPdfNumber(y1)} m`);
  commands.push(`${roundPdfNumber(x2)} ${roundPdfNumber(y2)} l`);
  commands.push("S");
  commands.push("Q");
}

function appendCircle(commands: string[], centerX: number, centerY: number, radius: number, fill: PdfRgb, stroke: PdfRgb): void {
  const k = 0.552284749831;
  const control = radius * k;
  commands.push("q");
  commands.push(`${colorToFill(fill)} rg`);
  commands.push(`${colorToStroke(stroke)} RG`);
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

function sortFinancialHistory(rows: FinancialHistoryRow[]): FinancialHistoryRow[] {
  return [...rows].sort((left, right) => {
    const quarterLeft = left.fiscal_quarter ?? 0;
    const quarterRight = right.fiscal_quarter ?? 0;
    if (left.fiscal_year !== right.fiscal_year) {
      return left.fiscal_year - right.fiscal_year;
    }
    return quarterLeft - quarterRight;
  });
}

function toneToColor(tone: PdfTone): PdfRgb {
  switch (tone) {
    case "spot":
      return thesisInk;
    case "low":
      return thesisGoldSoft;
    case "mid":
      return thesisGold;
    case "high":
      return thesisPositive;
    case "positive":
      return thesisPositive;
    case "negative":
      return thesisNegative;
    case "warning":
      return thesisWarning;
    case "neutral":
    default:
      return thesisNeutral;
  }
}

function riskToneColor(tone: PdfRiskTone): PdfRgb {
  switch (tone) {
    case "high":
      return thesisNegative;
    case "medium":
      return thesisWarning;
    case "low":
      return thesisGold;
    case "neutral":
    default:
      return thesisNeutral;
  }
}

function statusToColor(status: PdfScorecardItem["status"]): PdfRgb {
  switch (status) {
    case "pass":
      return thesisPositive;
    case "fail":
      return thesisNegative;
    case "watch":
      return thesisWarning;
    case "unavailable":
    default:
      return thesisNeutral;
  }
}

function hasAtLeastOneValue(values: Array<number | undefined>): boolean {
  return values.some(isFiniteNumber);
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function valuesMaxRounded(value: number): number {
  if (value >= 1000000000) {
    return Math.ceil(value / 1000000000) * 1000000000;
  }
  if (value >= 1000000) {
    return Math.ceil(value / 1000000) * 1000000;
  }
  if (value >= 1000) {
    return Math.ceil(value / 1000) * 1000;
  }
  return Math.ceil(value);
}

function wrapText(text: string, width: number): string[] {
  const normalized = sanitizeInline(text).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [""];
  }
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
    }
    current = word;
  }

  if (current.length > 0) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [normalized];
}

function sanitizeInline(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return sanitizeInline(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function roundPdfNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function colorToFill(color: PdfRgb): string {
  return color.map((entry) => entry.toFixed(3)).join(" ");
}

function colorToStroke(color: PdfRgb): string {
  return color.map((entry) => entry.toFixed(3)).join(" ");
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function formatCompact(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(2)}%`;
}
