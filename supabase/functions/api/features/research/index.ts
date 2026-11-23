// Feature "research". Owner: M3 (docs/rebuild/OWNERSHIP.md).
// The M3 read routes from docs/rebuild/contract.md, ported from apps/product-api/src/server.ts with the
// same paths, status codes and JSON. Alerts live in the "alerts" feature.
import { defaultResearchDeps, type ResearchDeps } from "../../../_lib/research/deps.ts";
import type { FeatureModule, Route } from "../../router.ts";
import { convictionInsightsHandler, convictionTimelineHandler } from "./conviction.ts";
import { reportFeedbackHandler, subscriptionFeedbackHandler } from "./feedback.ts";
import {
  macroStressCurrentHandler,
  macroStressHistoryHandler,
  sentimentCurrentHandler,
  sentimentHistoryHandler,
} from "./macro.ts";
import {
  earningsStateHandler,
  monitorSnapshotsHandler,
  nameRelationshipsHandler,
  warRoomHandler,
} from "./names.ts";
import { oppositeCaseCreateHandler, oppositeCaseGetHandler, reportScenarioHandler } from "./reports.ts";
import { scenarioRunCreateHandler, scenarioRunGetHandler, scenarioTemplatesHandler } from "./scenarios.ts";

export function researchRoutes(deps: ResearchDeps): Route[] {
  return [
    { method: "GET", path: "/v1/names/relationships", auth: "user", handler: nameRelationshipsHandler(deps) },
    { method: "GET", path: "/v1/research/earnings/state", auth: "user", handler: earningsStateHandler(deps) },
    { method: "GET", path: "/v1/research/war-room/:id", auth: "user", handler: warRoomHandler(deps) },
    { method: "GET", path: "/v1/scenarios/templates", auth: "user", handler: scenarioTemplatesHandler(deps) },
    { method: "POST", path: "/v1/scenarios/runs", auth: "user", handler: scenarioRunCreateHandler(deps) },
    { method: "GET", path: "/v1/scenarios/runs/:id", auth: "user", handler: scenarioRunGetHandler(deps) },
    { method: "POST", path: "/v1/reports/:id/scenario", auth: "user", handler: reportScenarioHandler(deps) },
    {
      method: "GET",
      path: "/v1/reports/:id/opposite-case",
      auth: "user",
      handler: oppositeCaseGetHandler(deps),
    },
    {
      method: "POST",
      path: "/v1/reports/:id/opposite-case",
      auth: "user",
      handler: oppositeCaseCreateHandler(deps),
    },
    {
      method: "GET",
      path: "/v1/conviction/timeline",
      auth: "user",
      handler: convictionTimelineHandler(deps),
    },
    {
      method: "GET",
      path: "/v1/conviction/insights",
      auth: "user",
      handler: convictionInsightsHandler(deps),
    },
    {
      method: "GET",
      path: "/v1/macro-stress/current",
      auth: "user",
      handler: macroStressCurrentHandler(deps),
    },
    {
      method: "GET",
      path: "/v1/macro-stress/history",
      auth: "user",
      handler: macroStressHistoryHandler(deps),
    },
    { method: "GET", path: "/v1/sentiment/current", auth: "user", handler: sentimentCurrentHandler(deps) },
    { method: "GET", path: "/v1/sentiment/history", auth: "user", handler: sentimentHistoryHandler(deps) },
    {
      method: "GET",
      path: "/v1/user/monitor-snapshots",
      auth: "user",
      handler: monitorSnapshotsHandler(deps),
    },
    { method: "POST", path: "/v1/feedback/report", auth: "user", handler: reportFeedbackHandler(deps) },
    {
      method: "POST",
      path: "/v1/feedback/subscription",
      auth: "user",
      handler: subscriptionFeedbackHandler(deps),
    },
  ];
}

export const feature: FeatureModule = {
  name: "research",
  owner: "M3",
  routes: researchRoutes(defaultResearchDeps()),
};
