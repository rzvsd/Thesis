// Deep Dive report bodies in Supabase Storage. Thin adapter over M1's helpers in ../reports/artifacts.ts, which
// own the bucket and key convention (`${type}/${YYYY-MM-DD}/${report_id}.json` in REPORT_ARTIFACT_BUCKET).
// M2 adds only a delete, used to clean up an artifact when completing a job fails after the write.
import { env } from "../../_shared/env.ts";
import {
  artifactBucket,
  artifactKeyFor,
  storageArtifactReader,
  writeArtifact,
} from "../reports/artifacts.ts";
import type { AnalysisReport } from "./types.ts";

export interface ArtifactStore {
  writeReport(report: AnalysisReport): Promise<string>;
  // undefined when the object is missing, empty or unreadable (a read error is logged).
  readReport(artifactKey: string): Promise<AnalysisReport | undefined>;
  deleteReport(artifactKey: string): Promise<void>;
}

export const toArtifactKey = artifactKeyFor;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function supabaseStorageArtifacts(fetchFn: FetchLike = fetch): ArtifactStore {
  const read = storageArtifactReader(fetchFn);
  return {
    writeReport: (report) => writeArtifact(report, fetchFn),

    async readReport(artifactKey) {
      try {
        const body = await read(artifactKey);
        return body && typeof body === "object" ? body as AnalysisReport : undefined;
      } catch (err) {
        console.error("artifact read failed", { artifactKey, error: (err as Error).message });
        return undefined;
      }
    },

    async deleteReport(artifactKey) {
      const url = env("SUPABASE_URL");
      const key = env("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) throw new Error("Storage is not configured");
      const res = await fetchFn(
        `${url.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(artifactBucket())}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
          body: JSON.stringify({ prefixes: [artifactKey] }),
        },
      );
      await res.body?.cancel();
      if (!res.ok) throw new Error(`Artifact delete failed with HTTP ${res.status}`);
    },
  };
}
