import { randomUUID } from "node:crypto";

import type {
  AnalysisReport,
  AnalysisRequest,
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  ChangeSummaryBlock,
  ConfidenceBlock,
  CoverageTruthBlock,
  DeepDiveExplainers,
  DeepDiveVisualPanel,
  EvidenceItem,
  InvestmentMemoBlock,
  KillSwitchConditionDraft,
  NameRelationshipDraft,
  ReportSection,
  SignalValue,
  StoryHeaderBlock,
  TopChangeItem,
  TrustMetadata,
  ValuationBlock
} from "../../../packages/contracts/src";
import {
  awaitPendingLangSmithTraces,
  createLangSmithRun,
  initLangSmith,
  initSentry,
  type LangSmithRun
} from "../../../packages/observability/src";

import { type DexterConfig, validateLiveModeConfig } from "./config";
import { buildComparisons } from "./comparisons";
import { computeDeterministicDcf } from "./dcf";
import {
  getFixtureHistoricalContext,
  getFixtureScenario,
  type FixtureScenario
} from "./fixtures";
import { buildFinancialAnalysis } from "./financial-analysis";
import { buildValueDisciplineScorecard } from "./value-discipline";
import {
  loadHistoricalContext,
  type ComparableDeepDiveSummary
} from "./historical-context";
import { runLiveDexterQuery } from "./live-dexter";
import { logError, logInfo, logWarn } from "./logging";
import { loadRuntimePrompts, renderPrompt, type LoadedPrompts } from "./prompt-store";
import { validateAnalysisReport } from "./schema-validation";
import {
  allSectionDefinitions,
  buildStatusBody,
  executableSectionDefinitions,
  selectSectionDefinitions,
  type SectionDefinition
} from "./sections";

const schemaVersion = "2.0";
const canonicalDisclaimer =
  "This is a research summary, not financial advice. Always do your own research.";

interface M2SectionContext {
  latest?: CanonicalFinancialSnapshot;
  priorQuarter?: CanonicalFinancialSnapshot;
  yearAgo?: CanonicalFinancialSnapshot;
  latestTranscript?: CanonicalTranscript;
  financials: CanonicalFinancialSnapshot[];
  transcripts: CanonicalTranscript[];
  context: NonNullable<AnalysisReport["historical_context"]>;
  comparableReport?: ComparableDeepDiveSummary;
  spotPrice?: number;
}

interface ExecutedSection {
  section: ReportSection;
  latencyMs: number;
  tokenCount: number;
}

function inferEvidenceSourceType(toolName: string): EvidenceItem["source_type"] {
  const normalized = toolName.toLowerCase();

  if (normalized.includes("filing") || normalized.includes("10k") || normalized.includes("10q")) {
    return "filing";
  }

  if (normalized.includes("news") || normalized.includes("article")) {
    return "article";
  }

  if (normalized.includes("macro") || normalized.includes("fred")) {
    return "macro_data";
  }

  return "financial_data";
}

function buildEvidenceFromToolCalls(
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    duration?: number;
  }>
): EvidenceItem[] {
  const retrievedAt = new Date().toISOString();

  return toolCalls
    .filter((toolCall) => toolCall.result.trim().length > 0)
    .slice(0, 5)
    .map((toolCall, index) => {
      const url = typeof toolCall.args.url === "string"
        ? toolCall.args.url
        : typeof toolCall.args.link === "string"
          ? toolCall.args.link
          : typeof toolCall.args.href === "string"
            ? toolCall.args.href
            : undefined;

      return {
        evidence_id: `${toolCall.tool}-${index}`,
        source_type: inferEvidenceSourceType(toolCall.tool),
        source_name: toolCall.tool,
        excerpt: toolCall.result.slice(0, 400),
        retrieved_at: retrievedAt,
        url
      };
    });
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(2)}%`;
}

function transcriptQuote(transcript: CanonicalTranscript | undefined): string | undefined {
  if (!transcript) {
    return undefined;
  }

  const normalized = transcript.body_text
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const sentence = normalized.split(/[.!?]/).find((entry) => entry.trim().length > 20);
  return sentence?.trim() ?? normalized.slice(0, 180);
}

function buildHistoricalEvidence(context: M2SectionContext): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  const retrievedAt = new Date().toISOString();

  if (context.latest) {
    evidence.push({
      evidence_id: `historical-${context.latest.snapshot_id}`,
      source_type: "financial_data",
      source_name: `historical:${context.latest.provider}`,
      excerpt: `${context.latest.ticker} ${context.latest.period} snapshot`,
      retrieved_at: retrievedAt
    });
  }

  const transcript = context.latestTranscript;
  if (transcript) {
    evidence.push({
      evidence_id: `transcript-${transcript.transcript_id}`,
      source_type: "article",
      source_name: `historical:${transcript.provider}`,
      excerpt: `${transcript.ticker} ${transcript.period} earnings call transcript`,
      retrieved_at: retrievedAt
    });
  }

  return evidence;
}

function buildThesisStatementSection(
  ticker: string,
  context: M2SectionContext
): ReportSection {
  const latestPeriod = context.latest?.period ?? "latest period";
  const qoqMissing = context.priorQuarter === undefined;
  const yoyMissing = context.yearAgo === undefined;
  const basis = [
    `${ticker} thesis: the current quarter (${latestPeriod}) shows execution strength, but conviction should track whether reported momentum survives the next filing cycle.`,
    qoqMissing
      ? "Quarter-over-quarter context is currently unavailable."
      : "Quarter-over-quarter context is available and included below.",
    yoyMissing
      ? "Year-over-year context is currently unavailable."
      : "Year-over-year context is available and included below."
  ].join(" ");

  return {
    section_id: "thesis_statement",
    title: "Thesis Statement",
    body: basis,
    status: "complete",
    evidence: buildHistoricalEvidence(context).slice(0, 2)
  };
}

function buildWhatChangedSection(context: M2SectionContext): ReportSection {
  const comparisons = buildComparisons({
    latest: context.latest,
    priorQuarter: context.priorQuarter,
    yearAgo: context.yearAgo
  });
  const missing: string[] = [];

  const qoqLines = comparisons.qoq.map((metric) => {
    if (metric.direction === "unavailable") {
      missing.push(`QoQ ${metric.metric}: ${metric.missing_reason ?? "missing."}`);
      return `QoQ ${metric.metric}: unavailable`;
    }

    return `QoQ ${metric.metric}: ${formatNumber(metric.current)} vs ${formatNumber(metric.reference)} (${formatPercent(metric.percent_change)})`;
  });

  const yoyLines = comparisons.yoy.map((metric) => {
    if (metric.direction === "unavailable") {
      missing.push(`YoY ${metric.metric}: ${metric.missing_reason ?? "missing."}`);
      return `YoY ${metric.metric}: unavailable`;
    }

    return `YoY ${metric.metric}: ${formatNumber(metric.current)} vs ${formatNumber(metric.reference)} (${formatPercent(metric.percent_change)})`;
  });

  const segmentLine = context.latest?.segments && context.latest.segments.length > 0
    ? `Segment context: ${context.latest.segments
      .slice(0, 3)
      .map((segment) => `${segment.segment_name} (${formatNumber(segment.revenue)} revenue)`)
      .join(", ")}.`
    : "Segment context unavailable in the current historical snapshot.";
  if (!context.latest?.segments || context.latest.segments.length === 0) {
    missing.push("Segment data unavailable.");
  }

  const quote = transcriptQuote(context.latestTranscript);
  const quoteLine = quote
    ? `Management quote: "${quote}."`
    : "Transcript quote unavailable for the latest quarter.";
  if (!quote) {
    missing.push("Transcript quote unavailable.");
  }

  const status = missing.length > 0 ? "data_incomplete" : "complete";
  const detail = missing.length > 0
    ? ` Missing details: ${missing.join(" ")}`
    : "";

  return {
    section_id: "what_changed",
    title: "What Changed",
    body: `${qoqLines.join(" ")} ${yoyLines.join(" ")} ${segmentLine} ${quoteLine}${detail}`.trim(),
    status,
    evidence: buildHistoricalEvidence(context)
  };
}

function buildValuationSection(
  ticker: string,
  context: M2SectionContext
): { section: ReportSection; valuation?: ValuationBlock } {
  const dcfResult = computeDeterministicDcf({
    snapshots: context.financials,
    spotPrice: context.spotPrice
  });

  if (!dcfResult.valuation) {
    return {
      section: {
        section_id: "valuation",
        title: "Valuation",
        body: `Valuation is degraded for ${ticker}: ${
          dcfResult.degradedReason ?? "deterministic DCF inputs were insufficient."
        }`,
        status: "data_incomplete",
        evidence: buildHistoricalEvidence(context)
      },
      valuation: {
        assumptions: {
          methodology: "deterministic_dcf",
          projection_years: 5,
          terminal_growth_rate: 0.025,
          wacc: 0.1
        },
        degraded_reason: dcfResult.degradedReason ?? "Deterministic DCF inputs insufficient."
      }
    };
  }

  const valuation = dcfResult.valuation;
  const body = [
    `Deterministic DCF fair-value mid: ${formatNumber(valuation.fair_value_mid)} per share`,
    `(range ${formatNumber(valuation.fair_value_low)} to ${formatNumber(valuation.fair_value_high)}).`,
    valuation.spot_price !== undefined
      ? `Spot reference: ${formatNumber(valuation.spot_price)}; implied upside ${formatPercent(valuation.implied_upside_pct)}.`
      : "Spot reference unavailable from the current live quote path; valuation is still computed from historical cash-flow data.",
    `Assumptions: WACC ${formatPercent(valuation.assumptions.wacc * 100)}, terminal growth ${formatPercent(valuation.assumptions.terminal_growth_rate * 100)}, projection horizon ${valuation.assumptions.projection_years} years.`
  ].join(" ");

  return {
    section: {
      section_id: "valuation",
      title: "Valuation",
      body,
      status: "complete",
      evidence: buildHistoricalEvidence(context)
    },
    valuation
  };
}

function humanizeMetric(metric: string): string {
  return metric
    .split("_")
    .map((token) => token.toUpperCase() === "EPS"
      ? "EPS"
      : token.replace(/^./, (letter) => letter.toUpperCase()))
    .join(" ");
}

function summarizeText(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function describeSignal(signalValue: SignalValue): StoryHeaderBlock["stance_label"] {
  if (signalValue === "positive" || signalValue === "neutral" || signalValue === "negative") {
    return signalValue;
  }
  return "watch";
}

function changeDirectionFromMetric(
  direction: "up" | "down" | "flat" | "unavailable"
): TopChangeItem["direction"] {
  if (direction === "up" || direction === "down") {
    return direction;
  }
  if (direction === "flat") {
    return "mixed";
  }
  return "watch";
}

function formatMetricDelta(current: number | undefined, reference: number | undefined): string {
  if (current === undefined || reference === undefined) {
    return "comparison unavailable";
  }
  return `${formatNumber(current)} vs ${formatNumber(reference)}`;
}

function buildTopChanges(context: M2SectionContext, trustMetadata: TrustMetadata): TopChangeItem[] {
  const comparisons = buildComparisons({
    latest: context.latest,
    priorQuarter: context.priorQuarter,
    yearAgo: context.yearAgo
  });

  const rankedComparisons = [...comparisons.qoq, ...comparisons.yoy]
    .filter((metric) => metric.direction !== "unavailable")
    .sort((left, right) => Math.abs(right.percent_change ?? 0) - Math.abs(left.percent_change ?? 0))
    .slice(0, 3)
    .map((metric, index) => ({
      title: `${metric.metric === "revenue" ? "Revenue" : humanizeMetric(metric.metric)} ${index === 0 ? "reset the tone" : "shifted"}`,
      direction: changeDirectionFromMetric(metric.direction),
      impact_level: index === 0 ? "high" : index === 1 ? "medium" : "low",
      why_it_changed: `${humanizeMetric(metric.metric)} moved ${metric.direction} at ${formatMetricDelta(metric.current, metric.reference)} (${formatPercent(metric.percent_change)}).`,
      why_it_matters: `That matters because Thesis is tracking whether ${humanizeMetric(metric.metric).toLowerCase()} is reinforcing or weakening the current conviction path.`
    } satisfies TopChangeItem));

  if (trustMetadata.thesis_drift.status === "available") {
    rankedComparisons.unshift({
      title: "The thesis itself moved",
      direction: "mixed",
      impact_level: "high",
      why_it_changed: trustMetadata.thesis_drift.summary,
      why_it_matters: trustMetadata.thesis_drift.reasons[0] ??
        "The most valuable Deep Dive question is whether the current evidence changed the original view."
    });
  }

  return rankedComparisons.slice(0, 3);
}

function buildStoryHeader(args: {
  ticker: string;
  thesisStatement: string;
  signalValue: SignalValue;
  trustMetadata: TrustMetadata;
  topChanges: TopChangeItem[];
}): StoryHeaderBlock {
  const freshnessLine = args.trustMetadata.freshness_state === "fresh"
    ? "The evidence base is still fresh."
    : args.trustMetadata.freshness_state === "degraded"
      ? "Parts of the evidence base are aging."
      : "This thesis is now stale and needs a fresh review.";
  const strongestChange = args.topChanges[0]?.why_it_changed ??
    "The latest filing cycle did not produce a clean first-order change signal.";

  return {
    headline: `${args.ticker}: ${summarizeText(args.thesisStatement, 96)}`,
    thesis_summary: summarizeText(args.thesisStatement, 150),
    why_now: summarizeText(`${strongestChange} ${freshnessLine}`, 160),
    reader_takeaway: summarizeText(
      `Start with what changed, then read the valuation and trust panels before deciding whether the thesis still deserves confidence.`,
      150
    ),
    stance_label: describeSignal(args.signalValue)
  };
}

function buildChangeSummary(args: {
  context: M2SectionContext;
  signalValue: SignalValue;
  trustMetadata: TrustMetadata;
  topChanges: TopChangeItem[];
}): ChangeSummaryBlock {
  const previousView = args.context.comparableReport?.thesis_statement?.trim()
    || "No prior comparable thesis was stored, so this report becomes the new baseline.";
  const latestPeriod = args.context.latest?.period ?? "the latest reporting period";
  const currentView = `${latestPeriod} now points to a ${args.signalValue === "no_signal" ? "watchful" : args.signalValue} stance, with ${
    args.trustMetadata.thesis_drift.status === "available"
      ? "an explicit thesis-drift summary attached."
      : "no prior thesis drift comparison available."
  }`;

  return {
    previous_view: summarizeText(previousView, 170),
    current_view: summarizeText(currentView, 170),
    top_changes: args.topChanges
  };
}

function buildVisualPanels(args: {
  context: M2SectionContext;
  trustMetadata: TrustMetadata;
  valuation?: ValuationBlock;
  signalEvidence: EvidenceItem[];
}): DeepDiveVisualPanel[] {
  const comparisons = buildComparisons({
    latest: args.context.latest,
    priorQuarter: args.context.priorQuarter,
    yearAgo: args.context.yearAgo
  });

  const panels: DeepDiveVisualPanel[] = [
    {
      type: "trust_scorecard",
      title: "Trust and Freshness",
      eyebrow: "SEE THE STORY",
      summary: "Read this before you trust the rest of the report.",
      freshness_state: args.trustMetadata.freshness_state,
      contradiction_state: args.trustMetadata.contradiction_state,
      valuation_state: args.trustMetadata.valuation_state,
      evidence_count: args.trustMetadata.evidence_count
    }
  ];

  const qoqMetrics = comparisons.qoq.slice(0, 3).map((metric) => ({
    label: humanizeMetric(metric.metric),
    current_value: metric.current,
    reference_value: metric.reference,
    delta_pct: metric.percent_change,
    basis: "qoq" as const,
    direction: metric.direction,
    note: metric.missing_reason
  }));
  if (qoqMetrics.some((metric) => metric.current_value !== undefined || metric.note !== undefined)) {
    panels.push({
      type: "metric_delta",
      title: "Quarter-over-quarter moves",
      summary: "The fastest way to see whether execution really changed.",
      metrics: qoqMetrics
    });
  }

  const yoyMetrics = comparisons.yoy.slice(0, 3).map((metric) => ({
    label: humanizeMetric(metric.metric),
    current_value: metric.current,
    reference_value: metric.reference,
    delta_pct: metric.percent_change,
    basis: "yoy" as const,
    direction: metric.direction,
    note: metric.missing_reason
  }));
  if (yoyMetrics.some((metric) => metric.current_value !== undefined || metric.note !== undefined)) {
    panels.push({
      type: "metric_delta",
      title: "Year-over-year moves",
      summary: "This keeps one-off quarter noise from dominating the story.",
      metrics: yoyMetrics
    });
  }

  panels.push({
    type: "timeline",
    title: "Reporting timeline",
    summary: "A quick timeline of the periods this report can actually compare.",
    points: [
      {
        label: "Current quarter",
        value: args.context.latest?.period ?? "Unavailable",
        emphasis: "current"
      },
      {
        label: "Prior quarter",
        value: args.context.priorQuarter?.period ?? "Unavailable",
        emphasis: "reference"
      },
      {
        label: "Year ago",
        value: args.context.yearAgo?.period ?? "Unavailable",
        emphasis: "reference"
      },
      {
        label: "Last transcript",
        value: args.context.latestTranscript?.period ?? "Unavailable",
        emphasis: "milestone"
      }
    ]
  });

  if (args.valuation) {
    if (
      args.valuation.fair_value_low !== undefined ||
      args.valuation.fair_value_mid !== undefined ||
      args.valuation.fair_value_high !== undefined ||
      args.valuation.spot_price !== undefined
    ) {
      panels.push({
        type: "range_band",
        title: "Valuation range",
        summary: args.valuation.degraded_reason
          ? args.valuation.degraded_reason
          : "The deterministic DCF range shows what the current cash-flow path supports.",
        low_value: args.valuation.fair_value_low,
        mid_value: args.valuation.fair_value_mid,
        high_value: args.valuation.fair_value_high,
        reference_value: args.valuation.spot_price,
        value_label: "Fair value",
        reference_label: "Spot"
      });
      panels.push({
        type: "valuation_bridge",
        title: "Valuation bridge",
        summary: "This shows where spot sits against the modeled valuation band.",
        points: [
          ...(args.valuation.spot_price !== undefined
            ? [{ label: "Spot", value: args.valuation.spot_price, tone: "spot" as const }]
            : []),
          ...(args.valuation.fair_value_low !== undefined
            ? [{ label: "Low", value: args.valuation.fair_value_low, tone: "low" as const }]
            : []),
          ...(args.valuation.fair_value_mid !== undefined
            ? [{ label: "Mid", value: args.valuation.fair_value_mid, tone: "mid" as const }]
            : []),
          ...(args.valuation.fair_value_high !== undefined
            ? [{ label: "High", value: args.valuation.fair_value_high, tone: "high" as const }]
            : [])
        ]
      });
    }
  }

  const evidenceByType = new Map<string, number>();
  args.signalEvidence.forEach((item) => {
    evidenceByType.set(item.source_type, (evidenceByType.get(item.source_type) ?? 0) + 1);
  });
  panels.push({
    type: "evidence_ladder",
    title: "Evidence ladder",
    summary: "This is where the report is standing: filings first, then data, then supporting commentary.",
    rungs: [
      {
        label: "Filings",
        count: evidenceByType.get("filing") ?? 0,
        tone: "strong"
      },
      {
        label: "Financial data",
        count: evidenceByType.get("financial_data") ?? 0,
        tone: "moderate"
      },
      {
        label: "Articles and macro",
        count: (evidenceByType.get("article") ?? 0) + (evidenceByType.get("macro_data") ?? 0),
        tone: "light"
      }
    ]
  });

  return panels;
}

function buildExplainers(args: {
  signalValue: SignalValue;
  confidence: ConfidenceBlock;
  trustMetadata: TrustMetadata;
  valuation?: ValuationBlock;
}): DeepDiveExplainers {
  const confidenceText = args.confidence.limiting_factors.length > 0
    ? args.confidence.limiting_factors.join(" ")
    : "The current confidence is broad-based and not being held back by one dominant missing input.";
  const omissions = args.trustMetadata.missing_data_notes.length > 0
    ? args.trustMetadata.missing_data_notes.join(" ")
    : "No major omissions were recorded beyond the normal limits of the current source set.";

  return {
    signal: args.signalValue === "no_signal"
      ? "Signal is set to watch because the current evidence did not clear the bar for a directional call."
      : `Signal is ${args.signalValue}, which means the strongest evidence currently leans ${args.signalValue}.`,
    confidence: `Confidence is ${args.confidence.label} at ${Math.round(args.confidence.score * 100)} out of 100. ${confidenceText}`,
    freshness: `Freshness is ${args.trustMetadata.freshness_state}. This tells you whether the thesis is current, aging, or stale before you rely on it.`,
    valuation: args.valuation?.degraded_reason
      ? `Valuation is present but degraded: ${args.valuation.degraded_reason}`
      : "Valuation comes from the deterministic DCF block. It is a disciplined range, not a promise.",
    omissions
  };
}

function companyAngleForTicker(ticker: string): string {
  switch (ticker.trim().toUpperCase()) {
    case "AAPL":
      return "installed-base monetization and ecosystem pricing power";
    case "MSFT":
      return "enterprise cloud, productivity bundling, and AI monetization discipline";
    case "TSLA":
      return "volume growth durability versus margin pressure in auto and energy scale-up";
    default:
      return "execution quality, cash conversion, and valuation discipline";
  }
}

function extractComparisonLine(args: {
  context: M2SectionContext;
  metric: "revenue" | "operating_margin" | "free_cash_flow";
  basis: "qoq" | "yoy";
}): {
  line: string;
  refId: string;
  available: boolean;
  direction?: "up" | "down" | "flat" | "unavailable";
  deltaPct?: number;
} {
  const comparisons = buildComparisons({
    latest: args.context.latest,
    priorQuarter: args.context.priorQuarter,
    yearAgo: args.context.yearAgo
  });
  const source = args.basis === "qoq" ? comparisons.qoq : comparisons.yoy;
  const metric = source.find((entry) => entry.metric === args.metric);

  if (!metric || metric.direction === "unavailable") {
    return {
      line: `${humanizeMetric(args.metric)} ${args.basis.toUpperCase()} comparison is unavailable from current inputs.`,
      refId: `${args.basis}:${args.metric}`,
      available: false
    };
  }

  return {
    line: `${humanizeMetric(args.metric)} moved ${metric.direction} (${formatPercent(metric.percent_change)} ${args.basis.toUpperCase()}) at ${formatMetricDelta(metric.current, metric.reference)}.`,
    refId: `${args.basis}:${args.metric}`,
    available: true,
    direction: metric.direction,
    deltaPct: metric.percent_change
  };
}

function buildInvestmentMemo(args: {
  ticker: string;
  signalValue: SignalValue;
  confidence: ConfidenceBlock;
  trustMetadata: TrustMetadata;
  context: M2SectionContext;
  valuation?: ValuationBlock;
  valueDiscipline: NonNullable<AnalysisReport["value_discipline"]>;
  financialAnalysis: NonNullable<AnalysisReport["financial_analysis"]>;
  signalEvidence: EvidenceItem[];
  promptVersion: string;
  fixtureMode: boolean;
}): InvestmentMemoBlock {
  const ticker = args.ticker.trim().toUpperCase();
  const companyAngle = companyAngleForTicker(ticker);
  const revenueQoq = extractComparisonLine({
    context: args.context,
    metric: "revenue",
    basis: "qoq"
  });
  const marginQoq = extractComparisonLine({
    context: args.context,
    metric: "operating_margin",
    basis: "qoq"
  });
  const fcfYoy = extractComparisonLine({
    context: args.context,
    metric: "free_cash_flow",
    basis: "yoy"
  });
  const missingSummary = args.trustMetadata.missing_data_notes.length > 0
    ? args.trustMetadata.missing_data_notes.join(" ")
    : "No major omission note is currently flagged.";
  const valuationSummary = args.valuation?.degraded_reason
    ? `Valuation is degraded because ${args.valuation.degraded_reason}.`
    : args.valuation?.fair_value_mid !== undefined
      ? `Deterministic valuation is centered near ${formatNumber(args.valuation.fair_value_mid)} with explicit scenario bounds.`
      : "Valuation is currently omission-forward because deterministic assumptions are incomplete.";
  const decisionQuestion = `Does ${ticker} still justify confidence on ${companyAngle}, or did the latest evidence shift the thesis into watch mode?`;
  const openingArgument = args.signalValue === "positive"
    ? `${ticker} keeps a constructive thesis because ${companyAngle} is still translating into measurable operating outcomes.`
    : args.signalValue === "negative"
      ? `${ticker} now reads defensively because recent evidence weakens the prior thesis on ${companyAngle}.`
      : args.signalValue === "neutral"
        ? `${ticker} remains balanced: the thesis on ${companyAngle} is intact, but the latest evidence does not justify a stronger directional call.`
        : `${ticker} is currently a watch-case because evidence quality is not yet strong enough to support a directional thesis on ${companyAngle}.`;

  const sections: InvestmentMemoBlock["sections"] = [
    {
      section_id: "investment_thesis",
      title: "Investment Thesis",
      narrative: `${openingArgument} Confidence is ${args.confidence.label} (${Math.round(args.confidence.score * 100)}/100), and the decision still depends on whether execution remains durable through the next filing cycle.`,
      key_points: [
        `Decision question: ${decisionQuestion}`,
        `Current signal: ${args.signalValue}`,
        `Confidence limiter: ${args.confidence.limiting_factors[0] ?? "No single dominant limiter flagged."}`
      ]
    },
    {
      section_id: "what_changed",
      title: "What Changed",
      narrative: `${revenueQoq.line} ${marginQoq.line} Thesis drift status is ${args.trustMetadata.thesis_drift.status}: ${args.trustMetadata.thesis_drift.summary}`,
      key_points: [
        revenueQoq.line,
        marginQoq.line,
        `Thesis drift: ${args.trustMetadata.thesis_drift.summary}`
      ]
    },
    {
      section_id: "business_quality",
      title: "Business Quality",
      narrative: `${ticker}'s quality lens is anchored on ${companyAngle}. ${fcfYoy.line} Value-discipline context is ${args.valueDiscipline.context_label} with score ${args.valueDiscipline.score}/${args.valueDiscipline.max_score}.`,
      key_points: [
        `Quality angle: ${companyAngle}`,
        fcfYoy.line,
        `Value context: ${args.valueDiscipline.context_label}`
      ]
    },
    {
      section_id: "valuation",
      title: "Valuation",
      narrative: valuationSummary,
      key_points: [
        args.valuation?.fair_value_mid !== undefined
          ? `Fair-value midpoint: ${formatNumber(args.valuation.fair_value_mid)}`
          : "Fair-value midpoint unavailable.",
        args.valuation?.implied_upside_pct !== undefined
          ? `Implied upside: ${formatPercent(args.valuation.implied_upside_pct)}`
          : "Implied upside unavailable.",
        args.valuation?.degraded_reason
          ? `Degraded reason: ${args.valuation.degraded_reason}`
          : "Deterministic assumptions are available."
      ]
    },
    {
      section_id: "risks",
      title: "Risks",
      narrative: args.valueDiscipline.value_trap_warning.triggered
        ? `${args.valueDiscipline.value_trap_warning.summary} ${missingSummary}`
        : `Primary risk controls remain evidence freshness and omission visibility. ${missingSummary}`,
      key_points: [
        args.valueDiscipline.value_trap_warning.summary,
        `Freshness state: ${args.trustMetadata.freshness_state}`,
        `Missing-data note: ${args.trustMetadata.missing_data_notes[0] ?? "No major missing-data note."}`
      ]
    }
  ];

  const evidenceSupport = args.signalEvidence[0];
  const materialClaims: InvestmentMemoBlock["material_claims"] = [
    {
      claim_id: "claim-thesis-direction",
      section_id: "investment_thesis",
      statement: openingArgument,
      materiality: "material",
      supports: revenueQoq.available
        ? [
            {
              support_type: "metric",
              ref_id: revenueQoq.refId,
              summary: revenueQoq.line
            }
          ]
        : evidenceSupport
          ? [
              {
                support_type: "evidence",
                ref_id: evidenceSupport.evidence_id,
                summary: summarizeText(evidenceSupport.excerpt, 120)
              }
            ]
          : [
              {
                support_type: "omission",
                ref_id: "trust:missing_data_notes",
                summary: args.trustMetadata.missing_data_notes[0] ?? "Evidence depth is currently constrained."
              }
            ]
    },
    {
      claim_id: "claim-valuation-range",
      section_id: "valuation",
      statement: valuationSummary,
      materiality: "material",
      supports: args.valuation?.fair_value_mid !== undefined
        ? [
            {
              support_type: "metric",
              ref_id: "valuation:fair_value_mid",
              summary: `Fair-value midpoint ${formatNumber(args.valuation.fair_value_mid)}.`
            }
          ]
        : [
            {
              support_type: "omission",
              ref_id: "valuation:degraded_reason",
              summary: args.valuation?.degraded_reason ?? "Valuation inputs are insufficient."
            }
          ]
    },
    {
      claim_id: "claim-risk-controls",
      section_id: "risks",
      statement: sections.find((section) => section.section_id === "risks")?.narrative ??
        "Risk controls require explicit omission handling.",
      materiality: "material",
      supports: args.trustMetadata.missing_data_notes.length > 0
        ? [
            {
              support_type: "omission",
              ref_id: "trust:missing_data_notes",
              summary: args.trustMetadata.missing_data_notes[0] ?? "Missing-data note available."
            }
          ]
        : [
            {
              support_type: "metric",
              ref_id: "value_discipline:score",
              summary: `Value-discipline score ${args.valueDiscipline.score}/${args.valueDiscipline.max_score}.`
            }
          ]
    }
  ];

  const sparseDataHonestyNote = args.financialAnalysis.omissions.length > 0
    ? `Sparse-data handling is active: ${args.financialAnalysis.omissions[0]?.reason ?? "financial inputs are incomplete."}`
    : "Sparse-data handling is inactive for this report because core financial inputs are present.";

  return {
    prompt_version: args.promptVersion,
    generation_mode: args.fixtureMode ? "deterministic_fixture" : "fallback",
    company_angle: companyAngle,
    decision_question: decisionQuestion,
    sections,
    material_claims: materialClaims,
    unsupported_claims: [],
    sparse_data_honesty_note: sparseDataHonestyNote
  };
}

function buildCoverageTruth(args: {
  context: M2SectionContext;
  trustMetadata: TrustMetadata;
  sections: ReportSection[];
  financialAnalysis: AnalysisReport["financial_analysis"];
  valueDiscipline: AnalysisReport["value_discipline"];
}): CoverageTruthBlock {
  const covered = [
    args.context.latest?.period ? `Latest financial snapshot (${args.context.latest.period})` : undefined,
    args.context.priorQuarter?.period ? `Prior-quarter comparison (${args.context.priorQuarter.period})` : undefined,
    args.context.yearAgo?.period ? `Year-ago comparison (${args.context.yearAgo.period})` : undefined,
    args.context.latestTranscript?.period ? `Management transcript (${args.context.latestTranscript.period})` : undefined,
    (args.financialAnalysis?.annual_history.length ?? 0) > 0
      ? `Financial history table (${args.financialAnalysis?.annual_history.length} annual rows)`
      : undefined,
    args.sections.some((section) => section.section_id === "valuation")
      ? "Deterministic DCF valuation block"
      : undefined
  ].filter((item): item is string => Boolean(item));

  const financialOmissions = args.financialAnalysis?.omissions.map(
    (omission) => `${omission.label}: ${omission.reason}`
  ) ?? [];
  const valueOmissions = args.valueDiscipline?.missing_signals.map(
    (signal) => `Value signal unavailable: ${signal}`
  ) ?? [];
  const missing = [
    ...args.trustMetadata.missing_data_notes,
    ...financialOmissions,
    ...valueOmissions
  ];

  return {
    summary: summarizeText(
      `This report covers the latest company data Thesis could verify and explicitly lists what is missing instead of filling gaps with guesses.`,
      160
    ),
    covered,
    missing: missing.length > 0
      ? Array.from(new Set(missing))
      : ["No material omission notes were recorded."]
  };
}

function buildWatchItems(
  trustMetadata: TrustMetadata,
  killSwitchConditions: KillSwitchConditionDraft[],
  valueDiscipline: AnalysisReport["value_discipline"]
): string[] {
  const items = [
    trustMetadata.thesis_drift.summary,
    ...killSwitchConditions.slice(0, 2).map((condition) => condition.condition_text),
    valueDiscipline?.value_trap_warning.triggered
      ? valueDiscipline.value_trap_warning.summary
      : undefined,
    trustMetadata.missing_data_notes[0]
  ]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => summarizeText(item, 120));

  return Array.from(new Set(items)).slice(0, 4);
}

async function resolveM2SectionContext(
  request: AnalysisRequest,
  config: DexterConfig
): Promise<M2SectionContext> {
  if (config.fixtureMode) {
    const fixtureTicker = normalizedTickerForFixture(request.ticker ?? "MSFT");
    const fixture = getFixtureHistoricalContext(fixtureTicker);
    const latestQuarterly = fixture.financials
      .filter((snapshot) => snapshot.period_type === "quarterly")
      .sort((left, right) => {
        const yearDiff = right.fiscal_year - left.fiscal_year;
        if (yearDiff !== 0) {
          return yearDiff;
        }
        return (right.fiscal_quarter ?? 0) - (left.fiscal_quarter ?? 0);
      });
    const latest = latestQuarterly[0];
    const priorQuarter = latestQuarterly[1];
    const yearAgo = latestQuarterly.find((snapshot) =>
      snapshot.fiscal_year === (latest?.fiscal_year ?? 0) - 1 &&
      snapshot.fiscal_quarter === latest?.fiscal_quarter
    );
    const transcript = fixture.transcripts[0];

    return {
      latest,
      priorQuarter,
      yearAgo,
      latestTranscript: transcript,
      financials: fixture.financials,
      transcripts: fixture.transcripts,
      comparableReport: fixtureTicker === "LIMITED"
        ? undefined
        : {
            report_id: `${fixtureTicker}-prior-thesis`,
            generated_at: "2026-01-15T09:00:00.000Z",
            schema_version: "2.0",
            ticker: fixtureTicker,
            signal_value: "neutral",
            confidence_label: "medium",
            confidence_score: 0.58,
            thesis_statement:
              "Prior thesis: execution was stable but lacked strong directional confirmation.",
            valuation_mid: fixture.spotPrice ? fixture.spotPrice * 1.04 : undefined
          },
      spotPrice: fixture.spotPrice,
      context: {
        latest_period: latest?.period,
        prior_quarter_period: priorQuarter?.period,
        year_ago_period: yearAgo?.period,
        transcript_period: transcript?.period,
        financial_snapshot_count: fixture.financials.length,
        transcript_count: fixture.transcripts.length,
        transcript_available: transcript !== undefined,
        missing_reasons: []
      }
    };
  }

  const loaded = await loadHistoricalContext(request, config);
  return {
    latest: loaded.latest,
    priorQuarter: loaded.priorQuarter,
    yearAgo: loaded.yearAgo,
    latestTranscript: loaded.latestTranscript,
    financials: loaded.financials,
    transcripts: loaded.transcripts,
    comparableReport: loaded.comparableReport,
    context: loaded.context
  };
}

function normalizedTickerForFixture(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();
  return normalized.length > 0 ? normalized : "MSFT";
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function collectSignalEvidence(sections: ReportSection[]): EvidenceItem[] {
  return sections.flatMap((section) => section.evidence);
}

function buildExecutiveSummary(
  ticker: string,
  sections: ReportSection[],
  signalValue: SignalValue,
  investmentMemo?: InvestmentMemoBlock
): ReportSection {
  const completeCount = sections.filter((section) => section.status === "complete").length;
  const degradedCount = sections.length - completeCount;
  const memoOpening = investmentMemo?.sections.find(
    (section) => section.section_id === "investment_thesis"
  )?.narrative;
  const body = degradedCount === 0
    ? `${memoOpening ?? `${ticker} completed the deep-dive path with all primary sections available.`} The current research signal is ${signalValue}. ${canonicalDisclaimer}`
    : `${memoOpening ?? `${ticker} completed the deep-dive path with ${degradedCount} degraded section(s).`} The current research signal is ${signalValue}, and the report explicitly notes every gap instead of filling it with assumptions. ${canonicalDisclaimer}`;

  return {
    section_id: "executive_summary",
    title: "Executive Summary",
    body,
    status: "complete",
    evidence: collectSignalEvidence(sections).slice(0, 3)
  };
}

function buildResearchSignalSection(
  signalValue: SignalValue,
  reasons: string[],
  evidence: EvidenceItem[]
): ReportSection {
  return {
    section_id: "research_signal",
    title: "Research Signal",
    body: `Research signal: ${signalValue}. ${reasons.join(" ")}`.trim(),
    status: "complete",
    evidence
  };
}

function buildConfidenceSection(confidence: ConfidenceBlock): ReportSection {
  return {
    section_id: "confidence_score",
    title: "Confidence Score and Limiting Factors",
    body: `Confidence score ${confidence.score.toFixed(2)} (${confidence.label}). Limiting factors: ${confidence.limiting_factors.join(" ")}`.trim(),
    status: "complete",
    evidence: []
  };
}

function buildEvidenceReferenceSection(evidence: EvidenceItem[]): ReportSection {
  const body = evidence.length === 0
    ? "No scored evidence references were available for this run. The report remains honest by returning no_signal instead of inventing support."
    : evidence.map((item) => `${item.source_name}: ${item.excerpt}`).join("\n");

  return {
    section_id: "evidence_references",
    title: "Evidence References",
    body,
    status: "complete",
    evidence
  };
}

function buildValueDisciplineSection(
  valueDiscipline: NonNullable<AnalysisReport["value_discipline"]>
): ReportSection {
  const status: ReportSection["status"] = valueDiscipline.completeness === "complete"
    ? "complete"
    : valueDiscipline.completeness === "partial"
      ? "data_incomplete"
      : "data_unavailable";
  const body = [
    `Value-discipline score: ${valueDiscipline.score}/${valueDiscipline.max_score} (${valueDiscipline.available_signals} signals available).`,
    `Context: ${valueDiscipline.context_label}.`,
    valueDiscipline.interpretation,
    valueDiscipline.missing_signals.length > 0
      ? `Missing signals: ${valueDiscipline.missing_signals.join("; ")}.`
      : "No scorecard inputs were missing.",
    valueDiscipline.does_not_prove
  ].join(" ");

  return {
    section_id: "value_discipline",
    title: "Value Discipline",
    body,
    status,
    evidence: []
  };
}

function buildSignal(
  jobId: string,
  config: DexterConfig,
  scenario: FixtureScenario | undefined,
  sections: ReportSection[]
): NonNullable<AnalysisReport["signal"]> {
  const evidence = collectSignalEvidence(
    sections.filter((section) => section.status === "complete")
  );
  const requiredEvidenceCount = Math.max(config.minSignalEvidenceCount, 1);

  if (evidence.length < requiredEvidenceCount || scenario?.signalValue === "no_signal") {
    const reasons = scenario?.signalReasons ?? [
      `Evidence count ${evidence.length} is below the minimum threshold of ${requiredEvidenceCount}.`
    ];

    logWarn("Evidence threshold not met", {
      job_id: jobId,
      score_state: "no_signal",
      limiting_factors: reasons
    });

    return {
      value: "no_signal",
      reasons,
      evidence: evidence.slice(0, requiredEvidenceCount)
    };
  }

  return {
    value: scenario?.signalValue ?? "neutral",
    reasons: scenario?.signalReasons ?? ["Signal generated from completed sections."],
    evidence: evidence.slice(0, requiredEvidenceCount)
  };
}

function buildFlags(
  scenario: FixtureScenario | undefined,
  sections: ReportSection[],
  signalValue: SignalValue,
  traceMode: "mock" | "live" | "disabled"
): string[] {
  const flags = new Set(scenario?.flags ?? []);

  sections.forEach((section) => {
    if (section.status !== "complete") {
      flags.add(`${section.section_id}:${section.status}`);
    }
  });

  if (signalValue === "no_signal") {
    flags.add("signal_insufficient_data");
  }

  if (traceMode === "mock") {
    flags.add("langsmith_trace_mock");
  }

  if (traceMode === "disabled") {
    flags.add("langsmith_trace_unverified");
  }

  return [...flags];
}

function buildDataSources(
  scenario: FixtureScenario | undefined,
  sections: ReportSection[]
): string[] {
  if (scenario) {
    return scenario.sources;
  }

  const sources = new Set<string>(["dexter-native:agent"]);
  sections.flatMap((section) => section.evidence).forEach((item) => {
    sources.add(item.source_name);
  });
  return [...sources];
}

function uniqueEvidenceItems(sections: ReportSection[]): EvidenceItem[] {
  const deduped = new Map<string, EvidenceItem>();
  for (const section of sections) {
    for (const item of section.evidence) {
      const key = item.evidence_id.trim().length > 0
        ? item.evidence_id
        : `${item.source_name}|${item.excerpt.slice(0, 64)}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    }
  }
  return [...deduped.values()];
}

function freshnessStateFromSources(
  context: M2SectionContext,
  generatedAt: string
): { state: TrustMetadata["freshness_state"]; note: string } {
  const candidates = [context.latest?.retrieved_at, context.latestTranscript?.retrieved_at]
    .filter((entry): entry is string => typeof entry === "string" && !Number.isNaN(Date.parse(entry)));

  if (candidates.length === 0) {
    return {
      state: "stale",
      note: "Source freshness could not be verified from retrievable timestamps."
    };
  }

  const newestSourceIso = [...candidates].sort((left, right) =>
    Date.parse(right) - Date.parse(left))[0] ?? generatedAt;
  const ageDays = Math.max(
    0,
    Math.floor((Date.parse(generatedAt) - Date.parse(newestSourceIso)) / (24 * 60 * 60 * 1000))
  );
  if (ageDays <= 45) {
    return {
      state: "fresh",
      note: `Latest source timestamp is ${ageDays} day(s) old.`
    };
  }
  if (ageDays <= 120) {
    return {
      state: "degraded",
      note: `Latest source timestamp is ${ageDays} day(s) old and may be stale for fast-moving narratives.`
    };
  }
  return {
    state: "stale",
    note: `Latest source timestamp is ${ageDays} day(s) old and should be treated as stale.`
  };
}

function quoteProvenanceFromContext(
  context: M2SectionContext
): TrustMetadata["quote_provenance"] {
  const transcript = context.latestTranscript;
  const quote = transcriptQuote(transcript);
  if (!transcript || !quote) {
    return [];
  }

  return [
    {
      quote,
      source_name: `transcript:${transcript.provider}`,
      source_type: "article",
      source_period: transcript.period,
      transcript_id: transcript.transcript_id,
      retrieved_at: transcript.retrieved_at
    }
  ];
}

function contradictionSummaryFromContext(
  context: M2SectionContext,
  signalValue: SignalValue
): TrustMetadata["contradictions"] {
  const contradictions: TrustMetadata["contradictions"] = [];
  const comparisons = buildComparisons({
    latest: context.latest,
    priorQuarter: context.priorQuarter,
    yearAgo: context.yearAgo
  });

  const qoqRevenue = comparisons.qoq.find((entry) => entry.metric === "revenue");
  const qoqNetIncome = comparisons.qoq.find((entry) => entry.metric === "net_income");
  if (qoqRevenue?.direction === "up" && qoqNetIncome?.direction === "down") {
    contradictions.push({
      id: "qoq_revenue_vs_profitability",
      description:
        "Quarter-over-quarter revenue improved while net income declined, which weakens conviction in operating quality.",
      severity: "medium"
    });
  }

  const yoyRevenue = comparisons.yoy.find((entry) => entry.metric === "revenue");
  const yoyFreeCashFlow = comparisons.yoy.find((entry) => entry.metric === "free_cash_flow");
  if (yoyRevenue?.direction === "up" && yoyFreeCashFlow?.direction === "down") {
    contradictions.push({
      id: "yoy_revenue_vs_cashflow",
      description:
        "Year-over-year revenue improved while free cash flow declined, signaling possible quality dilution in growth.",
      severity: "medium"
    });
  }

  if (
    signalValue === "positive" &&
    yoyRevenue?.direction === "down"
  ) {
    contradictions.push({
      id: "signal_vs_yoy_revenue",
      description:
        "Signal is positive while year-over-year revenue is down, so directional confidence should be treated as fragile.",
      severity: "high"
    });
  }

  if (
    signalValue === "negative" &&
    yoyRevenue?.direction === "up"
  ) {
    contradictions.push({
      id: "negative_signal_vs_yoy_revenue",
      description:
        "Signal is negative while year-over-year revenue is up, so downside conviction may be overstated.",
      severity: "high"
    });
  }

  return contradictions;
}

function buildThesisDriftSummary(input: {
  comparable?: ComparableDeepDiveSummary;
  currentSignal: SignalValue;
  currentConfidence: ConfidenceBlock;
  currentThesis?: string;
}): TrustMetadata["thesis_drift"] {
  const comparable = input.comparable;
  if (!comparable) {
    return {
      status: "unavailable",
      summary:
        "Comparable prior thesis is unavailable in the 120-day lookback window.",
      reasons: ["No comparable completed report was found for this ticker and schema family."]
    };
  }

  const reasons: string[] = [];
  if (
    comparable.signal_value &&
    comparable.signal_value !== input.currentSignal
  ) {
    reasons.push(
      `Signal shifted from ${comparable.signal_value} to ${input.currentSignal}.`
    );
  } else {
    reasons.push(`Signal remained ${input.currentSignal}.`);
  }

  if (typeof comparable.confidence_score === "number") {
    const delta = input.currentConfidence.score - comparable.confidence_score;
    if (Math.abs(delta) >= 0.1) {
      reasons.push(
        `Confidence moved by ${(delta * 100).toFixed(1)} points versus the prior thesis.`
      );
    } else {
      reasons.push("Confidence remained broadly stable versus the prior thesis.");
    }
  }

  if (
    comparable.thesis_statement &&
    input.currentThesis &&
    comparable.thesis_statement.trim().toLowerCase() !==
      input.currentThesis.trim().toLowerCase()
  ) {
    reasons.push("Core thesis framing changed materially from the prior report.");
  }

  return {
    status: "available",
    summary: `Compared with the prior thesis from ${comparable.generated_at.slice(0, 10)}, ${reasons.join(" ")}`,
    reasons,
    comparable_report_id: comparable.report_id,
    comparable_generated_at: comparable.generated_at,
    comparable_schema_version: comparable.schema_version
  };
}

function buildTrustMetadata(input: {
  generatedAt: string;
  context: M2SectionContext;
  sections: ReportSection[];
  signal: NonNullable<AnalysisReport["signal"]>;
  confidence: ConfidenceBlock;
  valuation?: ValuationBlock;
  thesisStatement?: string;
}): TrustMetadata {
  const allEvidence = uniqueEvidenceItems(input.sections);
  const freshness = freshnessStateFromSources(input.context, input.generatedAt);
  const contradictions = contradictionSummaryFromContext(input.context, input.signal.value);
  const valuationState: TrustMetadata["valuation_state"] =
    input.valuation === undefined
      ? "omitted"
      : input.valuation.fair_value_mid === undefined || input.valuation.degraded_reason
        ? "degraded"
        : "available";

  const missingDataNotes = [...input.context.context.missing_reasons];
  missingDataNotes.push(freshness.note);

  if (valuationState === "omitted") {
    missingDataNotes.push("Valuation block omitted due to insufficient deterministic DCF inputs.");
  } else if (valuationState === "degraded") {
    missingDataNotes.push(
      input.valuation?.degraded_reason ??
        "Valuation block is degraded because deterministic DCF inputs are partial."
    );
  }

  const degradedSections = input.sections
    .filter((section) => section.status !== "complete")
    .map((section) => section.title);
  if (degradedSections.length > 0) {
    missingDataNotes.push(`Degraded report sections: ${degradedSections.join(", ")}.`);
  }

  const quoteProvenance = quoteProvenanceFromContext(input.context);
  if (quoteProvenance.length === 0) {
    missingDataNotes.push("No traceable management quote was available in the latest transcript context.");
  }

  return {
    generated_at: input.generatedAt,
    freshness_state: freshness.state,
    evidence_count: allEvidence.length,
    contradiction_state: contradictions.length > 0 ? "present" : "none",
    contradictions,
    valuation_state: valuationState,
    missing_data_notes: [...new Set(missingDataNotes)],
    quote_provenance: quoteProvenance,
    thesis_drift: buildThesisDriftSummary({
      comparable: input.context.comparableReport,
      currentSignal: input.signal.value,
      currentConfidence: input.confidence,
      currentThesis: input.thesisStatement
    })
  };
}

interface KillSwitchExtractionResult {
  conditions: KillSwitchConditionDraft[];
  tokenCount: number;
  source: "prompt" | "fallback";
}

interface NameRelationshipExtractionResult {
  relationships: NameRelationshipDraft[];
  tokenCount: number;
  source: "prompt" | "fallback";
}

function normalizeKillSwitchSignalType(
  value: string | undefined
): KillSwitchConditionDraft["signal_type"] {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "price_move_pct":
    case "price_move":
      return "price_move_pct";
    case "thesis_state":
    case "thesis_drift":
      return "thesis_state";
    case "earnings_event":
    case "earnings":
      return "earnings_event";
    case "sec_filing":
    case "filing":
      return "sec_filing";
    case "guidance_revision":
    case "guidance":
      return "guidance_revision";
    case "management_change":
      return "management_change";
    case "macro_regime":
    case "macro":
      return "macro_regime";
    case "analyst_rerating":
    case "analyst":
      return "analyst_rerating";
    case "news_sentiment":
    case "sentiment":
      return "news_sentiment";
    default:
      return "custom";
  }
}

function normalizeKillSwitchDirection(
  value: string | undefined
): KillSwitchConditionDraft["direction"] | undefined {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "against_signal" ||
    normalized === "above" ||
    normalized === "below" ||
    normalized === "any"
  ) {
    return normalized;
  }
  return undefined;
}

function normalizeKillSwitchThresholdUnit(
  value: string | undefined
): KillSwitchConditionDraft["threshold_unit"] | undefined {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "pct" ||
    normalized === "count" ||
    normalized === "score" ||
    normalized === "days"
  ) {
    return normalized;
  }
  return undefined;
}

function parseJsonArrayCandidate(text: string): unknown[] | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through to bracket extraction fallback
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parsePromptKillSwitchConditions(input: {
  answer: string;
  promptVersion: string;
}): KillSwitchConditionDraft[] {
  const parsed = parseJsonArrayCandidate(input.answer);
  if (!parsed) {
    return [];
  }

  const conditions: KillSwitchConditionDraft[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const conditionText = typeof candidate.condition_text === "string"
      ? candidate.condition_text.trim()
      : "";
    const rationale = typeof candidate.rationale === "string"
      ? candidate.rationale.trim()
      : "";
    if (conditionText.length === 0 || rationale.length === 0) {
      continue;
    }

    const signalType = normalizeKillSwitchSignalType(
      typeof candidate.signal_type === "string" ? candidate.signal_type : undefined
    );
    const direction = normalizeKillSwitchDirection(
      typeof candidate.direction === "string" ? candidate.direction : undefined
    );
    const thresholdUnit = normalizeKillSwitchThresholdUnit(
      typeof candidate.threshold_unit === "string" ? candidate.threshold_unit : undefined
    );
    const thresholdValue =
      typeof candidate.threshold_value === "number" && Number.isFinite(candidate.threshold_value)
        ? candidate.threshold_value
        : undefined;
    const rawId = typeof candidate.condition_id === "string"
      ? candidate.condition_id.trim()
      : "";
    const conditionId = rawId.length > 0 ? rawId : `ks_${index + 1}`;

    conditions.push({
      condition_id: conditionId,
      condition_text: conditionText,
      signal_type: signalType,
      rationale,
      ...(thresholdValue !== undefined ? { threshold_value: thresholdValue } : {}),
      ...(thresholdUnit ? { threshold_unit: thresholdUnit } : {}),
      ...(direction ? { direction } : {}),
      prompt_version: input.promptVersion
    });
  }

  return conditions.slice(0, 5);
}

function buildFallbackKillSwitchConditions(input: {
  signal: NonNullable<AnalysisReport["signal"]>;
  confidence: ConfidenceBlock;
  promptVersion: string;
}): KillSwitchConditionDraft[] {
  const signal = input.signal.value;
  const directionalText =
    signal === "positive"
      ? "against your positive thesis"
      : signal === "negative"
        ? "against your negative thesis"
        : "against your active thesis signal";

  return [
    {
      condition_id: "ks_price_against_signal",
      condition_text: "Price moves 5% against the thesis anchor.",
      signal_type: "price_move_pct",
      rationale: `Detects immediate market divergence ${directionalText}.`,
      threshold_value: 5,
      threshold_unit: "pct",
      direction: "against_signal",
      prompt_version: input.promptVersion
    },
    {
      condition_id: "ks_thesis_state_degrades",
      condition_text: "Thesis monitor state becomes weakened or unresolved.",
      signal_type: "thesis_state",
      rationale:
        "Captures structural thesis degradation from monitor recompute, not only price volatility.",
      direction: "any",
      prompt_version: input.promptVersion
    },
    {
      condition_id: "ks_earnings_negative_surprise",
      condition_text: "Earnings event introduces a material surprise versus thesis assumptions.",
      signal_type: "earnings_event",
      rationale:
        "Prioritizes quarterly events that can quickly invalidate assumptions.",
      direction: "any",
      prompt_version: input.promptVersion
    },
    {
      condition_id: "ks_sec_material_filing",
      condition_text: "A material SEC filing introduces contradiction to the thesis.",
      signal_type: "sec_filing",
      rationale:
        "Tracks hard-signal regulatory filings that change risk posture.",
      direction: "any",
      prompt_version: input.promptVersion
    },
    {
      condition_id: "ks_guidance_revision",
      condition_text: "Management guidance is revised in a direction that weakens conviction.",
      signal_type: "guidance_revision",
      rationale: `Protects conviction when confidence (${input.confidence.score.toFixed(2)}) no longer matches updated guidance.`,
      direction: "any",
      prompt_version: input.promptVersion
    }
  ];
}

async function extractKillSwitchConditions(input: {
  request: AnalysisRequest;
  config: DexterConfig;
  prompts: LoadedPrompts;
  signal: NonNullable<AnalysisReport["signal"]>;
  confidence: ConfidenceBlock;
  thesisStatement?: string;
  rootTrace?: LangSmithRun;
  model: string;
}): Promise<KillSwitchExtractionResult> {
  const fallback = buildFallbackKillSwitchConditions({
    signal: input.signal,
    confidence: input.confidence,
    promptVersion: input.prompts.killSwitchExtractor.version
  });
  if (input.config.fixtureMode) {
    return {
      conditions: fallback,
      tokenCount: 0,
      source: "fallback"
    };
  }

  const query = renderPrompt(input.prompts.killSwitchExtractor, {
    ticker: input.request.ticker ?? "",
    signal_value: input.signal.value,
    confidence_label: input.confidence.label,
    confidence_score: input.confidence.score.toFixed(2),
    thesis_statement: input.thesisStatement ?? "Thesis statement unavailable."
  });

  const trace = input.rootTrace?.createChild({
    name: "dexter.kill_switch_extractor",
    run_type: "chain",
    inputs: {
      job_id: input.request.job_id,
      ticker: input.request.ticker ?? "",
      prompt_version: input.prompts.killSwitchExtractor.version
    },
    metadata: {
      service: "dexter-worker",
      job_id: input.request.job_id,
      ticker: input.request.ticker ?? "",
      prompt_version: input.prompts.killSwitchExtractor.version,
      model: input.model
    }
  });
  if (trace) {
    await trace.postRun();
  }

  try {
    const result = await runLiveDexterQuery(
      query,
      input.config,
      input.config.retrySectionTimeoutMs,
      1
    );
    const parsed = parsePromptKillSwitchConditions({
      answer: result.answer,
      promptVersion: input.prompts.killSwitchExtractor.version
    });
    if (parsed.length >= 3) {
      if (trace) {
        await trace.end(
          {
            status: "complete",
            rule_count: parsed.length,
            token_count: result.tokenCount
          },
          undefined,
          undefined,
          {
            service: "dexter-worker",
            job_id: input.request.job_id,
            ticker: input.request.ticker ?? "",
            prompt_version: input.prompts.killSwitchExtractor.version
          }
        );
        await trace.patchRun();
      }
      return {
        conditions: parsed.slice(0, 5),
        tokenCount: result.tokenCount,
        source: "prompt"
      };
    }

    logWarn("Kill-switch extractor fallback applied due to insufficient parsed conditions", {
      job_id: input.request.job_id,
      ticker: input.request.ticker,
      parsed_count: parsed.length,
      prompt_version: input.prompts.killSwitchExtractor.version
    });
    if (trace) {
      await trace.end(
        {
          status: "fallback",
          rule_count: fallback.length,
          token_count: result.tokenCount
        },
        "Insufficient prompt conditions; fallback used.",
        undefined,
        {
          service: "dexter-worker",
          job_id: input.request.job_id,
          ticker: input.request.ticker ?? "",
          prompt_version: input.prompts.killSwitchExtractor.version
        }
      );
      await trace.patchRun();
    }
    return {
      conditions: fallback,
      tokenCount: result.tokenCount,
      source: "fallback"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("Kill-switch extractor failed; fallback applied", {
      job_id: input.request.job_id,
      ticker: input.request.ticker,
      error_message: message,
      prompt_version: input.prompts.killSwitchExtractor.version
    });
    if (trace) {
      await trace.end(
        {
          status: "fallback",
          rule_count: fallback.length
        },
        message,
        undefined,
        {
          service: "dexter-worker",
          job_id: input.request.job_id,
          ticker: input.request.ticker ?? "",
          prompt_version: input.prompts.killSwitchExtractor.version
        }
      );
      await trace.patchRun();
    }
    return {
      conditions: fallback,
      tokenCount: 0,
      source: "fallback"
    };
  }
}

function normalizeTickerSymbol(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function normalizeNameRelationshipType(
  value: string | undefined
): NameRelationshipDraft["relationship_type"] | undefined {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "supplier":
    case "supply":
    case "vendor":
      return "supplier";
    case "competitor":
    case "competitive":
    case "rival":
      return "competitor";
    case "partner":
    case "partnership":
    case "customer":
      return "partner";
    case "sector":
    case "industry":
    case "macro":
      return "sector";
    default:
      return undefined;
  }
}

function parsePromptNameRelationships(input: {
  answer: string;
  promptVersion: string;
  ticker: string;
}): NameRelationshipDraft[] | undefined {
  const parsed = parseJsonArrayCandidate(input.answer);
  if (!parsed) {
    return undefined;
  }

  const fallbackTarget = normalizeTickerSymbol(input.ticker);
  const relationships: NameRelationshipDraft[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const sourceTicker = normalizeTickerSymbol(
      typeof candidate.source_ticker === "string" ? candidate.source_ticker : undefined
    );
    const targetTicker = normalizeTickerSymbol(
      typeof candidate.target_ticker === "string" ? candidate.target_ticker : fallbackTarget
    );
    const relationshipType = normalizeNameRelationshipType(
      typeof candidate.relationship_type === "string" ? candidate.relationship_type : undefined
    );
    const confidence =
      typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : undefined;
    const evidenceText = typeof candidate.evidence_text === "string"
      ? candidate.evidence_text.trim()
      : "";
    const rationale = typeof candidate.rationale === "string"
      ? candidate.rationale.trim()
      : "";

    if (
      sourceTicker.length === 0 ||
      targetTicker.length === 0 ||
      sourceTicker === targetTicker ||
      !relationshipType ||
      confidence === undefined ||
      evidenceText.length === 0 ||
      rationale.length === 0
    ) {
      continue;
    }

    const key = `${sourceTicker}:${targetTicker}:${relationshipType}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    relationships.push({
      source_ticker: sourceTicker,
      target_ticker: targetTicker,
      relationship_type: relationshipType,
      confidence,
      evidence_text: evidenceText.slice(0, 500),
      rationale: rationale.slice(0, 500),
      prompt_version: input.promptVersion
    });
  }

  return relationships.slice(0, 10);
}

function buildRelationshipReportText(input: {
  thesisStatement?: string;
  sections: ReportSection[];
}): string {
  const parts = [
    input.thesisStatement ?? "",
    ...input.sections.flatMap((section) => [
      section.title,
      section.body,
      ...section.evidence.map((evidence) => evidence.excerpt)
    ])
  ];

  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n")
    .slice(0, 12_000);
}

const relationshipTickerStopWords = new Set([
  "AI",
  "API",
  "CEO",
  "CFO",
  "DCF",
  "EPS",
  "ETF",
  "FY",
  "GAAP",
  "GDP",
  "LLM",
  "QOQ",
  "SEC",
  "US",
  "USA",
  "USD",
  "YOY"
]);

function relationshipTypeFromSentence(
  sentence: string
): NameRelationshipDraft["relationship_type"] | undefined {
  const normalized = sentence.toLowerCase();

  if (/\b(supplies|supplier|supply|vendor|input|component)\b/.test(normalized)) {
    return "supplier";
  }

  if (/\b(competes|competitor|competitive|rival|share shift)\b/.test(normalized)) {
    return "competitor";
  }

  if (/\b(partner|partnership|customer|client|distribution)\b/.test(normalized)) {
    return "partner";
  }

  if (/\b(sector|industry|macro|rates|dollar|inflation|etf)\b/.test(normalized)) {
    return "sector";
  }

  return undefined;
}

function fallbackConfidenceForRelationship(
  relationshipType: NameRelationshipDraft["relationship_type"]
): number {
  switch (relationshipType) {
    case "supplier":
      return 0.74;
    case "competitor":
      return 0.72;
    case "partner":
      return 0.72;
    case "sector":
      return 0.7;
  }
}

function buildFallbackNameRelationships(input: {
  ticker: string;
  reportText: string;
  promptVersion: string;
}): NameRelationshipDraft[] {
  const targetTicker = normalizeTickerSymbol(input.ticker);
  if (targetTicker.length === 0) {
    return [];
  }

  const relationships: NameRelationshipDraft[] = [];
  const seen = new Set<string>();
  const sentences = input.reportText
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]?/g) ?? [];

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    const relationshipType = relationshipTypeFromSentence(sentence);
    if (!relationshipType) {
      continue;
    }

    const matches = sentence.match(/\b[A-Z][A-Z0-9.-]{1,5}\b/g) ?? [];
    for (const match of matches) {
      const sourceTicker = normalizeTickerSymbol(match);
      if (
        sourceTicker.length < 2 ||
        sourceTicker === targetTicker ||
        relationshipTickerStopWords.has(sourceTicker)
      ) {
        continue;
      }

      const key = `${sourceTicker}:${targetTicker}:${relationshipType}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      relationships.push({
        source_ticker: sourceTicker,
        target_ticker: targetTicker,
        relationship_type: relationshipType,
        confidence: fallbackConfidenceForRelationship(relationshipType),
        evidence_text: sentence.slice(0, 500),
        rationale:
          `Report text explicitly links ${sourceTicker} to ${targetTicker} through ${relationshipType} language.`,
        prompt_version: input.promptVersion
      });

      if (relationships.length >= 10) {
        return relationships;
      }
    }
  }

  return relationships;
}

async function extractNameRelationships(input: {
  request: AnalysisRequest;
  config: DexterConfig;
  prompts: LoadedPrompts;
  sections: ReportSection[];
  thesisStatement?: string;
  rootTrace?: LangSmithRun;
  model: string;
}): Promise<NameRelationshipExtractionResult> {
  const reportText = buildRelationshipReportText({
    thesisStatement: input.thesisStatement,
    sections: input.sections
  });
  const fallback = buildFallbackNameRelationships({
    ticker: input.request.ticker ?? "",
    reportText,
    promptVersion: input.prompts.relationshipExtractor.version
  });

  if (input.config.fixtureMode) {
    return {
      relationships: fallback,
      tokenCount: 0,
      source: "fallback"
    };
  }

  const query = renderPrompt(input.prompts.relationshipExtractor, {
    ticker: input.request.ticker ?? "",
    report_text: reportText.length > 0 ? reportText : "Report text unavailable."
  });

  const trace = input.rootTrace?.createChild({
    name: "dexter.relationship_extractor",
    run_type: "chain",
    inputs: {
      job_id: input.request.job_id,
      ticker: input.request.ticker ?? "",
      prompt_version: input.prompts.relationshipExtractor.version
    },
    metadata: {
      service: "dexter-worker",
      job_id: input.request.job_id,
      ticker: input.request.ticker ?? "",
      prompt_version: input.prompts.relationshipExtractor.version,
      model: input.model
    }
  });
  if (trace) {
    await trace.postRun();
  }

  try {
    const result = await runLiveDexterQuery(
      query,
      input.config,
      input.config.retrySectionTimeoutMs,
      1
    );
    const parsed = parsePromptNameRelationships({
      answer: result.answer,
      promptVersion: input.prompts.relationshipExtractor.version,
      ticker: input.request.ticker ?? ""
    });

    if (parsed !== undefined) {
      if (trace) {
        await trace.end(
          {
            status: "complete",
            relationship_count: parsed.length,
            token_count: result.tokenCount
          },
          undefined,
          undefined,
          {
            service: "dexter-worker",
            job_id: input.request.job_id,
            ticker: input.request.ticker ?? "",
            prompt_version: input.prompts.relationshipExtractor.version
          }
        );
        await trace.patchRun();
      }
      return {
        relationships: parsed,
        tokenCount: result.tokenCount,
        source: "prompt"
      };
    }

    logWarn("Name relationship extractor fallback applied due to invalid prompt output", {
      job_id: input.request.job_id,
      ticker: input.request.ticker,
      fallback_count: fallback.length,
      prompt_version: input.prompts.relationshipExtractor.version
    });
    if (trace) {
      await trace.end(
        {
          status: "fallback",
          relationship_count: fallback.length,
          token_count: result.tokenCount
        },
        "Invalid prompt relationship output; fallback used.",
        undefined,
        {
          service: "dexter-worker",
          job_id: input.request.job_id,
          ticker: input.request.ticker ?? "",
          prompt_version: input.prompts.relationshipExtractor.version
        }
      );
      await trace.patchRun();
    }
    return {
      relationships: fallback,
      tokenCount: result.tokenCount,
      source: "fallback"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("Name relationship extractor failed; fallback applied", {
      job_id: input.request.job_id,
      ticker: input.request.ticker,
      error_message: message,
      fallback_count: fallback.length,
      prompt_version: input.prompts.relationshipExtractor.version
    });
    if (trace) {
      await trace.end(
        {
          status: "fallback",
          relationship_count: fallback.length
        },
        message,
        undefined,
        {
          service: "dexter-worker",
          job_id: input.request.job_id,
          ticker: input.request.ticker ?? "",
          prompt_version: input.prompts.relationshipExtractor.version
        }
      );
      await trace.patchRun();
    }
    return {
      relationships: fallback,
      tokenCount: 0,
      source: "fallback"
    };
  }
}

function orderSections(sections: ReportSection[]): ReportSection[] {
  const byId = new Map(sections.map((section) => [section.section_id, section]));
  return allSectionDefinitions
    .map((definition) => byId.get(definition.id))
    .filter((section): section is ReportSection => Boolean(section));
}

async function executeFixtureSection(
  definition: SectionDefinition,
  request: AnalysisRequest,
  config: DexterConfig
): Promise<ExecutedSection> {
  const scenario = getFixtureScenario(request.ticker ?? "MSFT");
  const sectionScenario = scenario.sectionScenarios[definition.id];
  const startedAt = Date.now();

  if (!sectionScenario) {
    return {
      section: {
        section_id: definition.id,
        title: definition.title,
        status: "data_unavailable",
        body: buildStatusBody(
          definition.title,
          "data_unavailable",
          "No fixture scenario was defined for this section."
        ),
        evidence: []
      },
      latencyMs: Date.now() - startedAt,
      tokenCount: 0
    };
  }

  if (
    sectionScenario.status === "complete" &&
    sectionScenario.evidence.length < config.minScoredClaimEvidenceCount
  ) {
    return {
      section: {
        section_id: definition.id,
        title: definition.title,
        status: "data_unavailable",
        body: buildStatusBody(
          definition.title,
          "data_unavailable",
          `The section completed with fewer than ${config.minScoredClaimEvidenceCount} required evidence item(s), so it is downgraded instead of being marked complete.`
        ),
        evidence: []
      },
      latencyMs: Date.now() - startedAt,
      tokenCount: 0
    };
  }

  if (
    config.simulateTimeoutSection === definition.id ||
    sectionScenario.shouldTimeout
  ) {
    throw new Error("Simulated section timeout");
  }

  return {
    section: {
      section_id: definition.id,
      title: definition.title,
      status: sectionScenario.status,
      body: buildStatusBody(definition.title, sectionScenario.status, sectionScenario.summary),
      evidence: sectionScenario.evidence
    },
    latencyMs: Date.now() - startedAt,
    tokenCount: 0
  };
}

async function executeLiveSection(
  definition: SectionDefinition,
  request: AnalysisRequest,
  config: DexterConfig,
  prompts: LoadedPrompts,
  timeoutMs: number
): Promise<ExecutedSection> {
  const configErrors = validateLiveModeConfig(config);
  if (configErrors.length > 0) {
    throw new Error(configErrors.join("; "));
  }

  const query = renderPrompt(prompts.sectionExecutor, {
    ticker: request.ticker ?? "",
    section_title: definition.title,
    section_guidance: definition.liveGuidance ?? "",
    requested_at: request.requested_at,
    job_id: request.job_id
  });
  const startedAt = Date.now();
  const result = await runLiveDexterQuery(
    query,
    config,
    timeoutMs,
    definition.liveMaxIterations ?? config.maxAgentIterations
  );
  const body = result.answer.trim();
  const evidence = buildEvidenceFromToolCalls(result.toolCalls);

  if (body.length === 0) {
    throw new Error("Dexter returned an empty section body");
  }

  if (evidence.length < config.minScoredClaimEvidenceCount) {
    return {
      section: {
        section_id: definition.id,
        title: definition.title,
        status: "data_unavailable",
        body: buildStatusBody(
          definition.title,
          "data_unavailable",
          `The section returned fewer than ${config.minScoredClaimEvidenceCount} required evidence item(s).`
        ),
        evidence: []
      },
      latencyMs: Date.now() - startedAt,
      tokenCount: result.tokenCount
    };
  }

  return {
    section: {
      section_id: definition.id,
      title: definition.title,
      status: "complete",
      body,
      evidence
    },
    latencyMs: Date.now() - startedAt,
    tokenCount: result.tokenCount
  };
}

async function executeSectionWithRetry(
  definition: SectionDefinition,
  request: AnalysisRequest,
  config: DexterConfig,
  prompts: LoadedPrompts
): Promise<ExecutedSection> {
  let attempt = 0;
  const maxAttempts = config.maxSectionRetries + 1;
  const firstAttemptTimeoutMs = definition.liveTimeoutMs ?? config.sectionTimeoutMs;
  const retryAttemptTimeoutMs =
    definition.liveRetryTimeoutMs ?? config.retrySectionTimeoutMs;

  while (attempt < maxAttempts) {
    const timeoutMs = attempt === 0 ? firstAttemptTimeoutMs : retryAttemptTimeoutMs;
    try {
      return config.fixtureMode
        ? await executeFixtureSection(definition, request, config)
        : await executeLiveSection(definition, request, config, prompts, timeoutMs);
    } catch (error) {
      if (attempt >= config.maxSectionRetries) {
        throw error;
      }

      attempt += 1;
      await sleep(config.retryBackoffMs * attempt);
    }
  }

  throw new Error("Section execution attempts exhausted unexpectedly");
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function runAnalysisPipeline(
  request: AnalysisRequest,
  config: DexterConfig
): Promise<AnalysisReport> {
  const ticker = request.ticker ?? "";
  const normalizedTicker = ticker.trim().toUpperCase();
  if (
    normalizedTicker.length > 0 &&
    config.forcedFailureTickers.has(normalizedTicker)
  ) {
    logError("Forced ticker failure triggered", {
      job_id: request.job_id,
      ticker: normalizedTicker,
      reason: "forced_failure_ticker"
    });
    throw new Error(`Forced failure for ticker ${normalizedTicker}`);
  }

  const scenario = config.fixtureMode ? getFixtureScenario(ticker) : undefined;
  const selectedDefinitions = selectSectionDefinitions(request.options?.sections);
  const plannedExecutableSections = executableSectionDefinitions
    .filter((definition) => selectedDefinitions.some((selected) => selected.id === definition.id))
    .sort(
      (left, right) => (right.executionPriority ?? 0) - (left.executionPriority ?? 0)
    );
  const model = config.fixtureMode ? scenario?.model ?? "fixture-dexter-m3" : config.model;
  const m2Context = await resolveM2SectionContext(request, config);

  if (!config.fixtureMode) {
    const preflightErrors = validateLiveModeConfig(config);
    if (preflightErrors.length > 0) {
      throw new Error(`Dexter live-mode preflight failed: ${preflightErrors.join("; ")}`);
    }

    if (!config.webSearchProviderKeyPresent) {
      logWarn("No web search provider key configured for live Dexter run", {
        job_id: request.job_id,
        ticker,
        recommendation:
          "Set EXASEARCH_API_KEY, PERPLEXITY_API_KEY, or TAVILY_API_KEY to improve event/news coverage."
      });
    }
  }

  initSentry({ enabled: false });
  const langSmithRuntime = initLangSmith({
    enabled: config.langsmithTracingEnabled || config.promptSource === "langsmith",
    apiKey: process.env.LANGSMITH_API_KEY,
    project: config.langsmithProject
  });
  const prompts = await loadRuntimePrompts(config);

  const rootTrace = !config.fixtureMode && langSmithRuntime.enabled
    ? createLangSmithRun({
        name: "dexter.deep_dive",
        run_type: "chain",
        inputs: {
          request_id: request.request_id,
          job_id: request.job_id,
          ticker,
          requested_at: request.requested_at,
          sections: selectedDefinitions.map((definition) => definition.id)
        },
        metadata: {
          service: "dexter-worker",
          job_id: request.job_id,
          ticker,
          model,
          planner_prompt_version: prompts.planner.version,
          section_executor_prompt_version: prompts.sectionExecutor.version,
          synthesizer_prompt_version: prompts.synthesizer.version,
          kill_switch_prompt_version: prompts.killSwitchExtractor.version,
          relationship_prompt_version: prompts.relationshipExtractor.version
        }
      })
    : undefined;

  if (rootTrace) {
    await rootTrace.postRun();
  }

  logInfo("Dexter run started", {
    job_id: request.job_id,
    ticker,
    request_id: request.request_id,
    model,
    prompt_version: prompts.sectionExecutor.version
  });

  logInfo("Planner completed", {
    job_id: request.job_id,
    ticker,
    section_count: plannedExecutableSections.length,
    latency_ms: 0
  });

  const executedSections: ReportSection[] = [];
  const sectionOutcomes = await mapWithConcurrency(
    plannedExecutableSections,
    config.fixtureMode ? plannedExecutableSections.length : config.maxParallelSections,
    async (definition) => {
    const sectionTrace: LangSmithRun | undefined = rootTrace?.createChild({
      name: `dexter.section.${definition.id}`,
      run_type: "chain",
      inputs: {
        job_id: request.job_id,
        ticker,
        section_id: definition.id,
        section_title: definition.title
      },
      metadata: {
        service: "dexter-worker",
        job_id: request.job_id,
        ticker,
        section_id: definition.id,
        prompt_version: prompts.sectionExecutor.version,
        model
      }
    });

    if (sectionTrace) {
      await sectionTrace.postRun();
    }

    try {
      const result = await executeSectionWithRetry(definition, request, config, prompts);
      if (sectionTrace) {
        await sectionTrace.end(
          {
            status: result.section.status,
            token_count: result.tokenCount,
            latency_ms: result.latencyMs
          },
          undefined,
          undefined,
          {
            section_id: definition.id,
            prompt_version: prompts.sectionExecutor.version,
            model,
            job_id: request.job_id,
            ticker
          }
        );
        await sectionTrace.patchRun();
      }
      return {
        definition,
        section: result.section,
        latencyMs: result.latencyMs,
        tokenCount: result.tokenCount
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedSection: ReportSection = {
        section_id: definition.id,
        title: definition.title,
        status: "failed",
        body: buildStatusBody(
          definition.title,
          "failed",
          "The section executor failed after retry and the report continued without fabricated replacement content."
        ),
        evidence: []
      };

      if (sectionTrace) {
        await sectionTrace.end(
          {
            status: "failed"
          },
          message,
          undefined,
          {
            section_id: definition.id,
            prompt_version: prompts.sectionExecutor.version,
            model,
            job_id: request.job_id,
            ticker
          }
        );
        await sectionTrace.patchRun();
      }
      return {
        definition,
        section: failedSection,
        latencyMs: config.sectionTimeoutMs,
        tokenCount: 0,
        errorMessage: message
      };
    }
    }
  );

  let totalTokenCount = 0;
  for (const outcome of sectionOutcomes) {
    executedSections.push(outcome.section);
    totalTokenCount += outcome.tokenCount;

    if ("errorMessage" in outcome) {
      logError("Section executor failed / timed out", {
        job_id: request.job_id,
        ticker,
        section_id: outcome.definition.id,
        error_message: outcome.errorMessage,
        timeout_ms: outcome.definition.liveTimeoutMs ?? config.sectionTimeoutMs
      });
      continue;
    }

    if (outcome.section.status === "complete") {
      logInfo("Section executor succeeded", {
        job_id: request.job_id,
        ticker,
        section_id: outcome.definition.id,
        latency_ms: outcome.latencyMs,
        evidence_count: outcome.section.evidence.length
      });
    } else {
      logWarn("Data retrieval degraded", {
        job_id: request.job_id,
        ticker,
        section_id: outcome.definition.id,
        degradation_status: outcome.section.status
      });
    }
  }

  const signal = buildSignal(request.job_id, config, scenario, executedSections);
  const confidence = scenario?.confidence ?? {
    score: signal.value === "no_signal" ? 0.35 : 0.62,
    label: signal.value === "no_signal" ? "insufficient_data" : "medium",
    limiting_factors:
      signal.value === "no_signal"
        ? ["Live mode has not yet extracted structured evidence items for scoring."]
        : ["Live mode still depends on external provider and model health."]
  };
  const valuationSection = buildValuationSection(ticker, m2Context);
  const financialAnalysis = buildFinancialAnalysis(m2Context.financials);
  const valueDiscipline = buildValueDisciplineScorecard({
    ticker,
    snapshots: m2Context.financials,
    financialAnalysis,
    valuation: valuationSection.valuation
  });
  const derivedSections: ReportSection[] = [
    buildThesisStatementSection(ticker, m2Context),
    buildWhatChangedSection(m2Context),
    buildValueDisciplineSection(valueDiscipline),
    valuationSection.section,
    buildExecutiveSummary(ticker, executedSections, signal.value),
    buildResearchSignalSection(signal.value, signal.reasons, signal.evidence),
    buildConfidenceSection(confidence),
    buildEvidenceReferenceSection(signal.evidence)
  ].filter((section) =>
    selectedDefinitions.some((definition) => definition.id === section.section_id)
  );
  const orderedSectionsInitial = orderSections([...executedSections, ...derivedSections]);

  const traceMode: "mock" | "live" | "disabled" = config.fixtureMode
    ? "mock"
    : config.langsmithTracingEnabled && config.langsmithApiKeyPresent
      ? "live"
      : "disabled";

  if (traceMode === "disabled") {
    logWarn("LangSmith trace unavailable", {
      job_id: request.job_id,
      ticker,
      prompt_version: prompts.sectionExecutor.version,
      model
    });
  } else {
    logInfo("LangSmith trace emitted", {
      job_id: request.job_id,
      ticker,
      prompt_version: prompts.sectionExecutor.version,
      model,
      trace_id: `${traceMode}-${request.job_id}`,
      token_count: totalTokenCount
    });
  }

  const generatedAt = new Date().toISOString();
  const thesisStatement = derivedSections.find((section) => section.section_id === "thesis_statement")?.body;
  const trustMetadata = buildTrustMetadata({
    generatedAt,
    context: m2Context,
    sections: orderedSectionsInitial,
    signal,
    confidence,
    valuation: valuationSection.valuation,
    thesisStatement
  });
  const investmentMemo = buildInvestmentMemo({
    ticker,
    signalValue: signal.value,
    confidence,
    trustMetadata,
    context: m2Context,
    valuation: valuationSection.valuation,
    valueDiscipline,
    financialAnalysis,
    signalEvidence: signal.evidence,
    promptVersion: prompts.synthesizer.version,
    fixtureMode: config.fixtureMode
  });
  const executiveSummarySection = buildExecutiveSummary(
    ticker,
    executedSections,
    signal.value,
    investmentMemo
  );
  const orderedSections = orderedSectionsInitial.map((section) =>
    section.section_id === "executive_summary" ? executiveSummarySection : section
  );
  const killSwitchExtraction = await extractKillSwitchConditions({
    request,
    config,
    prompts,
    signal,
    confidence,
    thesisStatement,
    rootTrace,
    model
  });
  totalTokenCount += killSwitchExtraction.tokenCount;
  const relationshipExtraction = await extractNameRelationships({
    request,
    config,
    prompts,
    sections: orderedSections,
    thesisStatement,
    rootTrace,
    model
  });
  totalTokenCount += relationshipExtraction.tokenCount;
  const topChanges = buildTopChanges(m2Context, trustMetadata);
  const storyHeader = buildStoryHeader({
    ticker,
    thesisStatement: thesisStatement ?? `${ticker} thesis remains under active review.`,
    signalValue: signal.value,
    trustMetadata,
    topChanges
  });
  const changeSummary = buildChangeSummary({
    context: m2Context,
    signalValue: signal.value,
    trustMetadata,
    topChanges
  });
  const visualPanels = buildVisualPanels({
    context: m2Context,
    trustMetadata,
    valuation: valuationSection.valuation,
    signalEvidence: signal.evidence
  });
  const explainers = buildExplainers({
    signalValue: signal.value,
    confidence,
    trustMetadata,
    valuation: valuationSection.valuation
  });
  const watchItems = buildWatchItems(
    trustMetadata,
    killSwitchExtraction.conditions,
    valueDiscipline
  );
  const coverageTruth = buildCoverageTruth({
    context: m2Context,
    trustMetadata,
    sections: orderedSections,
    financialAnalysis,
    valueDiscipline
  });

  const report: AnalysisReport = {
    report_id: randomUUID(),
    job_id: request.job_id,
    schema_version: schemaVersion,
    type: "deep_dive",
    ticker,
    generated_at: generatedAt,
    confidence,
    signal,
    historical_context: m2Context.context,
    valuation: valuationSection.valuation,
    trust_metadata: trustMetadata,
    kill_switch_conditions: killSwitchExtraction.conditions,
    name_relationships: relationshipExtraction.relationships,
    story_header: storyHeader,
    change_summary: changeSummary,
    visual_panels: visualPanels,
    explainers,
    watch_items: watchItems,
    coverage_truth: coverageTruth,
    investment_memo: investmentMemo,
    financial_analysis: financialAnalysis,
    value_discipline: valueDiscipline,
    sections: orderedSections,
    flags: buildFlags(scenario, orderedSections, signal.value, traceMode),
    data_sources: buildDataSources(scenario, orderedSections)
  };

  logInfo("Trust metadata generated", {
    job_id: request.job_id,
    ticker,
    freshness_state: trustMetadata.freshness_state,
    evidence_count: trustMetadata.evidence_count,
    contradiction_state: trustMetadata.contradiction_state,
    valuation_state: trustMetadata.valuation_state
  });
  logInfo("Value-discipline scorecard generated", {
    job_id: request.job_id,
    ticker,
    score: valueDiscipline.score,
    max_score: valueDiscipline.max_score,
    available_signals: valueDiscipline.available_signals,
    completeness: valueDiscipline.completeness,
    context_label: valueDiscipline.context_label,
    value_trap_warning: valueDiscipline.value_trap_warning.triggered
  });
  logInfo("Investment memo authored", {
    job_id: request.job_id,
    ticker,
    prompt_version: investmentMemo.prompt_version,
    generation_mode: investmentMemo.generation_mode,
    section_count: investmentMemo.sections.length,
    material_claim_count: investmentMemo.material_claims.length
  });
  if (trustMetadata.thesis_drift.status === "unavailable") {
    logWarn("Thesis-drift summary unavailable", {
      job_id: request.job_id,
      ticker,
      reason: trustMetadata.thesis_drift.reasons.join(" ")
    });
  }
  logInfo("Kill-switch conditions extracted", {
    job_id: request.job_id,
    report_id: report.report_id,
    ticker,
    rule_count: killSwitchExtraction.conditions.length,
    prompt_version: prompts.killSwitchExtractor.version,
    extraction_source: killSwitchExtraction.source
  });
  logInfo("Name relationships extracted", {
    job_id: request.job_id,
    report_id: report.report_id,
    ticker,
    relationship_count: relationshipExtraction.relationships.length,
    prompt_version: prompts.relationshipExtractor.version,
    extraction_source: relationshipExtraction.source
  });

  const validationErrors = validateAnalysisReport(report);
  if (validationErrors.length > 0) {
    logError("Schema validation failed", {
      job_id: request.job_id,
      ticker,
      contract: "AnalysisReport",
      validation_errors: validationErrors
    });
    throw new Error(`AnalysisReport validation failed: ${validationErrors.join("; ")}`);
  }

  if (rootTrace) {
    await rootTrace.end(
      {
        signal: report.signal?.value ?? "no_signal",
        flags: report.flags,
        token_count: totalTokenCount,
        section_count: report.sections.length,
        kill_switch_rule_count: report.kill_switch_conditions?.length ?? 0,
        name_relationship_count: report.name_relationships?.length ?? 0
      },
      undefined,
      undefined,
      {
        service: "dexter-worker",
        job_id: request.job_id,
        ticker,
        model,
        planner_prompt_version: prompts.planner.version,
        section_executor_prompt_version: prompts.sectionExecutor.version,
        synthesizer_prompt_version: prompts.synthesizer.version,
        kill_switch_prompt_version: prompts.killSwitchExtractor.version,
        relationship_prompt_version: prompts.relationshipExtractor.version
      }
    );
    await rootTrace.patchRun();
    await awaitPendingLangSmithTraces();
  }

  return report;
}
