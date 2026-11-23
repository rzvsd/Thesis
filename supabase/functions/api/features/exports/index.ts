// Feature "exports". Owner: M4 (docs/rebuild/OWNERSHIP.md). PDF downloads.
//   GET /v1/reports/:id/export/pdf  Deep Dive PDF, Pro only (ported from apps/product-api/src/server.ts)
//   GET /pulse/latest/export/pdf    Market Pulse PDF for the caller (ported from routes/pulse-routes.ts)
//   GET /pulse/:date/export/pdf     Same, by date
// Both PDFs are drawn in pure TypeScript inside the api function (no browser). Measured: about 12 ms CPU
// for a 10-page Deep Dive, far under the 2 s limit, so there is no PDF job and nothing is stored: each
// download renders fresh from the stored report JSON. See docs/rebuild/M4-exports-push-billing.md.
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError } from "../../../_shared/http.ts";
import { logError } from "../../../_shared/log.ts";
import { buildInstitutionalPdfExport } from "../../../_lib/exports/report_pdf/index.ts";
import { buildMarketPulsePdf } from "../../../_lib/exports/pulse/pdf.ts";
import { upgradeRequiredBody } from "../../../_lib/store/profile_limits.ts";
import { getUserTier, type Tier } from "../../../_lib/store/users.ts";
import type { AnalysisReport, MarketPulseReport } from "../../../_lib/reports/types.ts";
import { isMarketPulseReport, normalizeDateInput } from "../../../_lib/pulse/validate.ts";
import { loadAnalysisReport, pgReportsDeps, type ReportsDeps } from "../reports/handlers.ts";
import { personalizePulseForUser, pgPulseDeps, type PulseDeps } from "../pulse/handlers.ts";

export interface ExportsDeps {
  reports: Pick<
    ReportsDeps,
    "getReportById" | "hasReportAccessForUser" | "readArtifact" | "issuer" | "audit" | "rateLimit"
  >;
  pulse: Pick<
    PulseDeps,
    | "getLatestReportByType"
    | "getReportByTypeAndDate"
    | "getLatestUserResearchState"
    | "readArtifact"
    | "rateLimit"
  >;
  tier(userId: string): Promise<Tier>;
  renderReport(report: AnalysisReport): { buffer: Uint8Array; pageCount: number };
  renderPulse(report: MarketPulseReport): { bytes: Uint8Array; pageCount: number };
}

export const pgExportsDeps: ExportsDeps = {
  reports: pgReportsDeps,
  pulse: pgPulseDeps,
  tier: getUserTier,
  renderReport: buildInstitutionalPdfExport,
  renderPulse: buildMarketPulsePdf,
};

function requestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

function pdfResponse(bytes: Uint8Array, filename: string, extra: Record<string, string> = {}): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-length": String(bytes.byteLength),
      "content-disposition": `attachment; filename="${filename}"`,
      ...extra,
    },
  });
}

export function pulsePdfFilename(report: MarketPulseReport): string {
  const date = String(report.cycle_end).slice(0, 10);
  const safeReportId = String(report.report_id).replace(/[^A-Za-z0-9._-]/g, "-");
  return `thesis-pulse-${date}-${safeReportId}.pdf`;
}

export function exportsRoutes(deps: ExportsDeps = pgExportsDeps): Route[] {
  const reportPdf = async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const limited = await deps.reports.rateLimit(req, path.replace(/\/+$/, ""));
    if (limited) return limited;
    const userId = auth.userId!;
    const reportId = params.id;
    const record = await deps.reports.getReportById(reportId);
    if (!record || !(await deps.reports.hasReportAccessForUser(userId, record.id))) {
      return apiError(404, "report_not_found", "Report not found.");
    }
    if ((await deps.tier(userId)) !== "PRO") {
      const body = upgradeRequiredBody("report_export", "PDF export is available on the Pro tier.");
      return apiError(403, "upgrade_required", String(body.error_message), { feature: body.feature });
    }
    const report = await loadAnalysisReport(deps.reports, record);
    if (!report || report.type !== "deep_dive") {
      return apiError(404, "report_not_found", "Deep Dive report artifact missing.");
    }
    try {
      const pdf = deps.renderReport(report);
      const ticker = report.ticker ? String(report.ticker).trim().toUpperCase() : "REPORT";
      await deps.reports.audit("report.exported_pdf", {
        request_id: requestId(req),
        route: path,
        report_id: reportId,
        page_count: pdf.pageCount,
      }, userId);
      return pdfResponse(pdf.buffer, `thesis-deep-dive-${ticker}-${reportId}.pdf`);
    } catch (error) {
      logError("PDF export failed", {
        route: path,
        report_id: reportId,
        error_message: error instanceof Error ? error.message : "Unknown PDF export failure",
      });
      return apiError(500, "internal_error", "PDF export failed.");
    }
  };

  const sendPulsePdf = async (
    ctx: RouteContext,
    record: Awaited<ReturnType<PulseDeps["getLatestReportByType"]>>,
    missingMessage: string,
    reportDate?: string,
  ): Promise<Response> => {
    const userId = ctx.auth.userId!;
    const raw = record ? await deps.pulse.readArtifact(record.artifactKey) : undefined;
    if (!record || !raw || !isMarketPulseReport(raw)) {
      return apiError(404, "report_not_found", missingMessage);
    }
    const artifact = raw as MarketPulseReport;
    const date = reportDate ?? String(artifact.cycle_end).slice(0, 10);
    const personalized = await personalizePulseForUser(deps.pulse, artifact, userId, date);
    try {
      const pdf = deps.renderPulse(personalized.report);
      await deps.reports.audit("pulse.report_exported_pdf", {
        request_id: requestId(ctx.req),
        route: ctx.path,
        report_id: record.id,
        personalized_report_id: personalized.report.report_id,
        research_state_id: personalized.researchStateId,
        date,
      }, userId);
      return pdfResponse(pdf.bytes, pulsePdfFilename(personalized.report), {
        "cache-control": "private, no-store",
        vary: "Authorization",
      });
    } catch (error) {
      logError("Pulse PDF export failed.", {
        report_id: record.id,
        user_id: userId,
        error_message: error instanceof Error ? error.message : String(error),
      });
      return apiError(500, "internal_error", "Pulse PDF export failed.");
    }
  };

  const pulseLatest = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.pulse.rateLimit(ctx.req, "/pulse/:date");
    if (limited) return limited;
    const record = await deps.pulse.getLatestReportByType("market_pulse");
    return sendPulsePdf(ctx, record, "No Market Pulse report is available yet.");
  };

  const pulseByDate = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.pulse.rateLimit(ctx.req, "/pulse/:date");
    if (limited) return limited;
    const reportDate = normalizeDateInput(ctx.params.date ?? "");
    if (!reportDate) return apiError(422, "validation_failed", "date must be in YYYY-MM-DD format.");
    const record = await deps.pulse.getReportByTypeAndDate("market_pulse", reportDate);
    return sendPulsePdf(ctx, record, "Market Pulse report not found for the requested date.", reportDate);
  };

  return [
    { method: "GET", path: "/v1/reports/:id/export/pdf", auth: "user", handler: reportPdf },
    { method: "GET", path: "/pulse/latest/export/pdf", auth: "user", handler: pulseLatest },
    { method: "GET", path: "/pulse/:date/export/pdf", auth: "user", handler: pulseByDate },
  ];
}

export const feature: FeatureModule = {
  name: "exports",
  owner: "M4",
  routes: exportsRoutes(),
};
