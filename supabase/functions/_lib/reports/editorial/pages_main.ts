// Editorial pages: page shell, summary, narrative, risks, valuation, evidence, appendix. Copied unchanged.
import type { Loose } from "../types.ts";
import type { AnalysisReport } from "../types.ts";
import { reportLabelMap, reportSentenceMap } from "../label_map.ts";
import type { DueDiligenceSectionId } from "./html.ts";
import {
  buildMarginSvg,
  buildScenarioRows,
  buildTrendSvg,
  buildValuationStripSvg,
  chipToneForSignal,
  collectSourceNotes,
  coverageToneClass,
  escapeHtml,
  financialTableNote,
  formatMoneyCompact,
  formatReportDate,
  formatSignalLabel,
  getDueDiligenceSection,
  humanizeCoverageNote,
  impliedUpsideLabel,
  renderCard,
  renderChip,
  renderFinancialTable,
  renderMiniCard,
  renderScenarioTable,
  summarizeText,
  uniqueList,
} from "./helpers.ts";

export function renderPageShell(args: {
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

export function renderExecutiveSummaryPage(report: AnalysisReport): string {
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
  const whatChanged = memoSections.find((section: Loose) => section.section_id === "what_changed");
  const risks = memoSections.find((section: Loose) => section.section_id === "risks");
  const thesis = memoSections.find((section: Loose) => section.section_id === "investment_thesis");
  const heroSubtitle = summarizeText(
    report.story_header?.headline ??
      report.story_header?.thesis_summary ??
      thesis?.narrative ??
      "A structured due diligence report grounded in approved evidence.",
    120,
  );
  const investmentView = summarizeText(
    report.story_header?.thesis_summary ??
      thesis?.narrative ??
      "The current report is structured to explain whether the operating case still deserves conviction and where that conviction remains conditional.",
    210,
  );
  const decisionQuestion = summarizeText(
    report.investment_memo?.decision_question ??
      "What would need to remain true for this thesis to stay investable?",
    115,
  );
  const matterNow = summarizeText(
    report.story_header?.why_now ??
      thesis?.key_points?.[0] ??
      "The latest filing cycle matters because it either confirms or weakens the current operating case.",
    165,
  );
  const whatChangedBody = summarizeText(
    report.change_summary?.current_view ??
      whatChanged?.narrative ??
      "The current view differs from the prior baseline only where the evidence says it should.",
    150,
  );
  const breakThesis = summarizeText(
    risks?.narrative ??
      report.watch_items?.[0] ??
      "The report stays explicit about the conditions that would force a review of the stance.",
    185,
  );
  const valuationSvg = buildValuationStripSvg(report);
  const valuationNote = summarizeText(
    report.valuation?.degraded_reason ??
      "Low, base, and high values show how much execution the current price is already asking the business to deliver.",
    110,
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

export function renderNarrativeSectionPage(
  report: AnalysisReport,
  sectionId: DueDiligenceSectionId,
  options: {
    kicker: string;
    includeHighlights?: boolean;
    includeEvidenceStrip?: boolean;
    includeCoverageNote?: boolean;
  },
): string {
  const section = getDueDiligenceSection(report, sectionId);
  const paragraphs = section.narrative_paragraphs.map((paragraph: Loose) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
  const highlights = options.includeHighlights
    ? `
      <div class="mini-grid">
        ${section.key_points.slice(0, 4).map((point: Loose) => renderMiniCard(point)).join("\n")}
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
    ? `<div class="coverage-note">${
      escapeHtml(
        humanizeCoverageNote(section.omissions[0]) ??
          "Coverage remains grounded in approved filings, transcripts, and omission-aware deterministic analysis.",
      )
    }</div>`
    : "";

  return `
    <div class="eyebrow">${escapeHtml(options.kicker)}</div>
    <div class="narrative-header">
      <h1>${escapeHtml(section.title)}</h1>
      <div class="summary-pill ${coverageToneClass(section.coverage_state)}">${
    escapeHtml(section.summary)
  }</div>
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
        ${
    section.omissions.length > 0
      ? `
          <div class="side-card">
            <div class="side-card__label">Current limitation</div>
            <p>${escapeHtml(humanizeCoverageNote(section.omissions[0]))}</p>
          </div>
        `
      : ""
  }
      </aside>
    </div>
    ${highlights}
    ${coverageNote}
  `;
}

export function renderFinancialExhibitsPage(report: AnalysisReport): string {
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

export function renderRisksPage(report: AnalysisReport): string {
  const section = getDueDiligenceSection(report, "risks_and_challenges");
  const killSwitchCards = (report.kill_switch_conditions ?? []).slice(0, 3).map((condition: Loose) => `
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
        ${
    section.narrative_paragraphs.map((paragraph: Loose) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")
  }
      </div>
      <aside class="narrative-columns__side">
        <div class="side-card">
          <div class="side-card__label">What would change our mind</div>
          <p>${
    escapeHtml(
      (report.watch_items ?? []).slice(0, 2).join(" ") || section.key_points[0] ||
        "The report stays explicit about the conditions that would force a new stance.",
    )
  }</p>
        </div>
      </aside>
    </div>
    <div class="three-up">
      ${
    killSwitchCards ||
    renderCard(
      "Risk control",
      "Explicit kill-switch coverage was limited in this run, so the report stays omission-forward rather than pretending it has a complete falsification map.",
    )
  }
    </div>
  `;
}

export function renderValuationPage(report: AnalysisReport): string {
  const section = getDueDiligenceSection(report, "valuation_and_thesis_stance");
  const scenarioRows = buildScenarioRows(report);
  return `
    <div class="eyebrow">Valuation And Thesis Stance</div>
    <div class="narrative-header">
      <h1>${escapeHtml(section.title)}</h1>
      <div class="summary-pill ${report.valuation?.degraded_reason ? "warning" : "gold"}">${
    escapeHtml(section.summary)
  }</div>
    </div>
    <div class="narrative-columns">
      <div class="narrative-columns__main">
        ${
    section.narrative_paragraphs.map((paragraph: Loose) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")
  }
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

export function renderEvidencePage(report: AnalysisReport): string {
  const sourceNotes = collectSourceNotes(report).slice(0, 8);
  const omissions = uniqueList([
    ...(report.coverage_truth?.missing ?? []),
    ...((report.due_diligence?.sections ?? []).flatMap((section: Loose) => section.omissions)),
    ...((report.filing_intelligence?.omissions ?? []).map((omission: Loose) => omission.reason)),
  ]).slice(0, 10);
  return `
    <div class="eyebrow">Evidence And Coverage</div>
    <div class="narrative-header">
      <h1>Evidence, omissions, and source discipline</h1>
      <div class="summary-pill neutral">${
    escapeHtml(
      report.coverage_truth?.summary ?? "This page exists to increase trust, not to hide limitations.",
    )
  }</div>
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
          ${
    (omissions.length > 0 ? omissions : ["No major coverage limitations were recorded."]).map((note) =>
      `<li>${escapeHtml(note.includes("_") ? reportSentenceMap(note) : note)}</li>`
    ).join("\n")
  }
        </ul>
      </div>
    </div>
  `;
}

export function renderAppendixPage(report: AnalysisReport): string {
  const sectionDigests = (report.due_diligence?.sections ?? []).map((section: Loose) => `
    <div class="appendix-item">
      <div class="appendix-item__title">${escapeHtml(section.title)}</div>
      <div class="appendix-item__meta">Coverage ${escapeHtml(section.coverage_state)} | Evidence refs ${
    escapeHtml(String(section.evidence_refs.length))
  }</div>
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
    <div class="appendix-note">Generated ${
    escapeHtml(formatReportDate(report.generated_at))
  }. Thesis uses stance language only and remains omission-aware where the source plane is incomplete.</div>
  `;
}

export function renderSparseOverviewPage(report: AnalysisReport): string {
  const sections = report.due_diligence?.sections ?? [];
  return `
    <div class="eyebrow">Due Diligence Overview</div>
    <div class="narrative-header">
      <h1>Coverage stays intentionally narrow</h1>
      <div class="summary-pill warning">${
    escapeHtml(
      report.coverage_truth?.summary ??
        "Sparse evidence means the report is still useful, but not fully complete.",
    )
  }</div>
    </div>
    <div class="appendix-grid">
      ${
    sections.map((section: Loose) => `
        <div class="appendix-item">
          <div class="appendix-item__title">${escapeHtml(section.title)}</div>
          <div class="appendix-item__meta">Coverage ${escapeHtml(section.coverage_state)}</div>
          <p>${escapeHtml(section.summary)}</p>
        </div>
      `).join("\n")
  }
    </div>
  `;
}

export function renderSparseRiskValuationPage(report: AnalysisReport): string {
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
        ${risks.narrative_paragraphs.map((paragraph: Loose) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
      </div>
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Valuation status</div>
            <h2>${escapeHtml(valuation.title)}</h2>
          </div>
        </div>
        ${
    valuation.narrative_paragraphs.map((paragraph: Loose) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")
  }
        <div class="coverage-note">${
    escapeHtml(report.valuation?.degraded_reason ?? "Valuation range is not available for this report.")
  }</div>
      </div>
    </div>
  `;
}
