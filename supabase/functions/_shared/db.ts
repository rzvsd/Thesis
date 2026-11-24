// Postgres client for the api function.
// Uses THESIS_DB_URL when set (the thesis_api role), else the platform's SUPABASE_DB_URL.
// The search path is "app", so queries copied from apps/product-api/src/store.ts run unchanged.
//
// THESIS_DB_URL points at the Supabase transaction pooler (port 6543). What that means here:
// - prepare: false. The transaction pooler has no prepared statements (N4).
// - max: 5 (was 3). A request hung for 87 s on 2026-11-24 during a burst of about 12 parallel requests over
//   3 connections, while postgres.js was queueing several queries down each busy connection (pipelining).
//   More connections means less of that. Client connections to the transaction pooler are cheap; the pooler
//   decides how many real Postgres backends they share. (max_pipeline cannot be lowered instead: in
//   postgres.js 3.4.5 that breaks sql.begin.)
// - Session settings (SET statement_timeout, or startup parameters) do not stick behind the transaction pooler,
//   so the server-side timeouts live on the role instead: migration 20261128080000_ops_api_role_timeouts.sql.
// - connect_timeout fails a connection attempt after 10 s instead of the default 30 s.
// - max_lifetime retires each connection after 5 minutes, so a half-dead socket does not live for long.
// The api's request deadline (api/app.ts) is the last guard: it answers 503 and calls resetDb().
import postgres from "npm:postgres@3.4.5";
import { env } from "./env.ts";

export type Sql = ReturnType<typeof postgres>;

export const DB_OPTIONS = {
  prepare: false,
  max: 5,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 5 * 60,
  connection: { search_path: "app, extensions, public" },
} as const;

let client: Sql | null = null;

export function db(): Sql {
  if (client) return client;
  const url = env("THESIS_DB_URL") ?? env("SUPABASE_DB_URL");
  if (!url) throw new Error("No database URL configured");
  client = postgres(url, DB_OPTIONS);
  return client;
}

// Drops the current client so the next query opens fresh connections. The old client gets a few seconds for
// queries that are still moving, then its sockets are closed, which also fails any query stuck on them.
export function resetDb(): void {
  const old = client;
  client = null;
  if (old) old.end({ timeout: 5 }).catch(() => {});
}
