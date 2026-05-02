import assert from "node:assert/strict";
import test from "node:test";

import type { DexterToolResult } from "../../src/tools/tool-contract";
import { runDexterTool } from "../../src/tools/tool-runner";

function okResult<T>(data: T): DexterToolResult<T> {
  return {
    tool_name: "financial_analysis",
    ok: true,
    generated_at: "2026-05-01T12:00:00.000Z",
    data,
    evidence: [],
    omissions: [],
    confidence: "high",
    visibility: "customer_metadata",
    customer_safe: true,
    notes: []
  };
}

test("tool runner returns successful tool results", async () => {
  const result = await runDexterTool(
    "financial_analysis",
    { enabled: true, timeoutMs: 50, now: () => "2026-05-01T00:00:00.000Z" },
    async () => okResult({ value: 1 })
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { value: 1 });
});

test("tool runner returns disabled omissions", async () => {
  const result = await runDexterTool(
    "recent_context",
    { enabled: false, timeoutMs: 50, now: () => "2026-05-01T00:00:00.000Z" },
    async () => okResult({ value: 1 })
  );

  assert.equal(result.ok, false);
  assert.equal(result.omissions[0]?.reason_code, "disabled");
});

test("tool runner converts timeouts into omissions", async () => {
  const result = await runDexterTool(
    "recent_context",
    { enabled: true, timeoutMs: 5, now: () => "2026-05-01T00:00:00.000Z" },
    async () => new Promise<DexterToolResult<{ value: number }>>((resolve) => {
      setTimeout(() => resolve(okResult({ value: 1 })), 50);
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.omissions[0]?.reason_code, "timeout");
});

test("tool runner converts thrown errors without leaking stack traces", async () => {
  const result = await runDexterTool(
    "evidence_debate",
    { enabled: true, timeoutMs: 50, now: () => "2026-05-01T00:00:00.000Z" },
    async () => {
      throw new Error("secret stack details");
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.omissions[0]?.reason_code, "internal_error");
  assert.doesNotMatch(JSON.stringify(result), /secret stack details|at /i);
});
