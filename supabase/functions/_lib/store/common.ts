// Small helpers shared by the M1 store modules. Owner: M1.
// Queries use the shared client from _shared/db.ts. Its search path is "app", so table names stay unqualified.
export { db, type Sql } from "../../_shared/db.ts";

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Postgres returns timestamptz as Date and numeric as string. These keep the JSON shapes of the old server.
export function iso(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  const t = Date.parse(s);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

export function num(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}
