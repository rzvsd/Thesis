import { randomBytes } from "node:crypto";
import type { ServerResponse } from "node:http";

import type { AnalysisReport } from "../../../../packages/contracts/src";
import type { ArtifactStore } from "../artifact-store";
import type { ProductApiConfig } from "../config";
import { buildEditorialReportHtml } from "../report-pdf-editorial";
import { assertIncomingAnalysisReport } from "../report-validation";
import type { ProductStore } from "../store";

// Shared Deep Dive reports: an authenticated user creates an unguessable link, and anyone with
// the link reads the report on the web at /r/{token} without logging in.

interface ReportShareRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  artifactStore: ArtifactStore;
}

export interface ReportShareRouteDependencies<TRuntime extends ReportShareRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  enrichReport: (runtime: TRuntime, report: AnalysisReport) => Promise<AnalysisReport>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
}

const SHARE_PATH = /^\/v1\/reports\/([^/]+)\/share$/;
const READER_PATH = /^\/r\/([A-Za-z0-9_-]{20,64})$/;

function shareUrl(config: ProductApiConfig, token: string): string | undefined {
  return config.publicApiBaseUrl ? `${config.publicApiBaseUrl}/r/${token}` : undefined;
}

async function loadDeepDive<TRuntime extends ReportShareRuntime>(
  runtime: TRuntime,
  reportId: string
): Promise<AnalysisReport | undefined> {
  const record = await runtime.store.getReportById(reportId);
  if (!record || record.type !== "deep_dive") {
    return undefined;
  }
  const artifact = await runtime.artifactStore.readReport(record.artifactKey).catch(() => undefined);
  try {
    return artifact ? assertIncomingAnalysisReport(artifact) : undefined;
  } catch {
    return undefined;
  }
}

/** POST /v1/reports/{id}/share (authenticated): returns the report's share link, creating it once. */
export async function handleReportShareRoutes<TRuntime extends ReportShareRuntime>(
  context: {
    method: string;
    pathname: string;
    response: ServerResponse;
    runtime: TRuntime;
    meta: { requestId: string };
    auth: { userId: string };
  },
  deps: ReportShareRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, response, runtime, meta, auth } = context;
  const reportId = SHARE_PATH.exec(pathname)?.[1];
  if (method !== "POST" || !reportId) {
    return false;
  }

  const record = await runtime.store.getReportById(reportId);
  if (
    !record ||
    record.type !== "deep_dive" ||
    !(await runtime.store.hasReportAccessForUser(auth.userId, reportId))
  ) {
    deps.sendJson(response, 404, { error: "report_not_found", error_message: "Report not found." });
    return true;
  }

  let token = await runtime.store.getReportShareToken({ userId: auth.userId, reportId });
  const created = !token;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await runtime.store.createReportShare({
      token,
      reportId,
      userId: auth.userId,
      createdAt: new Date().toISOString()
    });
  }

  await deps.appendAudit(
    runtime,
    "report.shared",
    { request_id: meta.requestId, route: "/v1/reports/:id/share", report_id: reportId, created },
    auth.userId
  );
  deps.sendJson(response, created ? 201 : 200, {
    data: { share_token: token, path: `/r/${token}`, url: shareUrl(runtime.config, token) ?? null }
  });
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function sendReaderHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, max-age=300",
    "x-robots-tag": "noindex, nofollow",
    // The token is in the URL: do not pass it to other sites through the Referer header.
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"
  });
  response.end(html);
}

const NOT_ADVICE =
  "Thesis is research, not financial advice. This report is general information about a company, " +
  "not a recommendation to buy or sell any security. Do your own research before you invest.";

/** Web-reader additions around the existing report HTML: noindex, notice, app link, screen layout. */
function readerHtml(reportHtml: string, appDownloadUrl: string): string {
  const banner =
    "<div style=\"max-width:8.5in;margin:0 auto;padding:14px 18px;background:#1a2128;color:#f8f4eb;" +
    "font:14px/1.45 'Helvetica Neue',Arial,sans-serif\">" +
    `<p style="margin:0 0 6px;color:#f8f4eb">${escapeHtml(NOT_ADVICE)}</p>` +
    `<a href="${escapeHtml(appDownloadUrl)}" style="color:#d7b985;font-weight:700">Get the Thesis app</a>` +
    "</div>";
  const screenCss =
    "<style>@media screen{.page{width:auto;max-width:8.5in;height:auto;min-height:0;margin:0 auto 12px;" +
    "overflow:visible}}@media screen and (max-width:600px){.page{padding:20px 14px}}</style>";
  return reportHtml
    .replace("<head>", "<head>\n<meta name=\"robots\" content=\"noindex, nofollow\" />")
    .replace("</head>", `${screenCss}\n</head>`)
    .replace("<body>", `<body>\n${banner}`)
    .replace("</body>", `${banner}\n</body>`);
}

function notFoundHtml(appDownloadUrl: string): string {
  return [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<meta name=\"robots\" content=\"noindex, nofollow\" /><title>Thesis</title></head>",
    "<body style=\"font-family:'Helvetica Neue',Arial,sans-serif;padding:24px\">",
    "<p>This shared report is not available.</p>",
    `<p><a href="${escapeHtml(appDownloadUrl)}">Get the Thesis app</a></p>`,
    "</body></html>"
  ].join("");
}

/** GET /r/{token} (public, no login): read-only web view of a shared Deep Dive. */
export async function handleReportReaderRoutes<TRuntime extends ReportShareRuntime>(
  context: { method: string; pathname: string; response: ServerResponse; runtime: TRuntime },
  deps: Pick<ReportShareRouteDependencies<TRuntime>, "enrichReport">
): Promise<boolean> {
  const { method, pathname, response, runtime } = context;
  if (method !== "GET" || !pathname.startsWith("/r/")) {
    return false;
  }

  const appDownloadUrl = runtime.config.appDownloadUrl;
  const token = READER_PATH.exec(pathname)?.[1];
  const share = token ? await runtime.store.getReportShareByToken(token) : undefined;
  const report = share ? await loadDeepDive(runtime, share.reportId) : undefined;
  if (!report) {
    sendReaderHtml(response, 404, notFoundHtml(appDownloadUrl));
    return true;
  }

  // The report artifact is about the company only; the sharer's identity is never rendered.
  const enriched = await deps.enrichReport(runtime, report).catch(() => report);
  sendReaderHtml(response, 200, readerHtml(buildEditorialReportHtml(enriched), appDownloadUrl));
  return true;
}
