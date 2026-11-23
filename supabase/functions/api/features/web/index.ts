// Feature "web". Owner: M1 (docs/rebuild/OWNERSHIP.md). Public HTML pages from contract.md: legal pages,
// the shared report reader and the email unsubscribe page. Every page goes through html() (see html.ts).
// The delete-account form (/auth/delete-account*) lives in the account feature.
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { checkRateLimit, rules } from "../../../_lib/store/rate_limit.ts";
import { setEmailOptOut } from "../../../_lib/store/email_prefs_unsub.ts";
import { html } from "./html.ts";
import { LEGAL_CSP, LEGAL_HEADERS, legalPage } from "./legal.ts";
import { handleShareReader, type ShareReaderDeps } from "./share_reader.ts";
import { defaultVerify, handleUnsubscribe, type UnsubscribeDeps } from "./unsubscribe.ts";
import { pgReportsDeps } from "../reports/handlers.ts";

export interface WebDeps {
  share: ShareReaderDeps;
  unsubscribe: UnsubscribeDeps;
  rateLimit: (req: Request, keyPart: string) => Promise<Response | null>;
}

export const pgWebDeps: WebDeps = {
  share: pgReportsDeps,
  unsubscribe: { verify: defaultVerify, setEmailOptOut },
  rateLimit: (req, keyPart) => checkRateLimit(req, rules().general, keyPart),
};

export function webRoutes(deps: WebDeps = pgWebDeps): Route[] {
  const legal = (slug: "privacy" | "terms") => () => html(legalPage(slug), 200, LEGAL_HEADERS, LEGAL_CSP);
  const unsubscribe = async (ctx: RouteContext) => {
    const limited = await deps.rateLimit(ctx.req, "/v1/email/unsubscribe");
    if (limited) return limited;
    return handleUnsubscribe(ctx.req, ctx.url, deps.unsubscribe);
  };
  return [
    { method: "GET", path: "/legal/privacy", auth: "none", handler: legal("privacy") },
    { method: "GET", path: "/legal/terms", auth: "none", handler: legal("terms") },
    {
      method: "GET",
      path: "/r/:token",
      auth: "none",
      handler: async (ctx) => {
        const limited = await deps.rateLimit(ctx.req, ctx.path);
        if (limited) return limited;
        return handleShareReader(ctx.params.token, deps.share);
      },
    },
    { method: "GET", path: "/v1/email/unsubscribe", auth: "none", handler: unsubscribe },
    { method: "POST", path: "/v1/email/unsubscribe", auth: "none", handler: unsubscribe },
  ];
}

export const feature: FeatureModule = {
  name: "web",
  owner: "M1",
  routes: webRoutes(),
};
