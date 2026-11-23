// Editorial render helpers (tables, SVG charts, cards, formatting). Copied unchanged from report-pdf-editorial.ts.
import type { Loose } from "../types.ts";
import type {
  AnalysisReport,
  FilingIntelligenceMetricDelta,
  FinancialHistoryRow,
  FinancialIndicator,
  FinancialIndicatorBenchmark,
  FinancialIndicatorTrend,
  InvestorEducationBox,
} from "../types.ts";
import { reportLabelMap, reportSentenceMap } from "../label_map.ts";
import type { DueDiligenceSection, DueDiligenceSectionId } from "./html.ts";

export function renderFinancialTable(rows: FinancialHistoryRow[]): string {
  const periods = rows.map((row) => row.period);
  const metricRows = [
    {
      label: "Revenue",
      values: rows.map((row) => formatMoneyCompact(row.revenue)),
    },
    {
      label: "Gross margin",
      values: rows.map((row) => formatPercentCompact(row.gross_margin)),
    },
    {
      label: "Operating margin",
      values: rows.map((row) => formatPercentCompact(row.operating_margin)),
    },
    {
      label: "Free cash flow",
      values: rows.map((row) => formatMoneyCompact(row.free_cash_flow)),
    },
    {
      label: "Net income",
      values: rows.map((row) => formatMoneyCompact(row.net_income)),
    },
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
        ${
    metricRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            ${row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
          </tr>
        `).join("\n")
  }
      </tbody>
    </table>
  `;
}

export function buildTrendSvg(report: AnalysisReport): string {
  const rows = (report.financial_analysis?.annual_history ?? []).slice(0, 4);
  return buildBarChartSvg({
    title: "Revenue vs free cash flow",
    labels: rows.map((row: Loose) => row.period),
    primary: rows.map((row: Loose) => normalizeMoney(row.revenue)),
    secondary: rows.map((row: Loose) => normalizeMoney(row.free_cash_flow)),
    primaryColor: "#c0a060",
    secondaryColor: "#223042",
  });
}

export function buildMarginSvg(report: AnalysisReport): string {
  const rows = (report.financial_analysis?.annual_history ?? []).slice(0, 4);
  return buildBarChartSvg({
    title: "Gross margin vs operating margin",
    labels: rows.map((row: Loose) => row.period),
    primary: rows.map((row: Loose) => row.gross_margin ?? 0),
    secondary: rows.map((row: Loose) => row.operating_margin ?? 0),
    primaryColor: "#a7b7c6",
    secondaryColor: "#2f5f4b",
  });
}

export function buildBarChartSvg(args: {
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
        <rect x="${x}" y="${
      baseline - primaryHeight
    }" width="${barWidth}" height="${primaryHeight}" rx="3" fill="${args.primaryColor}" />
        <rect x="${x + 26}" y="${
      baseline - secondaryHeight
    }" width="${barWidth}" height="${secondaryHeight}" rx="3" fill="${args.secondaryColor}" />
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

export function buildValuationStripSvg(report: AnalysisReport): string {
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
      ${
    low !== undefined && high !== undefined
      ? `<rect x="${42 + (lowX / 100) * 456}" y="46" width="${
        Math.max(8, ((highX - lowX) / 100) * 456)
      }" height="24" rx="12" fill="#d8c299" />`
      : ""
  }
      ${renderRangeMarker(low, "Low", "#8f8b82", lowX)}
      ${renderRangeMarker(mid, "Base", "#b3874f", midX)}
      ${renderRangeMarker(high, "High", "#8f8b82", highX)}
      ${
    spot !== undefined
      ? `
        <circle cx="${42 + (spotX / 100) * 456}" cy="58" r="7" fill="#213141" />
        <text x="${42 + (spotX / 100) * 456}" y="92" text-anchor="middle" class="range-label">Spot ${
        escapeHtml(formatMoneyCompact(spot))
      }</text>
      `
      : ""
  }
    </svg>
  `;
}

export function renderRangeMarker(
  value: number | undefined,
  label: string,
  color: string,
  xPct: number,
): string {
  if (value === undefined) {
    return "";
  }
  const x = 42 + (xPct / 100) * 456;
  return `
    <line x1="${x}" y1="34" x2="${x}" y2="76" stroke="${color}" stroke-width="2" />
    <text x="${x}" y="24" text-anchor="middle" class="range-label">${escapeHtml(label)} ${
    escapeHtml(formatMoneyCompact(value))
  }</text>
  `;
}

export function renderScenarioTable(
  rows: Array<{ label: string; bear: string; base: string; bull: string }>,
): string {
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
        ${
    rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.bear)}</td>
            <td>${escapeHtml(row.base)}</td>
            <td>${escapeHtml(row.bull)}</td>
          </tr>
        `).join("\n")
  }
      </tbody>
    </table>
  `;
}

export function buildScenarioRows(
  report: AnalysisReport,
): Array<{ label: string; bear: string; base: string; bull: string }> {
  const valuation = report.valuation;
  const spot = valuation?.spot_price;
  return [
    {
      label: "Fair value",
      bear: formatMoneyCompact(valuation?.fair_value_low),
      base: formatMoneyCompact(valuation?.fair_value_mid),
      bull: formatMoneyCompact(valuation?.fair_value_high),
    },
    {
      label: "Implied move",
      bear: formatMoveLabel(spot, valuation?.fair_value_low),
      base: formatMoveLabel(spot, valuation?.fair_value_mid),
      bull: formatMoveLabel(spot, valuation?.fair_value_high),
    },
    {
      label: "Key assumption",
      bear: valuation?.degraded_reason
        ? reportSentenceMap(valuation.degraded_reason)
        : "Lower conversion from growth into cash flow",
      base: `WACC ${formatPercentCompact((valuation?.assumptions.wacc ?? 0) * 100)}`,
      bull: "Margin resilience and stronger cash conversion",
    },
    {
      label: "Main risk",
      bear: firstRiskBullet(report) ?? "Execution weakens faster than expected",
      base: "The current operating case stalls",
      bull: "The market already discounts the upside",
    },
  ];
}

export function renderChip(
  label: string,
  value: string,
  tone: "positive" | "neutral" | "warning" | "gold",
): string {
  return `<div class="chip ${tone}"><span>${escapeHtml(label)}</span><strong>${
    escapeHtml(value)
  }</strong></div>`;
}

export function renderCard(title: string, body: string): string {
  return `
    <div class="editorial-card">
      <div class="editorial-card__title">${escapeHtml(title)}</div>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

export function renderMemoParagraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

export function renderFilingMetricCard(delta: FilingIntelligenceMetricDelta): string {
  const directionClass = delta.direction === "improved"
    ? "positive"
    : delta.direction === "weakened"
    ? "warning"
    : "neutral";
  return `
    <div class="filing-metric-card ${directionClass}">
      <div class="filing-metric-card__top">
        <div>
          <div class="filing-metric-card__label">${escapeHtml(delta.label)}</div>
          <div class="filing-metric-card__basis">${escapeHtml(delta.basis.toUpperCase())}</div>
        </div>
        <div class="filing-metric-card__move">${escapeHtml(formatFilingDelta(delta))}</div>
      </div>
      <div class="filing-metric-card__values">
        <span>${escapeHtml(delta.current_period)}: ${
    escapeHtml(formatFilingValue(delta.current_value, delta.unit))
  }</span>
        <span>${escapeHtml(delta.reference_period ?? "prior")}: ${
    escapeHtml(formatFilingValue(delta.reference_value, delta.unit))
  }</span>
      </div>
      <p>${escapeHtml(delta.plain_english)}</p>
    </div>
  `;
}

export function buildFilingDeltaSvg(deltas: FilingIntelligenceMetricDelta[]): string {
  const width = 560;
  const height = 230;
  const maxAbs = Math.max(...deltas.map((delta) => Math.abs(delta.delta_pct ?? delta.delta ?? 0)), 1);
  const centerX = 280;
  const rows = deltas.map((delta, index) => {
    const y = 38 + index * 36;
    const raw = delta.delta_pct ?? delta.delta ?? 0;
    const barWidth = Math.min(190, (Math.abs(raw) / maxAbs) * 190);
    const positive = raw >= 0;
    const x = positive ? centerX : centerX - barWidth;
    const fill = delta.direction === "improved"
      ? "#2f5f4b"
      : delta.direction === "weakened"
      ? "#8b3f37"
      : "#8f8a7d";
    return `
      <g>
        <text x="24" y="${y + 10}" class="chart-label">${escapeHtml(delta.label)} ${
      escapeHtml(delta.basis.toUpperCase())
    }</text>
        <rect x="${x}" y="${y}" width="${barWidth}" height="16" rx="4" fill="${fill}" opacity="0.9" />
        <text x="${positive ? x + barWidth + 8 : x - 8}" y="${y + 12}" class="chart-value" text-anchor="${
      positive ? "start" : "end"
    }">${escapeHtml(formatFilingDelta(delta))}</text>
      </g>
    `;
  }).join("\n");
  return `
    <svg class="chart-svg filing-delta-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Filing metric deltas">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#fbf8f1" />
      <line x1="${centerX}" y1="24" x2="${centerX}" y2="${height - 20}" stroke="#b9b2a3" stroke-width="1" />
      ${rows}
    </svg>
  `;
}

export function renderIndicatorCard(entry: FinancialIndicator): string {
  const tone = entry.state === "available" ? "positive" : "neutral";
  return `
    <div class="indicator-card ${tone}">
      <div class="indicator-card__label">${escapeHtml(entry.label)}</div>
      <div class="indicator-card__value">${escapeHtml(formatIndicatorValue(entry))}</div>
      <p>${escapeHtml(entry.interpretation)}</p>
    </div>
  `;
}

export function renderIndicatorRow(entry: FinancialIndicator): string {
  return `
    <div class="indicator-row ${entry.state === "available" ? "available" : "missing"}">
      <span>${escapeHtml(entry.label)}</span>
      <strong>${escapeHtml(formatIndicatorValue(entry))}</strong>
      <em>${escapeHtml(summarizeText(entry.interpretation, 110))}</em>
    </div>
  `;
}

export function renderTrendRow(entry: FinancialIndicatorTrend): string {
  return `
    <div class="trend-row ${escapeHtml(entry.direction)}">
      <span>${escapeHtml(entry.label)}</span>
      <strong>${escapeHtml(formatIndicatorNumber(entry.current, entry.unit))}</strong>
      <span>${escapeHtml(formatIndicatorNumber(entry.one_year_ago, entry.unit))}</span>
      <span>${escapeHtml(formatIndicatorNumber(entry.three_years_ago, entry.unit))}</span>
      <span>${escapeHtml(formatIndicatorNumber(entry.five_years_ago, entry.unit))}</span>
      <em>${escapeHtml(entry.plain_english)}</em>
    </div>
  `;
}

export function renderBenchmarkRow(entry: FinancialIndicatorBenchmark): string {
  return `
    <div class="benchmark-row ${escapeHtml(entry.comparison)}">
      <span>${escapeHtml(entry.label)}</span>
      <strong>${escapeHtml(entry.comparison)}</strong>
      <small>${
    escapeHtml(
      `${formatIndicatorNumber(entry.low, entry.unit)} - ${
        formatIndicatorNumber(entry.high, entry.unit)
      } band`,
    )
  }</small>
      <em>${escapeHtml(entry.plain_english)}</em>
    </div>
  `;
}

export function renderEducationBox(entry: InvestorEducationBox): string {
  return `
    <div class="education-card">
      <div class="education-card__topic">${escapeHtml(entry.topic.replaceAll("_", " "))}</div>
      <h3>${escapeHtml(entry.title)}</h3>
      <p>${escapeHtml(entry.body)}</p>
      ${entry.example ? `<small>${escapeHtml(entry.example)}</small>` : ""}
    </div>
  `;
}

export function buildFinancialTrendSvg(trends: FinancialIndicatorTrend[]): string {
  const width = 560;
  const height = 220;
  const rows = trends.map((trend, index) => {
    const y = 30 + index * 30;
    const values = [trend.five_years_ago, trend.three_years_ago, trend.one_year_ago, trend.current]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const points = [trend.five_years_ago, trend.three_years_ago, trend.one_year_ago, trend.current].map(
      (value, pointIndex) => {
        const x = 235 + pointIndex * 82;
        const normalized = value === undefined || max === min ? 0.5 : (value - min) / (max - min);
        const py = y + 20 - normalized * 22;
        return { x, y: py, value };
      },
    );
    const path = points
      .filter((point) => point.value !== undefined)
      .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const stroke = trend.direction === "improving"
      ? "#2f5f4b"
      : trend.direction === "weakening"
      ? "#8b3f37"
      : "#9b8a62";
    return `
      <g>
        <text x="22" y="${y + 8}" class="chart-label">${escapeHtml(trend.label)}</text>
        <path d="${path}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" />
        ${
      points.filter((point) => point.value !== undefined).map((point) =>
        `<circle cx="${point.x}" cy="${point.y}" r="3.2" fill="${stroke}" />`
      ).join("\n")
    }
      </g>
    `;
  }).join("\n");
  return `
    <svg class="chart-svg trend-board-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Financial indicator trends">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#fbf8f1" />
      <text x="235" y="18" class="chart-axis">5Y</text>
      <text x="317" y="18" class="chart-axis">3Y</text>
      <text x="399" y="18" class="chart-axis">1Y</text>
      <text x="481" y="18" class="chart-axis">Now</text>
      ${rows}
    </svg>
  `;
}

export function renderMiniCard(body: string): string {
  return `<div class="mini-card">${escapeHtml(body)}</div>`;
}

export function getDueDiligenceSection(
  report: AnalysisReport,
  sectionId: DueDiligenceSectionId,
): DueDiligenceSection {
  return report.due_diligence?.sections.find((section: Loose) => section.section_id === sectionId) ?? {
    section_id: sectionId,
    title: reportLabelMap(sectionId),
    summary: reportSentenceMap(sectionId),
    narrative_paragraphs: [reportSentenceMap(sectionId)],
    key_points: [],
    evidence_refs: [],
    omissions: [reportSentenceMap(sectionId)],
    coverage_state: "limited",
  };
}

export function financialTableNote(report: AnalysisReport): string {
  if ((report.financial_analysis?.annual_history.length ?? 0) >= 4) {
    return "A four-period table makes the narrative easier to audit against the underlying financial progression.";
  }
  return "The current table is intentionally shorter because the annual history is incomplete.";
}

export function firstRiskBullet(report: AnalysisReport): string | undefined {
  return report.due_diligence?.sections
    .find((section: Loose) => section.section_id === "risks_and_challenges")
    ?.key_points?.[0];
}

export function impliedUpsideLabel(report: AnalysisReport): string {
  if (report.valuation?.implied_upside_pct === undefined) {
    return report.valuation?.degraded_reason
      ? reportSentenceMap(report.valuation.degraded_reason)
      : "Valuation range unavailable";
  }
  return `${formatPercentCompact(report.valuation.implied_upside_pct)} implied move`;
}

export function chipToneForSignal(signal: string): "positive" | "neutral" | "warning" | "gold" {
  if (signal === "positive") {
    return "positive";
  }
  if (signal === "negative") {
    return "warning";
  }
  return "neutral";
}

export function coverageToneClass(value: string): string {
  return value === "full" ? "positive" : value === "partial" ? "neutral" : "warning";
}

export function formatSignalLabel(signal: string): string {
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

export function collectSourceNotes(report: AnalysisReport): string[] {
  const sectionNotes = (report.sections ?? []).flatMap((section: Loose) =>
    (section.evidence ?? []).map((evidence: Loose) => {
      const source = evidence.source_name || "Source";
      const excerpt = evidence.excerpt || "";
      return `${source}: ${summarizeText(excerpt, 150)}`;
    })
  );
  const filingNotes = (report.filing_intelligence?.evidence ?? []).map((evidence: Loose) => {
    const source = evidence.source_name || "Source";
    const excerpt = evidence.excerpt || "";
    return `${source}: ${summarizeText(excerpt, 150)}`;
  });
  const indicatorNotes = (report.financial_indicators?.evidence ?? []).map((evidence: Loose) => {
    const source = evidence.source_name || "Source";
    const excerpt = evidence.excerpt || "";
    return `${source}: ${summarizeText(excerpt, 150)}`;
  });
  return uniqueList([...indicatorNotes, ...filingNotes, ...sectionNotes]);
}

export function humanizeCoverageNote(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return /[_-]/.test(value) ? reportSentenceMap(value) : value;
}

export function normalizeMoney(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, value);
}

export function formatMoneyCompact(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatPercentCompact(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(1)}%`;
}

export function formatFilingValue(
  value: number | undefined,
  unit: FilingIntelligenceMetricDelta["unit"],
): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  if (unit === "currency") {
    return formatMoneyCompact(value);
  }
  if (unit === "pct") {
    return `${value.toFixed(1)}%`;
  }
  if (unit === "count") {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return value.toFixed(2);
}

export function formatFilingDelta(delta: FilingIntelligenceMetricDelta): string {
  const value = delta.delta_pct ?? delta.delta;
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${delta.delta_pct !== undefined ? "%" : ""}`;
}

export function formatIndicatorValue(entry: FinancialIndicator): string {
  return formatIndicatorNumber(entry.value, entry.unit);
}

export function formatIndicatorNumber(value: number | undefined, unit: FinancialIndicator["unit"]): string {
  if (value === undefined || Number.isNaN(value)) {
    return "omitted";
  }
  if (unit === "currency") {
    return formatMoneyCompact(value);
  }
  if (unit === "pct") {
    return `${value.toFixed(1)}%`;
  }
  if (unit === "count") {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (unit === "multiple") {
    return `${value.toFixed(1)}x`;
  }
  return value.toFixed(2);
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatMoveLabel(spot: number | undefined, fairValue: number | undefined): string {
  if (spot === undefined || fairValue === undefined || spot === 0) {
    return "n/a";
  }
  const move = ((fairValue - spot) / spot) * 100;
  return `${move >= 0 ? "+" : ""}${move.toFixed(1)}%`;
}

export function formatReportDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function summarizeText(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function uniqueList(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function isSparseReport(report: AnalysisReport): boolean {
  const limitedSections =
    report.due_diligence?.sections.filter((section: Loose) => section.coverage_state === "limited").length ??
      0;
  const annualRows = report.financial_analysis?.annual_history.length ?? 0;
  return limitedSections >= 3 || annualRows < 3;
}
