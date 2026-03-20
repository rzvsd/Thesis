import { randomUUID } from "node:crypto";

import type {
  AnalysisReport,
  AnalysisRequest,
  ConfidenceBlock,
  EvidenceItem,
  ReportSection,
  SignalValue
} from "../../../packages/contracts/src";
import {
  awaitPendingLangSmithTraces,
  createLangSmithRun,
  initLangSmith,
  initSentry,
  type LangSmithRun
} from "../../../packages/observability/src";

import { type DexterConfig, validateLiveModeConfig } from "./config";
import { getFixtureScenario, type FixtureScenario } from "./fixtures";
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

const schemaVersion = "1.0.0";

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
    ? `${ticker} completed the deep-dive path with all primary sections available. The current research signal is ${signalValue}.`
    : `${ticker} completed the deep-dive path with ${degradedCount} degraded section(s). The current research signal is ${signalValue}, and the report explicitly notes every gap instead of filling it with assumptions.`;

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

  if (evidence.length < config.minSignalEvidenceCount || scenario?.signalValue === "no_signal") {
    const reasons = scenario?.signalReasons ?? [
      `Evidence count ${evidence.length} is below the minimum threshold of ${config.minSignalEvidenceCount}.`
    ];

    logWarn("Evidence threshold not met", {
      job_id: jobId,
      score_state: "no_signal",
      limiting_factors: reasons
    });

    return {
      value: "no_signal",
      reasons,
      evidence: evidence.slice(0, config.minSignalEvidenceCount)
    };
  }

  return {
    value: scenario?.signalValue ?? "neutral",
    reasons: scenario?.signalReasons ?? ["Signal generated from completed sections."],
    evidence: evidence.slice(0, Math.max(config.minSignalEvidenceCount, 1))
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

  if (evidence.length === 0) {
    return {
      section: {
        section_id: definition.id,
        title: definition.title,
        status: "data_unavailable",
        body: buildStatusBody(
          definition.title,
          "data_unavailable",
          "No retrievable evidence was returned by the section executor."
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
  const derivedSections: ReportSection[] = [
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

  const report: AnalysisReport = {
    report_id: randomUUID(),
    job_id: request.job_id,
    schema_version: schemaVersion,
    type: "deep_dive",
    ticker,
    generated_at: new Date().toISOString(),
    confidence,
    signal,
    sections: orderedSections,
    flags: buildFlags(scenario, orderedSections, signal.value, traceMode),
    data_sources: buildDataSources(scenario, orderedSections)
  };

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
