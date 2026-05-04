import type { ServerResponse } from "node:http";

import type {
  MarketPulseReport,
  UserResearchState
} from "../../../../packages/contracts/src";
import type { ArtifactStore } from "../artifact-store";
import type { ProductApiConfig } from "../config";
import { logWarn } from "../logging";
import type { ProductStore } from "../store";
import { withUserResearchState } from "../market-pulse";

const PRIVATE_JSON_HEADERS = {
  "cache-control": "private, no-store",
  vary: "Authorization"
} as const;

interface PulseRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  artifactStore: ArtifactStore;
}

interface PulsePdfExportResult {
  buffer: Buffer;
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
  sendBinary: (
    response: ServerResponse,
    statusCode: number,
    body: Buffer,
    contentType: string,
    headers?: Record<string, string>
  ) => void;
  buildMarketPulsePdfExport: (report: MarketPulseReport) => PulsePdfExportResult;
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

interface DexterPulseBriefPayload {
  report?: unknown;
}

async function requestDexterPulseBrief<TRuntime extends PulseRuntime>(
  runtime: TRuntime,
  report: MarketPulseReport,
  userId: string,
  asOf: string,
  state?: UserResearchState
): Promise<MarketPulseReport | undefined> {
  if (!runtime.config.pulseDexterBriefEnabled) {
    return undefined;
  }

  const [watchlistTickers, holdings] = await Promise.all([
    runtime.store.listWatchlistTickersByUser(userId),
    runtime.store.listUserResearchHoldings(userId)
  ]);
  const tickers = uniqueTickers([
    ...watchlistTickers,
    ...holdings.map((holding) => holding.ticker),
    ...(state?.names.map((name) => name.ticker) ?? [])
  ]).slice(0, 12);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtime.config.pulseDexterTimeoutMs);
  try {
    const response = await fetch(
      `${runtime.config.pulseDexterWorkerBaseUrl.replace(/\/$/, "")}/internal/pulse/brief`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": runtime.config.internalWorkerToken
        },
        body: JSON.stringify({
          report,
          user_id: userId,
          as_of: asOf,
          user_research_state: state,
          tickers
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Dexter Pulse brief failed with HTTP ${response.status}`);
    }
    const payload = (await response.json()) as DexterPulseBriefPayload;
    if (!isMarketPulseReport(payload.report)) {
      throw new Error("Dexter Pulse brief response did not include a valid report");
    }
    return payload.report;
  } finally {
    clearTimeout(timeout);
  }
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
  let personalized: MarketPulseReport | undefined;
  try {
    personalized = await requestDexterPulseBrief(
      runtime,
      report,
      userId,
      asOf,
      researchState?.state
    );
  } catch (error) {
    logWarn("Dexter Pulse brief unavailable; serving deterministic Product API fallback.", {
      report_id: report.report_id,
      user_id: userId,
      error_message: error instanceof Error ? error.message : String(error)
    });
  }

  personalized ??= withUserResearchState(report, researchState?.state);
  return {
    report: personalized,
    researchStateId: researchState?.stateId
  };
}

async function loadPulseReportByDate<TRuntime extends PulseRuntime>(
  runtime: TRuntime,
  reportDate: string
): Promise<{ metadataId: string; report: MarketPulseReport } | undefined> {
  const reportMetadata = await runtime.store.getReportByTypeAndDate("market_pulse", reportDate);
  if (!reportMetadata) {
    return undefined;
  }

  const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
  if (!report || !isMarketPulseReport(report)) {
    return undefined;
  }

  return {
    metadataId: reportMetadata.id,
    report
  };
}

async function loadLatestPulseReport<TRuntime extends PulseRuntime>(
  runtime: TRuntime
): Promise<{ metadataId: string; report: MarketPulseReport } | undefined> {
  const reportMetadata = await runtime.store.getLatestReportByType("market_pulse");
  if (!reportMetadata) {
    return undefined;
  }

  const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
  if (!report || !isMarketPulseReport(report)) {
    return undefined;
  }

  return {
    metadataId: reportMetadata.id,
    report
  };
}

function pulsePdfFilename(report: MarketPulseReport): string {
  const date = report.cycle_end.slice(0, 10);
  const safeReportId = report.report_id.replace(/[^A-Za-z0-9._-]/g, "-");
  return `thesis-pulse-${date}-${safeReportId}.pdf`;
}

async function sendPulsePdfExport<TRuntime extends PulseRuntime>(
  context: PulseRouteExecutionContext<TRuntime>,
  deps: PulseRouteDependencies<TRuntime>,
  loaded: { metadataId: string; report: MarketPulseReport },
  reportDate: string
): Promise<void> {
  const { response, runtime, meta, auth, pathname } = context;
  const personalized = await personalizePulseForUser(
    runtime,
    loaded.report,
    auth.userId,
    reportDate
  );

  try {
    const pdf = deps.buildMarketPulsePdfExport(personalized.report);
    await deps.appendAudit(
      runtime,
      "pulse.report_exported_pdf",
      {
        request_id: meta.requestId,
        route: pathname,
        report_id: loaded.metadataId,
        personalized_report_id: personalized.report.report_id,
        research_state_id: personalized.researchStateId,
        date: reportDate
      },
      auth.userId
    );

    deps.sendBinary(response, 200, pdf.buffer, "application/pdf", {
      "content-disposition": `attachment; filename="${pulsePdfFilename(personalized.report)}"`,
      "cache-control": "private, no-store",
      vary: "Authorization"
    });
  } catch (error) {
    logWarn("Pulse PDF export failed.", {
      report_id: loaded.metadataId,
      user_id: auth.userId,
      error_message: error instanceof Error ? error.message : String(error)
    });
    deps.sendJson(response, 500, {
      error: "internal_error",
      error_message: "Pulse PDF export failed."
    });
  }
}

export async function handlePulseRoutes<TRuntime extends PulseRuntime>(
  context: PulseRouteExecutionContext<TRuntime>,
  deps: PulseRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, response, runtime, meta, auth } = context;

  if (method === "GET" && pathname === "/pulse/latest/export/pdf") {
    const loaded = await loadLatestPulseReport(runtime);
    if (!loaded) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "No Market Pulse report is available yet."
      });
      return true;
    }

    await sendPulsePdfExport(
      context,
      deps,
      loaded,
      loaded.report.cycle_end.slice(0, 10)
    );
    return true;
  }

  if (method === "GET" && pathname.startsWith("/pulse/") && pathname.endsWith("/export/pdf")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 4 || parts[0] !== "pulse" || parts[2] !== "export" || parts[3] !== "pdf") {
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

    const loaded = await loadPulseReportByDate(runtime, reportDate);
    if (!loaded) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "Market Pulse report not found for the requested date."
      });
      return true;
    }

    await sendPulsePdfExport(context, deps, loaded, reportDate);
    return true;
  }

  if (method === "GET" && pathname === "/pulse/latest") {
    const loaded = await loadLatestPulseReport(runtime);
    if (!loaded) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "No Market Pulse report is available yet."
      });
      return true;
    }

    const personalized = await personalizePulseForUser(
      runtime,
      loaded.report,
      auth.userId,
      loaded.report.cycle_end.slice(0, 10)
    );

    await deps.appendAudit(
      runtime,
      "pulse.report_retrieved",
      {
        request_id: meta.requestId,
        route: pathname,
        report_id: loaded.metadataId,
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

    const loaded = await loadPulseReportByDate(runtime, reportDate);
    if (!loaded) {
      deps.sendJson(response, 404, {
        error: "report_not_found",
        error_message: "Market Pulse report not found for the requested date."
      });
      return true;
    }

    const personalized = await personalizePulseForUser(runtime, loaded.report, auth.userId, reportDate);

    await deps.appendAudit(
      runtime,
      "pulse.report_retrieved",
      {
        request_id: meta.requestId,
        route: pathname,
        report_id: loaded.metadataId,
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
