// Report files of a user who deletes their account (audit S7). Owner: M1.
// A Deep Dive body lives in the report-artifacts bucket under app.reports.artifact_key. The account delete
// keeps app.jobs rows (their user_id becomes null), so without this the user's report files stayed forever.
// A file is removed only when no other user's report points at the same key.
import { artifactBucket } from "../reports/artifacts.ts";
import { env } from "../../_shared/env.ts";
import { db } from "./common.ts";

export interface UserReportFiles {
  reportIds: string[];
  artifactKeys: string[];
}

export async function findUserReportFiles(userId: string): Promise<UserReportFiles> {
  const rows = await db()`
    select r.id, r.artifact_key
    from reports r
    join jobs j on j.id = r.job_id
    where j.user_id = ${userId}
      and not exists (
        select 1 from reports r2
        join jobs j2 on j2.id = r2.job_id
        where r2.artifact_key = r.artifact_key
          and r2.id <> r.id
          and j2.user_id is distinct from ${userId}
      )`;
  return {
    reportIds: rows.map((r) => String(r.id)),
    artifactKeys: [...new Set(rows.map((r) => String(r.artifact_key)))],
  };
}

export async function deleteReportRows(reportIds: string[]): Promise<void> {
  if (reportIds.length === 0) return;
  await db()`delete from reports where id = any(${reportIds})`;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Storage takes up to 1,000 keys per delete call.
export async function deleteArtifactKeys(keys: string[], fetchFn: FetchLike = fetch): Promise<void> {
  if (keys.length === 0) return;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Storage is not configured");
  for (let i = 0; i < keys.length; i += 1000) {
    const res = await fetchFn(
      `${url.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(artifactBucket())}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: keys.slice(i, i + 1000) }),
      },
    );
    await res.body?.cancel();
    if (!res.ok) throw new Error(`Artifact delete failed with HTTP ${res.status}`);
  }
}

// Files first, then rows: if Storage fails, the rows stay and the account delete stops, so it can be retried.
export async function deleteUserReportFiles(
  userId: string,
  deps: {
    find?: typeof findUserReportFiles;
    deleteKeys?: (keys: string[]) => Promise<void>;
    deleteRows?: typeof deleteReportRows;
  } = {},
): Promise<number> {
  const found = await (deps.find ?? findUserReportFiles)(userId);
  await (deps.deleteKeys ?? ((k) => deleteArtifactKeys(k)))(found.artifactKeys);
  await (deps.deleteRows ?? deleteReportRows)(found.reportIds);
  return found.artifactKeys.length;
}
