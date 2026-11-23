// Behaviour from apps/product-api/tests/ph5-m7-scenario-stress.test.ts.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { call, memoryDeps, OTHER_USER, USER } from "../../../_lib/research/testing.ts";
import { scenarioRunCreateHandler, scenarioRunGetHandler, scenarioTemplatesHandler } from "./scenarios.ts";

Deno.test("scenario routes are Pro only", async () => {
  const deps = memoryDeps();
  for (
    const [h, opts] of [
      [scenarioTemplatesHandler(deps), { path: "/v1/scenarios/templates" }],
      [scenarioRunCreateHandler(deps), { method: "POST", path: "/v1/scenarios/runs", body: {} }],
      [scenarioRunGetHandler(deps), { path: "/v1/scenarios/runs/x", params: { id: "x" } }],
    ] as const
  ) {
    const res = await call(h, opts);
    assertEquals(res.status, 403);
    assertEquals(res.body.feature, "scenario_stress");
  }
});

Deno.test("scenario templates list the five active templates in order", async () => {
  const deps = memoryDeps();
  deps.store.tiers.set(USER, "PRO");
  const res = await call(scenarioTemplatesHandler(deps), { path: "/v1/scenarios/templates" });
  assertEquals(res.status, 200);
  assertEquals(res.body.data.length, 5);
  assertEquals(res.body.data[0].scenario_id, "rates_higher_for_longer");
  assertEquals(Object.keys(res.body.data[0]).sort(), [
    "active",
    "created_at",
    "hypothesis",
    "scenario_id",
    "summary",
    "title",
    "updated_at",
  ]);
});

Deno.test("scenario run: create then read it back; other users get 404", async () => {
  const deps = memoryDeps();
  deps.store.tiers.set(USER, "PRO");
  deps.store.tiers.set(OTHER_USER, "PRO");
  deps.store.watchlists.set(USER, ["NVDA", "AMD", "MSFT", "KO"]);
  const created = await call(scenarioRunCreateHandler(deps), {
    method: "POST",
    path: "/v1/scenarios/runs",
    body: { scenario_id: "ai_hype_burst", as_of: "2026-11-20" },
  });
  assertEquals(created.status, 200);
  const run = created.body.data.run;
  assertEquals(run.as_of, "2026-11-20");
  assertEquals(run.total_names, 4);
  assertEquals(run.route, {
    open_tab: "research",
    scenario_id: "ai_hype_burst",
    scenario_run_id: run.scenario_run_id,
  });
  assert(created.body.data.impacts.every((i: { route: { ticker: string } }) => i.route.ticker));

  const get = scenarioRunGetHandler(deps);
  const read = await call(get, {
    path: `/v1/scenarios/runs/${run.scenario_run_id}`,
    params: { id: run.scenario_run_id },
  });
  assertEquals(read.status, 200);
  assertEquals(read.body.data.run.scenario_run_id, run.scenario_run_id);
  assertEquals(read.body.data.impacts.length, created.body.data.impacts.length);

  const other = await call(get, {
    path: `/v1/scenarios/runs/${run.scenario_run_id}`,
    params: { id: run.scenario_run_id },
    userId: OTHER_USER,
  });
  assertEquals(other.status, 404);
  assertEquals(other.body.error, "scenario_run_not_found");
});

Deno.test("scenario run: bad scenario_id or as_of is 422, inactive template is 404", async () => {
  const deps = memoryDeps();
  deps.store.tiers.set(USER, "PRO");
  const h = scenarioRunCreateHandler(deps);
  const bad = await call(h, { method: "POST", path: "/v1/scenarios/runs", body: { scenario_id: "nope" } });
  assertEquals(bad.status, 422);
  assertEquals(bad.body.error, "validation_failed");
  const badDate = await call(h, {
    method: "POST",
    path: "/v1/scenarios/runs",
    body: { scenario_id: "usd_up_10", as_of: "20-11-2026" },
  });
  assertEquals(badDate.status, 422);
  deps.store.templates.find((t) => t.templateId === "usd_up_10")!.isActive = false;
  const inactive = await call(h, {
    method: "POST",
    path: "/v1/scenarios/runs",
    body: { scenario_id: "usd_up_10" },
  });
  assertEquals(inactive.status, 404);
  assertEquals(inactive.body.error, "scenario_not_found");
});
