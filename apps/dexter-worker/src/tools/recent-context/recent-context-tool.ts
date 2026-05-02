import type { DexterToolResult, DexterToolRuntimeConfig, DexterToolVisibility } from "../tool-contract";
import { buildToolOmission } from "../tool-errors";
import { evidenceFromToolFinding } from "../tool-evidence";
import { runDexterTool } from "../tool-runner";
import type { RecentContextProvider } from "./recent-context-adapter";
import { FixtureRecentContextProvider } from "./recent-context-fixtures";
import {
  isFactualConfirmationAllowed,
  type RecentContextSourceFamily
} from "./recent-context-policy";

export interface RecentContextToolInput {
  query: string;
  ticker?: string;
  companyName?: string;
  topics?: string[];
  lookbackDays: 30;
  maxResults: number;
  mode: "deep_dive" | "pulse_internal" | "macro_context";
}

export interface RecentContextFinding {
  source_family: RecentContextSourceFamily;
  title: string;
  url: string;
  published_at?: string;
  observed_at: string;
  topic: string;
  attention_score?: number;
  stance?: "positive" | "negative" | "mixed" | "unclear";
  summary?: string;
  customer_safe: boolean;
  visibility: DexterToolVisibility;
}

export interface RecentContextToolData {
  query: string;
  lookback_days: number;
  findings: RecentContextFinding[];
  topic_summary: Array<{
    topic: string;
    finding_count: number;
    dominant_stance: "positive" | "negative" | "mixed" | "unclear";
    customer_safe: boolean;
  }>;
}

export async function runRecentContextTool(
  input: RecentContextToolInput,
  config: DexterToolRuntimeConfig,
  provider: RecentContextProvider = new FixtureRecentContextProvider()
): Promise<DexterToolResult<RecentContextToolData>> {
  return runDexterTool(
    "recent_context",
    {
      enabled: config.toolsEnabled && config.recentContextToolEnabled,
      timeoutMs: config.toolTimeoutMs
    },
    async () => buildRecentContextToolResult(input, config, provider)
  );
}

export async function buildRecentContextToolResult(
  input: RecentContextToolInput,
  config: Pick<DexterToolRuntimeConfig, "toolMaxResults" | "recentContextCustomerVisible">,
  provider: RecentContextProvider,
  generatedAt = new Date().toISOString()
): Promise<DexterToolResult<RecentContextToolData>> {
  const boundedInput = {
    ...input,
    maxResults: Math.max(0, Math.min(input.maxResults, config.toolMaxResults))
  };
  const data = await provider.search(boundedInput);
  const findings = data.findings.slice(0, boundedInput.maxResults).map((finding) => ({
    ...finding,
    customer_safe: config.recentContextCustomerVisible && finding.customer_safe,
    visibility: config.recentContextCustomerVisible && finding.customer_safe
      ? finding.visibility
      : "internal_only" as const
  }));
  const normalizedData: RecentContextToolData = {
    ...data,
    findings,
    topic_summary: data.topic_summary.map((topic) => ({
      ...topic,
      customer_safe: config.recentContextCustomerVisible && topic.customer_safe
    }))
  };
  const omissions = findings
    .filter((finding) => !finding.customer_safe)
    .map((finding) =>
      buildToolOmission({
        family: finding.source_family,
        reason_code: "policy_blocked",
        reason_text: `${finding.source_family} is internal-only and cannot be treated as customer-facing evidence.`
      })
    );
  const evidence = findings.map((finding) =>
    evidenceFromToolFinding({
      toolName: "recent_context",
      sourceFamily: finding.source_family,
      title: finding.title,
      excerpt: finding.source_family === "polymarket" && !isFactualConfirmationAllowed(finding.source_family)
        ? "Prediction-market attention signal only; not factual event confirmation."
        : finding.title,
      url: finding.url,
      retrievedAt: generatedAt,
      customerSafe: finding.customer_safe
    })
  );

  return {
    tool_name: "recent_context",
    ok: true,
    generated_at: generatedAt,
    data: normalizedData,
    evidence,
    omissions,
    confidence: findings.length > 0 ? "medium" : "low",
    visibility: findings.every((finding) => finding.customer_safe)
      ? "customer_metadata"
      : "internal_only",
    customer_safe: findings.length > 0 && findings.every((finding) => finding.customer_safe),
    notes: findings.map((finding) => `${finding.source_family}:${finding.topic}`)
  };
}
