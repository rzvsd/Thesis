import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../../src/config";
import { FixtureRecentContextProvider } from "../../src/tools/recent-context/recent-context-fixtures";
import {
  buildRecentContextToolResult,
  runRecentContextTool
} from "../../src/tools/recent-context/recent-context-tool";

const input = {
  query: "AAPL Apple",
  ticker: "AAPL",
  companyName: "Apple Inc.",
  lookbackDays: 30 as const,
  maxResults: 2,
  mode: "deep_dive" as const
};

test("recent context fixture returns bounded internal-only findings", async () => {
  const result = await buildRecentContextToolResult(
    input,
    { toolMaxResults: 1, recentContextCustomerVisible: false },
    new FixtureRecentContextProvider(),
    "2026-05-01T00:00:00.000Z"
  );

  assert.equal(result.ok, true);
  assert.equal(result.data?.findings.length, 1);
  assert.equal(result.data?.findings[0]?.visibility, "internal_only");
  assert.equal(result.customer_safe, false);
  assert.equal(result.omissions[0]?.reason_code, "policy_blocked");
});

test("recent context treats polymarket as attention only", async () => {
  const result = await buildRecentContextToolResult(
    { ...input, query: "geopolitical risk", ticker: undefined, topics: ["geopolitical risk"] },
    { toolMaxResults: 12, recentContextCustomerVisible: false },
    new FixtureRecentContextProvider(),
    "2026-05-01T00:00:00.000Z"
  );

  assert.ok(result.evidence.some((entry) =>
    entry.excerpt.includes("not factual event confirmation")
  ));
  assert.ok(result.data?.findings.every((finding) => finding.visibility === "internal_only"));
});

test("recent context disabled mode returns omission", async () => {
  const result = await runRecentContextTool(
    input,
    loadConfig({
      ...process.env,
      DEXTER_TOOLS_ENABLED: "true",
      DEXTER_RECENT_CONTEXT_TOOL_ENABLED: "false"
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.omissions[0]?.reason_code, "disabled");
});
