import type { IncomingMessage, ServerResponse } from "node:http";

import type { MarketPulseReport } from "../../../../packages/contracts/src";
import type { ArtifactStore } from "../artifact-store";
import type { ProductApiConfig } from "../config";
import { applyPulseLlmEditorial } from "../pulse-editorial-writer";
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
  const personalized = await applyPulseLlmEditorial(
    withUserResearchState(report, researchState?.state),
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
