// Builds chips, tiles, rows and cards from the report.
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import type { AnalysisReport, FinancialHistoryRow, Loose } from "../../reports/types.ts";

type InvestmentMemoSection = Loose;
type ValueDisciplineSignal = Loose;
import { reportLabelMap, reportSentenceMap } from "../../reports/label_map.ts";
import { collectStringList } from "./due_diligence.ts";
import {
  CanonicalDueDiligenceSectionId,
  ChangeCard,
  EvidenceCard,
  ExecutiveCard,
  FinancialTableRow,
  MarginChartView,
  MetricTile,
  PdfTone,
  QualityScoreRow,
  ReportChip,
  ScenarioColumn,
} from "./theme.ts";
import {
  computeMove,
  firstNonEmpty,
  formatFinancialAmount,
  formatPct,
  formatPrice,
  formatSignedPct,
  humanizeInlineWord,
  sanitizeInline,
  shortenText,
} from "./writer.ts";

export function buildSignalChips(report: AnalysisReport, missingCount: number): ReportChip[] {
  const signalValue = report.signal?.value ?? "no_signal";
  const signalLabel = signalValue === "positive"
    ? "Signal: Positive"
    : signalValue === "negative"
    ? "Signal: Negative"
    : signalValue === "neutral"
    ? "Signal: Neutral"
    : "Signal: Watch";

  const signalTone: PdfTone = signalValue === "positive"
    ? "positive"
    : signalValue === "negative"
    ? "negative"
    : signalValue === "neutral"
    ? "neutral"
    : "warning";

  const confidenceLabel = report.confidence.label === "high"
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
      tone: report.confidence.score >= 0.7
        ? "positive"
        : report.confidence.score >= 0.45
        ? "gold"
        : "warning",
    },
    valuationStance,
    coverageLabel,
  ];
}

export function buildQualityChips(report: AnalysisReport, missingCount: number): ReportChip[] {
  const score = report.value_discipline;
  return [
    {
      label: `Score: ${score ? `${score.score}/${score.max_score}` : "Limited"}`,
      tone: score && score.score >= Math.ceil(score.max_score * 0.66)
        ? "positive"
        : score
        ? "gold"
        : "warning",
    },
    {
      label: `Completeness: ${humanizeInlineWord(score?.completeness ?? "limited")}`,
      tone: score?.completeness === "complete"
        ? "positive"
        : score?.completeness === "partial"
        ? "gold"
        : "warning",
    },
    {
      label: `Missing inputs: ${String(missingCount)}`,
      tone: missingCount === 0 ? "positive" : missingCount <= 2 ? "gold" : "warning",
    },
  ];
}

export function buildValuationTiles(report: AnalysisReport): MetricTile[] {
  if (!report.valuation) {
    return [];
  }
  const tiles: MetricTile[] = [
    { label: "Low", value: formatPrice(report.valuation.fair_value_low), tone: "warning" },
    { label: "Spot", value: formatPrice(report.valuation.spot_price), tone: "neutral" },
    { label: "Base", value: formatPrice(report.valuation.fair_value_mid), tone: "gold" },
    { label: "High", value: formatPrice(report.valuation.fair_value_high), tone: "positive" },
  ];
  return tiles.filter((tile) => tile.value !== "n/a");
}

export function buildValuationStance(report: AnalysisReport): ReportChip {
  if (
    !report.valuation || report.valuation.spot_price === undefined ||
    report.valuation.fair_value_mid === undefined
  ) {
    return { label: "Valuation: Limited", tone: "warning" };
  }
  const spread = (report.valuation.fair_value_mid - report.valuation.spot_price) /
    report.valuation.spot_price;
  if (spread > 0.1) {
    return { label: "Valuation: Discount", tone: "positive" };
  }
  if (spread < -0.1) {
    return { label: "Valuation: Premium", tone: "negative" };
  }
  return { label: "Valuation: Near Base", tone: "gold" };
}

export function buildKillSwitchCards(report: AnalysisReport): ExecutiveCard[] {
  const conditions = report.kill_switch_conditions ?? [];
  if (conditions.length === 0) {
    return [
      {
        title: "Coverage note",
        body:
          "No explicit kill-switch rules were attached to this report, so the risk framing remains qualitative.",
        tone: "warning",
      },
    ];
  }

  return conditions.slice(0, 3).map((condition: Loose, index: Loose) => ({
    title: reportLabelMap(condition.signal_type),
    body: shortenText(condition.condition_text, 100),
    tone: index === 0 ? "warning" : index === 1 ? "gold" : "neutral",
  }));
}

export function buildCoverageChip(report: AnalysisReport, missingCount: number): ReportChip {
  if (missingCount === 0 && report.confidence.score >= 0.7) {
    return { label: "Coverage: Strong", tone: "positive" };
  }
  if (missingCount <= 2) {
    return { label: "Coverage: Moderate", tone: "gold" };
  }
  return { label: "Coverage: Limited", tone: "warning" };
}

export function buildChangeCards(report: AnalysisReport): ChangeCard[] {
  const changes = report.change_summary?.top_changes ?? [];
  if (changes.length === 0) {
    return [
      {
        title: "Fresh baseline",
        body:
          "No prior comparable report was available, so this memo establishes the current reference view.",
      },
      {
        title: "Current stance",
        body: shortenText(
          firstNonEmpty(
            report.story_header?.reader_takeaway,
            report.story_header?.thesis_summary,
            "The current stance should be treated as a working view.",
          ),
          130,
        ),
      },
      {
        title: "Attention point",
        body:
          "Future reports should focus on whether new evidence materially strengthens or weakens the current case.",
      },
    ];
  }

  const cards = changes.slice(0, 3).map((change: Loose) => ({
    title: shortenText(change.title, 34),
    body: shortenText(firstNonEmpty(change.why_it_matters, change.why_it_changed), 132),
  }));

  while (cards.length < 3) {
    if (cards.length === 1) {
      cards.push({
        title: "Coverage read",
        body: shortenText(
          firstNonEmpty(
            report.story_header?.reader_takeaway,
            report.coverage_truth?.summary,
            "The current memo is usable, but it still depends on continued evidence quality.",
          ),
          132,
        ),
      });
      continue;
    }
    cards.push({
      title: "Watch next",
      body: shortenText(
        firstNonEmpty(
          report.watch_items?.[0],
          report.kill_switch_conditions?.[0]?.condition_text,
          "The next review should focus on what could most quickly weaken the thesis.",
        ),
        132,
      ),
    });
  }

  return cards;
}

export function buildQualityRows(
  report: AnalysisReport,
  qualitySection: InvestmentMemoSection | undefined,
  risksSection: InvestmentMemoSection | undefined,
): QualityScoreRow[] {
  const signals = report.value_discipline?.signals ?? [];
  const profitability = findSignal(signals, (signal) => signal.family === "profitability");
  const margin = findSignal(
    signals,
    (signal) => signal.key === "operating_margin_up" || signal.family === "operating_efficiency",
  );
  const cashConversion = findSignal(
    signals,
    (signal) => signal.key === "cash_conversion_consistent" || signal.family === "earnings_quality",
  );
  const capitalDiscipline = findSignal(
    signals,
    (signal) => signal.key === "share_count_discipline" || signal.family === "capital_discipline",
  );
  const uncertaintyText = firstNonEmpty(
    buildMissingInputs(report)[0],
    risksSection?.key_points[0],
    report.kill_switch_conditions?.[0]?.condition_text,
    "The main uncertainty is whether fresh evidence continues to support the current base case.",
  );

  return [
    buildQualityRow(
      "Business model quality",
      firstNonEmpty(
        qualitySection?.narrative,
        report.story_header?.headline,
        "Business quality remains anchored to evidence rather than enthusiasm.",
      ),
      profitability,
      report.coverage_truth?.summary,
    ),
    buildQualityRow(
      "Margin resilience",
      firstNonEmpty(
        report.change_summary?.current_view,
        report.change_summary?.top_changes[0]?.why_it_changed,
        "Margin behavior should be watched for confirmation in the next reporting window.",
      ),
      margin,
      margin?.reason ?? report.story_header?.why_now,
    ),
    buildQualityRow(
      "Cash conversion",
      firstNonEmpty(
        report.story_header?.thesis_summary,
        "Free-cash-flow durability remains central to the investment case.",
      ),
      cashConversion,
      cashConversion?.reason ?? report.sections[0]?.evidence[0]?.excerpt,
    ),
    buildQualityRow(
      "Capital discipline",
      firstNonEmpty(
        report.value_discipline?.does_not_prove,
        "Capital allocation still matters even when operating quality looks supportive.",
      ),
      capitalDiscipline,
      capitalDiscipline?.reason ?? report.value_discipline?.interpretation,
    ),
    {
      factor: "Key uncertainty",
      reading: shortenText(
        firstNonEmpty(risksSection?.narrative, report.coverage_truth?.summary, uncertaintyText),
        92,
      ),
      signal: "Watch",
      tone: "warning",
      evidence: shortenText(uncertaintyText, 92),
    },
  ];
}

export function buildQualityRow(
  factor: string,
  reading: string,
  signal: ValueDisciplineSignal | undefined,
  evidenceFallback: string | undefined,
): QualityScoreRow {
  return {
    factor,
    reading: shortenText(reading, 92),
    signal: mapSignalStatus(signal?.status),
    tone: mapSignalTone(signal?.status),
    evidence: shortenText(
      firstNonEmpty(signal?.reason, evidenceFallback, "Evidence is limited for this factor."),
      92,
    ),
  };
}

export function buildFinancialView(annualHistory: FinancialHistoryRow[], noteOverride?: string): {
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
        values: history.map((row) => formatFinancialAmount(row.revenue)),
      },
      {
        label: "Gross margin",
        values: history.map((row) => formatPct(row.gross_margin)),
      },
      {
        label: "Operating margin",
        values: history.map((row) => formatPct(row.operating_margin)),
      },
      {
        label: "Free cash flow",
        values: history.map((row) => formatFinancialAmount(row.free_cash_flow)),
      },
      {
        label: "Revenue growth",
        values: revenueGrowth.map((value) => formatPct(value)),
      },
    ],
    note: firstNonEmpty(
      noteOverride,
      history.filter((row) => row.gross_margin !== undefined || row.operating_margin !== undefined).length >=
          2
        ? "Figures are shown in investor-friendly shorthand. Revenue and free cash flow are abbreviated for readability, while margins are shown as percentages."
        : "Only limited financial history was available, so the chart remains intentionally restrained.",
    ),
    chart:
      history.filter((row) => row.gross_margin !== undefined || row.operating_margin !== undefined).length >=
          2
        ? {
          labels: years,
          grossMargins: history.map((row) => row.gross_margin),
          operatingMargins: history.map((row) => row.operating_margin),
        }
        : undefined,
  };
}

export function buildScenarioColumns(
  report: AnalysisReport,
  valuationSection: InvestmentMemoSection | undefined,
  risksSection: InvestmentMemoSection | undefined,
): ScenarioColumn[] {
  if (!report.valuation) {
    const fallback = "Valuation was not available for this report.";
    return [
      {
        label: "Bear",
        fairValue: "n/a",
        impliedMove: "n/a",
        keyAssumption: fallback,
        mainRisk: fallback,
        tone: "warning",
      },
      {
        label: "Base",
        fairValue: "n/a",
        impliedMove: "n/a",
        keyAssumption: fallback,
        mainRisk: fallback,
        tone: "neutral",
      },
      {
        label: "Bull",
        fairValue: "n/a",
        impliedMove: "n/a",
        keyAssumption: fallback,
        mainRisk: fallback,
        tone: "gold",
      },
    ];
  }

  const spot = report.valuation.spot_price;
  const baseAssumption = `Uses the current base assumptions: ${
    formatPct(report.valuation.assumptions.wacc)
  } WACC and ${formatPct(report.valuation.assumptions.terminal_growth_rate)} terminal growth.`;
  const primaryRisk = shortenText(
    firstNonEmpty(
      risksSection?.key_points[0],
      report.kill_switch_conditions?.[0]?.condition_text,
      "Execution slips against the current base case.",
    ),
    82,
  );

  return [
    {
      label: "Bear",
      fairValue: formatPrice(report.valuation.fair_value_low),
      impliedMove: formatSignedPct(computeMove(report.valuation.fair_value_low, spot)),
      keyAssumption: "Downside assumes weaker conversion from revenue into durable margin and cash flow.",
      mainRisk: shortenText(firstNonEmpty(report.valuation.degraded_reason, primaryRisk), 82),
      tone: "warning",
    },
    {
      label: "Base",
      fairValue: formatPrice(report.valuation.fair_value_mid),
      impliedMove: formatSignedPct(computeMove(report.valuation.fair_value_mid, spot)),
      keyAssumption: shortenText(firstNonEmpty(valuationSection?.narrative, baseAssumption), 82),
      mainRisk: primaryRisk,
      tone: "neutral",
    },
    {
      label: "Bull",
      fairValue: formatPrice(report.valuation.fair_value_high),
      impliedMove: formatSignedPct(computeMove(report.valuation.fair_value_high, spot)),
      keyAssumption:
        "Upside requires stronger margin durability and cleaner free-cash-flow follow-through than the current base case.",
      mainRisk: "Upside fades quickly if execution misses or the valuation range compresses.",
      tone: "gold",
    },
  ];
}

export function buildEvidenceCards(
  report: AnalysisReport,
  dueDiligenceSection?: Record<string, unknown>,
): EvidenceCard[] {
  const diligenceHighlights = collectStringList(dueDiligenceSection, ["key_points", "bullets", "findings"]);
  if (diligenceHighlights.length > 0) {
    return diligenceHighlights.slice(0, 4).map((entry, index) => ({
      title: index === 0 ? "Lead support" : `Support ${index + 1}`,
      body: shortenText(entry, 100),
    }));
  }
  const cards: EvidenceCard[] = [];
  for (const section of report.sections) {
    for (const evidence of section.evidence) {
      cards.push({
        title: shortenText(section.title, 36),
        body: shortenText(evidence.excerpt, 100),
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
      body:
        "No evidence excerpts were attached to this report, so the export stays explicit about that limit.",
    },
    {
      title: "Coverage note",
      body: shortenText(
        firstNonEmpty(report.coverage_truth?.summary, "Evidence coverage is limited in this report."),
        100,
      ),
    },
  ];
}

export function buildMissingInputs(
  report: AnalysisReport,
  dueDiligence?: Partial<Record<CanonicalDueDiligenceSectionId, Record<string, unknown>>>,
): string[] {
  const notes = new Set<string>();
  for (const missing of report.coverage_truth?.missing ?? []) {
    notes.add(reportSentenceMap(missing));
  }
  for (const section of Object.values(dueDiligence ?? {})) {
    for (const omission of collectStringList(section, ["omissions", "missing", "limitations"])) {
      notes.add(shortenText(omission, 104));
    }
  }
  for (const omission of report.financial_analysis?.omissions ?? []) {
    notes.add(shortenText(`${reportLabelMap(omission.label)}: ${sanitizeInline(omission.reason)}`, 104));
  }
  for (const limitingFactor of report.confidence.limiting_factors ?? []) {
    notes.add(reportSentenceMap(limitingFactor));
  }
  return [...notes].slice(0, 5);
}

export function buildRiskItems(
  report: AnalysisReport,
  risksSection: InvestmentMemoSection | undefined,
  dueDiligenceSection?: Record<string, unknown>,
): string[] {
  const items = [
    ...collectStringList(dueDiligenceSection, ["key_points", "bullets", "findings"]),
    ...(risksSection?.key_points ?? []),
    ...(report.kill_switch_conditions ?? []).map((condition: Loose) =>
      `${reportLabelMap(condition.signal_type)}: ${sanitizeInline(condition.condition_text)}`
    ),
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
        "Risk coverage is limited because explicit risk items were not attached to this report.",
      ),
      100,
    ),
  ];
}

export function buildMindChangeItems(report: AnalysisReport): string[] {
  const items = [
    ...(report.watch_items ?? []),
    ...(report.kill_switch_conditions ?? []).map((condition: Loose) =>
      sanitizeInline(condition.condition_text)
    ),
  ]
    .map((item) => shortenText(item, 100))
    .filter((item) => item.length > 0);

  if (items.length > 0) {
    return items.slice(0, 5);
  }

  return [
    "A material shift in evidence quality, valuation support, or execution would warrant a fresh read of the thesis.",
  ];
}

export function findMemoSection(
  sections: InvestmentMemoSection[],
  sectionId: InvestmentMemoSection["section_id"],
): InvestmentMemoSection | undefined {
  return sections.find((section) => section.section_id === sectionId);
}

export function findSignal(
  signals: ValueDisciplineSignal[],
  predicate: (signal: ValueDisciplineSignal) => boolean,
): ValueDisciplineSignal | undefined {
  return signals.find(predicate);
}

export function mapSignalStatus(status: ValueDisciplineSignal["status"] | undefined): string {
  if (status === "pass") {
    return "Supportive";
  }
  if (status === "fail") {
    return "Concern";
  }
  return "Limited";
}

export function mapSignalTone(status: ValueDisciplineSignal["status"] | undefined): PdfTone {
  if (status === "pass") {
    return "positive";
  }
  if (status === "fail") {
    return "negative";
  }
  return "warning";
}

export function normalizeFinancialHistory(annualHistory: FinancialHistoryRow[]): FinancialHistoryRow[] {
  const sorted = [...annualHistory].sort((left, right) => left.fiscal_year - right.fiscal_year);
  if (sorted.length === 0) {
    return [
      { period: "FY-2022", period_type: "annual", fiscal_year: 2022 },
      { period: "FY-2023", period_type: "annual", fiscal_year: 2023 },
      { period: "FY-2024", period_type: "annual", fiscal_year: 2024 },
      { period: "FY-2025", period_type: "annual", fiscal_year: 2025 },
    ];
  }

  const lastYear = sorted[sorted.length - 1]?.fiscal_year ?? 2025;
  const targetYears = Array.from({ length: 4 }, (_, index) => lastYear - 3 + index);
  const rowsByYear = new Map(sorted.map((row) => [row.fiscal_year, row]));
  return targetYears.map((year) =>
    rowsByYear.get(year) ?? { period: `FY-${year}`, period_type: "annual", fiscal_year: year }
  );
}
