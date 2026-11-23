// Scenario stress cards: GET /v1/scenarios/templates, POST /v1/scenarios/runs, GET /v1/scenarios/runs/:id.
// Pro only (403 upgrade_required, feature scenario_stress).
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import { readJsonBody, requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import {
  buildScenarioStressRunResponse,
  runScenarioStressEvaluation,
  toScenarioStressTemplateView,
} from "../../../_lib/research/scenario_stress.ts";
import { type ScenarioStressTemplateId, scenarioStressTemplateIds } from "../../../_lib/research/types.ts";
import { buildUpgradeRequiredPayload, dateInTimeZone, isStrictIsoDate } from "../../../_lib/research/util.ts";
import type { RouteContext } from "../../router.ts";

const upgrade = () =>
  json(
    buildUpgradeRequiredPayload("scenario_stress", "Scenario stress cards are available on the Pro tier."),
    403,
  );

export function scenarioTemplatesHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    if ((await store.getSubscriptionTier(userId)) !== "PRO") return upgrade();
    const templates = await store.listScenarioStressTemplates({ includeInactive: false, limit: 20 });
    await appendAudit(store, "scenario_stress.templates_listed", {
      request_id: requestId(req),
      route: path,
      count: templates.length,
    }, userId);
    return json({ data: templates.map(toScenarioStressTemplateView) });
  };
}

export function scenarioRunCreateHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    if ((await store.getSubscriptionTier(userId)) !== "PRO") return upgrade();

    const body = await readJsonBody<{ scenario_id?: string; as_of?: string }>(req);
    const scenarioId = body.scenario_id as ScenarioStressTemplateId | undefined;
    if (!scenarioId || !scenarioStressTemplateIds.includes(scenarioId)) {
      return json({
        error: "validation_failed",
        error_message: `scenario_id must be one of: ${scenarioStressTemplateIds.join(", ")}.`,
      }, 422);
    }

    const template = await store.getScenarioStressTemplate(scenarioId);
    if (!template || !template.isActive) {
      return json({ error: "scenario_not_found", error_message: "Scenario template was not found." }, 404);
    }

    let asOf = dateInTimeZone(new Date(), "America/New_York");
    if (body.as_of !== undefined) {
      if (!isStrictIsoDate(body.as_of)) {
        return json({
          error: "validation_failed",
          error_message: "as_of must be a valid ISO date (YYYY-MM-DD).",
        }, 422);
      }
      asOf = body.as_of;
    }

    const evaluation = await runScenarioStressEvaluation(store, {
      userId,
      scenarioId,
      asOf,
      nowIso: new Date().toISOString(),
    });
    await appendAudit(store, "scenario_stress.run_created", {
      request_id: requestId(req),
      route: path,
      scenario_id: scenarioId,
      scenario_run_id: evaluation.run.id,
      impacted_names: evaluation.run.impactedNames,
      critical_names: evaluation.run.criticalNames,
    }, userId);
    return json(buildScenarioStressRunResponse(evaluation));
  };
}

export function scenarioRunGetHandler({ store }: ResearchDeps) {
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    if ((await store.getSubscriptionTier(userId)) !== "PRO") return upgrade();
    const scenarioRunId = params.id;
    const run = await store.getScenarioStressRun({ id: scenarioRunId, userId });
    if (!run) {
      return json({ error: "scenario_run_not_found", error_message: "Scenario run not found." }, 404);
    }
    const impacts = await store.listScenarioStressImpactsByRun({ scenarioRunId, userId });
    const suggestions = await store.listScenarioStressRuleSuggestionsByRun({ scenarioRunId, userId });
    await appendAudit(store, "scenario_stress.run_retrieved", {
      request_id: requestId(req),
      route: path,
      scenario_run_id: scenarioRunId,
      scenario_id: run.scenarioId,
      impact_count: impacts.length,
      suggestion_count: suggestions.length,
    }, userId);
    return json(buildScenarioStressRunResponse({ run, impacts, suggestions }));
  };
}
