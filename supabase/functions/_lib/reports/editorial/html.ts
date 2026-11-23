// Editorial HTML for a Deep Dive (shared reader /r/:token; M4 prints it to PDF). Copied unchanged from
// apps/product-api/src/report-pdf-editorial.ts, split into files under 800 lines. Owner: M1.
import type { AnalysisReport } from "../types.ts";
import {
  buildFilingIntelligencePages,
  buildFinancialIndicatorPages,
  buildSparseEditorialPages,
} from "./pages_filing.ts";
import {
  renderAppendixPage,
  renderEvidencePage,
  renderExecutiveSummaryPage,
  renderFinancialExhibitsPage,
  renderNarrativeSectionPage,
  renderPageShell,
  renderRisksPage,
  renderValuationPage,
} from "./pages_main.ts";
import { escapeHtml, isSparseReport } from "./helpers.ts";
import { editorialCss } from "./css.ts";

export interface EditorialPage {
  title: string;
  html: string;
}

export type DueDiligenceSectionId =
  | "financial_analysis"
  | "competitive_positioning"
  | "management_and_governance"
  | "risks_and_challenges"
  | "growth_opportunities_and_outlook"
  | "valuation_and_thesis_stance";

export type DueDiligenceSection = NonNullable<AnalysisReport["due_diligence"]>["sections"][number];
export function buildEditorialReportHtml(
  report: AnalysisReport,
  pages = buildEditorialReportPages(report),
): string {
  const totalPages = pages.length;
  const pageMarkup = pages.map((page, index) =>
    renderPageShell({
      report,
      pageTitle: page.title,
      pageNumber: index + 1,
      totalPages,
      bodyHtml: page.html,
    })
  ).join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(report.issuer?.name ?? report.ticker ?? "Thesis")} Due Diligence Report</title>`,
    "<style>",
    editorialCss,
    "</style>",
    "</head>",
    "<body>",
    pageMarkup,
    "</body>",
    "</html>",
  ].join("\n");
}

export function buildEditorialReportPages(report: AnalysisReport): EditorialPage[] {
  const sparse = isSparseReport(report);
  const filingPages = report.filing_intelligence ? buildFilingIntelligencePages(report) : [];
  const indicatorPages = report.financial_indicators ? buildFinancialIndicatorPages(report) : [];
  if (sparse) {
    return [...filingPages, ...indicatorPages, ...buildSparseEditorialPages(report)];
  }

  return [
    ...filingPages,
    ...indicatorPages,
    {
      title: "Executive Summary",
      html: renderExecutiveSummaryPage(report),
    },
    {
      title: "Financial Analysis",
      html: renderNarrativeSectionPage(report, "financial_analysis", {
        kicker: "Financial Analysis",
        includeHighlights: true,
        includeEvidenceStrip: true,
      }),
    },
    {
      title: "Financial Exhibits",
      html: renderFinancialExhibitsPage(report),
    },
    {
      title: "Competitive Positioning",
      html: renderNarrativeSectionPage(report, "competitive_positioning", {
        kicker: "Competitive Positioning",
        includeHighlights: true,
        includeEvidenceStrip: true,
      }),
    },
    {
      title: "Management and Governance",
      html: renderNarrativeSectionPage(report, "management_and_governance", {
        kicker: "Management and Governance",
        includeHighlights: true,
        includeCoverageNote: true,
      }),
    },
    {
      title: "Risks and Challenges",
      html: renderRisksPage(report),
    },
    {
      title: "Growth Outlook",
      html: renderNarrativeSectionPage(report, "growth_opportunities_and_outlook", {
        kicker: "Growth Opportunities and Outlook",
        includeHighlights: true,
        includeEvidenceStrip: true,
      }),
    },
    {
      title: "Valuation and Stance",
      html: renderValuationPage(report),
    },
    {
      title: "Evidence and Omissions",
      html: renderEvidencePage(report),
    },
    {
      title: "Appendix",
      html: renderAppendixPage(report),
    },
  ];
}
