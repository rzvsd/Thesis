// Feature "reports". Owner: M1 (docs/rebuild/OWNERSHIP.md). Routes from contract.md "Reports, notes, share, export".
// GET /v1/reports/:id/page is the in-app Deep Dive page (DECISIONS D3, 2026-11-24).
// Not here: PDF export (M4, exports feature) and /v1/reports/:id/scenario and opposite-case (M3, research feature).
import type { FeatureModule, Route } from "../../router.ts";
import { pgReportsDeps, type ReportsDeps, reportsHandlers } from "./handlers.ts";

export function reportsRoutes(deps: ReportsDeps = pgReportsDeps): Route[] {
  const h = reportsHandlers(deps);
  return [
    { method: "GET", path: "/reports", auth: "user", handler: h.list },
    { method: "GET", path: "/reports/:id", auth: "user", handler: h.read },
    { method: "GET", path: "/v1/reports/:id/note", auth: "user", handler: h.getNote },
    { method: "PUT", path: "/v1/reports/:id/note", auth: "user", handler: h.putNote },
    { method: "POST", path: "/v1/reports/:id/share", auth: "user", handler: h.share },
    { method: "GET", path: "/v1/reports/:id/page", auth: "user", handler: h.page },
  ];
}

export const feature: FeatureModule = {
  name: "reports",
  owner: "M1",
  routes: reportsRoutes(),
};
