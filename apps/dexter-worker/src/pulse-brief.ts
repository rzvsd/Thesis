import { randomUUID } from "node:crypto";

import type {
  MarketPulseBriefEditorial,
  MarketPulsePortfolioRadarRow,
  MarketPulseReport,
  ReportSection,
  UserResearchState
} from "../../../packages/contracts/src";
import type { DexterConfig } from "./config";
import { logWarn } from "./logging";
import { runLiveDexterQuery } from "./live-dexter";
import { buildPulseEditorialPrompt } from "./pulse-editorial-prompt";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

interface ClosePricePair {
  previousClose?: number;
  latestClose: number;
}

export interface DexterPulseBriefRequest {
  report?: MarketPulseReport;
  user_id?: string;
  as_of?: string;
  user_research_state?: UserResearchState;
  tickers?: string[];
}

export interface DexterPulseBriefResult {
  report: MarketPulseReport;
  analyst: "dexter";
  generated_at: string;
  data_families: string[];
  commentary_mode: "deterministic" | "llm";
}

const bannedAdvicePattern =
  /\b(buy|sell|hold|short|long|price target|entry|exit|stop loss|take profit|trade now|add shares|trim shares|overweight|underweight|outperform|underperform)\b/i;

const macroAcronyms = new Set([
  "AI",
  "BEA",
  "BLS",
  "CPI",
  "DJIA",
  "DXY",
  "ETF",
  "FED",
  "FOMC",
  "FX",
  "GDP",
  "HY",
  "NASDAQ",
  "NDX",
  "OPEC",
  "PCE",
  "PMI",
  "PPI",
  "RUT",
  "SEC",
  "SPX",
  "US",
  "USD",
  "UST",
  "VIX",
  "WTI"
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertMarketPulseReport(value: unknown): MarketPulseReport {
  if (!isObject(value) || typeof value.report_id !== "string" || !isObject(value.sections)) {
    throw new Error("report must be a MarketPulseReport-like object");
  }
  return value as unknown as MarketPulseReport;
}

function uniqueTickers(values: Array<string | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim().toUpperCase() ?? "")
        .filter((value) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value))
    )
  ];
}

function latestClosePair(values: Array<number | null> | undefined): ClosePricePair | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const finite: number[] = [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      finite.push(value);
      if (finite.length === 2) {
        break;
      }
    }
  }
  const [latestClose, previousClose] = finite;
  if (latestClose === undefined) {
    return undefined;
  }
  return {
    latestClose,
    ...(previousClose !== undefined ? { previousClose } : {})
  };
}

async function fetchLatestClosePricePair(
  baseUrl: string,
  symbol: string
): Promise<ClosePricePair | undefined> {
  const url = new URL(
    `${baseUrl.replace(/\/$/, "")}/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  url.searchParams.set("range", "1mo");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`price request failed for ${symbol}: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as YahooChartResponse;
  return latestClosePair(payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close);
}

async function fetchLatestClosePricePairs(
  baseUrl: string,
  symbols: string[],
  concurrency = 6
): Promise<Map<string, ClosePricePair>> {
  const uniqueSymbols = uniqueTickers(symbols);
  const maxWorkers = Math.max(1, Math.min(concurrency, uniqueSymbols.length));
  const results = new Map<string, ClosePricePair>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < uniqueSymbols.length) {
      const index = cursor;
      cursor += 1;
      const symbol = uniqueSymbols[index];
      if (!symbol) {
        continue;
      }
      try {
        const pair = await fetchLatestClosePricePair(baseUrl, symbol);
        if (pair) {
          results.set(symbol, pair);
        }
      } catch {
        continue;
      }
    }
  }

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
  return results;
}

function marketBreadth(report: MarketPulseReport): "higher" | "lower" | "mixed" | "thin" {
  const core = report.market_tape?.indices.filter((entry) => entry.family === "core_index") ?? [];
  if (core.length < 2) {
    return "thin";
  }
  const up = core.filter((entry) => entry.direction === "up").length;
  const down = core.filter((entry) => entry.direction === "down").length;
  if (up >= 3) {
    return "higher";
  }
  if (down >= 3) {
    return "lower";
  }
  return "mixed";
}

function directionFromChange(value: number): MarketPulsePortfolioRadarRow["direction"] {
  if (Math.abs(value) < 0.005) {
    return "flat";
  }
  return value > 0 ? "up" : "down";
}

function companyNameForTicker(
  ticker: string,
  report: MarketPulseReport,
  state?: UserResearchState
): string | undefined {
  const researchName = state?.names.find((name) => name.ticker === ticker);
  if (researchName?.company_name) {
    return researchName.company_name;
  }
  return report.morning_edition?.portfolio_radar.find((row) => row.ticker === ticker)?.company_name;
}

function portfolioPriceReason(
  direction: MarketPulsePortfolioRadarRow["direction"],
  changePct: number | undefined,
  breadth: ReturnType<typeof marketBreadth>
): string {
  if (typeof changePct !== "number" || !Number.isFinite(changePct)) {
    return "Latest close was available, but the prior close was not; no price move is shown.";
  }
  if (Math.abs(changePct) < 0.5) {
    return "No material price move. No company-specific evidence confirmed in approved sources.";
  }
  if (direction === "up" && breadth === "higher") {
    return "Moved with the broader tape. No company-specific evidence confirmed in approved sources.";
  }
  if (direction === "down" && breadth === "higher") {
    return "Lagged a firmer tape. No company-specific evidence confirmed in approved sources.";
  }
  if (direction === "up" && breadth === "lower") {
    return "Outpaced a softer tape. No company-specific evidence confirmed in approved sources.";
  }
  if (Math.abs(changePct) >= 2) {
    return "Bigger move, but no confirmed company-specific catalyst in approved sources.";
  }
  return "Moved with market context rather than confirmed company-specific evidence.";
}

function portfolioRowFromPrice(input: {
  ticker: string;
  companyName?: string;
  pair: ClosePricePair;
  report: MarketPulseReport;
  retrievedAt: string;
}): MarketPulsePortfolioRadarRow {
  const previousClose = input.pair.previousClose;
  const latestPrice = input.pair.latestClose;
  const change =
    typeof previousClose === "number" && Number.isFinite(previousClose)
      ? latestPrice - previousClose
      : undefined;
  const changePct =
    change !== undefined && previousClose && previousClose > 0
      ? (change / previousClose) * 100
      : undefined;
  const direction = directionFromChange(changePct ?? 0);
  return {
    ticker: input.ticker,
    ...(input.companyName ? { company_name: input.companyName } : {}),
    ...(typeof previousClose === "number" ? { previous_close: previousClose } : {}),
    latest_price: latestPrice,
    ...(typeof change === "number" ? { change } : {}),
    ...(typeof changePct === "number" ? { change_pct: changePct } : {}),
    direction,
    reason: portfolioPriceReason(direction, changePct, marketBreadth(input.report)),
    evidence: [
      {
        evidence_id: randomUUID(),
        source_type: "financial_data",
        source_name: "Dexter price tracker",
        excerpt:
          typeof previousClose === "number"
            ? `${input.ticker}: latest close ${latestPrice.toFixed(2)} versus prior close ${previousClose.toFixed(2)}.`
            : `${input.ticker}: latest close ${latestPrice.toFixed(2)}; prior close unavailable.`,
        retrieved_at: input.retrievedAt
      }
    ]
  };
}

async function buildPortfolioRows(input: {
  report: MarketPulseReport;
  state?: UserResearchState;
  tickers: string[];
  config: DexterConfig;
  now: string;
}): Promise<MarketPulsePortfolioRadarRow[]> {
  const tickers = uniqueTickers([
    ...input.tickers,
    ...(input.state?.watchlist_tickers ?? []),
    ...(input.state?.holdings.map((holding) => holding.ticker) ?? []),
    ...(input.state?.names.map((name) => name.ticker) ?? [])
  ]).slice(0, 12);
  if (tickers.length === 0) {
    return input.report.morning_edition?.portfolio_radar ?? [];
  }

  const prices = await fetchLatestClosePricePairs(input.config.pulsePriceBaseUrl, tickers, 6);
  const rows = tickers
    .map((ticker) => {
      const pair = prices.get(ticker);
      if (!pair) {
        return undefined;
      }
      return portfolioRowFromPrice({
        ticker,
        companyName: companyNameForTicker(ticker, input.report, input.state),
        pair,
        report: input.report,
        retrievedAt: input.now
      });
    })
    .filter((row): row is MarketPulsePortfolioRadarRow => Boolean(row));

  if (rows.length > 0) {
    return rows;
  }
  return input.report.morning_edition?.portfolio_radar ?? [];
}

function portfolioSection(rows: MarketPulsePortfolioRadarRow[]): ReportSection | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  return {
    section_id: "portfolio_radar",
    title: "Your Names",
    body: rows
      .map((row) => {
        const move =
          typeof row.change_pct === "number"
            ? `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}%`
            : "price move unavailable";
        return `${row.ticker}: ${move}. ${row.reason ?? "No thesis-level change."}`;
      })
      .join(" "),
    status: "complete",
    evidence: rows.flatMap((row) => row.evidence)
  };
}

function mergePortfolioRows(
  report: MarketPulseReport,
  rows: MarketPulsePortfolioRadarRow[]
): MarketPulseReport {
  if (rows.length === 0) {
    return report;
  }
  const section = portfolioSection(rows);
  const morningEdition = report.morning_edition
    ? {
        ...report.morning_edition,
        portfolio_radar: rows
      }
    : report.morning_edition;
  return {
    ...report,
    ...(morningEdition ? { morning_edition: morningEdition } : {}),
    sections: {
      ...report.sections,
      ...(section ? { portfolio_radar: section } : {})
    }
  };
}

function withUserState(report: MarketPulseReport, state?: UserResearchState): MarketPulseReport {
  if (!state) {
    return report;
  }
  return {
    ...report,
    user_research_state: state
  };
}

function deterministicBrief(report: MarketPulseReport): MarketPulseBriefEditorial {
  const breadth = marketBreadth(report);
  const rows = report.morning_edition?.portfolio_radar ?? [];
  const vix = report.market_tape?.cross_asset.find((move) => move.family === "volatility");
  const oneThing = vix && vix.direction === "down"
    ? "Volatility cooled alongside the equity move, giving the session cleaner texture than price alone."
    : "Market movement stayed contextual until official events or company evidence confirm more.";
  const morningStory = breadth === "higher"
    ? [
        "Risk appetite improved, but conviction did not reset. Yesterday's tape was broadly better: equities rose, volatility cooled, and the cross-asset backdrop was easier to digest.",
        "That combination matters more than a green index print by itself. A cleaner session is easier to respect when volatility is not fighting the move.",
        rows.length > 0
          ? "Your tracked names mostly moved with that broader context. That makes the day useful, but not company-specific evidence."
          : "No tracked-name evidence created a separate company story, so the read stays anchored in the tape.",
        "The morning conclusion is simple: better texture, not a new regime."
      ].join("\n\n")
    : breadth === "lower"
      ? [
          "Risk appetite softened, but the brief keeps movement separate from thesis change.",
          "The useful question is whether volatility, rates, credit, or company evidence confirmed the weakness. Without that, the move remains market context.",
          rows.length > 0
            ? "Your tracked names are checked against that tape first, then against company-specific evidence."
            : "No tracked-name evidence created a separate story.",
          "The morning conclusion is caution without theater."
        ].join("\n\n")
      : [
          "The tape was mixed, and macro did not give the market a clean new answer.",
          "That makes today more about separating useful context from noise than forcing a directional story.",
          rows.length > 0
            ? "Your tracked names mostly sit inside that mixed context."
            : "No tracked-name evidence created a separate story.",
          "The morning conclusion is patience."
        ].join("\n\n");
  return {
    the_read:
      breadth === "higher"
        ? "Risk appetite improved, but conviction did not reset. Yesterday's tape was broadly better: equities rose, volatility cooled, and the cross-asset backdrop was easier to digest. That is healthier than price alone, but it is still a cleaner session rather than a new regime."
        : breadth === "lower"
          ? "Risk appetite softened, but the brief keeps movement separate from thesis change. The right question is whether volatility, rates, credit, or company evidence confirmed the move. Without that confirmation, yesterday reads as market context rather than a reset."
          : "Markets were mixed, so the useful read is what changed versus what stayed quiet. Thesis keeps the brief focused on confirmed movement, macro context, and tracked-name evidence rather than forcing a directional story.",
    what_changed_summary:
      "The tape changed first, volatility and rates shaped the quality of the move, and no company-specific event changed the tracked-name story. The rest stays framed as context until official or first-party evidence says more.",
    why_it_matters:
      vix && typeof vix.daily_change_pct === "number" && vix.direction === "down"
        ? "The useful part is not that stocks went up. It is that the move came with lower volatility, which gives the session better texture than price alone. That helps the morning read, but conviction still needs repeated confirmation or company-specific evidence."
        : "The useful part is the split between market movement and conviction. A cleaner session can improve context, but a thesis change still needs repeated confirmation, official events, or company-specific evidence.",
    ...(rows.length > 0
      ? {
          your_names_comment:
            "Your names mostly moved with the broader tape. That makes yesterday useful context, but not company-specific evidence."
        }
      : {}),
    smart_comment:
      "Yesterday gave users a cleaner tape, not a stronger thesis. The difference matters. A better session can improve context, but conviction should come from repeated confirmation, official events, or company-specific evidence rather than one market day.",
    morning_story: morningStory,
    tape_color:
      breadth === "higher" && vix?.direction === "down"
        ? "Equities rose while VIX cooled"
        : breadth === "lower"
          ? "Softer tape, confirmation still selective"
          : "Mixed tape, selective read",
    ...(rows.length > 0
      ? {
          names_narrative:
            "Your names mostly moved with the broader tape. That makes the session useful context, but not company-specific evidence."
        }
      : {}),
    one_thing: oneThing,
    mood: breadth === "higher" ? "confident" : breadth === "lower" ? "cautious" : "curious"
  };
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

function validateCopy(
  draft: Partial<MarketPulseBriefEditorial>,
  report: MarketPulseReport
): MarketPulseBriefEditorial {
  const fallback = deterministicBrief(report);
  const merged = { ...fallback, ...draft };
  const totalWords = [
    merged.the_read,
    merged.what_changed_summary,
    merged.why_it_matters,
    merged.your_names_comment,
    merged.smart_comment,
    merged.morning_story,
    merged.tape_color,
    merged.names_narrative,
    merged.one_thing
  ].join(" ").split(/\s+/).filter(Boolean).length;
  if (totalWords > 500) {
    throw new Error("brief editorial exceeds 500 word budget");
  }
  return {
    the_read: validateCopyField("the_read", merged.the_read, report, 90, 12),
    what_changed_summary: validateCopyField(
      "what_changed_summary",
      merged.what_changed_summary,
      report,
      80,
      8
    ),
    why_it_matters: validateCopyField("why_it_matters", merged.why_it_matters, report, 90, 12),
    ...(merged.your_names_comment
      ? {
          your_names_comment: validateCopyField(
            "your_names_comment",
            merged.your_names_comment,
            report,
            80,
            6
          )
        }
      : {}),
    smart_comment: validateCopyField("smart_comment", merged.smart_comment, report, 100, 10),
    morning_story: validateCopyField("morning_story", merged.morning_story, report, 280, 45),
    tape_color: validateCopyField("tape_color", merged.tape_color, report, 18, 3),
    ...(merged.names_narrative
      ? {
          names_narrative: validateCopyField(
            "names_narrative",
            merged.names_narrative,
            report,
            80,
            8
          )
        }
      : {}),
    one_thing: validateCopyField("one_thing", merged.one_thing, report, 45, 8),
    mood: validateMood(merged.mood)
  };
}

function validateCopyField(
  key: string,
  value: string | undefined,
  report: MarketPulseReport,
  maxWords: number,
  minWords: number
): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < minWords) {
    throw new Error(`${key} is too short`);
  }
  if (wordCount > maxWords) {
    throw new Error(`${key} exceeds word budget`);
  }
  if (bannedAdvicePattern.test(text)) {
    throw new Error(`${key} contains trading language`);
  }
  if (/\bbecause\b/i.test(text)) {
    throw new Error(`${key} contains unsupported causality`);
  }
  const allowed = allowedTickers(report);
  for (const match of text.matchAll(/\b[A-Z]{2,6}\b/g)) {
    const token = match[0];
    if (!allowed.has(token) && !macroAcronyms.has(token)) {
      throw new Error(`${key} contains unsupported ticker or acronym ${token}`);
    }
  }
  return text;
}

function validateMood(value: string | undefined): MarketPulseBriefEditorial["mood"] {
  if (value === "confident" || value === "cautious" || value === "curious" || value === "calm") {
    return value;
  }
  return "curious";
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(trimmed) as unknown;
}

async function applyDexterCommentary(
  report: MarketPulseReport,
  config: DexterConfig,
  now: string
): Promise<{ report: MarketPulseReport; mode: "deterministic" | "llm" }> {
  const fallback = deterministicBrief(report);
  if (!config.pulseLlmEditorialEnabled || config.fixtureMode) {
    return {
      report: {
        ...report,
        brief_editorial: fallback,
        editorial_generation: {
          mode: "deterministic",
          status: "disabled",
          source_report_id: report.report_id,
          coverage_notes: ["Dexter generated deterministic Pulse commentary."]
        }
      },
      mode: "deterministic"
    };
  }

  try {
    const query = buildPulseEditorialPrompt(report);
    const result = await runLiveDexterQuery(
      query,
      config,
      Math.min(config.sectionTimeoutMs, 12_000),
      1
    );
    const copy = validateCopy(parseJsonObject(result.answer) as Partial<MarketPulseBriefEditorial>, report);
    return {
      report: {
        ...report,
        brief_editorial: copy,
        editorial_generation: {
          mode: "llm",
          status: "generated",
          provider: result.provider === "openrouter" ? "openrouter" : undefined,
          model: result.model,
          prompt_version: config.pulseLlmPromptVersion,
          generated_at: now,
          source_report_id: report.report_id,
          coverage_notes: ["Dexter LLM rewrote commentary only; report facts remained deterministic."]
        }
      },
      mode: "llm"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("Dexter Pulse commentary rejected; using deterministic copy.", {
      report_id: report.report_id,
      error_message: message.slice(0, 180)
    });
    return {
      report: {
        ...report,
        brief_editorial: fallback,
        editorial_generation: {
          mode: "llm",
          status: "rejected",
          prompt_version: config.pulseLlmPromptVersion,
          generated_at: now,
          source_report_id: report.report_id,
          coverage_notes: ["Dexter LLM commentary was rejected and deterministic copy was used."]
        }
      },
      mode: "deterministic"
    };
  }
}

export async function buildDexterPulseBrief(
  request: DexterPulseBriefRequest,
  config: DexterConfig,
  now: string = new Date().toISOString()
): Promise<DexterPulseBriefResult> {
  const baseReport = assertMarketPulseReport(request.report);
  const withState = withUserState(baseReport, request.user_research_state);
  const rows = await buildPortfolioRows({
    report: withState,
    state: request.user_research_state,
    tickers: request.tickers ?? [],
    config,
    now
  });
  const withRows = mergePortfolioRows(withState, rows);
  const commented = await applyDexterCommentary(withRows, config, now);
  return {
    report: commented.report,
    analyst: "dexter",
    generated_at: now,
    data_families: [
      "user_research_state",
      ...(rows.length > 0 ? ["portfolio_prices"] : []),
      "pulse_commentary"
    ],
    commentary_mode: commented.mode
  };
}
