import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AnalysisReport, FinancialHistoryRow } from "../../../packages/contracts/src";

import { reportLabelMap, reportSentenceMap } from "./report-label-map";

interface InstitutionalPdfExportResult {
  buffer: Buffer;
  pageCount: number;
  pageTitles: string[];
}

interface EditorialPage {
  title: string;
  html: string;
}

type DueDiligenceSectionId =
  | "financial_analysis"
  | "competitive_positioning"
  | "management_and_governance"
  | "risks_and_challenges"
  | "growth_opportunities_and_outlook"
  | "valuation_and_thesis_stance";

type DueDiligenceSection = NonNullable<AnalysisReport["due_diligence"]>["sections"][number];

const chromiumCandidates = [
  process.env.THESIS_PDF_CHROME_PATH,
  process.env.CHROME_BIN,
  process.env.CHROMIUM_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

export function supportsEditorialPdfExport(): boolean {
  return chromiumCandidates.some((candidate) => existsSync(candidate));
}

export function buildEditorialPdfExport(report: AnalysisReport): InstitutionalPdfExportResult {
  const browserPath = resolveChromiumExecutablePath();
  if (!browserPath) {
    throw new Error("Editorial PDF export requires a Chromium-compatible browser executable.");
  }

  const pages = buildEditorialReportPages(report);
  const html = buildEditorialReportHtml(report, pages);
  const tempDir = mkdtempSync(join(tmpdir(), "thesis-editorial-pdf-"));
  const htmlPath = join(tempDir, "report.html");
  const pdfPath = join(tempDir, "report.pdf");

  try {
    writeFileSync(htmlPath, html, "utf8");
    execFileSync(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdfPath}`,
        "--virtual-time-budget=12000",
        htmlPath
      ],
      {
        windowsHide: true,
        stdio: "ignore"
      }
    );

    const buffer = readFileSync(pdfPath);
    const renderedPageCount = countRenderedPdfPages(buffer);
    if (renderedPageCount <= 0) {
      throw new Error("Editorial PDF export did not produce a readable page count.");
    }
    if (renderedPageCount !== pages.length) {
      throw new Error(
        `Editorial PDF export rendered ${renderedPageCount} pages, expected ${pages.length}.`,
      );
    }

    return {
      buffer,
      pageCount: renderedPageCount,
      pageTitles: pages.map((page) => page.title)
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function buildEditorialReportHtml(
  report: AnalysisReport,
  pages = buildEditorialReportPages(report)
): string {
  const totalPages = pages.length;
  const pageMarkup = pages.map((page, index) => renderPageShell({
    report,
    pageTitle: page.title,
    pageNumber: index + 1,
    totalPages,
    bodyHtml: page.html
  })).join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>${escapeHtml(report.issuer?.name ?? report.ticker ?? "Thesis")} Due Diligence Report</title>`,
    "<style>",
    editorialCss,
    "</style>",
    "</head>",
    "<body>",
    pageMarkup,
    "</body>",
    "</html>"
  ].join("\n");
}

export function buildEditorialReportPages(report: AnalysisReport): EditorialPage[] {
  const sparse = isSparseReport(report);
  if (sparse) {
    return buildSparseEditorialPages(report);
  }

  return [
    {
      title: "Executive Summary",
      html: renderExecutiveSummaryPage(report)
    },
    {
      title: "Financial Analysis",
      html: renderNarrativeSectionPage(report, "financial_analysis", {
        kicker: "Financial Analysis",
        includeHighlights: true,
        includeEvidenceStrip: true
      })
    },
    {
      title: "Financial Exhibits",
      html: renderFinancialExhibitsPage(report)
    },
    {
      title: "Competitive Positioning",
      html: renderNarrativeSectionPage(report, "competitive_positioning", {
        kicker: "Competitive Positioning",
        includeHighlights: true,
        includeEvidenceStrip: true
      })
    },
    {
      title: "Management and Governance",
      html: renderNarrativeSectionPage(report, "management_and_governance", {
        kicker: "Management and Governance",
        includeHighlights: true,
        includeCoverageNote: true
      })
    },
    {
      title: "Risks and Challenges",
      html: renderRisksPage(report)
    },
    {
      title: "Growth Outlook",
      html: renderNarrativeSectionPage(report, "growth_opportunities_and_outlook", {
        kicker: "Growth Opportunities and Outlook",
        includeHighlights: true,
        includeEvidenceStrip: true
      })
    },
    {
      title: "Valuation and Stance",
      html: renderValuationPage(report)
    },
    {
      title: "Evidence and Omissions",
      html: renderEvidencePage(report)
    },
    {
      title: "Appendix",
      html: renderAppendixPage(report)
    }
  ];
}

function buildSparseEditorialPages(report: AnalysisReport): EditorialPage[] {
  return [
    {
      title: "Executive Summary",
      html: renderExecutiveSummaryPage(report)
    },
    {
      title: "Due Diligence Overview",
      html: renderSparseOverviewPage(report)
    },
    {
      title: "Financial Snapshot",
      html: renderFinancialExhibitsPage(report)
    },
    {
      title: "Risks and Valuation Limits",
      html: renderSparseRiskValuationPage(report)
    },
    {
      title: "Evidence and Omissions",
      html: renderEvidencePage(report)
    },
    {
      title: "Appendix",
      html: renderAppendixPage(report)
    }
  ];
}

function renderPageShell(args: {
  report: AnalysisReport;
  pageTitle: string;
  pageNumber: number;
  totalPages: number;
  bodyHtml: string;
}): string {
  const ticker = escapeHtml((args.report.ticker ?? "REPORT").toUpperCase());
  const issuer = escapeHtml(args.report.issuer?.name ?? args.report.ticker ?? "Thesis");
  const exchange = escapeHtml(args.report.issuer?.exchange ?? "");
  const reportDate = escapeHtml(formatReportDate(args.report.generated_at));
  return `
    <section class="page">
      <header class="page-header">
        <div class="page-header__brand">
          <div class="page-header__wordmark">Thesis</div>
          <div class="page-header__meta">${issuer}${exchange ? ` | ${exchange}` : ""}</div>
        </div>
        <div class="page-header__right">
          <div class="page-header__ticker">${ticker}</div>
          <div class="page-header__date">${reportDate}</div>
        </div>
      </header>
      <main class="page-body">
        ${args.bodyHtml}
      </main>
      <footer class="page-footer">
        <div>Thesis Due Diligence Report</div>
        <div>${escapeHtml(args.pageTitle)}</div>
        <div>Page ${args.pageNumber} of ${args.totalPages}</div>
      </footer>
    </section>
  `;
}

function renderExecutiveSummaryPage(report: AnalysisReport): string {
  const signal = report.signal?.value ?? "watch";
  const confidenceLabel = report.confidence.label.replace(/_/g, " ");
  const valuationLabel = report.valuation?.degraded_reason
    ? "Valuation constrained"
    : report.valuation?.fair_value_mid !== undefined
      ? "Valuation range available"
      : "Valuation omitted";
  const coverageLabel = report.coverage_truth?.missing.length
    ? `${report.coverage_truth.missing.length} limitations`
    : "Coverage complete";
  const memoSections = report.investment_memo?.sections ?? [];
  const whatChanged = memoSections.find((section) => section.section_id === "what_changed");
  const risks = memoSections.find((section) => section.section_id === "risks");
  const thesis = memoSections.find((section) => section.section_id === "investment_thesis");
  const heroSubtitle = summarizeText(
    report.story_header?.headline
      ?? report.story_header?.thesis_summary
      ?? thesis?.narrative
      ?? "A structured due diligence report grounded in approved evidence.",
    120
  );
  const investmentView = summarizeText(
    report.story_header?.thesis_summary
      ?? thesis?.narrative
      ?? "The current report is structured to explain whether the operating case still deserves conviction and where that conviction remains conditional.",
    210
  );
  const decisionQuestion = summarizeText(
    report.investment_memo?.decision_question
      ?? "What would need to remain true for this thesis to stay investable?",
    115
  );
  const matterNow = summarizeText(
    report.story_header?.why_now
      ?? thesis?.key_points?.[0]
      ?? "The latest filing cycle matters because it either confirms or weakens the current operating case.",
    165
  );
  const whatChangedBody = summarizeText(
    report.change_summary?.current_view
      ?? whatChanged?.narrative
      ?? "The current view differs from the prior baseline only where the evidence says it should.",
    150
  );
  const breakThesis = summarizeText(
    risks?.narrative
      ?? report.watch_items?.[0]
      ?? "The report stays explicit about the conditions that would force a review of the stance.",
    185
  );
  const valuationSvg = buildValuationStripSvg(report);
  const valuationNote = summarizeText(
    report.valuation?.degraded_reason
      ?? "Low, base, and high values show how much execution the current price is already asking the business to deliver.",
    110
  );

  return `
    <div class="eyebrow">Thesis Investment Memo</div>
    <div class="hero">
      <div class="hero__copy">
        <h1>${escapeHtml(report.issuer?.name ?? report.ticker ?? "Thesis Deep Dive")}</h1>
        <p class="hero__subtitle">${escapeHtml(heroSubtitle)}</p>
      </div>
      <div class="hero__signal">
        <div class="price-chip">${escapeHtml(formatSignalLabel(signal))}</div>
        <div class="hero__spot">${escapeHtml(formatMoneyCompact(report.valuation?.spot_price))}</div>
        <div class="hero__upside">${escapeHtml(impliedUpsideLabel(report))}</div>
      </div>
    </div>

    <div class="chip-row">
      ${renderChip("Signal", formatSignalLabel(signal), chipToneForSignal(signal))}
      ${renderChip("Confidence", confidenceLabel, "neutral")}
      ${renderChip("Valuation", valuationLabel, report.valuation?.degraded_reason ? "warning" : "gold")}
      ${renderChip("Coverage", coverageLabel, report.coverage_truth?.missing.length ? "warning" : "positive")}
    </div>

    <div class="thesis-box">
      <h2>Investment view</h2>
      <p>${escapeHtml(investmentView)}</p>
    </div>

    <div class="decision-box">
      <div class="decision-box__label">Decision question</div>
      <div class="decision-box__question">${escapeHtml(decisionQuestion)}</div>
    </div>

    <div class="three-up">
      ${renderCard("What matters now", matterNow)}
      ${renderCard("What changed", whatChangedBody)}
      ${renderCard("What could break the thesis", breakThesis)}
    </div>

    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Valuation range</div>
          <h2>Decision range, not a point target</h2>
        </div>
        <div class="section-panel__note">${escapeHtml(valuationNote)}</div>
      </div>
      ${valuationSvg}
    </div>
  `;
}

function renderNarrativeSectionPage(
  report: AnalysisReport,
  sectionId: DueDiligenceSectionId,
  options: {
    kicker: string;
    includeHighlights?: boolean;
    includeEvidenceStrip?: boolean;
    includeCoverageNote?: boolean;
  }
): string {
  const section = getDueDiligenceSection(report, sectionId);
  const paragraphs = section.narrative_paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n");
  const highlights = options.includeHighlights
    ? `
      <div class="mini-grid">
        ${section.key_points.slice(0, 4).map((point) => renderMiniCard(point)).join("\n")}
      </div>
    `
    : "";
  const evidenceStrip = options.includeEvidenceStrip
    ? `
      <div class="meta-strip">
        <span>Coverage: ${escapeHtml(section.coverage_state)}</span>
        <span>Evidence refs: ${escapeHtml(String(section.evidence_refs.length))}</span>
        <span>Omissions: ${escapeHtml(String(section.omissions.length))}</span>
      </div>
    `
    : "";
  const coverageNote = options.includeCoverageNote
    ? `<div class="coverage-note">${escapeHtml(humanizeCoverageNote(section.omissions[0]) ?? "Coverage remains grounded in approved filings, transcripts, and omission-aware deterministic analysis.")}</div>`
    : "";

  return `
    <div class="eyebrow">${escapeHtml(options.kicker)}</div>
    <div class="narrative-header">
      <h1>${escapeHtml(section.title)}</h1>
      <div class="summary-pill ${coverageToneClass(section.coverage_state)}">${escapeHtml(section.summary)}</div>
    </div>
    ${evidenceStrip}
    <div class="narrative-columns">
      <div class="narrative-columns__main">
        ${paragraphs}
      </div>
      <aside class="narrative-columns__side">
        <div class="side-card">
          <div class="side-card__label">Why this section matters</div>
          <p>${escapeHtml(section.summary)}</p>
        </div>
        <div class="side-card">
          <div class="side-card__label">Coverage state</div>
          <p>${escapeHtml(section.coverage_state)}</p>
        </div>
        ${section.omissions.length > 0 ? `
          <div class="side-card">
            <div class="side-card__label">Current limitation</div>
            <p>${escapeHtml(humanizeCoverageNote(section.omissions[0]))}</p>
          </div>
        ` : ""}
      </aside>
    </div>
    ${highlights}
    ${coverageNote}
  `;
}

function renderFinancialExhibitsPage(report: AnalysisReport): string {
  const annualRows = (report.financial_analysis?.annual_history ?? []).slice(0, 4);
  const financialTable = renderFinancialTable(annualRows);
  return `
    <div class="eyebrow">Financial Exhibits</div>
    <div class="narrative-header">
      <h1>Financial statement follow-through</h1>
      <div class="summary-pill neutral">The table and exhibits below are meant to support the narrative, not replace it.</div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Statement table</div>
          <h2>Four-period financial progression</h2>
        </div>
        <div class="section-panel__note">${escapeHtml(financialTableNote(report))}</div>
      </div>
      ${financialTable}
    </div>
    <div class="two-up">
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Trend chart</div>
            <h2>Revenue and free cash flow</h2>
          </div>
        </div>
        ${buildTrendSvg(report)}
      </div>
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Margin profile</div>
            <h2>Gross and operating margin</h2>
          </div>
        </div>
        ${buildMarginSvg(report)}
      </div>
    </div>
  `;
}

function renderRisksPage(report: AnalysisReport): string {
  const section = getDueDiligenceSection(report, "risks_and_challenges");
  const killSwitchCards = (report.kill_switch_conditions ?? []).slice(0, 3).map((condition) => `
    <div class="risk-card">
      <div class="risk-card__label">${escapeHtml(reportLabelMap(condition.signal_type))}</div>
      <h3>${escapeHtml(condition.condition_text)}</h3>
      <p>${escapeHtml(condition.rationale)}</p>
    </div>
  `).join("\n");

  return `
    <div class="eyebrow">Risks And Challenges</div>
    <div class="narrative-header">
      <h1>${escapeHtml(section.title)}</h1>
      <div class="summary-pill warning">${escapeHtml(section.summary)}</div>
    </div>
    <div class="narrative-columns">
      <div class="narrative-columns__main">
        ${section.narrative_paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
      </div>
      <aside class="narrative-columns__side">
        <div class="side-card">
          <div class="side-card__label">What would change our mind</div>
          <p>${escapeHtml((report.watch_items ?? []).slice(0, 2).join(" ") || section.key_points[0] || "The report stays explicit about the conditions that would force a new stance.")}</p>
        </div>
      </aside>
    </div>
    <div class="three-up">
      ${killSwitchCards || renderCard("Risk control", "Explicit kill-switch coverage was limited in this run, so the report stays omission-forward rather than pretending it has a complete falsification map.")}
    </div>
  `;
}

function renderValuationPage(report: AnalysisReport): string {
  const section = getDueDiligenceSection(report, "valuation_and_thesis_stance");
  const scenarioRows = buildScenarioRows(report);
  return `
    <div class="eyebrow">Valuation And Thesis Stance</div>
    <div class="narrative-header">
      <h1>${escapeHtml(section.title)}</h1>
      <div class="summary-pill ${report.valuation?.degraded_reason ? "warning" : "gold"}">${escapeHtml(section.summary)}</div>
    </div>
    <div class="narrative-columns">
      <div class="narrative-columns__main">
        ${section.narrative_paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
      </div>
      <aside class="narrative-columns__side">
        <div class="side-card">
          <div class="side-card__label">Assumption frame</div>
          <p>${escapeHtml(reportLabelMap(report.valuation?.assumptions.methodology))}</p>
        </div>
      </aside>
    </div>
    <div class="two-up">
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Scenario table</div>
            <h2>Bear, base, and bull</h2>
          </div>
        </div>
        ${renderScenarioTable(scenarioRows)}
      </div>
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Range view</div>
            <h2>Where spot sits today</h2>
          </div>
        </div>
        ${buildValuationStripSvg(report)}
      </div>
    </div>
  `;
}

function renderEvidencePage(report: AnalysisReport): string {
  const sourceNotes = collectSourceNotes(report).slice(0, 8);
  const omissions = uniqueList([
    ...(report.coverage_truth?.missing ?? []),
    ...((report.due_diligence?.sections ?? []).flatMap((section) => section.omissions))
  ]).slice(0, 10);
  return `
    <div class="eyebrow">Evidence And Coverage</div>
    <div class="narrative-header">
      <h1>Evidence, omissions, and source discipline</h1>
      <div class="summary-pill neutral">${escapeHtml(report.coverage_truth?.summary ?? "This page exists to increase trust, not to hide limitations.")}</div>
    </div>
    <div class="two-up">
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Evidence used</div>
            <h2>Primary support trail</h2>
          </div>
        </div>
        <ul class="evidence-list">
          ${sourceNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("\n")}
        </ul>
      </div>
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Coverage limitations</div>
            <h2>What stayed constrained</h2>
          </div>
        </div>
        <ul class="evidence-list">
          ${(omissions.length > 0 ? omissions : ["No major coverage limitations were recorded."]).map((note) =>
            `<li>${escapeHtml(note.includes("_") ? reportSentenceMap(note) : note)}</li>`
          ).join("\n")}
        </ul>
      </div>
    </div>
  `;
}

function renderAppendixPage(report: AnalysisReport): string {
  const sectionDigests = (report.due_diligence?.sections ?? []).map((section) => `
    <div class="appendix-item">
      <div class="appendix-item__title">${escapeHtml(section.title)}</div>
      <div class="appendix-item__meta">Coverage ${escapeHtml(section.coverage_state)} | Evidence refs ${escapeHtml(String(section.evidence_refs.length))}</div>
      <p>${escapeHtml(section.summary)}</p>
    </div>
  `).join("\n");

  return `
    <div class="eyebrow">Appendix And Source Notes</div>
    <div class="narrative-header">
      <h1>Appendix</h1>
      <div class="summary-pill neutral">This closing page preserves the structured trail behind the long-form memo.</div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Section ledger</div>
          <h2>Canonical due-diligence map</h2>
        </div>
      </div>
      <div class="appendix-grid">
        ${sectionDigests}
      </div>
    </div>
    <div class="appendix-note">Generated ${escapeHtml(formatReportDate(report.generated_at))}. Thesis uses stance language only and remains omission-aware where the source plane is incomplete.</div>
  `;
}

function renderSparseOverviewPage(report: AnalysisReport): string {
  const sections = report.due_diligence?.sections ?? [];
  return `
    <div class="eyebrow">Due Diligence Overview</div>
    <div class="narrative-header">
      <h1>Coverage stays intentionally narrow</h1>
      <div class="summary-pill warning">${escapeHtml(report.coverage_truth?.summary ?? "Sparse evidence means the report is still useful, but not fully complete.")}</div>
    </div>
    <div class="appendix-grid">
      ${sections.map((section) => `
        <div class="appendix-item">
          <div class="appendix-item__title">${escapeHtml(section.title)}</div>
          <div class="appendix-item__meta">Coverage ${escapeHtml(section.coverage_state)}</div>
          <p>${escapeHtml(section.summary)}</p>
        </div>
      `).join("\n")}
    </div>
  `;
}

function renderSparseRiskValuationPage(report: AnalysisReport): string {
  const risks = getDueDiligenceSection(report, "risks_and_challenges");
  const valuation = getDueDiligenceSection(report, "valuation_and_thesis_stance");
  return `
    <div class="eyebrow">Risks And Valuation Limits</div>
    <div class="two-up">
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Risk posture</div>
            <h2>${escapeHtml(risks.title)}</h2>
          </div>
        </div>
        ${risks.narrative_paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
      </div>
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Valuation status</div>
            <h2>${escapeHtml(valuation.title)}</h2>
          </div>
        </div>
        ${valuation.narrative_paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
        <div class="coverage-note">${escapeHtml(report.valuation?.degraded_reason ?? "Valuation range is not available for this report.")}</div>
      </div>
    </div>
  `;
}

function renderFinancialTable(rows: FinancialHistoryRow[]): string {
  const periods = rows.map((row) => row.period);
  const metricRows = [
    {
      label: "Revenue",
      values: rows.map((row) => formatMoneyCompact(row.revenue))
    },
    {
      label: "Gross margin",
      values: rows.map((row) => formatPercentCompact(row.gross_margin))
    },
    {
      label: "Operating margin",
      values: rows.map((row) => formatPercentCompact(row.operating_margin))
    },
    {
      label: "Free cash flow",
      values: rows.map((row) => formatMoneyCompact(row.free_cash_flow))
    },
    {
      label: "Net income",
      values: rows.map((row) => formatMoneyCompact(row.net_income))
    }
  ];

  return `
    <table class="financial-table">
      <thead>
        <tr>
          <th>Metric</th>
          ${periods.map((period) => `<th>${escapeHtml(period)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${metricRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            ${row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
          </tr>
        `).join("\n")}
      </tbody>
    </table>
  `;
}

function buildTrendSvg(report: AnalysisReport): string {
  const rows = (report.financial_analysis?.annual_history ?? []).slice(0, 4);
  return buildBarChartSvg({
    title: "Revenue vs free cash flow",
    labels: rows.map((row) => row.period),
    primary: rows.map((row) => normalizeMoney(row.revenue)),
    secondary: rows.map((row) => normalizeMoney(row.free_cash_flow)),
    primaryColor: "#c0a060",
    secondaryColor: "#223042"
  });
}

function buildMarginSvg(report: AnalysisReport): string {
  const rows = (report.financial_analysis?.annual_history ?? []).slice(0, 4);
  return buildBarChartSvg({
    title: "Gross margin vs operating margin",
    labels: rows.map((row) => row.period),
    primary: rows.map((row) => row.gross_margin ?? 0),
    secondary: rows.map((row) => row.operating_margin ?? 0),
    primaryColor: "#a7b7c6",
    secondaryColor: "#2f5f4b"
  });
}

function buildBarChartSvg(args: {
  title: string;
  labels: string[];
  primary: number[];
  secondary: number[];
  primaryColor: string;
  secondaryColor: string;
}): string {
  const width = 420;
  const height = 210;
  const baseline = 170;
  const groupWidth = 78;
  const barWidth = 20;
  const maxValue = Math.max(...args.primary, ...args.secondary, 1);
  const groups = args.labels.map((label, index) => {
    const x = 48 + index * groupWidth;
    const primaryHeight = Math.max(4, ((args.primary[index] ?? 0) / maxValue) * 110);
    const secondaryHeight = Math.max(4, ((args.secondary[index] ?? 0) / maxValue) * 110);
    return `
      <g>
        <rect x="${x}" y="${baseline - primaryHeight}" width="${barWidth}" height="${primaryHeight}" rx="3" fill="${args.primaryColor}" />
        <rect x="${x + 26}" y="${baseline - secondaryHeight}" width="${barWidth}" height="${secondaryHeight}" rx="3" fill="${args.secondaryColor}" />
        <text x="${x + 23}" y="${baseline + 18}" text-anchor="middle">${escapeHtml(label)}</text>
      </g>
    `;
  }).join("\n");

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(args.title)}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#fbf8f1" />
      <text x="28" y="22" class="chart-title">${escapeHtml(args.title)}</text>
      <line x1="34" y1="${baseline}" x2="${width - 24}" y2="${baseline}" stroke="#b9b2a3" stroke-width="1" />
      ${groups}
    </svg>
  `;
}

function buildValuationStripSvg(report: AnalysisReport): string {
  const valuation = report.valuation;
  const low = valuation?.fair_value_low;
  const mid = valuation?.fair_value_mid;
  const high = valuation?.fair_value_high;
  const spot = valuation?.spot_price;
  if (low === undefined && mid === undefined && high === undefined && spot === undefined) {
    return `<div class="coverage-note">Valuation range is not available for this report.</div>`;
  }
  const values = [low, mid, high, spot].filter((value): value is number => value !== undefined);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scale = (value?: number) => {
    if (value === undefined) {
      return 0;
    }
    if (max === min) {
      return 50;
    }
    return 8 + ((value - min) / (max - min)) * 84;
  };
  const lowX = scale(low);
  const midX = scale(mid);
  const highX = scale(high);
  const spotX = scale(spot);
  return `
    <svg class="range-svg" viewBox="0 0 540 110" role="img" aria-label="Valuation range">
      <rect x="0" y="0" width="540" height="110" rx="18" fill="#fbf8f1" />
      <rect x="42" y="52" width="456" height="12" rx="6" fill="#ded8cb" />
      ${low !== undefined && high !== undefined ? `<rect x="${42 + (lowX / 100) * 456}" y="46" width="${Math.max(8, ((highX - lowX) / 100) * 456)}" height="24" rx="12" fill="#d8c299" />` : ""}
      ${renderRangeMarker(low, "Low", "#8f8b82", lowX)}
      ${renderRangeMarker(mid, "Base", "#b3874f", midX)}
      ${renderRangeMarker(high, "High", "#8f8b82", highX)}
      ${spot !== undefined ? `
        <circle cx="${42 + (spotX / 100) * 456}" cy="58" r="7" fill="#213141" />
        <text x="${42 + (spotX / 100) * 456}" y="92" text-anchor="middle" class="range-label">Spot ${escapeHtml(formatMoneyCompact(spot))}</text>
      ` : ""}
    </svg>
  `;
}

function renderRangeMarker(value: number | undefined, label: string, color: string, xPct: number): string {
  if (value === undefined) {
    return "";
  }
  const x = 42 + (xPct / 100) * 456;
  return `
    <line x1="${x}" y1="34" x2="${x}" y2="76" stroke="${color}" stroke-width="2" />
    <text x="${x}" y="24" text-anchor="middle" class="range-label">${escapeHtml(label)} ${escapeHtml(formatMoneyCompact(value))}</text>
  `;
}

function renderScenarioTable(rows: Array<{ label: string; bear: string; base: string; bull: string }>): string {
  return `
    <table class="scenario-table">
      <thead>
        <tr>
          <th></th>
          <th>Bear</th>
          <th>Base</th>
          <th>Bull</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.bear)}</td>
            <td>${escapeHtml(row.base)}</td>
            <td>${escapeHtml(row.bull)}</td>
          </tr>
        `).join("\n")}
      </tbody>
    </table>
  `;
}

function buildScenarioRows(report: AnalysisReport): Array<{ label: string; bear: string; base: string; bull: string }> {
  const valuation = report.valuation;
  const spot = valuation?.spot_price;
  return [
    {
      label: "Fair value",
      bear: formatMoneyCompact(valuation?.fair_value_low),
      base: formatMoneyCompact(valuation?.fair_value_mid),
      bull: formatMoneyCompact(valuation?.fair_value_high)
    },
    {
      label: "Implied move",
      bear: formatMoveLabel(spot, valuation?.fair_value_low),
      base: formatMoveLabel(spot, valuation?.fair_value_mid),
      bull: formatMoveLabel(spot, valuation?.fair_value_high)
    },
    {
      label: "Key assumption",
      bear: valuation?.degraded_reason ? reportSentenceMap(valuation.degraded_reason) : "Lower conversion from growth into cash flow",
      base: `WACC ${formatPercentCompact((valuation?.assumptions.wacc ?? 0) * 100)}`,
      bull: "Margin resilience and stronger cash conversion"
    },
    {
      label: "Main risk",
      bear: firstRiskBullet(report) ?? "Execution weakens faster than expected",
      base: "The current operating case stalls",
      bull: "The market already discounts the upside"
    }
  ];
}

function renderChip(label: string, value: string, tone: "positive" | "neutral" | "warning" | "gold"): string {
  return `<div class="chip ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderCard(title: string, body: string): string {
  return `
    <div class="editorial-card">
      <div class="editorial-card__title">${escapeHtml(title)}</div>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function renderMiniCard(body: string): string {
  return `<div class="mini-card">${escapeHtml(body)}</div>`;
}

function getDueDiligenceSection(report: AnalysisReport, sectionId: DueDiligenceSectionId): DueDiligenceSection {
  return report.due_diligence?.sections.find((section) => section.section_id === sectionId) ?? {
    section_id: sectionId,
    title: reportLabelMap(sectionId),
    summary: reportSentenceMap(sectionId),
    narrative_paragraphs: [reportSentenceMap(sectionId)],
    key_points: [],
    evidence_refs: [],
    omissions: [reportSentenceMap(sectionId)],
    coverage_state: "limited"
  };
}

function financialTableNote(report: AnalysisReport): string {
  if ((report.financial_analysis?.annual_history.length ?? 0) >= 4) {
    return "A four-period table makes the narrative easier to audit against the underlying financial progression.";
  }
  return "The current table is intentionally shorter because the annual history is incomplete.";
}

function firstRiskBullet(report: AnalysisReport): string | undefined {
  return report.due_diligence?.sections
    .find((section) => section.section_id === "risks_and_challenges")
    ?.key_points?.[0];
}

function impliedUpsideLabel(report: AnalysisReport): string {
  if (report.valuation?.implied_upside_pct === undefined) {
    return report.valuation?.degraded_reason
      ? reportSentenceMap(report.valuation.degraded_reason)
      : "Valuation range unavailable";
  }
  return `${formatPercentCompact(report.valuation.implied_upside_pct)} implied move`;
}

function chipToneForSignal(signal: string): "positive" | "neutral" | "warning" | "gold" {
  if (signal === "positive") {
    return "positive";
  }
  if (signal === "negative") {
    return "warning";
  }
  return "neutral";
}

function coverageToneClass(value: string): string {
  return value === "full" ? "positive" : value === "partial" ? "neutral" : "warning";
}

function formatSignalLabel(signal: string): string {
  switch (signal) {
    case "positive":
      return "Positive";
    case "negative":
      return "Negative";
    case "neutral":
      return "Neutral";
    default:
      return "Watch";
  }
}

function collectSourceNotes(report: AnalysisReport): string[] {
  const notes = (report.sections ?? []).flatMap((section) =>
    (section.evidence ?? []).map((evidence) => {
      const source = evidence.source_name || "Source";
      const excerpt = evidence.excerpt || "";
      return `${source}: ${summarizeText(excerpt, 150)}`;
    })
  );
  return uniqueList(notes);
}

function humanizeCoverageNote(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return /[_-]/.test(value) ? reportSentenceMap(value) : value;
}

function normalizeMoney(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function formatMoneyCompact(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatPercentCompact(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(1)}%`;
}

function formatMoveLabel(spot: number | undefined, fairValue: number | undefined): string {
  if (spot === undefined || fairValue === undefined || spot === 0) {
    return "n/a";
  }
  const move = ((fairValue - spot) / spot) * 100;
  return `${move >= 0 ? "+" : ""}${move.toFixed(1)}%`;
}

function formatReportDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function resolveChromiumExecutablePath(): string | undefined {
  return chromiumCandidates.find((candidate) => existsSync(candidate));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summarizeText(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function countRenderedPdfPages(buffer: Buffer): number {
  const pageMatches = buffer.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return pageMatches?.length ?? 0;
}

function isSparseReport(report: AnalysisReport): boolean {
  const limitedSections = report.due_diligence?.sections.filter((section) => section.coverage_state === "limited").length ?? 0;
  const annualRows = report.financial_analysis?.annual_history.length ?? 0;
  return limitedSections >= 3 || annualRows < 3;
}

const editorialCss = `
  @page {
    size: Letter;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f262d;
    background: #f3eee4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3 {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    color: #1a2128;
    margin: 0;
  }

  h1 { font-size: 28px; line-height: 1.08; }
  h2 { font-size: 20px; line-height: 1.2; }
  h3 { font-size: 15px; line-height: 1.25; }
  p {
    margin: 0;
    color: #33404b;
    font-size: 12.1px;
    line-height: 1.48;
  }

  .page {
    width: 8.5in;
    height: 11in;
    page-break-after: always;
    padding: 0.58in 0.62in 0.46in 0.62in;
    background: #f8f4eb;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }

  .page:last-child {
    page-break-after: auto;
  }

  .page-header,
  .page-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .page-header {
    border-bottom: 1px solid #d2c8b6;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }

  .page-header__brand {
    display: grid;
    gap: 4px;
  }

  .page-header__wordmark {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #7e6337;
  }

  .page-header__meta,
  .page-header__date,
  .page-header__ticker,
  .page-footer {
    font-size: 10px;
    color: #6a706f;
  }

  .page-body {
    display: grid;
    gap: 16px;
    flex: 1 1 auto;
    min-height: 0;
    align-content: start;
  }

  .page-footer {
    border-top: 1px solid #d2c8b6;
    padding-top: 9px;
    margin-top: auto;
  }

  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #7e6337;
    font-weight: 700;
  }

  .hero {
    display: grid;
    grid-template-columns: 1.8fr 0.8fr;
    gap: 18px;
    align-items: start;
  }

  .hero__copy {
    display: grid;
    gap: 10px;
  }

  .hero__subtitle {
    font-size: 14px;
    color: #55616c;
    line-height: 1.45;
  }

  .hero__signal {
    background: #213141;
    color: #f4efe4;
    border-radius: 18px;
    padding: 16px;
    display: grid;
    gap: 8px;
    text-align: right;
  }

  .price-chip {
    justify-self: end;
    background: rgba(216, 194, 153, 0.18);
    border: 1px solid rgba(216, 194, 153, 0.34);
    color: #f2e7d2;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero__spot {
    font-size: 28px;
    font-family: Georgia, "Times New Roman", serif;
  }

  .hero__upside {
    font-size: 11px;
    color: #d8d0bf;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .chip {
    padding: 10px 12px;
    border-radius: 14px;
    display: flex;
    gap: 10px;
    align-items: baseline;
    border: 1px solid #d9d0c1;
    background: #fffdf8;
    font-size: 11px;
  }

  .chip strong {
    font-size: 12px;
    color: #1f262d;
  }

  .chip.positive {
    border-color: rgba(48, 96, 74, 0.2);
    background: #eaf2ee;
  }

  .chip.warning {
    border-color: rgba(179, 135, 79, 0.28);
    background: #f3ead8;
  }

  .chip.gold {
    border-color: rgba(192, 160, 96, 0.28);
    background: #f6efe0;
  }

  .thesis-box,
  .decision-box,
  .section-panel,
  .editorial-card,
  .side-card,
  .mini-card,
  .risk-card,
  .appendix-item {
    background: #fffdf8;
    border: 1px solid #ded5c6;
    border-radius: 18px;
  }

  .thesis-box,
  .section-panel {
    padding: 18px;
  }

  .thesis-box {
    display: grid;
    gap: 10px;
  }

  .decision-box {
    padding: 16px 18px;
    background: #f1ebdf;
    border-color: #d7c7a8;
    display: grid;
    gap: 8px;
  }

  .decision-box__label {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7e6337;
    font-weight: 700;
  }

  .decision-box__question {
    font-size: 17px;
    line-height: 1.35;
    color: #27323b;
    font-family: Georgia, "Times New Roman", serif;
  }

  .three-up,
  .two-up,
  .mini-grid,
  .appendix-grid {
    display: grid;
    gap: 14px;
  }

  .three-up {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .two-up {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mini-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .appendix-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .editorial-card,
  .risk-card,
  .appendix-item {
    padding: 14px;
    display: grid;
    gap: 8px;
  }

  .editorial-card__title,
  .side-card__label,
  .section-panel__kicker,
  .risk-card__label,
  .appendix-item__meta {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: #7e6337;
  }

  .summary-pill {
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 11px;
    line-height: 1.35;
    border: 1px solid #d7c7a8;
    background: #f6efe0;
    color: #4a5660;
  }

  .summary-pill.positive {
    background: #eaf2ee;
    border-color: rgba(48, 96, 74, 0.2);
  }

  .summary-pill.warning {
    background: #f3ead8;
    border-color: rgba(179, 135, 79, 0.28);
  }

  .summary-pill.neutral {
    background: #f5f1e8;
    border-color: #ded5c6;
  }

  .summary-pill.gold {
    background: #f6efe0;
    border-color: rgba(192, 160, 96, 0.28);
  }

  .narrative-header,
  .section-panel__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
  }

  .narrative-columns {
    display: grid;
    grid-template-columns: 1.8fr 0.9fr;
    gap: 16px;
  }

  .narrative-columns__main,
  .narrative-columns__side {
    display: grid;
    gap: 12px;
  }

  .side-card {
    padding: 14px;
    display: grid;
    gap: 8px;
  }

  .mini-card {
    padding: 12px;
    font-size: 11.4px;
    line-height: 1.45;
    color: #32404c;
  }

  .meta-strip {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: 10px;
    color: #6a706f;
  }

  .coverage-note,
  .appendix-note {
    padding: 12px 14px;
    border-radius: 16px;
    background: #f2ede3;
    border: 1px solid #ddd3c2;
    font-size: 11px;
    color: #5a6670;
    line-height: 1.45;
  }

  .financial-table,
  .scenario-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .financial-table th,
  .financial-table td,
  .scenario-table th,
  .scenario-table td {
    padding: 10px 8px;
    text-align: left;
    border-bottom: 1px solid #e8e0d2;
  }

  .financial-table thead th,
  .scenario-table thead th {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6a706f;
  }

  .evidence-list {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 8px;
    color: #32404c;
    font-size: 11.5px;
    line-height: 1.45;
  }

  .chart-svg,
  .range-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-title {
    font-size: 12px;
    font-family: Georgia, "Times New Roman", serif;
    fill: #223042;
  }

  .chart-svg text,
  .range-svg text {
    font-size: 10px;
    fill: #5a6670;
    font-family: "Helvetica Neue", Arial, sans-serif;
  }

  .range-label {
    font-size: 9px;
  }
`;
