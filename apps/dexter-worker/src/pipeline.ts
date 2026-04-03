import { randomUUID } from "node:crypto";

import type {
  AnalysisReport,
  AnalysisRequest,
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  ConfidenceBlock,
  EvidenceItem,
  ReportSection,
  SignalValue,
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
  signalValue: SignalValue
): ReportSection {
  const completeCount = sections.filter((section) => section.status === "complete").length;
  const degradedCount = sections.length - completeCount;
  const body = degradedCount === 0
    ? `${ticker} completed the deep-dive path with all primary sections available. The current research signal is ${signalValue}. ${canonicalDisclaimer}`
    : `${ticker} completed the deep-dive path with ${degradedCount} degraded section(s). The current research signal is ${signalValue}, and the report explicitly notes every gap instead of filling it with assumptions. ${canonicalDisclaimer}`;

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
    enabled: config.langsmithTracingEnabled,
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
          synthesizer_prompt_version: prompts.synthesizer.version
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
  const derivedSections: ReportSection[] = [
    buildThesisStatementSection(ticker, m2Context),
    buildWhatChangedSection(m2Context),
    valuationSection.section,
    buildExecutiveSummary(ticker, executedSections, signal.value),
    buildResearchSignalSection(signal.value, signal.reasons, signal.evidence),
    buildConfidenceSection(confidence),
    buildEvidenceReferenceSection(signal.evidence)
  ].filter((section) =>
    selectedDefinitions.some((definition) => definition.id === section.section_id)
  );
  const orderedSections = orderSections([...executedSections, ...derivedSections]);

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
    sections: orderedSections,
    signal,
    confidence,
    valuation: valuationSection.valuation,
    thesisStatement
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
  if (trustMetadata.thesis_drift.status === "unavailable") {
    logWarn("Thesis-drift summary unavailable", {
      job_id: request.job_id,
      ticker,
      reason: trustMetadata.thesis_drift.reasons.join(" ")
    });
  }

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
        section_count: report.sections.length
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
        synthesizer_prompt_version: prompts.synthesizer.version
      }
    );
    await rootTrace.patchRun();
    await awaitPendingLangSmithTraces();
  }

  return report;
}
