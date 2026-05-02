import { resolve } from "node:path";

import { goldenRoot } from "./fs-roots";

const defaultPort = 3002;
const defaultSectionTimeoutMs = 70_000;
const defaultRetrySectionTimeoutMs = 15_000;
const defaultRetryBackoffMs = 500;
const defaultScoredClaimEvidenceThreshold = 1;
const defaultSignalEvidenceThreshold = 2;
const defaultAgentMaxIterations = 2;
const defaultMaxParallelSections = 4;
const defaultMaxSectionRetries = 0;
const defaultOpenRouterModel = "openrouter:openai/gpt-5.4-mini";
const defaultOpenAiModel = "gpt-5.4-mini";
const devInternalWorkerToken = "dev-internal-worker-token";

export type DexterLiveProvider = "openrouter" | "anthropic" | "openai";

export interface LiveProviderAttempt {
  provider: DexterLiveProvider;
  model: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTickerSet(value: string | undefined): Set<string> {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter((entry) => entry.length > 0)
  );
}

function parseProviderOrder(value: string | undefined): DexterLiveProvider[] {
  const allowed = new Set<DexterLiveProvider>(["openrouter", "anthropic", "openai"]);
  const parsed = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is DexterLiveProvider => allowed.has(entry as DexterLiveProvider));

  return parsed.length > 0 ? parsed : ["openrouter", "anthropic", "openai"];
}

export interface DexterConfig {
  port: number;
  nodeEnv: string;
  allowProductionFixtures: boolean;
  fixtureMode: boolean;
  model: string;
  providerOrder: DexterLiveProvider[];
  promptSource: "local" | "langsmith";
  openrouterModel: string;
  openaiModel: string;
  anthropicModel?: string;
  bunBin: string;
  anthropicApiKeyPresent: boolean;
  openrouterApiKeyPresent: boolean;
  openaiApiKeyPresent: boolean;
  webSearchProviderKeyPresent: boolean;
  maxAgentIterations: number;
  maxParallelSections: number;
  sectionTimeoutMs: number;
  retrySectionTimeoutMs: number;
  retryBackoffMs: number;
  maxSectionRetries: number;
  minScoredClaimEvidenceCount: number;
  minSignalEvidenceCount: number;
  promptManifestPath: string;
  langsmithTracingEnabled: boolean;
  langsmithProject?: string;
  langsmithApiKeyPresent: boolean;
  langsmithPlannerPrompt: string;
  langsmithSectionExecutorPrompt: string;
  langsmithSynthesizerPrompt: string;
  langsmithKillSwitchPrompt: string;
  langsmithRelationshipPrompt: string;
  langsmithOppositeCasePrompt: string;
  langsmithCoherenceAnalyzerPrompt: string;
  simulateTimeoutSection?: string;
  queueMode: boolean;
  redisUrl?: string;
  queueKey: string;
  queueBlockTimeoutSeconds: number;
  productApiInternalBaseUrl: string;
  internalWorkerToken: string;
  pulsePriceBaseUrl: string;
  pulseLlmEditorialEnabled: boolean;
  pulseLlmPromptVersion: string;
  pulseLlmMaxTokens: number;
  toolsEnabled: boolean;
  financialAnalysisToolEnabled: boolean;
  evidenceDebateToolEnabled: boolean;
  recentContextToolEnabled: boolean;
  recentContextCustomerVisible: boolean;
  toolTimeoutMs: number;
  toolMaxResults: number;
  recentContextBaseUrl?: string;
  recentContextApiKeyPresent: boolean;
  forcedFailureTickers: Set<string>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DexterConfig {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase() || "development";
  const fixtureMode = parseBoolean(env.DEXTER_FIXTURE_MODE, true);
  const legacyModel = env.DEXTER_MODEL?.trim() ?? "";
  const providerOrder: DexterLiveProvider[] =
    env.DEXTER_PROVIDER_ORDER && env.DEXTER_PROVIDER_ORDER.trim().length > 0
      ? parseProviderOrder(env.DEXTER_PROVIDER_ORDER)
      : legacyModel.startsWith("claude-")
        ? (["anthropic", "openrouter", "openai"] as DexterLiveProvider[])
        : legacyModel.startsWith("openrouter:")
          ? (["openrouter", "anthropic", "openai"] as DexterLiveProvider[])
          : parseProviderOrder(undefined);
  const promptSource = env.DEXTER_PROMPT_SOURCE === "langsmith" ? "langsmith" : "local";
  const anthropicModel =
    (env.DEXTER_ANTHROPIC_MODEL ?? "").trim() ||
    (legacyModel.startsWith("claude-") ? legacyModel : "");
  const openrouterModel =
    (env.DEXTER_OPENROUTER_MODEL ?? "").trim() ||
    (legacyModel.startsWith("openrouter:") ? legacyModel : defaultOpenRouterModel);
  const openaiModel =
    (env.DEXTER_OPENAI_MODEL ?? "").trim() ||
    (legacyModel.length > 0 &&
    !legacyModel.startsWith("claude-") &&
    !legacyModel.startsWith("openrouter:")
      ? legacyModel
      : defaultOpenAiModel);
  const primaryModelByProvider: Record<DexterLiveProvider, string> = {
    openrouter: openrouterModel,
    anthropic: anthropicModel,
    openai: openaiModel
  };
  const primaryProvider: DexterLiveProvider = providerOrder[0] ?? "openrouter";

  return {
    port: parseInteger(env.PORT, defaultPort),
    nodeEnv,
    allowProductionFixtures: parseBoolean(env.THESIS_ALLOW_PRODUCTION_FIXTURES, false),
    fixtureMode,
    model: fixtureMode ? "fixture-dexter-m3" : primaryModelByProvider[primaryProvider] ?? "",
    providerOrder,
    promptSource,
    openrouterModel,
    openaiModel,
    anthropicModel: anthropicModel || undefined,
    bunBin: env.DEXTER_BUN_BIN ?? "bun",
    anthropicApiKeyPresent: Boolean(env.ANTHROPIC_API_KEY),
    openrouterApiKeyPresent: Boolean(env.OPENROUTER_API_KEY),
    openaiApiKeyPresent: Boolean(env.OPENAI_API_KEY),
    webSearchProviderKeyPresent: Boolean(
      env.EXASEARCH_API_KEY || env.PERPLEXITY_API_KEY || env.TAVILY_API_KEY
    ),
    maxAgentIterations: parseInteger(
      env.DEXTER_AGENT_MAX_ITERATIONS,
      defaultAgentMaxIterations
    ),
    maxParallelSections: parseInteger(
      env.DEXTER_MAX_PARALLEL_SECTIONS,
      defaultMaxParallelSections
    ),
    sectionTimeoutMs: parseInteger(env.DEXTER_SECTION_TIMEOUT_MS, defaultSectionTimeoutMs),
    retrySectionTimeoutMs: parseInteger(
      env.DEXTER_RETRY_SECTION_TIMEOUT_MS,
      defaultRetrySectionTimeoutMs
    ),
    retryBackoffMs: parseInteger(env.DEXTER_RETRY_BACKOFF_MS, defaultRetryBackoffMs),
    maxSectionRetries: parseInteger(env.DEXTER_MAX_SECTION_RETRIES, defaultMaxSectionRetries),
    minScoredClaimEvidenceCount: parseInteger(
      env.DEXTER_MIN_SCORED_CLAIM_EVIDENCE_COUNT,
      defaultScoredClaimEvidenceThreshold
    ),
    minSignalEvidenceCount: parseInteger(
      env.DEXTER_MIN_SIGNAL_EVIDENCE_COUNT,
      defaultSignalEvidenceThreshold
    ),
    promptManifestPath:
      env.DEXTER_PROMPT_MANIFEST_PATH ?? resolve(goldenRoot, "prompts.json"),
    langsmithTracingEnabled: parseBoolean(env.LANGSMITH_TRACING, false),
    langsmithProject: env.LANGSMITH_PROJECT,
    langsmithApiKeyPresent: Boolean(env.LANGSMITH_API_KEY),
    langsmithPlannerPrompt: env.LANGSMITH_PLANNER_PROMPT ?? "thesis-m2-planner",
    langsmithSectionExecutorPrompt:
      env.LANGSMITH_SECTION_EXECUTOR_PROMPT ?? "thesis-m2-section-executor",
    langsmithSynthesizerPrompt:
      env.LANGSMITH_SYNTHESIZER_PROMPT ?? "thesis-m2-synthesizer",
    langsmithKillSwitchPrompt:
      env.LANGSMITH_KILL_SWITCH_PROMPT ?? "thesis-m5-kill-switch-extractor",
    langsmithRelationshipPrompt:
      env.LANGSMITH_RELATIONSHIP_PROMPT ?? "thesis-m5-relationship-extractor",
    langsmithOppositeCasePrompt:
      env.LANGSMITH_OPPOSITE_CASE_PROMPT ?? "thesis-m6-opposite-case",
    langsmithCoherenceAnalyzerPrompt:
      env.LANGSMITH_COHERENCE_ANALYZER_PROMPT ?? "thesis-m6-coherence-analyzer",
    simulateTimeoutSection: env.DEXTER_SIMULATE_TIMEOUT_SECTION,
    queueMode: parseBoolean(env.DEXTER_QUEUE_MODE, false),
    redisUrl: env.REDIS_URL,
    queueKey: env.REDIS_JOB_QUEUE_KEY ?? "jobs:deep_dive",
    queueBlockTimeoutSeconds: parseInteger(env.DEXTER_QUEUE_BLOCK_TIMEOUT_SECONDS, 5),
    productApiInternalBaseUrl:
      env.PRODUCT_API_INTERNAL_BASE_URL ?? "http://product-api:3001",
    internalWorkerToken: env.INTERNAL_WORKER_TOKEN ?? devInternalWorkerToken,
    pulsePriceBaseUrl:
      env.DEXTER_PULSE_PRICE_BASE_URL?.trim() ||
      env.SENTIMENT_YAHOO_BASE_URL?.trim() ||
      "https://query1.finance.yahoo.com",
    pulseLlmEditorialEnabled: parseBoolean(env.PULSE_LLM_EDITORIAL_ENABLED, false),
    pulseLlmPromptVersion:
      env.PULSE_LLM_PROMPT_VERSION?.trim() || "ph7-dexter-pulse-brief-v1",
    pulseLlmMaxTokens: parseInteger(env.PULSE_LLM_MAX_TOKENS, 420),
    toolsEnabled: parseBoolean(env.DEXTER_TOOLS_ENABLED, false),
    financialAnalysisToolEnabled: parseBoolean(
      env.DEXTER_FINANCIAL_ANALYSIS_TOOL_ENABLED,
      false
    ),
    evidenceDebateToolEnabled: parseBoolean(env.DEXTER_EVIDENCE_DEBATE_TOOL_ENABLED, false),
    recentContextToolEnabled: parseBoolean(env.DEXTER_RECENT_CONTEXT_TOOL_ENABLED, false),
    recentContextCustomerVisible: parseBoolean(
      env.DEXTER_RECENT_CONTEXT_CUSTOMER_VISIBLE,
      false
    ),
    toolTimeoutMs: parseInteger(env.DEXTER_TOOL_TIMEOUT_MS, 6000),
    toolMaxResults: parseInteger(env.DEXTER_TOOL_MAX_RESULTS, 12),
    recentContextBaseUrl: env.LAST30DAYS_BASE_URL?.trim() || undefined,
    recentContextApiKeyPresent: Boolean(env.LAST30DAYS_API_KEY),
    forcedFailureTickers: parseTickerSet(env.DEXTER_FORCE_FAIL_TICKERS)
  };
}

export function validateLiveModeConfig(config: DexterConfig): string[] {
  const errors: string[] = [];

  if (config.nodeEnv === "production") {
    if (config.internalWorkerToken === devInternalWorkerToken) {
      errors.push(
        "INTERNAL_WORKER_TOKEN must not use the local development default when NODE_ENV=production"
      );
    }

    if (config.fixtureMode && !config.allowProductionFixtures) {
      errors.push(
        "DEXTER_FIXTURE_MODE must be false when NODE_ENV=production unless THESIS_ALLOW_PRODUCTION_FIXTURES=true"
      );
    }
  }

  if (config.fixtureMode) {
    return errors;
  }

  const attempts = resolveLiveProviderAttempts(config);
  if (attempts.length === 0) {
    errors.push(
      "At least one live provider is required when DEXTER_FIXTURE_MODE=false (set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY with a matching model configuration)"
    );
  }

  if (config.promptSource === "langsmith" && !config.langsmithApiKeyPresent) {
    errors.push("LANGSMITH_API_KEY is required when DEXTER_PROMPT_SOURCE=langsmith");
  }

  return errors;
}

export function resolveLiveProviderAttempts(config: DexterConfig): LiveProviderAttempt[] {
  if (config.fixtureMode) {
    return [];
  }

  const attempts: LiveProviderAttempt[] = [];
  for (const provider of config.providerOrder) {
    if (
      provider === "openrouter" &&
      config.openrouterApiKeyPresent &&
      config.openrouterModel.trim().length > 0
    ) {
      attempts.push({ provider, model: config.openrouterModel });
    }

    if (
      provider === "anthropic" &&
      config.anthropicApiKeyPresent &&
      (config.anthropicModel ?? "").trim().length > 0
    ) {
      attempts.push({ provider, model: config.anthropicModel!.trim() });
    }

    if (
      provider === "openai" &&
      config.openaiApiKeyPresent &&
      config.openaiModel.trim().length > 0
    ) {
      attempts.push({ provider, model: config.openaiModel });
    }
  }

  return attempts;
}

export function validateQueueModeConfig(config: DexterConfig): string[] {
  const errors: string[] = [];

  if (!config.queueMode) {
    return errors;
  }

  if (!config.redisUrl || config.redisUrl.trim().length === 0) {
    errors.push("REDIS_URL is required when DEXTER_QUEUE_MODE=true");
  }

  if (
    !config.productApiInternalBaseUrl ||
    config.productApiInternalBaseUrl.trim().length === 0
  ) {
    errors.push("PRODUCT_API_INTERNAL_BASE_URL is required when DEXTER_QUEUE_MODE=true");
  }

  if (!config.internalWorkerToken || config.internalWorkerToken.trim().length < 16) {
    errors.push("INTERNAL_WORKER_TOKEN must be set when DEXTER_QUEUE_MODE=true");
  }

  return errors;
}
