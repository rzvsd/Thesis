import { Client, RunTree, type RunTreeConfig } from "langsmith";

import type { ObservabilityConfig } from "./sentry";

export interface LangSmithConfig extends ObservabilityConfig {
  apiKey?: string;
  project?: string;
}

export interface LangSmithRuntime {
  enabled: boolean;
  project?: string;
  apiKeyPresent: boolean;
  client?: Client;
}

export type LangSmithRun = RunTree;

let runtime: LangSmithRuntime = {
  enabled: false,
  apiKeyPresent: false
};

export function initLangSmith(config: LangSmithConfig = {}): LangSmithRuntime {
  const enabled = Boolean(config.enabled);
  const apiKey = config.apiKey ?? process.env.LANGSMITH_API_KEY;
  const project = config.project ?? process.env.LANGSMITH_PROJECT;

  if (!enabled || !apiKey) {
    runtime = {
      enabled: false,
      project,
      apiKeyPresent: Boolean(apiKey)
    };
    return runtime;
  }

  const existing = runtime.client;
  const client = existing ?? new Client({ apiKey });

  runtime = {
    enabled: true,
    project,
    apiKeyPresent: true,
    client
  };

  return runtime;
}

export function getLangSmithRuntime(): LangSmithRuntime {
  return runtime;
}

export function getLangSmithClient(): Client | undefined {
  return runtime.client;
}

export function createLangSmithRun(
  config: Omit<RunTreeConfig, "client" | "project_name"> & { projectName?: string }
): RunTree | undefined {
  const client = runtime.client;
  if (!runtime.enabled || !client) {
    return undefined;
  }

  return new RunTree({
    ...config,
    client,
    project_name: config.projectName ?? runtime.project,
    tracingEnabled: true
  });
}

export async function awaitPendingLangSmithTraces(): Promise<void> {
  if (!runtime.enabled || !runtime.client) {
    return;
  }

  await runtime.client.awaitPendingTraceBatches();
}
