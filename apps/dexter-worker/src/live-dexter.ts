import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { resolveLiveProviderAttempts, type DexterConfig } from "./config";
import { appRoot } from "./fs-roots";
import { assertLlmBudgetAvailable, recordLlmCall, type LlmTokenUsage } from "./llm-usage";

export interface LiveDexterResult {
  answer: string;
  iterations: number;
  tokenCount: number;
  usage?: LlmTokenUsage;
  provider?: string;
  model?: string;
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    duration?: number;
  }>;
}

function runLiveDexterAttempt(
  query: string,
  config: DexterConfig,
  model: string,
  modelProvider: string,
  timeoutMs: number,
  maxIterations: number
): Promise<LiveDexterResult> {
  const runnerPath = resolve(appRoot, "src", "live-runner.mjs");

  return new Promise((resolvePromise, reject) => {
    const child = spawn(config.bunBin, [runnerPath], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error(`Dexter live runner timed out for provider ${modelProvider}`));
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            stderr || `Dexter live runner exited with code ${code} for provider ${modelProvider}`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          answer: string;
          iterations: number;
          token_count: number;
          usage?: LlmTokenUsage;
          tool_calls?: Array<{
            tool: string;
            args: Record<string, unknown>;
            result: string;
            duration?: number;
          }>;
        };

        resolvePromise({
          answer: parsed.answer,
          iterations: parsed.iterations,
          tokenCount: parsed.token_count,
          usage: parsed.usage,
          provider: modelProvider,
          model,
          toolCalls: parsed.tool_calls ?? []
        });
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(
      JSON.stringify({
        query,
        model,
        modelProvider,
        maxIterations
      })
    );
    child.stdin.end();
  });
}

export function runLiveDexterQuery(
  query: string,
  config: DexterConfig,
  timeoutMs: number = config.sectionTimeoutMs,
  maxIterations: number = config.maxAgentIterations
): Promise<LiveDexterResult> {
  const attempts = resolveLiveProviderAttempts(config);
  if (attempts.length === 0) {
    return Promise.reject(
      new Error("Dexter live runner has no configured providers available for this environment")
    );
  }

  return (async () => {
    assertLlmBudgetAvailable();
    const attemptedProviders: string[] = [];
    let lastError: unknown;

    for (const attempt of attempts) {
      attemptedProviders.push(`${attempt.provider}:${attempt.model}`);
      try {
        const result = await runLiveDexterAttempt(
          query,
          config,
          attempt.model,
          attempt.provider,
          timeoutMs,
          maxIterations
        );
        recordLlmCall(attempt.provider, attempt.model, result.usage);
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `Dexter live runner failed for all providers (${attemptedProviders.join(", ")}): ${lastMessage}`
    );
  })();
}
