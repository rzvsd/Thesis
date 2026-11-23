// Feature "historical". Owner: M2 (docs/rebuild/OWNERSHIP.md). /v1/historical/* answer an internal token
// or a user token, so the guard mode is "none" and the handler checks both (contract.md).
import { handleHistorical, type HistoricalKind } from "../../../_lib/jobs/historical.ts";
import { historicalDeps, requestIdOf } from "../../../_lib/jobs/wiring.ts";
import type { FeatureModule, Route, RouteContext } from "../../router.ts";

const kinds: HistoricalKind[] = ["financials", "transcripts", "filing-sections", "coverage"];

export const feature: FeatureModule = {
  name: "historical",
  owner: "M2",
  routes: kinds.map((kind): Route => ({
    method: "GET",
    path: `/v1/historical/${kind}`,
    auth: "none",
    handler: ({ req, url }: RouteContext) =>
      handleHistorical(historicalDeps(), { req, url, kind, requestId: requestIdOf(req) }),
  })),
};
