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

export interface DexterConfig {
  port: number;
  fixtureMode: boolean;
  model: string;
  bunBin: string;
  anthropicApiKeyPresent: boolean;
  financialDatasetsApiKeyPresent: boolean;
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
  simulateTimeoutSection?: string;
  queueMode: boolean;
  redisUrl?: string;
  queueKey: string;
  queueBlockTimeoutSeconds: number;
  productApiInternalBaseUrl: string;
  internalWorkerToken: string;
  forcedFailureTickers: Set<string>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DexterConfig {
  const fixtureMode = parseBoolean(env.DEXTER_FIXTURE_MODE, true);

  return {
    port: parseInteger(env.PORT, defaultPort),
    fixtureMode,
    model: fixtureMode ? "fixture-dexter-m3" : env.DEXTER_MODEL ?? "",
    bunBin: env.DEXTER_BUN_BIN ?? "bun",
    anthropicApiKeyPresent: Boolean(env.ANTHROPIC_API_KEY),
    financialDatasetsApiKeyPresent: Boolean(env.FINANCIAL_DATASETS_API_KEY),
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
    langsmithPlannerPrompt: env.LANGSMITH_PLANNER_PROMPT ?? "thesis-m3-planner",
    langsmithSectionExecutorPrompt:
      env.LANGSMITH_SECTION_EXECUTOR_PROMPT ?? "thesis-m3-section-executor",
    langsmithSynthesizerPrompt:
      env.LANGSMITH_SYNTHESIZER_PROMPT ?? "thesis-m3-synthesizer",
    simulateTimeoutSection: env.DEXTER_SIMULATE_TIMEOUT_SECTION,
    queueMode: parseBoolean(env.DEXTER_QUEUE_MODE, false),
    redisUrl: env.REDIS_URL,
    queueKey: env.REDIS_JOB_QUEUE_KEY ?? "jobs:deep_dive",
    queueBlockTimeoutSeconds: parseInteger(env.DEXTER_QUEUE_BLOCK_TIMEOUT_SECONDS, 5),
    productApiInternalBaseUrl:
      env.PRODUCT_API_INTERNAL_BASE_URL ?? "http://product-api:3001",
    internalWorkerToken: env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token",
    forcedFailureTickers: parseTickerSet(env.DEXTER_FORCE_FAIL_TICKERS)
  };
}

export function validateLiveModeConfig(config: DexterConfig): string[] {
  const errors: string[] = [];

  if (config.fixtureMode) {
    return errors;
  }

  if (config.model.trim().length === 0) {
    errors.push("DEXTER_MODEL is required when DEXTER_FIXTURE_MODE=false");
  }

  if (!config.anthropicApiKeyPresent) {
    errors.push("ANTHROPIC_API_KEY is required when DEXTER_FIXTURE_MODE=false");
  }

  if (!config.financialDatasetsApiKeyPresent) {
    errors.push("FINANCIAL_DATASETS_API_KEY is required when DEXTER_FIXTURE_MODE=false");
  }

  if (!config.langsmithTracingEnabled) {
    errors.push("LANGSMITH_TRACING=true is required when DEXTER_FIXTURE_MODE=false");
  }

  if (!config.langsmithApiKeyPresent) {
    errors.push("LANGSMITH_API_KEY is required when DEXTER_FIXTURE_MODE=false");
  }

  if (!config.langsmithProject || config.langsmithProject.trim().length === 0) {
    errors.push("LANGSMITH_PROJECT is required when DEXTER_FIXTURE_MODE=false");
  }

  return errors;
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
