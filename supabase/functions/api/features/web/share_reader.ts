// GET /r/:token: public, read-only web view of a shared Deep Dive. Ported from
// apps/product-api/src/routes/report-share-routes.ts. Builds the editorial HTML per request (no Chrome).
import { html } from "./html.ts";
import { buildEditorialReportHtml } from "../../../_lib/reports/editorial/html.ts";
import { buildDeepDiveV2Html } from "../../../_lib/reports/deep_dive_v2/render.ts";
import { enrichAnalysisReportIssuer } from "../../../_lib/reports/issuer.ts";
import { logError } from "../../../_shared/log.ts";
import {
  appDownloadUrl,
  notFoundHtml,
  READER_CSP,
  READER_HEADERS,
  READER_V2_CSP,
  readerHtml,
  SHARE_TOKEN_PATTERN,
} from "../../../_lib/reports/share_reader.ts";
import type { AnalysisReport } from "../../../_lib/reports/types.ts";
import { assertIncomingAnalysisReport } from "../../../_lib/reports/validation.ts";
import type { ReportsDeps } from "../reports/handlers.ts";

export type ShareReaderDeps =
  & Pick<
    ReportsDeps,
    "getReportShareByToken" | "getReportById" | "readArtifact" | "issuer"
  >
  & {
    /** Deep Dive 2.0 page builder; tests pass one that throws to exercise the editorial fallback. */
    renderV2?: typeof buildDeepDiveV2Html;
  };

async function loadDeepDive(deps: ShareReaderDeps, reportId: string): Promise<AnalysisReport | undefined> {
  const record = await deps.getReportById(reportId);
  if (!record || record.type !== "deep_dive") {
    return undefined;
  }
  const artifact = await deps.readArtifact(record.artifactKey).catch(() => undefined);
  try {
    return artifact ? assertIncomingAnalysisReport(artifact) : undefined;
  } catch {
    return undefined;
  }
}

export async function handleShareReader(token: string, deps: ShareReaderDeps): Promise<Response> {
  const downloadUrl = appDownloadUrl();
  const valid = SHARE_TOKEN_PATTERN.test(token) ? token : undefined;
  const share = valid ? await deps.getReportShareByToken(valid) : undefined;
  const report = share ? await loadDeepDive(deps, share.reportId) : undefined;
  if (!report) {
    return html(notFoundHtml(downloadUrl), 404, READER_HEADERS, READER_CSP);
  }
  const enriched = await enrichAnalysisReportIssuer(deps.issuer, report).catch(() => report);
  let page: string | undefined;
  try {
    page = (deps.renderV2 ?? buildDeepDiveV2Html)(enriched, { downloadUrl });
  } catch (e) {
    // Deep Dive 2.0 could not render this report: serve the editorial page as before, and say so in the logs.
    // The report id only, never the share token.
    logError("deep_dive_v2_render_failed", {
      report_id: share?.reportId ?? null,
      error: String((e as Error)?.message ?? e).slice(0, 200),
    });
    page = undefined;
  }
  if (page !== undefined) return html(page, 200, READER_HEADERS, READER_V2_CSP);
  return html(readerHtml(buildEditorialReportHtml(enriched), downloadUrl), 200, READER_HEADERS, READER_CSP);
}
