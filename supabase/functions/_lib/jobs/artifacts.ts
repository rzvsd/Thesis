// Report JSON bodies in Supabase Storage (ADR 8, N2). Private bucket "report-artifacts" (M2 migration).
// Key format is the old one: <type>/<YYYY-MM-DD>/<report_id>.json, stored in app.reports.artifact_key.
// The api function talks to Storage over its HTTP API with the platform's service role key, which the
// Edge runtime injects. Nothing here needs a secret in the repo.
import { env } from "../../_shared/env.ts";
import type { AnalysisReport } from "./types.ts";

export interface ArtifactStore {
  writeReport(report: AnalysisReport): Promise<string>;
  readReport(artifactKey: string): Promise<AnalysisReport | undefined>;
  deleteReport(artifactKey: string): Promise<void>;
}

export function toArtifactKey(report: { type?: string; generated_at: string; report_id: string }): string {
  const type = report.type ?? "market_pulse";
  return `${type}/${report.generated_at.slice(0, 10)}/${report.report_id}.json`;
}

export function reportBucket(): string {
  return env("REPORT_ARTIFACT_BUCKET") ?? "report-artifacts";
}

type Fetch = typeof fetch;

export function supabaseStorageArtifacts(
  options: { url?: string; key?: string; bucket?: string; fetchFn?: Fetch } = {},
): ArtifactStore {
  const fetchFn = options.fetchFn ?? fetch;
  const base = () => {
    const url = options.url ?? env("SUPABASE_URL");
    const key = options.key ?? env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Storage is not configured");
    return { url: url.replace(/\/$/, ""), key };
  };
  const bucket = options.bucket ?? reportBucket();
  const objectUrl = (url: string, artifactKey: string) =>
    `${url}/storage/v1/object/${bucket}/${artifactKey.split("/").map(encodeURIComponent).join("/")}`;

  return {
    async writeReport(report) {
      const { url, key } = base();
      const artifactKey = toArtifactKey(report);
      const res = await fetchFn(objectUrl(url, artifactKey), {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          apikey: key,
          "content-type": "application/json",
          "x-upsert": "true",
        },
        body: JSON.stringify(report),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`Storage write failed (${res.status})`);
      }
      await res.body?.cancel();
      return artifactKey;
    },

    async readReport(artifactKey) {
      const { url, key } = base();
      const res = await fetchFn(objectUrl(url, artifactKey), {
        headers: { authorization: `Bearer ${key}`, apikey: key },
      });
      if (!res.ok) {
        await res.body?.cancel();
        return undefined;
      }
      try {
        return await res.json() as AnalysisReport;
      } catch {
        return undefined;
      }
    },

    async deleteReport(artifactKey) {
      const { url, key } = base();
      const res = await fetchFn(`${url}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: [artifactKey] }),
      });
      await res.body?.cancel();
    },
  };
}
