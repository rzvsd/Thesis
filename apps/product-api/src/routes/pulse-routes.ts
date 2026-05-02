import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

import type {
  MarketPulsePortfolioRadarRow,
  MarketPulseReport,
  UserResearchState
} from "../../../../packages/contracts/src";
import type { ArtifactStore } from "../artifact-store";
import type { ProductApiConfig } from "../config";
import { fetchLatestClosePricePairs, type ClosePricePair } from "../market-prices";
import { applyPulseBriefLlmEditorial } from "../pulse-brief-editor";
import type { ProductStore } from "../store";
import { withUserResearchState } from "../market-pulse";
import { sectionFromPortfolioRadar } from "../pulse/morning-edition";

const PRIVATE_JSON_HEADERS = {
  "cache-control": "private, no-store",
  vary: "Authorization"
} as const;

interface PulseRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  artifactStore: ArtifactStore;
}

interface RequestMeta {
  requestId: string;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface PulseRouteExecutionContext<TRuntime extends PulseRuntime> {
  method: string;
  pathname: string;
  response: ServerResponse;
  runtime: TRuntime;
  meta: RequestMeta;
  auth: AuthContext;
}

export interface PulseRouteDependencies<TRuntime extends PulseRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  normalizeDateInput: (value: string) => string | undefined;
  sendJson: (
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
    headers?: Record<string, string>
  ) => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMarketPulseReport(report: unknown): report is MarketPulseReport {
  if (!isObject(report)) {
    return false;
  }
  if (typeof report.report_id !== "string" || typeof report.generated_at !== "string") {
    return false;
  }
  if (!isObject(report.sections)) {
    return false;
  }
  return (
    isObject(report.sections.market_moves) &&
    isObject(report.sections.market_tape) &&
    isObject(report.sections.macro_releases) &&
    isObject(report.sections.rates_fx_commodities) &&
    isObject(report.sections.news_summary) &&
    isObject(report.sections.uncertainty_flags)
  );
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
  const existingRow = report.morning_edition?.portfolio_radar.find((row) => row.ticker === ticker);
  return existingRow?.company_name;
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

async function buildUserPortfolioRadarRows<TRuntime extends PulseRuntime>(
  runtime: TRuntime,
  report: MarketPulseReport,
  userId: string,
  state?: UserResearchState
): Promise<MarketPulsePortfolioRadarRow[]> {
  const [watchlistTickers, holdings] = await Promise.all([
    runtime.store.listWatchlistTickersByUser(userId),
    runtime.store.listUserResearchHoldings(userId)
  ]);
  const tickers = uniqueTickers([
    ...watchlistTickers,
    ...holdings.map((holding) => holding.ticker),
    ...(state?.names.map((name) => name.ticker) ?? [])
  ]).slice(0, 12);
  if (tickers.length === 0) {
    return [];
  }

  const retrievedAt = new Date().toISOString();
  const prices = await fetchLatestClosePricePairs(
    runtime.config.sentimentYahooBaseUrl,
    tickers,
    6
  );
  return tickers
    .map((ticker) => {
      const pair = prices.get(ticker);
      if (!pair) {
        return undefined;
      }
      return portfolioRowFromPrice({
        ticker,
        companyName: companyNameForTicker(ticker, report, state),
        pair,
        report,
        retrievedAt
      });
    })
    .filter((row): row is MarketPulsePortfolioRadarRow => Boolean(row));
}

function withPortfolioPriceRows(
  report: MarketPulseReport,
  rows: MarketPulsePortfolioRadarRow[]
): MarketPulseReport {
  if (rows.length === 0) {
    return report;
  }
  const byTicker = new Map<string, MarketPulsePortfolioRadarRow>();
  for (const row of rows) {
    byTicker.set(row.ticker, row);
  }
  for (const row of report.morning_edition?.portfolio_radar ?? []) {
    if (!byTicker.has(row.ticker)) {
      byTicker.set(row.ticker, row);
    }
  }
  const mergedRows = [...byTicker.values()].slice(0, 12);
  const morningEdition = report.morning_edition
    ? {
        ...report.morning_edition,
        portfolio_radar: mergedRows
      }
    : report.morning_edition;
  const portfolioSection = sectionFromPortfolioRadar(mergedRows);
  return {
    ...report,
    ...(morningEdition ? { morning_edition: morningEdition } : {}),
    sections: {
      ...report.sections,
      ...(portfolioSection ? { portfolio_radar: portfolioSection } : {})
    }
  };
}

async function personalizePulseForUser<TRuntime extends PulseRuntime>(
  runtime: TRuntime,
  report: MarketPulseReport,
  userId: string,
  asOf: string
): Promise<{ report: MarketPulseReport; researchStateId?: string }> {
  const researchState = await runtime.store.getLatestUserResearchState({
    userId,
    asOf
  });
  const researchPersonalized = withUserResearchState(report, researchState?.state);
  const portfolioPriceRows = await buildUserPortfolioRadarRows(
    runtime,
    researchPersonalized,
    userId,
    researchState?.state
  );
  const pricePersonalized = withPortfolioPriceRows(researchPersonalized, portfolioPriceRows);
  const personalized = await applyPulseBriefLlmEditorial(
    pricePersonalized,
    {
      config: {
        enabled: runtime.config.pulseLlmEditorialEnabled,
        apiKey: runtime.config.pulseLlmOpenRouterApiKey,
        baseUrl: runtime.config.pulseLlmOpenRouterBaseUrl,
        model: runtime.config.pulseLlmOpenRouterModel,
        timeoutMs: runtime.config.pulseLlmTimeoutMs,
        maxTokens: runtime.config.pulseLlmMaxTokens,
        promptVersion: runtime.config.pulseLlmPromptVersion
      }
    }
  );
  return {
    report: personalized,
    researchStateId: researchState?.stateId
  };
}

export async function handlePulseRoutes<TRuntime extends PulseRuntime>(
  context: PulseRouteExecutionContext<TRuntime>,
  deps: PulseRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, response, runtime, meta, auth } = context;

  if (method === "GET" && pathname === "/pulse/latest") {
    const reportMetadata = await runtime.store.getLatestReportByType("market_pulse");
    if (!reportMetadata) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "No Market Pulse report is available yet."
      });
      return true;
    }

    const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
    if (!report || !isMarketPulseReport(report)) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "Market Pulse report artifact missing."
      });
      return true;
    }

    const personalized = await personalizePulseForUser(
      runtime,
      report,
      auth.userId,
      report.cycle_end.slice(0, 10)
    );

    await deps.appendAudit(
      runtime,
      "pulse.report_retrieved",
      {
        request_id: meta.requestId,
        route: pathname,
        report_id: reportMetadata.id,
        research_state_id: personalized.researchStateId
      },
      auth.userId
    );

    deps.sendJson(response, 200, personalized.report, PRIVATE_JSON_HEADERS);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/pulse/")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== "pulse") {
      deps.sendJson(response, 404, { status: "not_found" });
      return true;
    }

    const reportDate = deps.normalizeDateInput(parts[1] ?? "");
    if (!reportDate) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "date must be in YYYY-MM-DD format."
      });
      return true;
    }

    const reportMetadata = await runtime.store.getReportByTypeAndDate("market_pulse", reportDate);
    if (!reportMetadata) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "Market Pulse report not found for the requested date."
      });
      return true;
    }

    const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
    if (!report || !isMarketPulseReport(report)) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "Market Pulse report artifact missing."
      });
      return true;
    }

    const personalized = await personalizePulseForUser(runtime, report, auth.userId, reportDate);

    await deps.appendAudit(
      runtime,
      "pulse.report_retrieved",
      {
        request_id: meta.requestId,
        route: pathname,
        report_id: reportMetadata.id,
        date: reportDate,
        research_state_id: personalized.researchStateId
      },
      auth.userId
    );

    deps.sendJson(response, 200, personalized.report, PRIVATE_JSON_HEADERS);
    return true;
  }

  return false;
}
