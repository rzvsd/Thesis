// Feature "alerts". Owner: M3 (docs/rebuild/OWNERSHIP.md).
// The in-app alert inbox routes from docs/rebuild/contract.md. The rows come from the M3 evaluators.
import { defaultResearchDeps, type ResearchDeps } from "../../../_lib/research/deps.ts";
import type { FeatureModule, Route } from "../../router.ts";
import { alertFeedbackHandler, alertGetHandler, alertMuteHandler, alertsListHandler } from "./alerts.ts";

export function alertRoutes(deps: ResearchDeps): Route[] {
  return [
    { method: "GET", path: "/v1/user/alerts", auth: "user", handler: alertsListHandler(deps) },
    { method: "GET", path: "/v1/user/alerts/:id", auth: "user", handler: alertGetHandler(deps) },
    {
      method: "POST",
      path: "/v1/user/alerts/:id/feedback",
      auth: "user",
      handler: alertFeedbackHandler(deps),
    },
    { method: "POST", path: "/v1/user/alerts/:id/mute", auth: "user", handler: alertMuteHandler(deps) },
  ];
}

export const feature: FeatureModule = {
  name: "alerts",
  owner: "M3",
  routes: alertRoutes(defaultResearchDeps()),
};
