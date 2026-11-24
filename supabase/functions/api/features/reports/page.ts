// GET /v1/reports/:id/page: the Deep Dive 2.0 page for the signed-in user, shown in the app's WebView (DECISIONS D3,
// approved 2026-11-24). Same access rules as GET /reports/:id and POST /v1/reports/:id/share; same page, CSP and
// editorial fallback as the share reader GET /r/:token (_lib/reports/deep_dive_page.ts).
// Query: theme=light|dark sets html[data-theme]; embed=1 drops the app bar, the theme switch and the app link.
// Any other value of either is ignored.
import type { RouteContext } from "../../router.ts";
import { html } from "../web/html.ts";
import { loadDeepDive, renderDeepDivePage } from "../../../_lib/reports/deep_dive_page.ts";
import type { RenderOptions } from "../../../_lib/reports/deep_dive_v2/render.ts";
import {
  appDownloadUrl,
  READER_CSP,
  READER_HEADERS,
  reportNotFoundHtml,
} from "../../../_lib/reports/share_reader.ts";
import type { ReportsDeps } from "./handlers.ts";

/** The reader headers, but never cached: the page is per user and must not outlive a lost access. */
export const PAGE_HEADERS: Record<string, string> = {
  ...READER_HEADERS,
  "cache-control": "private, no-store",
};

/** theme and embed from the query string, strictly: only the exact values listed count. */
export function pageOptions(url: URL): Pick<RenderOptions, "theme" | "embed"> {
  const theme = url.searchParams.get("theme");
  return {
    theme: theme === "light" || theme === "dark" ? theme : undefined,
    embed: url.searchParams.get("embed") === "1",
  };
}

function notFound(message = "Report not found."): Response {
  return html(reportNotFoundHtml(message), 404, PAGE_HEADERS, READER_CSP);
}

/** The handler after the rate limit. */
export async function reportPage(
  ctx: RouteContext,
  deps: ReportsDeps,
  requestId: (req: Request) => string,
): Promise<Response> {
  const userId = ctx.auth.userId!;
  const reportId = ctx.params.id;
  const record = await deps.getReportById(reportId);
  if (
    !record || record.type !== "deep_dive" || !(await deps.hasReportAccessForUser(userId, record.id))
  ) {
    return notFound();
  }
  const report = await loadDeepDive(deps.readArtifact, record);
  if (!report) return notFound("Report artifact missing.");
  const page = await renderDeepDivePage(deps, record.id, report, {
    downloadUrl: appDownloadUrl(),
    ...pageOptions(ctx.url),
  });
  await deps.audit("report.retrieved", {
    request_id: requestId(ctx.req),
    route: "/v1/reports/:id/page",
    job_id: record.jobId,
    report_id: record.id,
  }, userId);
  return html(page.body, 200, PAGE_HEADERS, page.csp);
}
