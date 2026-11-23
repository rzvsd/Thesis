// Due diligence view model and page list.
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import type { AnalysisReport, Loose } from "../../reports/types.ts";
import { reportLabelMap, reportSentenceMap } from "../../reports/label_map.ts";
import {
  drawAppendixPage,
  drawCompetitivePositioningPage,
  drawEvidenceBookPage,
  drawFinancialAppendixPage,
  drawRiskMonitoringPage,
  drawSparseConvictionPage,
  drawSparseDueDiligenceOverviewPage,
  drawValuationThesisStancePage,
  drawValueDisciplinePage,
} from "./pages_dd.ts";
import {
  drawEvidenceAndRiskPage,
  drawExecutiveMemoPage,
  drawFinancialStatementPage,
  drawThesisAndChangePage,
} from "./pages_memo.ts";
import {
  AnalysisReportWithDueDiligence,
  CanonicalDueDiligenceSectionId,
  DetailPair,
  DueDiligenceSectionView,
  DueDiligenceViewModel,
  FinancialTableRow,
  MetricTile,
  PdfPageContent,
  ReportViewModel,
} from "./theme.ts";
import { mapSignalStatus, mapSignalTone } from "./view_builders.ts";
import {
  firstNonEmpty,
  formatFinancialAmount,
  formatPct,
  formatPrice,
  hasAtLeastOneValue,
  sanitizeInline,
  shortenText,
} from "./writer.ts";

export function buildDueDiligencePdfPages(
  report: AnalysisReport,
  baseView: ReportViewModel,
  dueDiligence: Partial<Record<CanonicalDueDiligenceSectionId, Record<string, unknown>>>,
): PdfPageContent[] {
  const model = buildDueDiligenceViewModel(report, baseView, dueDiligence);
  if (model.sparse) {
    return [
      {
        title: "Executive Memo",
        draw: (commands, pageNumber, totalPages) =>
          drawExecutiveMemoPage(commands, model.base, pageNumber, totalPages),
      },
      {
        title: "Investment Memo",
        draw: (commands, pageNumber, totalPages) =>
          drawThesisAndChangePage(commands, model.base, pageNumber, totalPages),
      },
      {
        title: "Due Diligence Overview",
        draw: (commands, pageNumber, totalPages) =>
          drawSparseDueDiligenceOverviewPage(commands, model, pageNumber, totalPages),
      },
      {
        title: "Growth Outlook and Valuation",
        draw: (commands, pageNumber, totalPages) =>
          drawSparseConvictionPage(commands, model, pageNumber, totalPages),
      },
      {
        title: "Evidence and Risks",
        draw: (commands, pageNumber, totalPages) =>
          drawEvidenceAndRiskPage(commands, model.base, pageNumber, totalPages),
      },
      {
        title: "Appendix and Source Notes",
        draw: (commands, pageNumber, totalPages) => drawAppendixPage(commands, model, pageNumber, totalPages),
      },
    ];
  }

  return [
    {
      title: "Executive Memo",
      draw: (commands, pageNumber, totalPages) =>
        drawExecutiveMemoPage(commands, model.base, pageNumber, totalPages),
    },
    {
      title: "Investment Memo",
      draw: (commands, pageNumber, totalPages) =>
        drawThesisAndChangePage(commands, model.base, pageNumber, totalPages),
    },
    {
      title: "Financial Statement Analysis",
      draw: (commands, pageNumber, totalPages) =>
        drawFinancialStatementPage(commands, model.base, pageNumber, totalPages),
    },
    {
      title: "Competitive Positioning",
      draw: (commands, pageNumber, totalPages) =>
        drawCompetitivePositioningPage(commands, model, pageNumber, totalPages),
    },
    {
      title: "Management and Governance",
      draw: (commands, pageNumber, totalPages) =>
        drawFinancialAppendixPage(commands, model, pageNumber, totalPages),
    },
    {
      title: "Risks and Challenges",
      draw: (commands, pageNumber, totalPages) =>
        drawRiskMonitoringPage(commands, model, pageNumber, totalPages),
    },
    {
      title: "Growth Opportunities and Outlook",
      draw: (commands, pageNumber, totalPages) =>
        drawValueDisciplinePage(commands, model, pageNumber, totalPages),
    },
    {
      title: "Valuation and Thesis Stance",
      draw: (commands, pageNumber, totalPages) =>
        drawValuationThesisStancePage(commands, model, pageNumber, totalPages),
    },
    {
      title: "Evidence and Coverage",
      draw: (commands, pageNumber, totalPages) =>
        drawEvidenceBookPage(commands, model, pageNumber, totalPages),
    },
    {
      title: "Appendix and Source Notes",
      draw: (commands, pageNumber, totalPages) => drawAppendixPage(commands, model, pageNumber, totalPages),
    },
  ];
}

export function buildDueDiligenceViewModel(
  report: AnalysisReport,
  base: ReportViewModel,
  dueDiligence: Partial<Record<CanonicalDueDiligenceSectionId, Record<string, unknown>>>,
): DueDiligenceViewModel {
  const valueSignals = report.value_discipline?.signals ?? [];
  const valueSignalRows = valueSignals.slice(0, 6).map((signal: Loose) => ({
    label: sanitizeDisplayLabel(signal.label),
    family: reportLabelMap(signal.family),
    status: mapSignalStatus(signal.status),
    tone: mapSignalTone(signal.status),
    reason: shortenText(firstNonEmpty(signal.reason, "Supporting evidence is limited."), 96),
  }));
  const financialMetricTiles = [
    ...buildMetricTilesFromFinancialRows(base.financialRows),
    ...buildMetricTilesFromDerivedMetrics(report),
  ].slice(0, 4);
  const valuationAssumptions = buildValuationAssumptionPairs(report);
  const evidenceSupport = buildEvidenceSupportPairs(report);
  const appendixNotes = buildBulletSet([
    ...base.missingInputs,
    ...collectStringList(dueDiligence.financial_analysis, ["omissions", "missing", "limitations"]),
    ...collectStringList(dueDiligence.management_and_governance, ["omissions", "missing", "limitations"]),
    ...collectStringList(dueDiligence.valuation_and_thesis_stance, ["omissions", "missing", "limitations"]),
    ...collectStringList(dueDiligence.risks_and_challenges, ["omissions", "missing", "limitations"]),
  ], 6);
  const sourceNotes = buildSourceNotes(report);
  const annualPeriods = report.financial_analysis?.annual_history.filter((row: Loose) =>
    hasAtLeastOneValue([
      row.revenue,
      row.gross_margin,
      row.operating_margin,
      row.net_income,
      row.free_cash_flow,
      row.debt_total,
      row.cash_and_equivalents,
      row.shares_outstanding,
    ])
  ).length ?? 0;
  const sparse = annualPeriods < 3 ||
    !report.valuation?.fair_value_mid ||
    base.missingInputs.length >= 3 ||
    report.confidence.label === "low";

  return {
    base,
    sectionCount: Object.keys(dueDiligence).length,
    sparse,
    financialAnalysis: buildDueDiligenceSectionView("financial_analysis", dueDiligence.financial_analysis, {
      title: "Financial Statement Analysis",
      subtitle: "What the numbers show across revenue, margins, cash flow, and balance sheet.",
      summary: firstNonEmpty(base.financialNote, base.coverageNote),
      narrative: firstNonEmpty(base.financialNote, base.coverageNote),
      bullets: [
        ...base.financialRows.slice(0, 4).map((row) => `${row.label}: ${row.values.at(-1) ?? "--"}`),
        ...base.missingInputs.slice(0, 2),
      ],
      detailPairs: base.financialRows.slice(0, 4).map((row) => ({
        label: row.label,
        value: row.values.at(-1) ?? "--",
      })),
      omissions: [
        ...base.missingInputs,
        ...(report.financial_analysis?.omissions ?? []).map((entry: Loose) =>
          sanitizeDisplaySentence(entry.reason)
        ),
      ],
    }),
    competitivePositioning: buildDueDiligenceSectionView(
      "competitive_positioning",
      dueDiligence.competitive_positioning,
      {
        title: "Competitive Positioning",
        subtitle: "How the company earns, defends returns, and positions itself in the market.",
        summary: firstNonEmpty(base.qualityInterpretation, base.centralArgument),
        narrative: firstNonEmpty(base.qualityInterpretation, base.centralArgument),
        bullets: [
          ...base.qualityRows.slice(0, 3).map((row) => `${row.factor}: ${row.reading}`),
          ...base.riskItems.slice(0, 1),
        ],
        detailPairs: [
          { label: "Context", value: base.qualityContext },
          { label: "Signal", value: base.signalChips[0]?.label ?? "Signal: Watch" },
          { label: "Confidence", value: base.signalChips[1]?.label ?? "Confidence: Limited" },
        ],
        omissions: base.missingInputs,
      },
    ),
    managementAndGovernance: buildDueDiligenceSectionView(
      "management_and_governance",
      dueDiligence.management_and_governance,
      {
        title: "Management and Governance",
        subtitle: "Capital allocation, accountability, and execution discipline.",
        summary: firstNonEmpty(base.changeCards[0]?.body, base.coverageNote),
        narrative: firstNonEmpty(base.changeCards[0]?.body, base.coverageNote),
        bullets: [
          ...base.changeCards.map((card) => `${card.title}: ${card.body}`),
          ...base.mindChangeItems.slice(0, 1),
        ],
        detailPairs: [
          { label: "Capital discipline", value: base.qualityRows[3]?.reading ?? "Limited" },
          { label: "Operating stance", value: base.currentView },
          { label: "Governance watchpoint", value: base.riskItems[0] ?? "Limited" },
        ],
        omissions: base.missingInputs,
      },
    ),
    risksAndChallenges: buildDueDiligenceSectionView(
      "risks_and_challenges",
      dueDiligence.risks_and_challenges,
      {
        title: "Risks and Challenges",
        subtitle: "What could break the thesis and what evidence would force a new read.",
        summary: firstNonEmpty(base.riskItems[0], base.coverageNote),
        narrative: firstNonEmpty(base.riskItems[0], base.coverageNote),
        bullets: [...base.riskItems, ...base.mindChangeItems],
        detailPairs: (report.kill_switch_conditions ?? []).slice(0, 3).map((condition: Loose) => ({
          label: reportLabelMap(condition.signal_type),
          value: shortenText(condition.condition_text, 88),
        })),
        omissions: base.missingInputs,
      },
    ),
    growthOpportunitiesAndOutlook: buildDueDiligenceSectionView(
      "growth_opportunities_and_outlook",
      dueDiligence.growth_opportunities_and_outlook,
      {
        title: "Growth Opportunities and Outlook",
        subtitle: "Where upside could come from and what must still be confirmed.",
        summary: firstNonEmpty(base.implication, base.coverageNote),
        narrative: firstNonEmpty(base.implication, base.coverageNote),
        bullets: [
          ...base.changeCards.map((card) => `${card.title}: ${card.body}`),
          ...base.mindChangeItems.slice(0, 2),
        ],
        detailPairs: [
          { label: "Why now", value: base.executiveCards[0]?.body ?? base.implication },
          { label: "Current view", value: base.currentView },
          { label: "What to monitor", value: base.mindChangeItems[0] ?? "Limited" },
        ],
        omissions: base.missingInputs,
      },
    ),
    valuationAndThesisStance: buildDueDiligenceSectionView(
      "valuation_and_thesis_stance",
      dueDiligence.valuation_and_thesis_stance,
      {
        title: "Valuation and Thesis Stance",
        subtitle: "How valuation and conviction fit together in the current report.",
        summary: firstNonEmpty(base.valuationNarrative, base.centralArgument),
        narrative: firstNonEmpty(base.valuationNarrative, base.centralArgument),
        bullets: [
          ...base.scenarioColumns.map((column) => `${column.label}: ${column.keyAssumption}`),
          ...valueSignalRows.slice(0, 2).map((row: Loose) => `${row.label}: ${row.reason}`),
        ],
        detailPairs: [
          { label: "Framework", value: base.valuationFrameworkLabel },
          { label: "Base value", value: formatPrice(report.valuation?.fair_value_mid) },
          { label: "Spot price", value: formatPrice(report.valuation?.spot_price) },
          { label: "Stance", value: base.signalChips[0]?.label ?? "Signal: Watch" },
        ],
        omissions: base.missingInputs,
      },
    ),
    financialMetricTiles,
    valueSignalRows,
    valuationAssumptions,
    evidenceSupport,
    appendixNotes,
    sourceNotes,
  };
}

export function buildDueDiligenceSectionView(
  id: CanonicalDueDiligenceSectionId,
  rawSection: Record<string, unknown> | undefined,
  fallback: {
    title: string;
    subtitle: string;
    summary: string;
    narrative: string;
    bullets: string[];
    detailPairs: DetailPair[];
    omissions: string[];
  },
): DueDiligenceSectionView {
  return {
    id,
    title: sanitizeDisplayLabel(
      firstNonEmpty(extractSectionText(rawSection, ["title", "label"]), fallback.title),
    ),
    subtitle: shortenText(
      firstNonEmpty(extractSectionText(rawSection, ["subtitle", "eyebrow", "deck"]), fallback.subtitle),
      120,
    ),
    summary: shortenText(
      firstNonEmpty(
        extractSectionText(rawSection, ["summary", "body", "narrative", "narrative_paragraphs"]),
        fallback.summary,
      ),
      180,
    ),
    narrative: shortenText(
      firstNonEmpty(
        extractSectionText(rawSection, [
          "analysis",
          "narrative",
          "body",
          "conclusion",
          "narrative_paragraphs",
        ]),
        fallback.narrative,
      ),
      220,
    ),
    bullets: buildBulletSet(
      [
        ...collectStringList(rawSection, ["key_points", "bullets", "findings", "watch_items", "questions"]),
        ...fallback.bullets,
      ],
      6,
    ),
    detailPairs: buildDetailPairs([
      ...collectDetailPairs(rawSection, ["metrics", "items", "assumptions", "claims"]),
      ...fallback.detailPairs,
    ], 4),
    omissions: buildBulletSet(
      [
        ...collectStringList(rawSection, ["omissions", "missing", "limitations"]),
        ...fallback.omissions,
      ],
      4,
    ),
  };
}

export function extractDueDiligenceSectionMap(
  report: AnalysisReportWithDueDiligence,
): Partial<Record<CanonicalDueDiligenceSectionId, Record<string, unknown>>> | undefined {
  const block = report.due_diligence;
  if (!isRecord(block)) {
    return undefined;
  }

  const collected: Partial<Record<CanonicalDueDiligenceSectionId, Record<string, unknown>>> = {};
  const directAliases: Record<CanonicalDueDiligenceSectionId, string[]> = {
    financial_analysis: ["financial_analysis", "financial_statement_analysis"],
    competitive_positioning: ["competitive_positioning"],
    management_and_governance: ["management_and_governance"],
    risks_and_challenges: ["risks_and_challenges", "risks"],
    growth_opportunities_and_outlook: ["growth_opportunities_and_outlook"],
    valuation_and_thesis_stance: ["valuation_and_thesis_stance", "valuation"],
  };

  for (
    const [canonicalId, aliases] of Object.entries(directAliases) as Array<
      [CanonicalDueDiligenceSectionId, string[]]
    >
  ) {
    for (const alias of aliases) {
      const candidate = block[alias];
      if (isRecord(candidate)) {
        collected[canonicalId] = candidate;
        break;
      }
    }
  }

  const sections = block.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (!isRecord(section)) {
        continue;
      }
      const normalizedId = normalizeDueDiligenceSectionId(
        firstNonEmpty(
          readUnknownText(section.section_id),
          readUnknownText(section.id),
          readUnknownText(section.key),
          readUnknownText(section.kind),
          readUnknownText(section.title),
        ),
      );
      if (normalizedId && !collected[normalizedId]) {
        collected[normalizedId] = section;
      }
    }
  }

  return Object.keys(collected).length > 0 ? collected : undefined;
}

export function normalizeDueDiligenceSectionId(value: string): CanonicalDueDiligenceSectionId | undefined {
  const normalized = sanitizeInline(value).toLowerCase();
  if (normalized.includes("financial")) {
    return "financial_analysis";
  }
  if (normalized.includes("competitive")) {
    return "competitive_positioning";
  }
  if (normalized.includes("management") || normalized.includes("governance")) {
    return "management_and_governance";
  }
  if (normalized.includes("risk") || normalized.includes("challenge")) {
    return "risks_and_challenges";
  }
  if (normalized.includes("growth") || normalized.includes("outlook") || normalized.includes("opportun")) {
    return "growth_opportunities_and_outlook";
  }
  if (normalized.includes("valuation") || normalized.includes("stance") || normalized.includes("thesis")) {
    return "valuation_and_thesis_stance";
  }
  return undefined;
}

export function extractSectionText(
  section: Record<string, unknown> | undefined,
  fields: string[],
): string | undefined {
  if (!section) {
    return undefined;
  }
  for (const field of fields) {
    const value = section[field];
    const text = readUnknownText(value);
    if (text) {
      return text;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const candidate = readUnknownText(item);
        if (candidate) {
          return candidate;
        }
      }
    }
  }
  return undefined;
}

export function collectStringList(section: Record<string, unknown> | undefined, fields: string[]): string[] {
  if (!section) {
    return [];
  }
  const values: string[] = [];
  for (const field of fields) {
    const candidate = section[field];
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const text = readUnknownText(item);
        if (text) {
          values.push(sanitizeDisplaySentence(text));
        }
      }
      continue;
    }
    const text = readUnknownText(candidate);
    if (text) {
      values.push(sanitizeDisplaySentence(text));
    }
  }
  return values;
}

export function collectDetailPairs(
  section: Record<string, unknown> | undefined,
  fields: string[],
): DetailPair[] {
  if (!section) {
    return [];
  }
  const pairs: DetailPair[] = [];
  for (const field of fields) {
    const candidate = section[field];
    if (!Array.isArray(candidate)) {
      continue;
    }
    for (const item of candidate) {
      if (!isRecord(item)) {
        continue;
      }
      const label = sanitizeDisplayLabel(
        firstNonEmpty(
          readUnknownText(item.label),
          readUnknownText(item.title),
          readUnknownText(item.name),
          readUnknownText(item.key),
        ),
      );
      const value = sanitizeDisplaySentence(
        firstNonEmpty(
          readUnknownText(item.value),
          readUnknownText(item.summary),
          readUnknownText(item.body),
          readUnknownText(item.note),
        ),
      );
      if (label && value) {
        pairs.push({ label, value });
      }
    }
  }
  return pairs;
}

export function buildDetailPairs(pairs: DetailPair[], limit: number): DetailPair[] {
  const seen = new Set<string>();
  const next: DetailPair[] = [];
  for (const pair of pairs) {
    const label = sanitizeDisplayLabel(pair.label);
    const value = sanitizeDisplaySentence(pair.value);
    if (!label || !value) {
      continue;
    }
    const key = `${label}::${value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ label, value });
    if (next.length === limit) {
      break;
    }
  }
  return next;
}

export function buildBulletSet(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of items) {
    const normalized = sanitizeDisplaySentence(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(shortenText(normalized, 112));
    if (next.length === limit) {
      break;
    }
  }
  return next;
}

export function buildMetricTilesFromFinancialRows(rows: FinancialTableRow[]): MetricTile[] {
  return rows.slice(0, 4).map((row, index) => ({
    label: row.label,
    value: row.values.at(-1) ?? "--",
    tone: index === 0 ? "gold" : index === 1 ? "positive" : index === 2 ? "neutral" : "warning",
  }));
}

export function buildMetricTilesFromDerivedMetrics(report: AnalysisReport): MetricTile[] {
  const metrics = [
    ...(report.financial_analysis?.trend_metrics ?? []),
    ...(report.financial_analysis?.quality_metrics ?? []),
  ];
  return metrics.slice(0, 4).map((metric, index) => ({
    label: sanitizeDisplayLabel(metric.label),
    value: metric.unit === "pct"
      ? formatPct(metric.value)
      : metric.unit === "ratio"
      ? metric.value?.toFixed(2) ?? "--"
      : metric.unit === "count"
      ? metric.value?.toFixed(0) ?? "--"
      : formatFinancialAmount(metric.value),
    tone: metric.direction === "improving"
      ? "positive"
      : metric.direction === "deteriorating"
      ? "warning"
      : index % 2 === 0
      ? "gold"
      : "neutral",
  }));
}

export function buildValuationAssumptionPairs(report: AnalysisReport): DetailPair[] {
  if (!report.valuation) {
    return [{ label: "Valuation status", value: "Scenario math is not available in this report." }];
  }
  const assumptions = report.valuation.assumptions;
  return buildDetailPairs(
    [
      { label: "Methodology", value: reportLabelMap(assumptions.methodology) },
      { label: "Projection years", value: String(assumptions.projection_years) },
      { label: "Terminal growth", value: formatPct(assumptions.terminal_growth_rate) },
      { label: "WACC", value: formatPct(assumptions.wacc) },
    ],
    4,
  );
}

export function buildEvidenceSupportPairs(report: AnalysisReport): DetailPair[] {
  const pairs: DetailPair[] = [];
  for (const claim of report.investment_memo?.material_claims ?? []) {
    const support = claim.supports[0];
    if (!support) {
      continue;
    }
    pairs.push({
      label: shortenText(claim.statement, 48),
      value: shortenText(firstNonEmpty(support.summary, reportLabelMap(support.ref_id)), 92),
    });
    if (pairs.length === 4) {
      return pairs;
    }
  }
  if (pairs.length > 0) {
    return pairs;
  }
  return report.sections.slice(0, 4).map((section: Loose) => ({
    label: shortenText(section.title, 42),
    value: shortenText(
      firstNonEmpty(section.evidence[0]?.excerpt, section.body, "Source support is limited in this section."),
      92,
    ),
  }));
}

export function buildSourceNotes(report: AnalysisReport): string[] {
  const items = report.data_sources.map((source: Loose) => reportLabelMap(source));
  const ifNone = items.length > 0 ? items : ["Source notes were not attached to this report export."];
  return buildBulletSet(ifNone, 6);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readUnknownText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return sanitizeInline(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function sanitizeDisplayLabel(value: string): string {
  const safe = sanitizeInline(value);
  if (!safe) {
    return "";
  }
  return looksLikeInternalIdentifier(safe) ? reportLabelMap(safe) : safe;
}

export function sanitizeDisplaySentence(value: string): string {
  const safe = sanitizeInline(value);
  if (!safe) {
    return "";
  }
  return looksLikeInternalIdentifier(safe) ? reportSentenceMap(safe) : safe;
}

export function looksLikeInternalIdentifier(value: string): boolean {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(value);
}
