// Feature "auth". Owner: M1 (docs/rebuild/OWNERSHIP.md). Routes: contract.md "Auth".
// Mapping to Supabase Auth: docs/rebuild/M1-auth-mapping.md.
import type { FeatureModule, Route } from "../../router.ts";
import { type AuthDeps, lazyDeps } from "./deps.ts";
import { googleOff, login, logout, refresh, register, verify } from "./handlers.ts";
import { resetConfirm, resetRequest } from "./reset.ts";

export function authRoutes(deps?: AuthDeps): Route[] {
  const get = lazyDeps(deps);
  return [
    { method: "POST", path: "/auth/register", auth: "none", handler: register(get) },
    { method: "POST", path: "/auth/verify", auth: "none", handler: verify(get) },
    { method: "POST", path: "/auth/login", auth: "none", handler: login(get) },
    { method: "POST", path: "/auth/refresh", auth: "none", handler: refresh(get) },
    // auth "none": the token may be a bearer or a refresh token in the body; the handler checks it.
    { method: "POST", path: "/auth/logout", auth: "none", handler: logout(get) },
    { method: "POST", path: "/auth/password-reset/request", auth: "none", handler: resetRequest(get) },
    { method: "POST", path: "/auth/password-reset/confirm", auth: "none", handler: resetConfirm(get) },
    // Off path only: 404 { status: "not_found" } before any auth check, as the old server did.
    { method: "POST", path: "/auth/google", auth: "none", handler: googleOff(get, "/auth/google") },
    { method: "POST", path: "/auth/google/link", auth: "none", handler: googleOff(get, "/auth/google/link") },
  ];
}

export const feature: FeatureModule = {
  name: "auth",
  owner: "M1",
  routes: authRoutes(),
};
