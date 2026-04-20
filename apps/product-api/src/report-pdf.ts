import type { AnalysisReport, FinancialHistoryRow, FinancialOmission, InvestmentMemoSection } from "../../../packages/contracts/src";

interface PdfPageContent {
  title: string;
  lines: string[];
}

interface MetricSummaryRow {
  label: string;
  status: string;
  direction: string;
  value?: number;
  note?: string;
}

export interface InstitutionalPdfExportResult {
  buffer: Buffer;
  pageCount: number;
  pageTitles: string[];
}

const maxLinesPerPage = 46;
const lineWrapWidth = 92;

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

  const page1 = createPage("Page 1 - Cover and One-Page Memo", (lines) => {
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
  });

  const page2 = createPage("Page 2 - Investment Thesis and What Changed", (lines) => {
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
  });

  const page3 = createPage("Page 3 - Business Quality", (lines) => {
    pushSectionText(lines, "Business model and quality narrative", memoQuality?.narrative);
    pushBulletList(lines, "Business quality highlights", memoQuality?.key_points, "Business quality highlights were not fully emitted.");
    if (report.value_discipline) {
      lines.push(`Context label: ${sanitizeInline(report.value_discipline.context_label)}`);
      pushSectionText(lines, "Context interpretation", report.value_discipline.interpretation);
    } else {
      lines.push("Business context: omitted (value discipline block unavailable).");
    }
    pushSectionText(lines, "Uncertainty and missing inputs", report.coverage_truth?.missing.join("; "));
  });

  const page4 = createPage("Page 4 - Financial Statement Analysis", (lines) => {
    pushFinancialHistory(lines, "Annual history", report.financial_analysis?.annual_history ?? []);
    pushFinancialHistory(lines, "Quarterly history", report.financial_analysis?.quarterly_history ?? []);
    pushMetricSummaries(lines, "Trend metrics", report.financial_analysis?.trend_metrics ?? []);
    pushMetricSummaries(lines, "Quality metrics", report.financial_analysis?.quality_metrics ?? []);
    pushFinancialOmissions(lines, report.financial_analysis?.omissions ?? []);
  });

  const page5 = createPage("Page 5 - Value Discipline Scorecard", (lines) => {
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
  });

  const page6 = createPage("Page 6 - Valuation and Scenarios", (lines) => {
    if (!report.valuation) {
      lines.push("Valuation: omitted (valuation block unavailable).");
      return;
    }
    lines.push(`Fair value low/mid/high: ${formatNumber(report.valuation.fair_value_low)} / ${formatNumber(report.valuation.fair_value_mid)} / ${formatNumber(report.valuation.fair_value_high)}`);
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
  });

  const page7 = createPage("Page 7 - Risks, Catalysts, and Kill Switches", (lines) => {
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
  });

  const page8 = createPage("Page 8 - Evidence Book", (lines) => {
    const evidenceRows = extractEvidenceRows(report);
    if (evidenceRows.length === 0) {
      lines.push("Evidence ladder: omitted (no evidence rows found in section payload).");
      return;
    }
    lines.push(`Evidence count: ${evidenceRows.length}`);
    for (const row of evidenceRows.slice(0, 30)) {
      lines.push(`- ${sanitizeInline(row.sectionTitle)} | ${sanitizeInline(row.sourceName)} | ${sanitizeInline(row.excerpt)}`);
    }
  });

  const page9 = createPage("Page 9 - Appendix", (lines) => {
    lines.push(`Report ID: ${sanitizeInline(report.report_id)}`);
    lines.push(`Job ID: ${sanitizeInline(report.job_id)}`);
    lines.push(`Schema version: ${sanitizeInline(report.schema_version)}`);
    lines.push(`Generated at: ${generatedAt}`);
    lines.push(`Prompt version: ${sanitizeInline(report.investment_memo?.prompt_version ?? "not_emitted")}`);
    pushBulletList(lines, "Data sources", report.data_sources, "No data sources were emitted.");
    pushBulletList(lines, "Flags", report.flags, "No runtime flags were emitted.");
    pushFinancialOmissions(lines, report.financial_analysis?.omissions ?? []);
    pushBulletList(lines, "Coverage missing", report.coverage_truth?.missing, "No coverage-missing list was emitted.");
  });

  return [page1, page2, page3, page4, page5, page6, page7, page8, page9];
}

function createPage(title: string, fill: (lines: string[]) => void): PdfPageContent {
  const lines: string[] = [];
  fill(lines);
  const wrapped: string[] = [];
  for (const line of lines) {
    for (const wrappedLine of wrapText(line, lineWrapWidth)) {
      wrapped.push(wrappedLine);
    }
  }
  const normalized =
    wrapped.length <= maxLinesPerPage
      ? wrapped
      : [
          ...wrapped.slice(0, maxLinesPerPage - 1),
          "[Content truncated in PDF page; canonical JSON artifact remains complete.]"
        ];
  return { title, lines: normalized };
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
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
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
  let y = 758;

  commands.push("BT");
  commands.push("/F1 16 Tf");
  commands.push(`72 ${y} Td`);
  commands.push(`(${escapePdfText(page.title)}) Tj`);
  commands.push("ET");
  y -= 22;

  for (const line of page.lines) {
    if (y < 62) {
      break;
    }
    commands.push("BT");
    commands.push("/F1 10 Tf");
    commands.push(`72 ${y} Td`);
    commands.push(`(${escapePdfText(line)}) Tj`);
    commands.push("ET");
    y -= 14;
  }

  commands.push("BT");
  commands.push("/F1 10 Tf");
  commands.push(`72 36 Td`);
  commands.push(`(${escapePdfText(`Page ${pageNumber} of ${totalPages}`)}) Tj`);
  commands.push("ET");
  return commands.join("\n");
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

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function formatPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(2)}%`;
}
