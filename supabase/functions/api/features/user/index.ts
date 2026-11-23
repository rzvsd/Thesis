// Feature "user". Owner: M1 (docs/rebuild/OWNERSHIP.md). Empty until M1 adds its routes.
// See docs/rebuild/contract.md for the routes this feature serves.
import type { FeatureModule } from "../../router.ts";

export const feature: FeatureModule = {
  name: "user",
  owner: "M1",
  routes: [],
};
