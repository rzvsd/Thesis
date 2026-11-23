// Feature "internal-jobs". Owner: M2 (docs/rebuild/OWNERSHIP.md). The runner's routes (H5), behind the
// internal token: claim, complete, fail, and the comparable-report read the pipeline uses.
import { readJson } from "../../../_shared/http.ts";
import { comparableLatest } from "../../../_lib/jobs/historical.ts";
import { claimJob, completeJob, failJob } from "../../../_lib/jobs/service.ts";
import { jobsDeps, requestIdOf } from "../../../_lib/jobs/wiring.ts";
import type { FeatureModule, RouteContext } from "../../router.ts";

export const feature: FeatureModule = {
  name: "internal-jobs",
  owner: "M2",
  routes: [
    {
      method: "POST",
      path: "/internal/jobs/:id/claim",
      auth: "internal",
      handler: async ({ req, params }: RouteContext) => {
        const body = await readJson<{ run_url?: string }>(req);
        return claimJob(jobsDeps(), { jobId: params.id, runUrl: body?.run_url, requestId: requestIdOf(req) });
      },
    },
    {
      method: "POST",
      path: "/internal/jobs/:id/complete",
      auth: "internal",
      handler: async ({ req, params }: RouteContext) => {
        const body = await readJson<{ report?: unknown; llm_usage?: unknown }>(req);
        return completeJob(jobsDeps(), { jobId: params.id, body, requestId: requestIdOf(req) });
      },
    },
    {
      method: "POST",
      path: "/internal/jobs/:id/fail",
      auth: "internal",
      handler: async ({ req, params }: RouteContext) => {
        const body = await readJson<{ error_message?: unknown }>(req);
        return failJob(jobsDeps(), {
          jobId: params.id,
          errorMessage: body?.error_message,
          requestId: requestIdOf(req),
        });
      },
    },
    {
      method: "GET",
      path: "/internal/reports/comparable-latest",
      auth: "internal",
      handler: ({ url }: RouteContext) => {
        const deps = jobsDeps();
        return comparableLatest({
          store: deps.store,
          artifacts: deps.artifacts,
          enrichIssuer: deps.effects.enrichIssuer,
        }, url);
      },
    },
  ],
};
