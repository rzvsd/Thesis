// Feature "health". Owner: M0. GET /health keeps the old shape: { status, modes }.
// GET /health?db=1 also runs one query in schema app. The Worker's daily cron uses it as the keep-alive (H11).
import { db } from "../../../_shared/db.ts";
import { env } from "../../../_shared/env.ts";
import { json } from "../../../_shared/http.ts";
import type { FeatureModule, RouteContext } from "../../router.ts";

export type DbProbe = () => Promise<{ app_tables: number; users_visible: boolean }>;

export const probeDb: DbProbe = async () => {
  const sql = db();
  const [row] = await sql<{ app_tables: number; users_visible: boolean }[]>`
    select
      (select count(*)::int from information_schema.tables where table_schema = 'app') as app_tables,
      (to_regclass('users') is not null) as users_visible`;
  return row;
};

export function healthHandler(probe: DbProbe = probeDb) {
  return async ({ url }: RouteContext): Promise<Response> => {
    const body: Record<string, unknown> = {
      status: "ok",
      modes: {
        push: env("PUSH_PROVIDER_MODE") ?? "disabled",
        email: env("EMAIL_PROVIDER_MODE") ?? "supabase",
        artifact_store: env("ARTIFACT_STORE_MODE") ?? "supabase_storage",
      },
    };
    if (url.searchParams.get("db") === "1") {
      try {
        body.db = { ok: true, ...(await probe()) };
      } catch {
        body.db = { ok: false };
        return json({ ...body, status: "degraded" }, 503);
      }
    }
    return json(body, 200);
  };
}

export const feature: FeatureModule = {
  name: "health",
  owner: "M0",
  routes: [{ method: "GET", path: "/health", auth: "none", handler: healthHandler() }],
};
