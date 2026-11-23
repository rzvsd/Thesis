// Feature "pulse". Owner: M1 (docs/rebuild/OWNERSHIP.md). Routes from contract.md "Pulse".
// Not here: /pulse/latest/export/pdf and /pulse/:date/export/pdf (M4, exports feature).
import type { FeatureModule, Route } from "../../router.ts";
import { pgPulseDeps, type PulseDeps, pulseHandlers } from "./handlers.ts";

export function pulseRoutes(deps: PulseDeps = pgPulseDeps): Route[] {
  const h = pulseHandlers(deps);
  return [
    // The router tries static segments first, so /pulse/latest never reaches /pulse/:date.
    { method: "GET", path: "/pulse/latest", auth: "user", handler: h.latest },
    { method: "GET", path: "/pulse/:date", auth: "user", handler: h.byDate },
  ];
}

export const feature: FeatureModule = {
  name: "pulse",
  owner: "M1",
  routes: pulseRoutes(),
};
