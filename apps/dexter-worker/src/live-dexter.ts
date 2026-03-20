import { spawn } from "node:child_process";
import { resolve } from "node:path";

import type { DexterConfig } from "./config";
import { appRoot } from "./fs-roots";

export interface LiveDexterResult {
  answer: string;
  iterations: number;
  tokenCount: number;
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    duration?: number;
  }>;
}

export function runLiveDexterQuery(
  query: string,
  config: DexterConfig,
  timeoutMs: number = config.sectionTimeoutMs,
  maxIterations: number = config.maxAgentIterations
): Promise<LiveDexterResult> {
  const runnerPath = resolve(appRoot, "src", "live-runner.mjs");

  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      config.bunBin,
      [runnerPath],
      {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

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
        reject(new Error("Dexter live runner timed out"));
        return;
      }

      if (code !== 0) {
        reject(new Error(stderr || `Dexter live runner exited with code ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          answer: string;
          iterations: number;
          token_count: number;
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
          toolCalls: parsed.tool_calls ?? []
        });
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(
      JSON.stringify({
        query,
        model: config.model,
        maxIterations
      })
    );
    child.stdin.end();
  });
}
