// Editorial pages: filing intelligence and financial indicators. Copied unchanged from report-pdf-editorial.ts.
import type { Loose } from "../types.ts";
import type { AnalysisReport } from "../types.ts";
import type { EditorialPage } from "./html.ts";
import {
  renderAppendixPage,
  renderEvidencePage,
  renderExecutiveSummaryPage,
  renderFinancialExhibitsPage,
  renderSparseOverviewPage,
  renderSparseRiskValuationPage,
} from "./pages_main.ts";
import {
  buildFilingDeltaSvg,
  buildFinancialTrendSvg,
  escapeHtml,
  formatIndicatorNumber,
  renderBenchmarkRow,
  renderCard,
  renderEducationBox,
  renderFilingMetricCard,
  renderIndicatorCard,
  renderIndicatorRow,
  renderMemoParagraphs,
  renderTrendRow,
  summarizeText,
  titleCase,
} from "./helpers.ts";

export function buildFinancialIndicatorPages(report: AnalysisReport): EditorialPage[] {
  return [
    {
      title: "Financial Indicators",
      html: renderFinancialIndicatorsPage(report),
    },
    {
      title: "Benchmarks and Quality",
      html: renderFinancialBenchmarksQualityPage(report),
    },
    {
      title: "Five-Year Trend Board",
      html: renderFinancialTrendBoardPage(report),
    },
    {
      title: "Investor Education",
      html: renderFinancialEducationPage(report),
    },
  ];
}

export function buildFilingIntelligencePages(report: AnalysisReport): EditorialPage[] {
  return [
    {
      title: "Filing Read",
      html: renderFilingReadPage(report),
    },
    {
      title: "What Changed In The Filing",
      html: renderFilingChangesPage(report),
    },
    {
      title: "Good Bad Interesting",
      html: renderFilingGoodBadInterestingPage(report),
    },
  ];
}

export function buildSparseEditorialPages(report: AnalysisReport): EditorialPage[] {
  return [
    {
      title: "Executive Summary",
      html: renderExecutiveSummaryPage(report),
    },
    {
      title: "Due Diligence Overview",
      html: renderSparseOverviewPage(report),
    },
    {
      title: "Financial Snapshot",
      html: renderFinancialExhibitsPage(report),
    },
    {
      title: "Risks and Valuation Limits",
      html: renderSparseRiskValuationPage(report),
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

export function renderFilingReadPage(report: AnalysisReport): string {
  const filing = report.filing_intelligence;
  if (!filing) {
    return "";
  }
  const latest = filing.latest_filing;
  const topChanges = filing.top_changes.slice(0, 4);
  const plainEnglish = filing.memo.plain_english_takeaway;
  return `
    <div class="eyebrow">Filing Intelligence Memo</div>
    <div class="filing-hero">
      <div>
        <h1>The Filing Read</h1>
        <p class="filing-hero__meta">${
    escapeHtml(latest ? `${latest.form} | ${latest.period}` : "Latest SEC filing unavailable")
  }</p>
      </div>
      <div class="filing-hero__badge">${
    escapeHtml(filing.generation_mode === "live_prompt" ? "LLM explained" : "Deterministic read")
  }</div>
    </div>
    <div class="filing-story">
      ${renderMemoParagraphs(filing.memo.the_filing_read)}
    </div>
    <div class="filing-callout">
      <div class="filing-callout__label">What this means in plain English</div>
      <p>${escapeHtml(plainEnglish)}</p>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Top filing changes</div>
          <h2>What moved inside the company</h2>
        </div>
        <div class="section-panel__note">These are SEC/XBRL-backed comparisons, not quote-screen moves.</div>
      </div>
      <div class="filing-change-grid">
        ${
    (topChanges.length > 0 ? topChanges : ["No clean filing change crossed the reviewed threshold."]).map((
      change: Loose,
    ) => `
          <div class="filing-change-card">
            <span></span>
            <p>${escapeHtml(change)}</p>
          </div>
        `).join("\n")
  }
      </div>
    </div>
  `;
}

export function renderFilingChangesPage(report: AnalysisReport): string {
  const filing = report.filing_intelligence;
  if (!filing) {
    return "";
  }
  const metricDeltas = filing.metric_deltas
    .filter((delta: Loose) => delta.direction !== "unavailable")
    .slice(0, 8);
  const chartDeltas = metricDeltas.slice(0, 5);
  return `
    <div class="eyebrow">What Changed In The Filing</div>
    <div class="narrative-header">
      <h1>Numbers first, explanation beside them</h1>
      <div class="summary-pill gold">${escapeHtml(summarizeText(filing.memo.what_changed, 150))}</div>
    </div>
    <div class="filing-story filing-story--compact">
      ${renderMemoParagraphs(filing.memo.what_changed)}
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Before / after</div>
          <h2>Filing comparison board</h2>
        </div>
        <div class="section-panel__note">QoQ, YoY, and annual views stay separate so the memo does not blur timeframes.</div>
      </div>
      <div class="filing-metric-grid">
        ${metricDeltas.map(renderFilingMetricCard).join("\n")}
      </div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Visual explanation</div>
          <h2>How the main filing lines changed</h2>
        </div>
      </div>
      ${buildFilingDeltaSvg(chartDeltas)}
    </div>
  `;
}

export function renderFilingGoodBadInterestingPage(report: AnalysisReport): string {
  const filing = report.filing_intelligence;
  if (!filing) {
    return "";
  }
  const omissions = filing.omissions.slice(0, 6);
  return `
    <div class="eyebrow">Good / Bad / Interesting</div>
    <div class="narrative-header">
      <h1>The memo read-through</h1>
      <div class="summary-pill neutral">The point is not to praise or punish the filing. It is to explain what actually changed.</div>
    </div>
    <div class="three-up filing-gbi">
      ${renderCard("The good", filing.memo.the_good)}
      ${renderCard("The bad", filing.memo.the_bad)}
      ${renderCard("The interesting", filing.memo.the_interesting)}
    </div>
    <div class="two-up">
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Management tone</div>
            <h2>Do the words agree with the numbers?</h2>
          </div>
        </div>
        ${renderMemoParagraphs(filing.memo.management_tone)}
      </div>
      <div class="section-panel">
        <div class="section-panel__header">
          <div>
            <div class="section-panel__kicker">Risk watch</div>
            <h2>What needs confirmation next</h2>
          </div>
        </div>
        ${renderMemoParagraphs(filing.memo.risk_watch)}
        <div class="coverage-note">${escapeHtml(filing.memo.what_to_watch_next)}</div>
      </div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Omission truth</div>
          <h2>What the memo refused to fake</h2>
        </div>
      </div>
      <ul class="evidence-list">
        ${
    (omissions.length > 0 ? omissions : [{ reason: "No filing-intelligence omissions were recorded." }]).map((
      omission: Loose,
    ) => `<li>${escapeHtml("reason" in omission ? omission.reason : String(omission))}</li>`).join("\n")
  }
      </ul>
    </div>
  `;
}

export function renderFinancialIndicatorsPage(report: AnalysisReport): string {
  const block = report.financial_indicators;
  if (!block) {
    return "";
  }
  const classification = block.value_classification.classification.replaceAll("_", " ");
  const valuationRows = block.valuation.slice(0, 6);
  const priceReference = block.price_reference;
  return `
    <div class="eyebrow">Financial Indicators & Value Lens</div>
    <div class="value-hero">
      <div>
        <h1>${escapeHtml(titleCase(classification))}</h1>
        <p class="value-hero__meta">${escapeHtml(block.period)} | ${
    escapeHtml(block.basis.toUpperCase())
  } basis</p>
      </div>
      <div class="value-hero__badge">${escapeHtml(block.value_classification.confidence)} confidence</div>
    </div>
    <div class="filing-story">
      ${renderMemoParagraphs(block.plain_english.value_lens)}
      ${renderMemoParagraphs(block.plain_english.business_quality)}
    </div>
    <div class="price-provenance">
      <div>
        <div class="price-provenance__label">Price provenance</div>
        <strong>${
    escapeHtml(priceReference ? formatIndicatorNumber(priceReference.value, "currency") : "Price unavailable")
  }</strong>
      </div>
      <p>${
    escapeHtml(
      priceReference
        ? `${priceReference.source_name} | ${priceReference.price_kind} | ${priceReference.currency} | price date ${priceReference.price_date} | retrieved ${priceReference.retrieved_at}. ${priceReference.provenance_note}`
        : "Price-dependent ratios are omitted because the report does not have approved price provenance.",
    )
  }</p>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Valuation</div>
          <h2>Cheap, expensive, or expensive for a reason?</h2>
        </div>
        <div class="section-panel__note">Price-dependent ratios render only when approved price exists.</div>
      </div>
      <div class="indicator-grid">
        ${valuationRows.map(renderIndicatorCard).join("\n")}
      </div>
    </div>
  `;
}

export function renderFinancialBenchmarksQualityPage(report: AnalysisReport): string {
  const block = report.financial_indicators;
  if (!block) {
    return "";
  }
  const benchmarkRows = (block.benchmarks ?? []).slice(0, 6);
  const qualityRows = [
    ...block.profitability.slice(0, 3),
    ...block.cash_flow_quality.slice(0, 2),
    ...block.balance_sheet.slice(0, 2),
    ...block.capital_allocation.slice(0, 1),
  ].slice(0, 4);
  return `
    <div class="eyebrow">Benchmarks & Quality</div>
    <div class="narrative-header">
      <h1>Is the multiple supported by business quality?</h1>
      <div class="summary-pill gold">${
    escapeHtml(summarizeText(block.plain_english.business_quality, 150))
  }</div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Benchmarks</div>
          <h2>High or low compared with a reviewed band?</h2>
        </div>
        <div class="section-panel__note">Benchmarks are context bands, not peer-perfect truth.</div>
      </div>
      <div class="benchmark-table">
        ${benchmarkRows.map(renderBenchmarkRow).join("\n")}
      </div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Business quality</div>
          <h2>Profit, cash, and balance-sheet reality</h2>
        </div>
      </div>
      <div class="indicator-table">
        ${qualityRows.map(renderIndicatorRow).join("\n")}
      </div>
    </div>
  `;
}

export function renderFinancialTrendBoardPage(report: AnalysisReport): string {
  const block = report.financial_indicators;
  if (!block) {
    return "";
  }
  const trends = block.five_year_trends.slice(0, 6);
  return `
    <div class="eyebrow">Five-Year Trend Board</div>
    <div class="narrative-header">
      <h1>Did the business improve, or did the multiple just expand?</h1>
      <div class="summary-pill gold">${
    escapeHtml(summarizeText(block.plain_english.five_year_read, 160))
  }</div>
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Trend board</div>
          <h2>Current, 1Y, 3Y, and 5Y context</h2>
        </div>
      </div>
      ${buildFinancialTrendSvg(trends)}
      <div class="trend-table">
        ${trends.map(renderTrendRow).join("\n")}
      </div>
    </div>
  `;
}

export function renderFinancialEducationPage(report: AnalysisReport): string {
  const block = report.financial_indicators;
  if (!block) {
    return "";
  }
  const education = (block.education ?? []).slice(0, 4);
  return `
    <div class="eyebrow">Investor Education</div>
    <div class="narrative-header">
      <h1>What these labels mean in human language</h1>
      <div class="summary-pill gold">${
    escapeHtml(summarizeText(block.plain_english.what_to_watch_next, 150))
  }</div>
    </div>
    <div class="education-grid education-grid--large">
      ${education.map(renderEducationBox).join("\n")}
    </div>
    <div class="section-panel">
      <div class="section-panel__header">
        <div>
          <div class="section-panel__kicker">Omission truth</div>
          <h2>What the value lens refused to fake</h2>
        </div>
      </div>
      <div class="omission-list">
        ${
    (block.omissions.length > 0
      ? block.omissions.slice(0, 4)
      : [{ family: "none", reason: "No material financial-indicator omissions were recorded." }]).map((
        omission: Loose,
      ) => `
          <div class="omission-row">
            <strong>${escapeHtml(String(omission.family))}</strong>
            <span>${escapeHtml(omission.reason)}</span>
          </div>
        `).join("\n")
  }
      </div>
    </div>
  `;
}
