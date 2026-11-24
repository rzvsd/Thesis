// The Deep Dive page, shared by the public share reader (GET /r/:token) and the in-app page
// (GET /v1/reports/:id/page): load and validate the stored artifact, enrich the issuer, render Deep Dive 2.0, and
// fall back to the editorial page when 2.0 throws (log deep_dive_v2_render_failed with the report id).
import { logError } from "../../_shared/log.ts";
import type { ArtifactReader } from "./artifacts.ts";
import { buildDeepDiveV2Html, type RenderOptions } from "./deep_dive_v2/render.ts";
import { buildEditorialReportHtml } from "./editorial/html.ts";
import { enrichAnalysisReportIssuer, type IssuerDeps } from "./issuer.ts";
import { READER_CSP, READER_V2_CSP, readerHtml } from "./share_reader.ts";
import type { AnalysisReport, ReportRecord } from "./types.ts";
import { assertIncomingAnalysisReport } from "./validation.ts";

export interface DeepDivePageDeps {
  readArtifact: ArtifactReader;
  issuer: IssuerDeps;
  /** Deep Dive 2.0 page builder; tests pass one that throws to exercise the editorial fallback. */
  renderV2?: typeof buildDeepDiveV2Html;
}

/**
 * The validated Deep Dive body of a report row. Undefined when there is no row, the row is not a deep_dive, or the
 * artifact is missing, unreadable or invalid.
 */
export async function loadDeepDive(
  readArtifact: ArtifactReader,
  record: ReportRecord | undefined,
): Promise<AnalysisReport | undefined> {
  if (!record || record.type !== "deep_dive") {
    return undefined;
  }
  const artifact = await readArtifact(record.artifactKey).catch(() => undefined);
  try {
    return artifact ? assertIncomingAnalysisReport(artifact) : undefined;
  } catch {
    return undefined;
  }
}

export interface DeepDivePage {
  body: string;
  /** READER_V2_CSP for the Deep Dive 2.0 page, READER_CSP for the editorial fallback (no script). */
  csp: string;
  fallback: boolean;
}

/** Renders a loaded Deep Dive. With opts.embed the editorial fallback also leaves out the app link. */
export async function renderDeepDivePage(
  deps: DeepDivePageDeps,
  reportId: string,
  report: AnalysisReport,
  opts: RenderOptions,
): Promise<DeepDivePage> {
  const enriched = await enrichAnalysisReportIssuer(deps.issuer, report).catch(() => report);
  try {
    const body = (deps.renderV2 ?? buildDeepDiveV2Html)(enriched, opts);
    return { body, csp: READER_V2_CSP, fallback: false };
  } catch (e) {
    // Deep Dive 2.0 could not render this report: serve the editorial page as before, and say so in the logs.
    // The report id only, never a share token.
    logError("deep_dive_v2_render_failed", {
      report_id: reportId,
      error: String((e as Error)?.message ?? e).slice(0, 200),
    });
  }
  const link = opts.embed ? null : opts.downloadUrl;
  return { body: readerHtml(buildEditorialReportHtml(enriched), link), csp: READER_CSP, fallback: true };
}
