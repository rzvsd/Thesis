import type {
  MarketPulseBriefEditorial,
  MarketPulseReport
} from "../../../packages/contracts/src";
import { logWarn } from "./logging";
import { createOpenRouterChatCompletion } from "./openrouter-client";
import { buildPulseBriefFactPack, buildDeterministicPulseBriefCopy } from "./pulse-brief-plan";

export interface PulseBriefLlmEditorialConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  promptVersion: string;
}

export interface PulseBriefLlmEditorialOptions {
  config: PulseBriefLlmEditorialConfig;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

type PulseBriefLlmDraft = MarketPulseBriefEditorial;

const bannedAdvicePattern =
  /\b(buy|sell|hold|short|long|price target|entry|exit|stop loss|take profit|trade now|add shares|trim shares|overweight|underweight|outperform|underperform)\b/i;

const allowedMacroTokens = new Set([
  "AI",
  "BEA",
  "BLS",
  "CPI",
  "DJIA",
  "DXY",
  "ECB",
  "ETF",
  "FED",
  "FOMC",
  "FX",
  "GDP",
  "HY",
  "ISM",
  "JOLTS",
  "NASDAQ",
  "NDX",
  "NFP",
  "NYSE",
  "OPEC",
  "PCE",
  "PMI",
  "PPI",
  "RUT",
  "SEC",
  "SPX",
  "UK",
  "US",
  "USD",
  "UST",
  "VIX",
  "WTI"
]);

export async function applyPulseBriefLlmEditorial(
  report: MarketPulseReport,
  options: PulseBriefLlmEditorialOptions
): Promise<MarketPulseReport> {
  const now = options.now ?? (() => new Date().toISOString());
  const factPack = buildPulseBriefFactPack(report);

  if (!options.config.enabled || !options.config.apiKey) {
    return report;
  }

  if (factPack.mode === "quiet") {
    return {
      ...report,
      brief_editorial: buildDeterministicPulseBriefCopy(factPack),
      editorial_generation: {
        mode: "deterministic",
        status: "disabled",
        source_report_id: report.report_id,
        coverage_notes: ["Quiet day bypassed the LLM brief writer."]
      }
    };
  }

  try {
    const content = await createOpenRouterChatCompletion({
      apiKey: options.config.apiKey,
      baseUrl: options.config.baseUrl,
      model: options.config.model,
      timeoutMs: options.config.timeoutMs,
      maxTokens: Math.min(options.config.maxTokens, 360),
      temperature: 0.15,
      fetchImpl: options.fetchImpl,
      messages: [
        {
          role: "system",
          content: [
            "You are the Thesis Morning Brief copy editor.",
            "Return only strict JSON with these keys: morning_line, yesterday_comment, interesting_bit, your_names_comment, signal, noise.",
            "Use only the provided fact pack. Do not add tickers, prices, sources, causality, advice, or claims.",
            "Avoid the word because unless the fact pack explicitly provides a causal link. This fact pack does not.",
            "No buy, sell, hold, price target, execution, or portfolio instruction language."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            contract: {
              morning_line: "max 22 words",
              yesterday_comment: "max 45 words",
              interesting_bit: "max 55 words",
              your_names_comment: "max 35 words, optional",
              signal: "max 14 words",
              noise: "max 14 words",
              total_words: "under 180"
            },
            fact_pack: {
              as_of: factPack.as_of,
              mode: factPack.mode,
              morning_verdict: factPack.morning_verdict,
              tape: factPack.tape,
              deltas: factPack.deltas,
              interesting_candidates: factPack.interesting_candidates,
              user_names: factPack.user_names,
              calendar: factPack.calendar,
              headlines: factPack.headlines,
              sources: factPack.sources
            }
          })
        }
      ]
    });

    const draft = validatePulseBriefLlmDraft(parseJsonObject(content), report);
    return {
      ...report,
      brief_editorial: draft,
      editorial_generation: {
        mode: "llm",
        status: "generated",
        provider: "openrouter",
        model: options.config.model,
        prompt_version: options.config.promptVersion,
        generated_at: now(),
        source_report_id: report.report_id,
        coverage_notes: []
      }
    };
  } catch (error) {
    logWarn("Pulse brief LLM editorial rejected; falling back to deterministic brief.", {
      report_id: report.report_id,
      reason_category: llmRejectionCategory(error)
    });
    return {
      ...report,
      editorial_generation: {
        mode: "llm",
        status: "rejected",
        provider: "openrouter",
        model: options.config.model,
        prompt_version: options.config.promptVersion,
        generated_at: now(),
        source_report_id: report.report_id,
        coverage_notes: [llmRejectionCategory(error)]
      }
    };
  }
}

export function validatePulseBriefLlmDraft(
  value: unknown,
  report: MarketPulseReport
): MarketPulseBriefEditorial {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("LLM brief output is not an object");
  }
  const draft = value as Partial<PulseBriefLlmDraft>;
  const result = {
    morning_line: validateField("morning_line", draft.morning_line, report, 22),
    yesterday_comment: validateField("yesterday_comment", draft.yesterday_comment, report, 45),
    interesting_bit: validateField("interesting_bit", draft.interesting_bit, report, 55),
    your_names_comment: draft.your_names_comment
      ? validateField("your_names_comment", draft.your_names_comment, report, 35)
      : undefined,
    signal: validateField("signal", draft.signal, report, 14),
    noise: validateField("noise", draft.noise, report, 14)
  };

  const totalWords = Object.values(result).reduce(
    (total, field) => total + (typeof field === "string" ? wordCount(field) : 0),
    0
  );
  if (totalWords >= 180) {
    throw new Error("LLM brief output exceeds total word budget");
  }
  return result;
}

function validateField(
  key: keyof PulseBriefLlmDraft,
  text: string | undefined,
  report: MarketPulseReport,
  maxWords: number
): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (value.length < 4) {
    throw new Error(`LLM brief output field ${key} is too short`);
  }
  if (wordCount(value) > maxWords) {
    throw new Error(`LLM brief output field ${key} exceeds word budget`);
  }
  if (bannedAdvicePattern.test(value)) {
    throw new Error(`LLM brief output field ${key} contains trading advice language`);
  }
  if (/\bbecause\b/i.test(value)) {
    throw new Error(`LLM brief output field ${key} contains unsupported causality`);
  }
  const unsupportedTicker = assertNoUnknownTickers(value, report);
  if (unsupportedTicker) {
    throw new Error(`LLM brief output field ${key} contains ${unsupportedTicker}`);
  }
  const unsupportedSource = assertNoUnknownSources(value, report);
  if (unsupportedSource) {
    throw new Error(`LLM brief output field ${key} contains ${unsupportedSource}`);
  }
  return value;
}

function assertNoUnknownTickers(text: string, report: MarketPulseReport): string | undefined {
  const allowed = allowedTickers(report);
  if (allowed.size === 0) {
    return undefined;
  }
  const candidates = new Set<string>();
  for (const match of text.matchAll(/(?:\$|\()([A-Z]{2,6})(?:\))?/g)) {
    if (match[1]) {
      candidates.add(match[1]);
    }
  }
  for (const match of text.matchAll(/\b[A-Z]{2,6}\b/g)) {
    candidates.add(match[0]);
  }
  for (const candidate of candidates) {
    if (!allowed.has(candidate) && !allowedMacroTokens.has(candidate)) {
      return `unsupported ticker or acronym ${candidate}`;
    }
  }
  return undefined;
}

function allowedTickers(report: MarketPulseReport): Set<string> {
  const values = new Set<string>();
  for (const row of report.morning_edition?.portfolio_radar ?? []) {
    values.add(row.ticker.trim().toUpperCase());
  }
  for (const ticker of report.user_research_state?.watchlist_tickers ?? []) {
    values.add(ticker.trim().toUpperCase());
  }
  for (const holding of report.user_research_state?.holdings ?? []) {
    values.add(holding.ticker.trim().toUpperCase());
  }
  for (const name of report.user_research_state?.names ?? []) {
    values.add(name.ticker.trim().toUpperCase());
  }
  return values;
}

function assertNoUnknownSources(text: string, report: MarketPulseReport): string | undefined {
  const allowed = new Set(
    buildPulseBriefFactPack(report).sources.map((source) => source.toLowerCase())
  );
  const sourceLike = [...text.matchAll(/\b(Bloomberg|Reuters|WSJ|CNBC|Federal Reserve|Treasury|FRED|SEC|BEA|BLS)\b/g)]
    .map((match) => match[0]);
  for (const source of sourceLike) {
    const lower = source.toLowerCase();
    const matched = [...allowed].some((allowedSource) => allowedSource.includes(lower));
    if (!matched && !["fred", "sec", "bea", "bls"].includes(lower)) {
      return `unsupported source ${source}`;
    }
  }
  return undefined;
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(trimmed) as unknown;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function llmRejectionCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/JSON|object/i.test(message)) {
    return "malformed_json";
  }
  if (/trading advice/i.test(message)) {
    return "trading_language";
  }
  if (/unsupported ticker/i.test(message)) {
    return "unknown_ticker";
  }
  if (/unsupported source/i.test(message)) {
    return "unknown_source";
  }
  if (/causality|because/i.test(message)) {
    return "unsupported_causality";
  }
  if (/word budget|too short/i.test(message)) {
    return "shape_violation";
  }
  if (/OpenRouter|fetch|timeout|Abort/i.test(message)) {
    return "provider_unavailable";
  }
  return "validation_failed";
}
