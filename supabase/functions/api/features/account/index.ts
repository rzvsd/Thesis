// Feature "account". Owner: M1 (docs/rebuild/OWNERSHIP.md). Routes: contract.md "Account".
import type { FeatureModule, Route } from "../../router.ts";
import { type AuthDeps, lazyDeps } from "../auth/deps.ts";
import { deleteAccountRoute } from "./delete.ts";
import { confirmDelete, formPage, requestCode } from "./web.ts";

export function accountRoutes(deps?: AuthDeps): Route[] {
  const get = lazyDeps(deps);
  return [
    { method: "DELETE", path: "/v1/account", auth: "user", handler: deleteAccountRoute(get) },
    { method: "GET", path: "/auth/delete-account", auth: "none", handler: formPage(get) },
    { method: "POST", path: "/auth/delete-account", auth: "none", handler: requestCode(get) },
    { method: "POST", path: "/auth/delete-account/confirm", auth: "none", handler: confirmDelete(get) },
  ];
}

export const feature: FeatureModule = {
  name: "account",
  owner: "M1",
  routes: accountRoutes(),
};
