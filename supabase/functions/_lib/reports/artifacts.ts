// Report bodies (JSON) in Supabase Storage (ADR 8, N2). Owner: M1. Every milestone that stores or reads a report
// body uses this module, so the convention lives in one place:
//
// - Bucket: env REPORT_ARTIFACT_BUCKET, default "report-artifacts". Private; only the service role reads or writes.
// - Object key = app.reports.artifact_key, exactly. Format (same as apps/product-api/src/artifact-store.ts):
//     `${type}/${generated_at YYYY-MM-DD}/${report_id}.json`
//   type is the report's `type` ("deep_dive"); a Market Pulse report has no `type` field and uses "market_pulse".
//   The old S3 store put a "reports/" prefix in front of the key; the new bucket does not.
// - Body: the report JSON as served by GET /reports/:id or /pulse/*, content-type application/json.
// - Writers (M2 deep_dive on job complete, M3 market_pulse in the daily job) call writeArtifact(report), then
//   insert the app.reports row with the returned key.
import { env } from "../../_shared/env.ts";

export const DEFAULT_ARTIFACT_BUCKET = "report-artifacts";

// Returns the parsed body, or undefined when the object does not exist or is empty.
export type ArtifactReader = (artifactKey: string) => Promise<unknown | undefined>;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function artifactBucket(): string {
  return env("REPORT_ARTIFACT_BUCKET") ?? DEFAULT_ARTIFACT_BUCKET;
}

export function artifactKeyFor(report: { type?: unknown; generated_at: string; report_id: string }): string {
  const reportType = typeof report.type === "string" ? report.type : "market_pulse";
  return `${reportType}/${report.generated_at.slice(0, 10)}/${report.report_id}.json`;
}

function objectUrl(artifactKey: string): string {
  const base = env("SUPABASE_URL");
  if (!base) throw new Error("SUPABASE_URL is not set");
  const key = artifactKey.trim().replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(artifactBucket())}/${key}`;
}

function authHeaders(): Record<string, string> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return { authorization: `Bearer ${key}`, apikey: key };
}

// Storage answers 404, or 400 with a not_found body on older versions, for a missing object.
async function isMissing(res: Response): Promise<boolean> {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  const text = await res.text().catch(() => "");
  return /not_?found|object not found/i.test(text);
}

export function storageArtifactReader(fetchFn: FetchLike = fetch): ArtifactReader {
  return async (artifactKey) => {
    const res = await fetchFn(objectUrl(artifactKey), { headers: authHeaders() });
    if (!res.ok) {
      if (await isMissing(res)) return undefined;
      await res.body?.cancel();
      throw new Error(`Artifact read failed with HTTP ${res.status}`);
    }
    const raw = await res.text();
    if (raw.trim().length === 0) return undefined;
    return JSON.parse(raw);
  };
}

export const readArtifact: ArtifactReader = (artifactKey) => storageArtifactReader()(artifactKey);

// Stores a report body (upsert) and returns its artifact key.
export async function writeArtifact(
  report: { type?: unknown; generated_at: string; report_id: string },
  fetchFn: FetchLike = fetch,
): Promise<string> {
  const artifactKey = artifactKeyFor(report);
  const res = await fetchFn(objectUrl(artifactKey), {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json; charset=utf-8", "x-upsert": "true" },
    body: JSON.stringify(report),
  });
  await res.body?.cancel();
  if (!res.ok) throw new Error(`Artifact write failed with HTTP ${res.status}`);
  return artifactKey;
}

// Test helper: an in-memory reader.
export function memoryArtifactReader(objects: Record<string, unknown>): ArtifactReader {
  return (artifactKey) => Promise.resolve(objects[artifactKey]);
}
