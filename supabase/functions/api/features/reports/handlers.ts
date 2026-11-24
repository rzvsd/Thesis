// Report reads, notes and share links. Ported from apps/product-api/src/server.ts (GET /reports, GET /reports/:id,
// GET+PUT /v1/reports/:id/note) and routes/report-share-routes.ts (POST /v1/reports/:id/share).
import { apiError, json, readJson } from "../../../_shared/http.ts";
import type { RouteContext } from "../../router.ts";
import { type ArtifactReader, readArtifact } from "../../../_lib/reports/artifacts.ts";
import {
  enrichAnalysisReportIssuer,
  fetchStructuralContext,
  type IssuerDeps,
} from "../../../_lib/reports/issuer.ts";
import { newShareToken, shareUrl } from "../../../_lib/reports/share_reader.ts";
import type { buildDeepDiveV2Html } from "../../../_lib/reports/deep_dive_v2/render.ts";
import { reportPage } from "./page.ts";
import type { AnalysisReport, ReportRecord } from "../../../_lib/reports/types.ts";
import { assertIncomingAnalysisReport } from "../../../_lib/reports/validation.ts";
import * as store from "../../../_lib/store/reports.ts";
import { checkRateLimit, rules } from "../../../_lib/store/rate_limit.ts";

export interface ReportsDeps {
  getReportById: (id: string) => Promise<ReportRecord | undefined>;
  hasReportAccessForUser: (userId: string, reportId: string) => Promise<boolean>;
  listReportsByUser: (userId: string) => Promise<ReportRecord[]>;
  getReportNote: typeof store.getReportNote;
  upsertReportNote: typeof store.upsertReportNote;
  getReportShareToken: typeof store.getReportShareToken;
  createReportShare: typeof store.createReportShare;
  getReportShareByToken: typeof store.getReportShareByToken;
  readArtifact: ArtifactReader;
  issuer: IssuerDeps;
  audit: (eventType: string, payload: Record<string, unknown>, userId?: string) => Promise<void>;
  rateLimit: (req: Request, keyPart: string) => Promise<Response | null>;
  /** Deep Dive 2.0 page builder; tests pass one that throws to exercise the editorial fallback. */
  renderV2?: typeof buildDeepDiveV2Html;
}

export const pgReportsDeps: ReportsDeps = {
  getReportById: store.getReportById,
  hasReportAccessForUser: store.hasReportAccessForUser,
  listReportsByUser: store.listReportsByUser,
  getReportNote: store.getReportNote,
  upsertReportNote: store.upsertReportNote,
  getReportShareToken: store.getReportShareToken,
  createReportShare: store.createReportShare,
  getReportShareByToken: store.getReportShareByToken,
  readArtifact,
  issuer: { getSupportedTicker: store.getSupportedTicker, fetchStructuralContext },
  audit: store.appendAuditEvent,
  rateLimit: (req, keyPart) => checkRateLimit(req, rules().general, keyPart),
};

export function requestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

// Old bucket rule: /reports/* collapses to one key; other paths use the path itself.
function bucket(path: string): string {
  const p = path.replace(/\/+$/, "") || "/";
  return p.startsWith("/reports/") ? "/reports/:id" : p;
}

function reportNotFound(message = "Report not found."): Response {
  return apiError(404, "report_not_found", message);
}

function buildReportListItem(report: ReportRecord) {
  return {
    report_id: report.id,
    job_id: report.jobId,
    type: report.type,
    ticker: report.ticker,
    schema_version: report.schemaVersion,
    created_at: report.createdAt,
  };
}

// Loads, validates and enriches a Deep Dive body. Undefined when the artifact is missing or invalid.
// A storage error (not a missing object) throws, as in the old server.
export async function loadAnalysisReport(
  deps: Pick<ReportsDeps, "readArtifact" | "issuer">,
  record: ReportRecord,
): Promise<AnalysisReport | undefined> {
  const artifact = await deps.readArtifact(record.artifactKey);
  if (!artifact) return undefined;
  try {
    return await enrichAnalysisReportIssuer(deps.issuer, assertIncomingAnalysisReport(artifact));
  } catch {
    return undefined;
  }
}

export function reportsHandlers(deps: ReportsDeps = pgReportsDeps) {
  const list = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.rateLimit(ctx.req, bucket(ctx.path));
    if (limited) return limited;
    const reports = await deps.listReportsByUser(ctx.auth.userId!);
    return json(reports.map(buildReportListItem));
  };

  const read = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.rateLimit(ctx.req, bucket(ctx.path));
    if (limited) return limited;
    const userId = ctx.auth.userId!;
    const record = await deps.getReportById(ctx.params.id);
    if (!record) return reportNotFound();
    if (!(await deps.hasReportAccessForUser(userId, record.id))) return reportNotFound();
    const report = await loadAnalysisReport(deps, record);
    if (!report) return reportNotFound("Report artifact missing.");
    await deps.audit("report.retrieved", {
      request_id: requestId(ctx.req),
      route: ctx.path,
      job_id: record.jobId,
      report_id: record.id,
    }, userId);
    return json(report);
  };

  // Shared start of GET and PUT note: the report must exist and the user must have access.
  const noteGuard = async (ctx: RouteContext): Promise<Response | null> => {
    const limited = await deps.rateLimit(ctx.req, bucket(ctx.path));
    if (limited) return limited;
    const record = await deps.getReportById(ctx.params.id);
    if (!record) return reportNotFound();
    if (!(await deps.hasReportAccessForUser(ctx.auth.userId!, record.id))) return reportNotFound();
    return null;
  };

  const getNote = async (ctx: RouteContext): Promise<Response> => {
    const blocked = await noteGuard(ctx);
    if (blocked) return blocked;
    const reportId = ctx.params.id;
    const existing = await deps.getReportNote(reportId, ctx.auth.userId!);
    if (!existing) return apiError(404, "note_not_found", "No note is saved for this report.");
    return json({ data: { report_id: reportId, content: existing.content, updated_at: existing.updatedAt } });
  };

  const putNote = async (ctx: RouteContext): Promise<Response> => {
    const blocked = await noteGuard(ctx);
    if (blocked) return blocked;
    const userId = ctx.auth.userId!;
    const reportId = ctx.params.id;
    const body = await readJson<{ content?: unknown }>(ctx.req);
    if (typeof body?.content !== "string") {
      return apiError(422, "validation_failed", "content must be a string.");
    }
    const content = body.content.trim();
    if (content.length > 10_000) {
      return apiError(422, "validation_failed", "content must be at most 10000 characters.");
    }
    const updated = await deps.upsertReportNote({
      reportId,
      userId,
      content,
      updatedAt: new Date().toISOString(),
    });
    await deps.audit("report.note_upserted", {
      request_id: requestId(ctx.req),
      route: ctx.path,
      report_id: reportId,
      content_length: content.length,
    }, userId);
    return json({ data: { report_id: reportId, content: updated.content, updated_at: updated.updatedAt } });
  };

  const share = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.rateLimit(ctx.req, bucket(ctx.path));
    if (limited) return limited;
    const userId = ctx.auth.userId!;
    const reportId = ctx.params.id;
    const record = await deps.getReportById(reportId);
    if (
      !record || record.type !== "deep_dive" || !(await deps.hasReportAccessForUser(userId, reportId))
    ) {
      return reportNotFound();
    }
    let token = await deps.getReportShareToken({ userId, reportId });
    const created = !token;
    if (!token) {
      token = newShareToken();
      await deps.createReportShare({ token, reportId, userId, createdAt: new Date().toISOString() });
    }
    await deps.audit("report.shared", {
      request_id: requestId(ctx.req),
      route: "/v1/reports/:id/share",
      report_id: reportId,
      created,
    }, userId);
    return json(
      { data: { share_token: token, path: `/r/${token}`, url: shareUrl(token) } },
      created ? 201 : 200,
    );
  };

  // GET /v1/reports/:id/page: the Deep Dive page as HTML for the app's WebView (page.ts).
  const page = async (ctx: RouteContext): Promise<Response> => {
    const limited = await deps.rateLimit(ctx.req, bucket(ctx.path));
    if (limited) return limited;
    return await reportPage(ctx, deps, requestId);
  };

  return { list, read, getNote, putNote, share, page };
}
