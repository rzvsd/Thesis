// A tiny router. Paths use ":name" for parameters, e.g. "/v1/reports/:id". No framework (AGENTS rule 5).
import type { AuthContext, AuthMode } from "../_shared/auth.ts";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteContext {
  req: Request;
  url: URL;
  path: string;
  params: Record<string, string>;
  auth: AuthContext;
}

export interface Route {
  method: Method;
  path: string;
  auth: AuthMode;
  handler: (ctx: RouteContext) => Promise<Response> | Response;
}

export interface FeatureModule {
  name: string;
  owner: "M0" | "M1" | "M2" | "M3" | "M4";
  routes: Route[];
}

interface Compiled {
  route: Route;
  feature: string;
  regex: RegExp;
  keys: string[];
}

function compile(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = path
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern}/?$`), keys };
}

export class Router {
  private compiled: Compiled[] = [];

  constructor(features: FeatureModule[]) {
    const seen = new Map<string, string>();
    for (const feature of features) {
      for (const route of feature.routes) {
        const key = `${route.method} ${route.path}`;
        const other = seen.get(key);
        if (other) throw new Error(`Route ${key} registered by both ${other} and ${feature.name}`);
        seen.set(key, feature.name);
        const { regex, keys } = compile(route.path);
        this.compiled.push({ route, feature: feature.name, regex, keys });
      }
    }
    // Static segments win over parameters: sort routes with fewer parameters first.
    this.compiled.sort((a, b) => a.keys.length - b.keys.length);
  }

  get size(): number {
    return this.compiled.length;
  }

  match(method: string, path: string):
    | { kind: "found"; route: Route; params: Record<string, string> }
    | { kind: "method_not_allowed" }
    | { kind: "not_found" } {
    let pathMatched = false;
    for (const c of this.compiled) {
      const m = c.regex.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (c.route.method !== method) continue;
      const params: Record<string, string> = {};
      c.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { kind: "found", route: c.route, params };
    }
    return pathMatched ? { kind: "method_not_allowed" } : { kind: "not_found" };
  }
}
