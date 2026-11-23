// Feature "jobs". Owner: M2 (docs/rebuild/OWNERSHIP.md). POST /jobs and GET /jobs/:id (contract.md, Jobs).
import { readJson } from "../../../_shared/http.ts";
import { createDeepDiveJob, getDeepDiveJob } from "../../../_lib/jobs/service.ts";
import { jobsDeps, requestIdOf } from "../../../_lib/jobs/wiring.ts";
import type { FeatureModule, RouteContext } from "../../router.ts";

export const feature: FeatureModule = {
  name: "jobs",
  owner: "M2",
  routes: [
    {
      method: "POST",
      path: "/jobs",
      auth: "user",
      handler: async ({ req, auth }: RouteContext) => {
        const body = await readJson<{ ticker?: unknown }>(req);
        return createDeepDiveJob(jobsDeps(), {
          userId: auth.userId!,
          ticker: body?.ticker,
          requestId: requestIdOf(req),
        });
      },
    },
    {
      method: "GET",
      path: "/jobs/:id",
      auth: "user",
      handler: ({ params, auth }: RouteContext) =>
        getDeepDiveJob(jobsDeps(), { userId: auth.userId!, jobId: params.id }),
    },
  ],
};
