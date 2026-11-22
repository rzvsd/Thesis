import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";

import type { DexterConfig } from "./config";
import { logError, logInfo, logWarn } from "./logging";

export interface LlmTokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
}

// USD per 1M tokens. A null price means "not filled in yet".
interface LlmPrice {
  input_per_mtok: number | null;
  cached_input_per_mtok: number | null;
  output_per_mtok: number | null;
}

interface LlmCallUsage extends LlmTokenUsage {
  provider: string;
  model: string;
  estimated_cost_usd: number | null;
}

export interface LlmRunUsage extends LlmTokenUsage {
  calls: LlmCallUsage[];
  // Sum over priced calls only. unpriced_call_count > 0 means this is a lower bound.
  estimated_cost_usd: number;
  unpriced_call_count: number;
  budget_usd: number | null;
  budget_exceeded: boolean;
}

interface RunState {
  usage: LlmRunUsage;
  prices: Record<string, LlmPrice>;
}

export class LlmBudgetExceededError extends Error {}

const runStorage = new AsyncLocalStorage<RunState>();

function loadPrices(path: string): Record<string, LlmPrice> {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { models?: Record<string, LlmPrice> };
    return parsed.models ?? {};
  } catch (error) {
    logWarn("LLM price table unavailable; cost will not be estimated", {
      path,
      error_message: error instanceof Error ? error.message : String(error)
    });
    return {};
  }
}

function estimateCost(usage: LlmTokenUsage, price: LlmPrice | undefined): number | null {
  if (!price || price.input_per_mtok === null || price.output_per_mtok === null) {
    return null;
  }
  // Without a cached price, bill cached tokens at the full input price (upper bound).
  const cachedPrice = price.cached_input_per_mtok ?? price.input_per_mtok;
  return (
    (usage.input_tokens * price.input_per_mtok +
      usage.cached_input_tokens * cachedPrice +
      usage.output_tokens * price.output_per_mtok) /
    1_000_000
  );
}

function budgetMessage(usage: LlmRunUsage): string {
  return `Deep Dive LLM budget exceeded: estimated $${usage.estimated_cost_usd.toFixed(4)} >= limit $${usage.budget_usd}`;
}

/** Called before each LLM call. Throws once the run has reached its budget. */
export function assertLlmBudgetAvailable(): void {
  const state = runStorage.getStore();
  if (!state || state.usage.budget_usd === null) {
    return;
  }
  if (state.usage.estimated_cost_usd >= state.usage.budget_usd) {
    state.usage.budget_exceeded = true;
    throw new LlmBudgetExceededError(budgetMessage(state.usage));
  }
}

/** Called after each successful LLM call. No-op outside a tracked run. */
export function recordLlmCall(provider: string, model: string, tokens: LlmTokenUsage | undefined): void {
  const state = runStorage.getStore();
  if (!state || !tokens) {
    return;
  }
  const cost = estimateCost(tokens, state.prices[model]);
  const usage = state.usage;
  usage.calls.push({ provider, model, ...tokens, estimated_cost_usd: cost });
  usage.input_tokens += tokens.input_tokens;
  usage.cached_input_tokens += tokens.cached_input_tokens;
  usage.output_tokens += tokens.output_tokens;
  if (cost === null) {
    usage.unpriced_call_count += 1;
  } else {
    usage.estimated_cost_usd += cost;
  }
  if (usage.budget_usd !== null && usage.estimated_cost_usd >= usage.budget_usd) {
    usage.budget_exceeded = true;
  }
}

/**
 * Runs one Deep Dive with per-call LLM usage tracking. Logs the totals.
 * If DEXTER_MAX_DEEP_DIVE_COST_USD is set and reached, throws so the caller's
 * existing failure path runs and no report is stored.
 */
export async function trackDeepDiveLlmUsage<T>(
  config: DexterConfig,
  context: { job_id?: string; ticker?: string },
  run: () => Promise<T>
): Promise<{ result: T; usage: LlmRunUsage }> {
  const state: RunState = {
    prices: loadPrices(config.llmPricesPath),
    usage: {
      calls: [],
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      unpriced_call_count: 0,
      budget_usd: config.maxDeepDiveCostUsd ?? null,
      budget_exceeded: false
    }
  };

  const logUsage = () => {
    const usage = state.usage;
    logInfo("Deep Dive LLM usage", {
      job_id: context.job_id,
      ticker: context.ticker,
      llm_call_count: usage.calls.length,
      input_tokens: usage.input_tokens,
      cached_input_tokens: usage.cached_input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: Number(usage.estimated_cost_usd.toFixed(6)),
      unpriced_call_count: usage.unpriced_call_count,
      unpriced_models: [...new Set(usage.calls.filter((c) => c.estimated_cost_usd === null).map((c) => c.model))],
      budget_usd: usage.budget_usd ?? undefined,
      budget_exceeded: usage.budget_exceeded
    });
  };

  let result: T;
  try {
    result = await runStorage.run(state, run);
  } catch (error) {
    logUsage();
    throw error;
  }
  logUsage();

  if (state.usage.budget_exceeded) {
    logError("Deep Dive stopped: LLM budget exceeded; report discarded", {
      job_id: context.job_id,
      ticker: context.ticker,
      estimated_cost_usd: Number(state.usage.estimated_cost_usd.toFixed(6)),
      budget_usd: state.usage.budget_usd ?? undefined
    });
    throw new LlmBudgetExceededError(budgetMessage(state.usage));
  }

  return { result, usage: state.usage };
}
