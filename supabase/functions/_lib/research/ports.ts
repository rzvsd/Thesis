// Ports to other milestones.
// Report bodies move to Supabase Storage (owner M2). Until M2 ships its reader, the default
// reader returns undefined, and the handlers answer exactly as the old server did when the
// stored artifact could not be read (404 report_not_found "Report artifact missing.").
import { readArtifact } from "../reports/artifacts.ts";
import type { ReportRecord } from "./types.ts";

export type ReportBodyReader = (report: ReportRecord) => Promise<unknown | undefined>;

export const missingReportBodyReader: ReportBodyReader = () => Promise.resolve(undefined);

// Reads the body from Supabase Storage with the shared M1 convention (key = app.reports.artifact_key).
export const storageReportBodyReader: ReportBodyReader = (report) => readArtifact(report.artifactKey);
