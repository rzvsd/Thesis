// GET /r/:token: public, read-only web view of a shared Deep Dive. Ported from
// apps/product-api/src/routes/report-share-routes.ts. Builds the page per request (no Chrome); loading, rendering and
// the editorial fallback live in _lib/reports/deep_dive_page.ts, shared with the in-app GET /v1/reports/:id/page.
import { html } from "./html.ts";
import {
  type DeepDivePageDeps,
  loadDeepDive,
  renderDeepDivePage,
} from "../../../_lib/reports/deep_dive_page.ts";
import {
  appDownloadUrl,
  notFoundHtml,
  READER_CSP,
  READER_HEADERS,
  SHARE_TOKEN_PATTERN,
} from "../../../_lib/reports/share_reader.ts";
import type { ReportsDeps } from "../reports/handlers.ts";

export type ShareReaderDeps =
  & Pick<ReportsDeps, "getReportShareByToken" | "getReportById">
  & DeepDivePageDeps;

export async function handleShareReader(token: string, deps: ShareReaderDeps): Promise<Response> {
  const downloadUrl = appDownloadUrl();
  const valid = SHARE_TOKEN_PATTERN.test(token) ? token : undefined;
  const share = valid ? await deps.getReportShareByToken(valid) : undefined;
  const record = share ? await deps.getReportById(share.reportId) : undefined;
  const report = share ? await loadDeepDive(deps.readArtifact, record) : undefined;
  if (!share || !report) {
    return html(notFoundHtml(downloadUrl), 404, READER_HEADERS, READER_CSP);
  }
  const page = await renderDeepDivePage(deps, share.reportId, report, { downloadUrl });
  return html(page.body, 200, READER_HEADERS, page.csp);
}
