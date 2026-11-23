// GET /pulse/latest and GET /pulse/:date. Ported from apps/product-api/src/routes/pulse-routes.ts.
// DECISIONS D4: serve the stored issue plus the deterministic brief (withUserResearchState). The old server first
// asked the worker for a personal brief on every request; the rebuild never does (no worker, no LLM per request).
import { apiError, json } from "../../../_shared/http.ts";
import type { RouteContext } from "../../router.ts";
import { type ArtifactReader, readArtifact } from "../../../_lib/reports/artifacts.ts";
import type { MarketPulseReport, ReportRecord } from "../../../_lib/reports/types.ts";
import { withUserResearchState } from "../../../_lib/pulse/research_state.ts";
import { isMarketPulseReport, normalizeDateInput } from "../../../_lib/pulse/validate.ts";
import * as pulseStore from "../../../_lib/store/pulse.ts";
import { appendAuditEvent } from "../../../_lib/store/reports.ts";
import { checkRateLimit, rules } from "../../../_lib/store/rate_limit.ts";

const PRIVATE_JSON_HEADERS = {
  "cache-control": "private, no-store",
  vary: "Authorization",
} as const;

export interface PulseDeps {
  getLatestReportByType: (type: ReportRecord["type"]) => Promise<ReportRecord | undefined>;
  getReportByTypeAndDate: (type: ReportRecord["type"], date: string) => Promise<ReportRecord | undefined>;
  getLatestUserResearchState: typeof pulseStore.getLatestUserResearchState;
  readArtifact: ArtifactReader;
  audit: (eventType: string, payload: Record<string, unknown>, userId?: string) => Promise<void>;
  rateLimit: (req: Request, keyPart: string) => Promise<Response | null>;
}

export const pgPulseDeps: PulseDeps = {
  getLatestReportByType: pulseStore.getLatestReportByType,
  getReportByTypeAndDate: pulseStore.getReportByTypeAndDate,
  getLatestUserResearchState: pulseStore.getLatestUserResearchState,
  readArtifact,
  audit: appendAuditEvent,
  // Old bucket rule: every /pulse/* path shares one key.
  rateLimit: (req, keyPart) => checkRateLimit(req, rules().general, keyPart),
};

interface Loaded {
  metadataId: string;
  report: MarketPulseReport;
}

async function loadFromRecord(
  deps: PulseDeps,
  record: ReportRecord | undefined,
): Promise<Loaded | undefined> {
  if (!record) return undefined;
  const report = await deps.readArtifact(record.artifactKey);
  if (!report || !isMarketPulseReport(report)) return undefined;
  return { metadataId: record.id, report };
}

// Stored issue + the user's latest research state on or before asOf. M4's Pulse PDF reuses this.
export async function personalizePulseForUser(
  deps: Pick<PulseDeps, "getLatestUserResearchState">,
  report: MarketPulseReport,
  userId: string,
  asOf: string,
): Promise<{ report: MarketPulseReport; researchStateId?: string }> {
  const researchState = await deps.getLatestUserResearchState({ userId, asOf });
  return {
    report: withUserResearchState(report, researchState?.state),
    researchStateId: researchState?.stateId,
  };
}

function requestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function pulseHandlers(deps: PulseDeps = pgPulseDeps) {
  const latest = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.rateLimit(ctx.req, "/pulse/:date");
    if (limited) return limited;
    const userId = ctx.auth.userId!;
    const loaded = await loadFromRecord(deps, await deps.getLatestReportByType("market_pulse"));
    if (!loaded) return apiError(404, "report_not_found", "No Market Pulse report is available yet.");
    const personalized = await personalizePulseForUser(
      deps,
      loaded.report,
      userId,
      String(loaded.report.cycle_end).slice(0, 10),
    );
    await deps.audit("pulse.report_retrieved", {
      request_id: requestId(ctx.req),
      route: ctx.path,
      report_id: loaded.metadataId,
      research_state_id: personalized.researchStateId,
    }, userId);
    return json(personalized.report, 200, PRIVATE_JSON_HEADERS);
  };

  const byDate = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.rateLimit(ctx.req, "/pulse/:date");
    if (limited) return limited;
    const userId = ctx.auth.userId!;
    const reportDate = normalizeDateInput(ctx.params.date ?? "");
    if (!reportDate) return apiError(422, "validation_failed", "date must be in YYYY-MM-DD format.");
    const loaded = await loadFromRecord(deps, await deps.getReportByTypeAndDate("market_pulse", reportDate));
    if (!loaded) {
      return apiError(404, "report_not_found", "Market Pulse report not found for the requested date.");
    }
    const personalized = await personalizePulseForUser(deps, loaded.report, userId, reportDate);
    await deps.audit("pulse.report_retrieved", {
      request_id: requestId(ctx.req),
      route: ctx.path,
      report_id: loaded.metadataId,
      date: reportDate,
      research_state_id: personalized.researchStateId,
    }, userId);
    return json(personalized.report, 200, PRIVATE_JSON_HEADERS);
  };

  return { latest, byDate };
}
