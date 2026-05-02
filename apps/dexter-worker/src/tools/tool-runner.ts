import type { DexterToolName, DexterToolResult } from "./tool-contract";
import { buildToolFailure } from "./tool-errors";

export interface RunToolOptions {
  timeoutMs: number;
  enabled: boolean;
  now?: () => string;
}

export async function runDexterTool<T>(
  toolName: DexterToolName,
  options: RunToolOptions,
  fn: () => Promise<DexterToolResult<T>>
): Promise<DexterToolResult<T>> {
  const generatedAt = options.now?.() ?? new Date().toISOString();
  if (!options.enabled) {
    return buildToolFailure({
      toolName,
      generatedAt,
      reason_code: "disabled",
      reason_text: `${toolName} is disabled by configuration.`
    });
  }

  let timeout: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<DexterToolResult<T>>((resolve) => {
        timeout = setTimeout(() => {
          resolve(buildToolFailure({
            toolName,
            generatedAt,
            reason_code: "timeout",
            reason_text: `${toolName} exceeded the configured timeout.`
          }));
        }, Math.max(1, options.timeoutMs));
      })
    ]);
    return {
      ...result,
      generated_at: result.generated_at || generatedAt
    };
  } catch {
    return buildToolFailure({
      toolName,
      generatedAt,
      reason_code: "internal_error",
      reason_text: `${toolName} failed internally; raw error details were withheld.`,
      notes: ["internal_error"]
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
