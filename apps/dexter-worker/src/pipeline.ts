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
  DueDiligenceBlock,
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
  fixtureFilingSections,
  getFixtureHistoricalContext,
  getFixtureScenario,
  type FixtureScenario
} from "./fixtures";
import { buildFilingIntelligence, type ReviewedFilingSections } from "./filing-intelligence";
import { buildFinancialIndicators } from "./financial-indicators";
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
import { runEvidenceDebateTool } from "./tools/evidence-debate/evidence-debate-tool";
import { runFinancialAnalysisTool } from "./tools/financial-analysis/financial-analysis-tool";
import { runRecentContextTool } from "./tools/recent-context/recent-context-tool";
import {
  renderToolContextForPrompt,
  type DexterEvidenceToolContext
} from "./tools/tool-prompt-context";

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
  filingSections?: ReviewedFilingSections[];
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

function issuerForTicker(ticker: string): AnalysisReport["issuer"] | undefined {
  switch (ticker.trim().toUpperCase()) {
    case "AAPL":
      return { name: "Apple Inc.", exchange: "NASDAQ" };
    case "MSFT":
      return { name: "Microsoft Corporation", exchange: "NASDAQ" };
    case "TSLA":
      return { name: "Tesla, Inc.", exchange: "NASDAQ" };
    case "NVDA":
      return { name: "NVIDIA Corporation", exchange: "NASDAQ" };
    case "AMZN":
      return { name: "Amazon.com, Inc.", exchange: "NASDAQ" };
    case "META":
      return { name: "Meta Platforms, Inc.", exchange: "NASDAQ" };
    case "GOOGL":
      return { name: "Alphabet Inc.", exchange: "NASDAQ" };
    default:
      return undefined;
  }
}

function humanizeContextLabel(contextLabel: string): string {
  switch (contextLabel) {
    case "quality_mega_cap":
      return "large-cap quality context";
    case "value_cyclical":
      return "cyclical value context";
    case "distressed":
      return "distressed context";
    case "financial":
      return "financial-company context";
    case "sparse_data":
      return "sparse-data context";
    default:
      return contextLabel.replace(/[_-]+/g, " ");
  }
}

function reportSectionBodyExcerpt(
  sections: ReportSection[],
  sectionId: string,
  fallback: string,
  maxLength = 260
): string {
  const body = findReportSection(sections, sectionId)?.body;
  if (!body || body.trim().length === 0) {
    return fallback;
  }
  return summarizeText(body, maxLength);
}

function reportSectionEvidenceExcerpt(
  sections: ReportSection[],
  sectionId: string,
  fallback: string,
  maxLength = 180
): string {
  const evidence = findReportSection(sections, sectionId)?.evidence[0]?.excerpt;
  if (!evidence || evidence.trim().length === 0) {
    return fallback;
  }
  return summarizeText(evidence, maxLength);
}

function findDueDiligenceSection(
  dueDiligence: DueDiligenceBlock,
  sectionId: string
) {
  return dueDiligence.sections.find((section) => section.section_id === sectionId);
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
  dueDiligence: DueDiligenceBlock;
  signalEvidence: EvidenceItem[];
  promptVersion: string;
  fixtureMode: boolean;
}): InvestmentMemoBlock {
  const ticker = args.ticker.trim().toUpperCase();
  const companyAngle = companyAngleForTicker(ticker);
  const financialSection = findDueDiligenceSection(args.dueDiligence, "financial_analysis");
  const competitiveSection = findDueDiligenceSection(args.dueDiligence, "competitive_positioning");
  const riskSection = findDueDiligenceSection(args.dueDiligence, "risks_and_challenges");
  const valuationSection = findDueDiligenceSection(args.dueDiligence, "valuation_and_thesis_stance");
  const growthSection = findDueDiligenceSection(args.dueDiligence, "growth_opportunities_and_outlook");
  const missingSummary = args.trustMetadata.missing_data_notes.length > 0
    ? args.trustMetadata.missing_data_notes.join(" ")
    : "No major omission note is currently flagged.";
  const valuationSummary = valuationSection?.summary
    ?? (args.valuation?.degraded_reason
      ? `Valuation is degraded because ${args.valuation.degraded_reason}.`
      : args.valuation?.fair_value_mid !== undefined
        ? `Deterministic valuation is centered near ${formatNumber(args.valuation.fair_value_mid)} with explicit scenario bounds.`
        : "Valuation is currently omission-forward because deterministic assumptions are incomplete.");
  const decisionQuestion = `Does ${ticker} still justify confidence on ${companyAngle}, or did the latest evidence shift the thesis into watch mode?`;
  const openingArgument = financialSection?.summary
    ?? (args.signalValue === "positive"
      ? `${ticker} keeps a constructive thesis because ${companyAngle} is still translating into measurable operating outcomes.`
      : args.signalValue === "negative"
        ? `${ticker} now reads defensively because recent evidence weakens the prior thesis on ${companyAngle}.`
        : args.signalValue === "neutral"
          ? `${ticker} remains balanced: the thesis on ${companyAngle} is intact, but the latest evidence does not justify a stronger directional call.`
          : `${ticker} is currently a watch-case because evidence quality is not yet strong enough to support a directional thesis on ${companyAngle}.`);

  const sections: InvestmentMemoBlock["sections"] = [
    {
      section_id: "investment_thesis",
      title: "Investment Thesis",
      narrative: `${openingArgument} ${financialSection?.narrative_paragraphs[0] ?? ""} Confidence is ${args.confidence.label} (${Math.round(args.confidence.score * 100)}/100), and the decision still depends on whether execution remains durable through the next filing cycle.`,
      key_points: [
        `Decision question: ${decisionQuestion}`,
        `Current signal: ${args.signalValue}`,
        `Confidence limiter: ${args.confidence.limiting_factors[0] ?? "No single dominant limiter flagged."}`
      ]
    },
    {
      section_id: "what_changed",
      title: "What Changed",
      narrative: `${competitiveSection?.summary ?? "Competitive posture still matters to the current thesis."} ${growthSection?.summary ?? ""} Thesis drift status is ${args.trustMetadata.thesis_drift.status}: ${args.trustMetadata.thesis_drift.summary}`,
      key_points: [
        financialSection?.key_points[0] ?? "Financial direction still matters.",
        growthSection?.key_points[0] ?? "The next filing still matters more than the headline alone.",
        `Thesis drift: ${args.trustMetadata.thesis_drift.summary}`
      ]
    },
    {
      section_id: "business_quality",
      title: "Business Quality",
      narrative: `${competitiveSection?.summary ?? `${ticker}'s quality lens is anchored on ${companyAngle}.`} ${competitiveSection?.narrative_paragraphs[0] ?? ""} Value-discipline context is ${humanizeContextLabel(args.valueDiscipline.context_label)} with score ${args.valueDiscipline.score}/${args.valueDiscipline.max_score}.`,
      key_points: [
        `Quality angle: ${companyAngle}`,
        competitiveSection?.key_points[0] ?? "Business quality remains tied to execution quality.",
        `Value context: ${humanizeContextLabel(args.valueDiscipline.context_label)}`
      ]
    },
    {
      section_id: "valuation",
      title: "Valuation",
      narrative: `${valuationSummary} ${valuationSection?.narrative_paragraphs[0] ?? ""}`.trim(),
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
        ? `${args.valueDiscipline.value_trap_warning.summary} ${riskSection?.summary ?? ""} ${missingSummary}`
        : `${riskSection?.summary ?? "Primary risk controls remain evidence freshness and omission visibility."} ${riskSection?.narrative_paragraphs[0] ?? ""} ${missingSummary}`,
      key_points: [
        args.valueDiscipline.value_trap_warning.summary,
        `Freshness state: ${args.trustMetadata.freshness_state}`,
        `Missing-data note: ${args.trustMetadata.missing_data_notes[0] ?? "No major missing-data note."}`
      ]
    }
  ];

  const evidenceSupport = args.signalEvidence[0];
  const financialSupportRefs = financialSection?.evidence_refs ?? [];
  const valuationSupportRefs = valuationSection?.evidence_refs ?? [];
  const riskSupportRefs = riskSection?.evidence_refs ?? [];
  const financialCoverageLimited = financialSection?.coverage_state === "limited";
  const valuationCoverageLimited = valuationSection?.coverage_state === "limited" || Boolean(args.valuation?.degraded_reason);
  const riskCoverageLimited = riskSection?.coverage_state === "limited" || args.trustMetadata.missing_data_notes.length > 0;
  const materialClaims: InvestmentMemoBlock["material_claims"] = [
    {
      claim_id: "claim-thesis-direction",
      section_id: "investment_thesis",
      statement: openingArgument,
      materiality: "material",
      supports: financialCoverageLimited
        ? [
            {
              support_type: "omission",
              ref_id: "trust:missing_data_notes",
              summary: args.trustMetadata.missing_data_notes[0]
                ?? financialSection?.omissions[0]
                ?? "Evidence depth is currently constrained."
            }
          ]
        : financialSupportRefs.length > 0
        ? [
            {
              support_type: "metric",
              ref_id: financialSupportRefs[0] ?? "due_diligence:financial_analysis",
              summary: financialSection?.summary ?? openingArgument
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
      supports: valuationCoverageLimited
        ? [
            {
              support_type: "omission",
              ref_id: "valuation:degraded_reason",
              summary: args.valuation?.degraded_reason
                ?? valuationSection?.omissions[0]
                ?? "Valuation inputs are insufficient."
            }
          ]
        : valuationSupportRefs.length > 0
        ? [
            {
              support_type: "metric",
              ref_id: valuationSupportRefs[0] ?? "valuation:fair_value_mid",
              summary: valuationSection?.summary ?? valuationSummary
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
      supports: riskCoverageLimited
        ? [
            {
              support_type: "omission",
              ref_id: "trust:missing_data_notes",
              summary: args.trustMetadata.missing_data_notes[0]
                ?? riskSection?.omissions[0]
                ?? "Missing-data note available."
            }
          ]
        : riskSupportRefs.length > 0
        ? [
            {
              support_type: "evidence",
              ref_id: riskSupportRefs[0] ?? "due_diligence:risks_and_challenges",
              summary: riskSection?.summary ?? "Risk framework remains explicit."
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

  const sparseDataHonestyNote = args.dueDiligence.sections.some((section) => section.coverage_state === "limited")
    ? `Sparse-data handling is active: ${args.dueDiligence.sections.find((section) => section.coverage_state === "limited")?.omissions[0] ?? args.financialAnalysis.omissions[0]?.reason ?? "financial inputs are incomplete."}`
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

function uniqueStrings(values: Array<string | undefined>, maxItems?: number): string[] {
  const deduped = Array.from(
    new Set(
      values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  );
  return maxItems === undefined ? deduped : deduped.slice(0, maxItems);
}

function findReportSection(sections: ReportSection[], sectionId: string): ReportSection | undefined {
  return sections.find((section) => section.section_id === sectionId);
}

function collectEvidenceRefs(args: {
  sections: ReportSection[];
  sectionIds?: string[];
  evidence?: EvidenceItem[];
  extras?: string[];
  maxItems?: number;
}): string[] {
  const refs: string[] = [];

  for (const sectionId of args.sectionIds ?? []) {
    const section = findReportSection(args.sections, sectionId);
    if (!section) {
      continue;
    }
    refs.push(`section:${section.section_id}`);
    refs.push(...section.evidence.map((item) => `evidence:${item.evidence_id}`));
  }

  for (const item of args.evidence ?? []) {
    refs.push(`evidence:${item.evidence_id}`);
  }

  refs.push(...(args.extras ?? []));
  return uniqueStrings(refs, args.maxItems ?? 8);
}

function trendMetricByKey(
  financialAnalysis: NonNullable<AnalysisReport["financial_analysis"]>,
  key: string
) {
  return financialAnalysis.trend_metrics.find((metric) => metric.key === key) ??
    financialAnalysis.quality_metrics.find((metric) => metric.key === key);
}

function annualMetricSummary(
  financialAnalysis: NonNullable<AnalysisReport["financial_analysis"]>,
  key: string,
  fallback: string
): string {
  const metric = trendMetricByKey(financialAnalysis, key);
  if (!metric || metric.status !== "available" || metric.value === undefined) {
    return fallback;
  }

  const formattedValue = metric.unit === "pct"
    ? formatPercent(metric.value)
    : metric.unit === "ratio"
      ? metric.value.toFixed(2)
      : formatNumber(metric.value);
  return `${metric.label} is ${formattedValue} and currently reads ${metric.direction}.`;
}

function buildDueDiligence(args: {
  ticker: string;
  signalValue: SignalValue;
  confidence: ConfidenceBlock;
  trustMetadata: TrustMetadata;
  context: M2SectionContext;
  valuation?: ValuationBlock;
  valueDiscipline: NonNullable<AnalysisReport["value_discipline"]>;
  financialAnalysis: NonNullable<AnalysisReport["financial_analysis"]>;
  sections: ReportSection[];
  killSwitchConditions: KillSwitchConditionDraft[];
  nameRelationships: NameRelationshipDraft[];
  promptVersion: string;
  fixtureMode: boolean;
}): DueDiligenceBlock {
  const ticker = args.ticker.trim().toUpperCase();
  const companyAngle = companyAngleForTicker(ticker);
  const revenueMarginBody = reportSectionBodyExcerpt(
    args.sections,
    "revenue_margin_analysis",
    "Recent operating results need to be read through the joint lens of revenue conversion, margin quality, and cash generation."
  );
  const qoqBody = reportSectionBodyExcerpt(
    args.sections,
    "quarter_over_quarter_changes",
    "Quarter-over-quarter changes remain useful, but they should not dominate the thesis on their own."
  );
  const yoyBody = reportSectionBodyExcerpt(
    args.sections,
    "year_over_year_changes",
    "Year-over-year comparisons help keep one-quarter noise from becoming the whole story."
  );
  const debtBody = reportSectionBodyExcerpt(
    args.sections,
    "debt_liquidity",
    "Balance-sheet resilience still matters because valuation only deserves confidence when liquidity remains intact."
  );
  const eventsBody = reportSectionBodyExcerpt(
    args.sections,
    "acquisitions_major_events",
    "Major-event context is limited in this run, so the narrative should stay anchored in disclosed operating evidence."
  );
  const commentaryBody = reportSectionBodyExcerpt(
    args.sections,
    "management_commentary",
    "Management commentary is useful only when it helps explain operating evidence rather than replace it."
  );
  const commentaryEvidence = reportSectionEvidenceExcerpt(
    args.sections,
    "management_commentary",
    "Approved management commentary is limited in this run."
  );
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
  const financialOmissions = args.financialAnalysis.omissions.map(
    (omission) => `${omission.label}: ${omission.reason}`
  );
  const growthOmissions = uniqueStrings([
    args.context.latest?.segments?.length ? undefined : "Segment disclosures were not available in the latest approved snapshot.",
    args.context.latestTranscript ? undefined : "Management outlook commentary was not available from an approved transcript.",
    args.trustMetadata.missing_data_notes[0]
  ]);
  const segmentSummary = args.context.latest?.segments && args.context.latest.segments.length > 0
    ? args.context.latest.segments
      .slice(0, 3)
      .map((segment) => `${segment.segment_name} at ${formatNumber(segment.revenue)} of revenue`)
      .join(", ")
    : "The latest approved snapshot did not carry segment-level revenue detail.";
  const relationshipSummaries = args.nameRelationships.slice(0, 3).map((relationship) =>
    `${relationship.source_ticker} ${relationship.relationship_type} ${relationship.target_ticker} (${Math.round(relationship.confidence * 100)}% confidence)`
  );
  const relationshipNarrative = relationshipSummaries.length > 0
    ? relationshipSummaries.join("; ")
    : "Cross-name mapping was not rich enough in this run to support a stronger relationship map.";
  const killSwitchSummary = args.killSwitchConditions
    .slice(0, 3)
    .map((condition) => condition.condition_text);
  const transcriptSentence = transcriptQuote(args.context.latestTranscript);
  const valuationAvailable = args.valuation?.fair_value_mid !== undefined &&
    !args.valuation?.degraded_reason;
  const financialCoverage: "full" | "partial" | "limited" = financialOmissions.length === 0 &&
    revenueQoq.available &&
    marginQoq.available
    ? "full"
    : args.financialAnalysis.annual_history.length >= 2 || revenueQoq.available || marginQoq.available
      ? "partial"
      : "limited";
  const competitiveCoverage: "full" | "partial" | "limited" =
    args.context.latest?.segments?.length && relationshipSummaries.length > 0
      ? "full"
      : args.context.latest?.segments?.length || relationshipSummaries.length > 0 || Boolean(transcriptSentence)
        ? "partial"
        : "limited";
  const managementCoverage: "full" | "partial" | "limited" = transcriptSentence
    ? "partial"
    : "limited";
  const riskCoverage: "full" | "partial" | "limited" = killSwitchSummary.length >= 3 &&
    args.trustMetadata.missing_data_notes.length === 0
    ? "full"
    : killSwitchSummary.length > 0 || args.trustMetadata.missing_data_notes.length > 0
      ? "partial"
      : "limited";
  const growthCoverage: "full" | "partial" | "limited" = growthOmissions.length === 0 &&
    (args.context.latest?.segments?.length ?? 0) > 0
    ? "full"
    : Boolean(args.context.latestTranscript) || (args.context.latest?.segments?.length ?? 0) > 0
      ? "partial"
      : "limited";
  const valuationCoverage: "full" | "partial" | "limited" = valuationAvailable
    ? "full"
    : args.valuation
      ? "partial"
      : "limited";
  const governanceLimitNote = "Governance detail is limited because proxy-grade material was not available in this run.";
  const financialNarrativeParagraphs = financialCoverage === "limited"
    ? [
        `Financial analysis is intentionally limited for ${ticker} because the current source set does not yet support a durable multi-period read. ${revenueQoq.line} ${marginQoq.line} ${fcfYoy.line} In this state, the report can still describe what the latest numbers say, but it should not pretend that one or two partial comparisons settle the longer financial debate.`,
        `The safest interpretation is omission-forward rather than thinly confident. ${financialOmissions.join(" ") || "Statement history is not deep enough for a stronger trend read."}`
      ]
    : [
        `${ticker}'s financial case still begins with whether recent operating results are broad enough to support a durable thesis rather than a quarter-only bounce. ${revenueQoq.line} ${marginQoq.line} ${fcfYoy.line} The underlying section read remains consistent with that direction: ${revenueMarginBody} The point is not that every metric moved perfectly in the same direction, but that revenue conversion, margin behavior, and cash generation can still be discussed as one coherent story instead of as disconnected headlines. That distinction matters because the market often overreacts to single-line beats or misses long before it re-underwrites the quality of the full earnings engine.`,
        `The statement history now available to Thesis includes ${args.financialAnalysis.annual_history.length} annual rows and ${args.financialAnalysis.quarterly_history.length} quarterly rows. ${yoyBody} ${annualMetricSummary(args.financialAnalysis, "revenue_cagr_3y_pct", "Revenue CAGR cannot yet be stated with full confidence from the current annual history.")} ${annualMetricSummary(args.financialAnalysis, "operating_margin_delta_3y_pp", "Operating-margin trend is directionally visible, but it remains less complete than a full long-cycle history.")} That broader time frame matters because investment mistakes usually happen when a single quarter is allowed to overpower the more durable earnings and cash-flow pattern.`,
        `The balance-sheet read remains part of the same story, not a separate appendix. ${debtBody} ${annualMetricSummary(args.financialAnalysis, "cash_conversion_latest", "Cash-conversion quality is not fully measurable from the current dataset.")} ${commentaryEvidence} When cash generation, liquidity, and operating evidence are aligned, the report can speak with more conviction about quality. When they are not aligned, the correct response is to narrow the stance rather than forcing a cleaner story than the filings support.`,
        financialOmissions.length > 0
          ? `Financial coverage is still omission-aware even when the overall section is usable. ${financialOmissions.join(" ")} Those omissions matter because they set the edge of what this report can responsibly claim. They do not erase the available evidence, but they do define the confidence interval around any thesis built on that evidence.`
          : `No major financial-statement omissions were detected in the current run, which is why this section can move beyond a memo-thin summary into a fuller analyst read. Even so, the discipline remains the same: the financial story only stays strong if the next filing cycle confirms that current margins and cash generation were not a temporary lift.`
      ];
  const competitiveNarrativeParagraphs = competitiveCoverage === "limited"
    ? [
        `Competitive-positioning coverage is limited for ${ticker} because the run does not have enough approved evidence to support a stronger industry-structure view. The report can still say that ${companyAngle} remains the central business question, but it cannot responsibly convert that into precise market-share or peer-ranking claims without sources that explicitly carry that burden.`,
        `That limitation is a feature, not a defect. When segment detail, relationship mapping, or approved contextual evidence are thin, the correct report behavior is to stay close to disclosed business mix and to state uncertainty plainly instead of filling the gap with confident-sounding competitive language.`
      ]
    : [
        `The competitive question for ${ticker} is less about brand familiarity and more about whether ${companyAngle} still shows up in approved evidence as a durable commercial advantage. The current segment read points to ${segmentSummary} That matters because business quality becomes more believable when the report can see where revenue concentration sits and how that concentration interacts with pricing power, customer dependence, or ecosystem stickiness. It also matters because a real competitive edge should eventually reveal itself in the mix of business that management is willing to defend and reinvest behind, not just in descriptive marketing language.`,
        relationshipSummaries.length > 0
          ? `Cross-name relationship extraction adds a more useful layer than generic peer name-dropping. The current relationship map surfaces ${relationshipNarrative} This does not prove exact share gains or losses, but it does help the report talk about dependency chains, adjacent pressure points, and where the thesis could be influenced by supplier, partner, sector, or competitor dynamics already visible in the approved source plane.`
          : `Cross-name relationship extraction was lighter in this run, so the competitive read leans more heavily on business mix, filings language, and management commentary than on explicit name-to-name mapping. That is still acceptable so long as the report stays disciplined about what it is doing: describing where competitive durability might still exist, not claiming a full industry map that the evidence did not provide.`,
        `Management and event context help turn competitive description into interpretation. ${commentaryBody} ${eventsBody} Together, those sections matter because competitive positioning is rarely visible in a single data point. It usually shows up in how management explains demand, where product or segment momentum is concentrated, and whether recent corporate events reinforce or complicate the existing thesis.`,
        `This section therefore stays deliberately conservative about unsupported claims. It can say the current evidence still supports a business-quality read when segment mix, relationship mapping, and management commentary point in the same direction. It cannot claim precise market-share dominance, peer displacement, or durable structural advantage unless the approved source set says so directly.`
      ];
  const managementNarrativeParagraphs = managementCoverage === "limited"
    ? [
        `Management-and-governance coverage is limited for ${ticker} because the run did not recover enough approved commentary to support a stronger qualitative read. The safest interpretation is to judge leadership primarily through reported operating outcomes and capital-allocation evidence rather than through tone or reputation. ${governanceLimitNote}`,
        `That means the management section remains useful in a narrow way: it keeps the report from implying more confidence than the source plane deserves. Share-count discipline, cash conversion, and execution follow-through still matter, but governance language should stay restrained until the run includes proxy-grade support.`
      ]
    : [
        `Management commentary matters here because it can either reinforce or weaken the financial interpretation of the quarter. ${commentaryBody} The freshest traceable management evidence currently reads: ${commentaryEvidence} That language does not settle the thesis by itself, but it does help show whether management priorities, disclosed tradeoffs, and current execution all line up in a way that makes the broader report more credible. In practice, the most useful management signal is not optimism by itself but whether disclosure cadence and operating follow-through stay consistent once the next filing arrives.`,
        `Governance should be read with more humility than management tone. Thesis can discuss capital allocation, disclosure posture, and the consistency between what management says and what the financial statements later confirm. It should not simulate a full board-effectiveness or incentive-design review when proxy-grade evidence is absent. ${governanceLimitNote} That omission is exactly the kind of guardrail that keeps a long-form report from sliding into polished speculation.`,
        `The practical conclusion is that management quality for this run is best inferred from disciplined follow-through rather than adjectives. Value-discipline context remains ${humanizeContextLabel(args.valueDiscipline.context_label)} at ${args.valueDiscipline.score}/${args.valueDiscipline.max_score}, share-count behavior remains part of the read, and the next step is simple: if management language and the next filing stay consistent, governance confidence can gradually widen; if they do not, the stance should narrow quickly.`
      ];
  const riskNarrativeParagraphs = riskCoverage === "limited"
    ? [
        `Risk coverage for ${ticker} remains usable but incomplete because the current run did not surface enough break conditions to make the thesis fully stress-tested. In that state, the report should emphasize omission pressure and fragile assumptions rather than pretending the downside case has been mapped with precision.`,
        `Even a limited risk section still serves a purpose: it tells the reader where the confidence boundary sits. ${args.trustMetadata.missing_data_notes.join(" ") || "The current run carries fewer explicit omission notes than usual, but risk framing is still narrower than a full-data case."}`
      ]
    : [
        `The central risk question is not whether ${ticker} faces generic uncertainty. Every company does. The real question is which conditions would invalidate the current stance quickly enough that the thesis should be rewritten rather than merely monitored. ${args.trustMetadata.missing_data_notes.length > 0
          ? `The report is already carrying explicit omission pressure: ${args.trustMetadata.missing_data_notes.join(" ")}`
          : "The trust layer is relatively clean in this run, which allows the section to focus more on business and valuation risk than on missing-data risk."} That framing matters because a disciplined risk section should tell the reader when a thesis is broken, when it is merely noisier, and which evidence would separate those two states.`,
        killSwitchSummary.length > 0
          ? `The active kill-switch set is what makes this section actionable instead of decorative. Current break conditions include ${killSwitchSummary.join("; ")} These are not generic warning bullets. They define the evidence pattern that would force the current stance back into review even if the top-line story still sounded attractive at first glance.`
          : `Explicit kill-switch coverage is lighter than ideal in this run, so risk discussion leans more heavily on source-backed caution and evidence freshness. That is still better than pretending to own a precise downside map that the current source set does not actually support.`,
        args.valueDiscipline.value_trap_warning.triggered
          ? `${args.valueDiscipline.value_trap_warning.summary} That warning deserves extra weight because a superficially cheaper multiple can still be the wrong signal when quality evidence is weakening underneath it. In other words, valuation only helps if the operating story remains intact.`
          : `The current value-discipline layer does not trigger a value-trap warning, but that is not the same thing as a risk-free setup. Multiple compression, execution slippage, weaker cash conversion, or a deterioration in management guidance can still damage the thesis long before a static quality score fully catches up.`,
        `This is why the risk section stays explicit about uncertainty instead of hiding it inside polished prose. The report should tell the reader what would break the thesis, where omission pressure still exists, and which next filing or management update matters most. If it cannot do those things, it should sound incomplete.`
      ];
  const growthNarrativeParagraphs = growthCoverage === "limited"
    ? [
        `Growth-and-outlook coverage is intentionally narrow for ${ticker} because the current run does not have enough approved driver evidence to support a more ambitious forecast. The report can still name the next things to watch, but it should not turn thin management language or missing segment detail into a durable growth story.`,
        `That means the most honest outlook is conditional: future upside remains possible, but conviction has to wait for cleaner evidence on business drivers, execution follow-through, and what the next reporting cycle confirms.`
      ]
    : [
        `The most important growth question for ${ticker} is whether ${companyAngle} still has enough operating support to matter over the next several reporting windows. ${segmentSummary} That matters because the outlook is strongest when it can point to visible business drivers rather than to abstract stories about optionality or total addressable market. The next reporting window should therefore be judged by which driver is actually funding incremental margin, cash generation, or strategic reinvestment rather than by headline enthusiasm alone.`,
        transcriptSentence
          ? `Management context helps sharpen that read without overreaching. The latest approved transcript language suggests "${transcriptSentence}." That is meaningful only if later filings continue to validate disciplined execution, demand durability, or margin conversion. In other words, transcript color is useful when it frames the next evidence to watch, not when it substitutes for that evidence.`
          : `Approved management outlook commentary is limited in this run, so the report keeps the outlook close to disclosed operating reality. That is still enough to form a view on what the next filing should confirm, but it is not enough to justify a louder multi-year narrative than the approved source set can carry.`,
        `Recent operating context also matters because outlook is rarely a clean continuation of the last quarter. ${qoqBody} ${eventsBody} Together, those pieces help the report explain why the next step in the thesis is not just "more growth," but a more specific question about whether visible business drivers are still converting into durable operating quality and cash generation.`,
        `This section therefore stays conservative by design. It can identify catalysts, segment pressure points, and areas where management appears to be investing behind the thesis. It should not pretend to know the full forward arc unless that view is already supported inside the approved source plane.`
      ];
  const valuationNarrativeParagraphs = valuationCoverage === "limited"
    ? [
        `Valuation-and-stance coverage is limited for ${ticker} because the current run does not support a fully specified deterministic range. The report can still describe the stance, but it must do so without implying a level of price precision that the evidence does not justify.`,
        `In this state, the better question is not "what is the target?" but "what would need to improve before a stronger range deserves trust?" That keeps the report honest when valuation inputs are incomplete.`
      ]
    : [
        valuationAvailable
          ? `The current Thesis stance on ${ticker} remains ${args.signalValue}, and the valuation discussion is deliberately framed as a decision process rather than as a single-point target. Fair value centers near ${formatNumber(args.valuation?.fair_value_mid)} with a bounded range from ${formatNumber(args.valuation?.fair_value_low)} to ${formatNumber(args.valuation?.fair_value_high)}. ${args.valuation?.spot_price !== undefined
            ? `Against a spot reference of ${formatNumber(args.valuation.spot_price)}, that leaves implied upside at ${formatPercent(args.valuation.implied_upside_pct)}.`
            : "Spot-price comparison is not currently available from the approved quote path."} The range matters less as a marketing number than as a discipline check on whether the current operating evidence is strong enough to justify staying constructive at today's price.`
          : `The current Thesis stance on ${ticker} remains ${args.signalValue}, but valuation precision is still constrained in this run because ${args.valuation?.degraded_reason ?? "the deterministic range inputs remain incomplete"}. The report can still explain the stance, but it should not imply a cleaner entry framework than the evidence can support.`,
        `That numerical range only matters because it sits on top of an operating case. The stance remains constructive only if ${companyAngle} continues to convert into reported outcomes, omission pressure remains controlled, and the trust state does not deteriorate without explanation. ${args.trustMetadata.thesis_drift.summary} In that sense, valuation is not the thesis itself. It is the framework that tests whether the thesis is still worth owning at the current price.`,
        `The assumption discipline is equally important. ${args.valuation?.degraded_reason
          ? `This run still carries a valuation limitation: ${args.valuation.degraded_reason}.`
          : `The deterministic setup remains usable with WACC at ${formatPercent((args.valuation?.assumptions.wacc ?? 0) * 100)}, terminal growth at ${formatPercent((args.valuation?.assumptions.terminal_growth_rate ?? 0) * 100)}, and a ${args.valuation?.assumptions.projection_years ?? 5}-year projection horizon.`} That matters because long-form due diligence becomes less useful, not more, when it hides the assumptions doing the real work.`,
        killSwitchSummary.length > 0
          ? `What would change our mind is not vague. The current stance would need to be reviewed if conditions such as ${killSwitchSummary.slice(0, 2).join(" or ")} begin showing up in the evidence. That keeps valuation anchored to falsifiable business outcomes instead of letting the report drift into a static target-price exercise.`
          : `Break conditions are lighter than ideal in this run, so the report states the stance with more caution than certainty. Where the falsification map is thinner, the valuation section should sound appropriately provisional rather than cosmetically complete.`
      ];

  const sections: DueDiligenceBlock["sections"] = [
    {
      section_id: "financial_analysis",
      title: "Financial Analysis",
      summary: financialCoverage === "full"
        ? `${ticker}'s latest financial read still supports the thesis with revenue momentum, margin follow-through, and cash generation moving in the same direction.`
        : `The financial read remains usable for ${ticker}, but it is constrained by missing history that needs to stay explicit in the final interpretation.`,
      narrative_paragraphs: financialNarrativeParagraphs,
      key_points: uniqueStrings([
        revenueQoq.line,
        marginQoq.line,
        fcfYoy.line,
        annualMetricSummary(args.financialAnalysis, "cash_conversion_latest", "Cash-conversion quality is not fully measurable from the current dataset.")
      ], 4),
      evidence_refs: collectEvidenceRefs({
        sections: args.sections,
        sectionIds: ["quarter_over_quarter_changes", "year_over_year_changes", "revenue_margin_analysis", "debt_liquidity"],
        extras: uniqueStrings([
          revenueQoq.available ? revenueQoq.refId : undefined,
          marginQoq.available ? marginQoq.refId : undefined,
          fcfYoy.available ? fcfYoy.refId : undefined,
          "metric:revenue_cagr_3y_pct",
          "metric:free_cash_flow_cagr_3y_pct"
        ]),
        maxItems: 8
      }),
      omissions: financialOmissions,
      coverage_state: financialCoverage
    },
    {
      section_id: "competitive_positioning",
      title: "Competitive Positioning",
      summary: competitiveCoverage === "full"
        ? `${ticker}'s competitive read is grounded in segment concentration plus explicit cross-name relationships, not unsupported market-share claims.`
        : `Competitive positioning for ${ticker} is directionally useful, but the report stays disciplined about what the current source plane can and cannot prove.`,
      narrative_paragraphs: competitiveNarrativeParagraphs,
      key_points: uniqueStrings([
        args.context.latest?.segments?.[0]?.segment_name
          ? `${args.context.latest.segments[0].segment_name} remains a visible operating anchor in the latest snapshot.`
          : "Latest segment concentration is not directly observable in this run.",
        relationshipSummaries[0]
          ? `Relationship map: ${relationshipSummaries[0]}`
          : "Direct cross-name mapping is limited in this run.",
        transcriptSentence ? `Management context: ${transcriptSentence}` : undefined
      ], 4),
      evidence_refs: collectEvidenceRefs({
        sections: args.sections,
        sectionIds: ["quarter_over_quarter_changes", "management_commentary"],
        extras: uniqueStrings([
          ...args.nameRelationships.slice(0, 3).map((relationship) =>
            `relationship:${relationship.source_ticker}:${relationship.relationship_type}:${relationship.target_ticker}`
          )
        ]),
        maxItems: 8
      }),
      omissions: uniqueStrings([
        args.context.latest?.segments?.length ? undefined : "Latest segment disclosures were unavailable.",
        relationshipSummaries.length > 0 ? undefined : "No explicit cross-name relationship map was available for this run."
      ]),
      coverage_state: competitiveCoverage
    },
    {
      section_id: "management_and_governance",
      title: "Management and Governance",
      summary: transcriptSentence
        ? `Management commentary is usable for ${ticker}, but governance analysis remains intentionally limited to what approved filings and transcripts can actually support.`
        : `Management and governance coverage is limited because the run did not surface enough approved commentary to support a deeper qualitative read.`,
      narrative_paragraphs: managementNarrativeParagraphs,
      key_points: uniqueStrings([
        transcriptSentence ? `Transcript read: ${transcriptSentence}` : "Fresh management quote unavailable.",
        `Value-discipline context: ${humanizeContextLabel(args.valueDiscipline.context_label)} (${args.valueDiscipline.score}/${args.valueDiscipline.max_score}).`,
        "Governance coverage is limited to approved filings and transcript evidence."
      ], 4),
      evidence_refs: collectEvidenceRefs({
        sections: args.sections,
        sectionIds: ["management_commentary"],
        evidence: args.context.latestTranscript
          ? [{
              evidence_id: `transcript:${args.context.latestTranscript.transcript_id}`,
              source_type: "article",
              source_name: args.context.latestTranscript.provider,
              excerpt: args.context.latestTranscript.body_text,
              retrieved_at: args.context.latestTranscript.retrieved_at
            }]
          : [],
        extras: ["metric:value_discipline_score"],
        maxItems: 8
      }),
      omissions: uniqueStrings([
        transcriptSentence ? undefined : "Fresh management transcript excerpt unavailable.",
        "Proxy-grade governance detail is unavailable in the current approved source plane."
      ]),
      coverage_state: managementCoverage
    },
    {
      section_id: "risks_and_challenges",
      title: "Risks and Challenges",
      summary: riskCoverage === "full"
        ? `The risk framework for ${ticker} is explicit and falsifiable, with documented kill switches and visible omission notes rather than vague cautionary language.`
        : `The risk framework is still usable for ${ticker}, but it needs to be read alongside the current omission notes and evidence-depth limits.`,
      narrative_paragraphs: riskNarrativeParagraphs,
      key_points: uniqueStrings([
        killSwitchSummary[0],
        args.trustMetadata.missing_data_notes[0],
        args.valueDiscipline.value_trap_warning.summary
      ], 4),
      evidence_refs: collectEvidenceRefs({
        sections: args.sections,
        sectionIds: ["management_commentary"],
        extras: uniqueStrings([
          ...args.killSwitchConditions.slice(0, 4).map((condition) => `kill_switch:${condition.condition_id}`),
          "trust:missing_data_notes"
        ]),
        maxItems: 8
      }),
      omissions: uniqueStrings([
        killSwitchSummary.length > 0 ? undefined : "Explicit kill-switch conditions were limited in this run.",
        ...args.trustMetadata.missing_data_notes
      ]),
      coverage_state: riskCoverage
    },
    {
      section_id: "growth_opportunities_and_outlook",
      title: "Growth Opportunities and Outlook",
      summary: growthCoverage === "full"
        ? `${ticker}'s outlook remains grounded in visible growth drivers rather than unsupported total-addressable-market storytelling.`
        : `The outlook section remains useful for ${ticker}, but it is intentionally narrow where approved growth evidence is incomplete.`,
      narrative_paragraphs: growthNarrativeParagraphs,
      key_points: uniqueStrings([
        args.context.latest?.segments?.[0]?.segment_name
          ? `${args.context.latest.segments[0].segment_name} is the clearest visible growth lens in the latest snapshot.`
          : "Latest segment mix is unavailable.",
        transcriptSentence ? `Management outlook: ${transcriptSentence}` : "Management outlook commentary is limited.",
        args.trustMetadata.thesis_drift.summary
      ], 4),
      evidence_refs: collectEvidenceRefs({
        sections: args.sections,
        sectionIds: ["quarter_over_quarter_changes", "management_commentary", "acquisitions_major_events"],
        maxItems: 8
      }),
      omissions: growthOmissions,
      coverage_state: growthCoverage
    },
    {
      section_id: "valuation_and_thesis_stance",
      title: "Valuation and Thesis Stance",
      summary: valuationAvailable
        ? `Thesis stance for ${ticker} remains ${args.signalValue}, with deterministic valuation providing a disciplined range rather than a narrative shortcut.`
        : `The current Thesis stance for ${ticker} can still be stated, but valuation needs to be read as constrained or degraded rather than precise.`,
      narrative_paragraphs: valuationNarrativeParagraphs,
      key_points: uniqueStrings([
        valuationAvailable
          ? `Fair-value midpoint: ${formatNumber(args.valuation?.fair_value_mid)}`
          : "Deterministic fair-value midpoint unavailable.",
        args.valuation?.implied_upside_pct !== undefined
          ? `Implied upside: ${formatPercent(args.valuation.implied_upside_pct)}`
          : args.valuation?.degraded_reason,
        args.trustMetadata.thesis_drift.summary
      ], 4),
      evidence_refs: collectEvidenceRefs({
        sections: args.sections,
        sectionIds: ["valuation", "thesis_statement"],
        extras: uniqueStrings([
          valuationAvailable ? "valuation:fair_value_mid" : undefined,
          args.valuation?.implied_upside_pct !== undefined ? "valuation:implied_upside_pct" : undefined,
          ...args.killSwitchConditions.slice(0, 2).map((condition) => `kill_switch:${condition.condition_id}`)
        ]),
        maxItems: 8
      }),
      omissions: uniqueStrings([
        args.valuation?.degraded_reason,
        !valuationAvailable ? "Deterministic valuation is degraded or incomplete in this run." : undefined
      ]),
      coverage_state: valuationCoverage
    }
  ];

  return {
    prompt_version: args.fixtureMode ? "m9-due-diligence-fixture-v1" : "m9-due-diligence-live-v1",
    generation_mode: args.fixtureMode ? "deterministic_fixture" : "fallback",
    sections
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
    (signal) => `Value signal unavailable: ${humanizeMetric(signal)}`
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
      filingSections: fixtureTicker === "LIMITED" ? [] : fixtureFilingSections(fixtureTicker),
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
    filingSections: loaded.filingSections,
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

function augmentConfidenceWithToolContext(
  confidence: ConfidenceBlock,
  toolContext: DexterEvidenceToolContext
): ConfidenceBlock {
  const limitingFactors = new Set(confidence.limiting_factors);
  let scorePenalty = 0;

  const financialRedFlags = toolContext.financialAnalysis?.data?.red_flags ?? [];
  if (financialRedFlags.some((flag) => flag.severity === "high")) {
    limitingFactors.add("Financial validator found high-severity math flags; confidence remains conservative.");
    scorePenalty += 0.05;
  }
  if ((toolContext.financialAnalysis?.omissions.length ?? 0) > 0) {
    limitingFactors.add("Financial validator omitted some ratios because source inputs were incomplete.");
  }

  const debateScore = toolContext.evidenceDebate?.data?.claim_quality_score;
  if (typeof debateScore === "number" && debateScore < 0.5) {
    limitingFactors.add("Evidence quality review found unresolved support across sections.");
    scorePenalty += 0.05;
  }
  if ((toolContext.evidenceDebate?.omissions.length ?? 0) > 0) {
    limitingFactors.add("Evidence quality review kept unresolved sections in the confidence limits.");
  }

  const score = Math.max(0, confidence.score - scorePenalty);
  return {
    ...confidence,
    score,
    label: score < 0.4 ? "low" : confidence.label,
    limiting_factors: [...limitingFactors]
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
    `Context: ${humanizeContextLabel(valueDiscipline.context_label)}.`,
    valueDiscipline.interpretation,
    valueDiscipline.missing_signals.length > 0
      ? `Missing signals: ${valueDiscipline.missing_signals.map((signal) => humanizeMetric(signal)).join("; ")}.`
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
  timeoutMs: number,
  toolContextPrompt = ""
): Promise<ExecutedSection> {
  const configErrors = validateLiveModeConfig(config);
  if (configErrors.length > 0) {
    throw new Error(configErrors.join("; "));
  }

  const query = renderPrompt(prompts.sectionExecutor, {
    ticker: request.ticker ?? "",
    section_title: definition.title,
    section_guidance: [definition.liveGuidance ?? "", toolContextPrompt]
      .filter((entry) => entry.trim().length > 0)
      .join("\n\n"),
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
  prompts: LoadedPrompts,
  toolContextPrompt = ""
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
        : await executeLiveSection(definition, request, config, prompts, timeoutMs, toolContextPrompt);
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
  const issuer = issuerForTicker(ticker);
  const toolContext: DexterEvidenceToolContext = {};
  toolContext.financialAnalysis = await runFinancialAnalysisTool(
    {
      ticker,
      latest: m2Context.latest,
      priorQuarter: m2Context.priorQuarter,
      yearAgo: m2Context.yearAgo
    },
    config
  );
  toolContext.recentContext = await runRecentContextTool(
    {
      query: `${ticker} ${issuer?.name ?? ""}`.trim() || ticker,
      ticker,
      companyName: issuer?.name,
      lookbackDays: 30,
      maxResults: config.toolMaxResults,
      mode: "deep_dive"
    },
    config
  );
  const preSectionToolContextPrompt = renderToolContextForPrompt(toolContext);

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
      const result = await executeSectionWithRetry(
        definition,
        request,
        config,
        prompts,
        preSectionToolContextPrompt
      );
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
  let confidence = scenario?.confidence ?? {
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
  let derivedSections: ReportSection[] = [
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
  let orderedSectionsInitial = orderSections([...executedSections, ...derivedSections]);
  const thesisStatement = derivedSections.find((section) => section.section_id === "thesis_statement")?.body;
  toolContext.evidenceDebate = await runEvidenceDebateTool(
    {
      ticker,
      thesisStatement,
      sections: orderedSectionsInitial,
      financialTool: toolContext.financialAnalysis?.data
    },
    config
  );
  confidence = augmentConfidenceWithToolContext(confidence, toolContext);
  derivedSections = derivedSections.map((section) =>
    section.section_id === "confidence_score" ? buildConfidenceSection(confidence) : section
  );
  orderedSectionsInitial = orderSections([...executedSections, ...derivedSections]);

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
  const trustMetadata = buildTrustMetadata({
    generatedAt,
    context: m2Context,
    sections: orderedSectionsInitial,
    signal,
    confidence,
    valuation: valuationSection.valuation,
    thesisStatement
  });
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
    sections: orderedSectionsInitial,
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
  const dueDiligence = buildDueDiligence({
    ticker,
    signalValue: signal.value,
    confidence,
    trustMetadata,
    context: m2Context,
    valuation: valuationSection.valuation,
    valueDiscipline,
    financialAnalysis,
    sections: orderedSectionsInitial,
    killSwitchConditions: killSwitchExtraction.conditions,
    nameRelationships: relationshipExtraction.relationships,
    promptVersion: prompts.synthesizer.version,
    fixtureMode: config.fixtureMode
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
    dueDiligence,
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
  const coverageTruth = buildCoverageTruth({
    context: m2Context,
    trustMetadata,
    sections: orderedSections,
    financialAnalysis,
    valueDiscipline
  });
  const filingIntelligence = await buildFilingIntelligence(
    {
      ticker,
      generatedAt,
      latest: m2Context.latest,
      priorQuarter: m2Context.priorQuarter,
      yearAgo: m2Context.yearAgo,
      financials: m2Context.financials,
      latestTranscript: m2Context.latestTranscript,
      filingSections: m2Context.filingSections,
      fixtureMode: config.fixtureMode
    },
    config
  );
  const financialIndicators = await buildFinancialIndicators(
    {
      ticker,
      generatedAt,
      latest: m2Context.latest,
      financials: m2Context.financials,
      spotPrice: m2Context.spotPrice,
      fixtureMode: config.fixtureMode
    },
    config
  );

  const report: AnalysisReport = {
    report_id: randomUUID(),
    job_id: request.job_id,
    schema_version: schemaVersion,
    type: "deep_dive",
    ticker,
    issuer: issuerForTicker(ticker),
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
    due_diligence: dueDiligence,
    filing_intelligence: filingIntelligence,
    financial_indicators: financialIndicators,
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
  logInfo("Due-diligence narrative compiled", {
    job_id: request.job_id,
    ticker,
    prompt_version: dueDiligence.prompt_version,
    generation_mode: dueDiligence.generation_mode,
    section_count: dueDiligence.sections.length,
    limited_sections: dueDiligence.sections.filter((section) => section.coverage_state === "limited").length
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
