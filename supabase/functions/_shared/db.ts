// Postgres client for the api function.
// Uses THESIS_DB_URL when set (the thesis_api role), else the platform's SUPABASE_DB_URL.
// The search path is "app", so queries copied from apps/product-api/src/store.ts run unchanged.
// prepare: false keeps it safe behind the transaction pooler (N4).
import postgres from "npm:postgres@3.4.5";
import { env } from "./env.ts";

export type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

export function db(): Sql {
  if (client) return client;
  const url = env("THESIS_DB_URL") ?? env("SUPABASE_DB_URL");
  if (!url) throw new Error("No database URL configured");
  client = postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connection: { search_path: "app, extensions, public" },
  });
  return client;
}
