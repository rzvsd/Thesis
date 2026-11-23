// Stores the encrypted database dump in a private Supabase Storage bucket and keeps only the newest few.
// The repository is public, so a run artifact would be downloadable by any signed-in GitHub user. The bucket has
// no storage policies: only a Supabase secret key can read or write it.
//
// Usage: node jobs/ops/backup_store.mts <file>
// Env: SUPABASE_URL, BACKUP_STORAGE_KEY (a Supabase secret key), optional BACKUP_BUCKET (default "db-backups"),
// optional BACKUP_KEEP (default 5). The key is never printed.
//
// Restore: download the newest thesis-db-*.sql.gz.gpg from Storage > db-backups in the Supabase dashboard, then
// follow docs/rebuild/M1-backup.md from step 2.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const DEFAULT_BUCKET = "db-backups";
export const DEFAULT_KEEP = 5;
// Only files with this exact name shape are ever listed for deletion. The date in the name sorts by time.
export const BACKUP_NAME_RE = /^thesis-db-\d{8}\.sql\.gz\.gpg$/;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface StoreConfig {
  baseUrl: string;
  key: string;
  bucket?: string;
  keep?: number;
  fetchFn?: FetchLike;
}

export interface StoredObject {
  name: string;
  size: number | undefined;
}

export interface StoreResult {
  stored: string;
  size: number;
  kept: string[];
  deleted: string[];
}

function storageBase(cfg: StoreConfig): string {
  return `${cfg.baseUrl.replace(/\/+$/, "")}/storage/v1/object`;
}

function bucketOf(cfg: StoreConfig): string {
  return encodeURIComponent(cfg.bucket ?? DEFAULT_BUCKET);
}

function headers(cfg: StoreConfig, extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${cfg.key}`, apikey: cfg.key, ...extra };
}

async function failure(what: string, res: Response): Promise<Error> {
  const text = (await res.text().catch(() => "")).slice(0, 200);
  return new Error(`${what} failed with HTTP ${res.status}${text ? `: ${text}` : ""}`);
}

export async function uploadBackup(cfg: StoreConfig, name: string, body: Uint8Array): Promise<void> {
  if (!BACKUP_NAME_RE.test(name)) throw new Error(`Unexpected backup file name: ${name}`);
  if (body.byteLength === 0) throw new Error("Backup file is empty");
  const fetchFn = cfg.fetchFn ?? fetch;
  const res = await fetchFn(`${storageBase(cfg)}/${bucketOf(cfg)}/${encodeURIComponent(name)}`, {
    method: "POST",
    // Upsert, so a second run on the same day replaces that day's file.
    headers: headers(cfg, { "content-type": "application/octet-stream", "x-upsert": "true" }),
    body,
  });
  if (!res.ok) throw await failure("Backup upload", res);
  await res.body?.cancel();
}

export async function listBackups(cfg: StoreConfig): Promise<StoredObject[]> {
  const fetchFn = cfg.fetchFn ?? fetch;
  const res = await fetchFn(`${storageBase(cfg)}/list/${bucketOf(cfg)}`, {
    method: "POST",
    headers: headers(cfg, { "content-type": "application/json" }),
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw await failure("Backup listing", res);
  const rows = await res.json() as unknown;
  if (!Array.isArray(rows)) throw new Error("Backup listing returned an unexpected body");
  const out: StoredObject[] = [];
  for (const row of rows) {
    const name = (row as { name?: unknown }).name;
    if (typeof name !== "string" || !BACKUP_NAME_RE.test(name)) continue;
    const size = (row as { metadata?: { size?: unknown } }).metadata?.size;
    out.push({ name, size: typeof size === "number" ? size : undefined });
  }
  return out;
}

// Newest first by the date in the name. Everything after the first `keep` entries is returned for deletion.
export function selectForDeletion(names: string[], keep: number): { kept: string[]; deleted: string[] } {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("keep must be a whole number of at least 1");
  const sorted = names.filter((n) => BACKUP_NAME_RE.test(n)).sort().reverse();
  return { kept: sorted.slice(0, keep), deleted: sorted.slice(keep) };
}

export async function deleteBackups(cfg: StoreConfig, names: string[]): Promise<void> {
  if (names.length === 0) return;
  if (names.some((n) => !BACKUP_NAME_RE.test(n))) throw new Error("Refusing to delete an unexpected file name");
  const fetchFn = cfg.fetchFn ?? fetch;
  const res = await fetchFn(`${storageBase(cfg)}/${bucketOf(cfg)}`, {
    method: "DELETE",
    headers: headers(cfg, { "content-type": "application/json" }),
    body: JSON.stringify({ prefixes: names }),
  });
  if (!res.ok) throw await failure("Old backup deletion", res);
  await res.body?.cancel();
}

// Uploads, checks that the bucket now holds the new file at its full size, and only then deletes older files.
// If the check fails nothing is deleted, so a broken upload can never cost an older good backup.
export async function storeBackup(cfg: StoreConfig, name: string, body: Uint8Array): Promise<StoreResult> {
  const keep = cfg.keep ?? DEFAULT_KEEP;
  await uploadBackup(cfg, name, body);
  const listed = await listBackups(cfg);
  const mine = listed.find((o) => o.name === name);
  if (!mine) throw new Error("The uploaded backup is not in the bucket listing. Nothing was deleted.");
  if (mine.size !== body.byteLength) {
    throw new Error(
      `The stored backup is ${mine.size ?? "an unknown number of"} bytes, expected ${body.byteLength}. Nothing was deleted.`,
    );
  }
  const { kept, deleted } = selectForDeletion(listed.map((o) => o.name), keep);
  if (!kept.includes(name)) throw new Error("The new backup would not be kept. Nothing was deleted.");
  await deleteBackups(cfg, deleted);
  return { stored: name, size: body.byteLength, kept, deleted };
}

async function main(): Promise<number> {
  const file = process.argv[2];
  const baseUrl = process.env.SUPABASE_URL ?? "";
  const key = process.env.BACKUP_STORAGE_KEY ?? "";
  if (!file) {
    console.error("Usage: node jobs/ops/backup_store.mts <file>");
    return 2;
  }
  if (!baseUrl || !key) {
    console.error("SUPABASE_URL or BACKUP_STORAGE_KEY is not set. The dump was made but not stored.");
    return 1;
  }
  const keepRaw = process.env.BACKUP_KEEP;
  const keep = keepRaw ? Number(keepRaw) : DEFAULT_KEEP;
  const bucket = process.env.BACKUP_BUCKET || DEFAULT_BUCKET;
  try {
    const result = await storeBackup({ baseUrl, key, bucket, keep }, basename(file), readFileSync(file));
    console.log(
      `Stored ${result.stored} (${result.size} bytes) in bucket ${bucket}. ` +
        `Keeping ${result.kept.length}, deleted ${result.deleted.length}.`,
    );
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Backup store failed");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
