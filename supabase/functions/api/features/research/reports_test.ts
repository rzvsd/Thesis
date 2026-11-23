// Opposite case and what-if routes. Behaviour from apps/product-api/tests/ph5-m6-conviction.test.ts and
// m7-report-features.test.ts.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { call, memoryDeps, OTHER_USER, USER } from "../../../_lib/research/testing.ts";
import type { ReportRecord } from "../../../_lib/research/types.ts";
import { oppositeCaseCreateHandler, oppositeCaseGetHandler, reportScenarioHandler } from "./reports.ts";

const reportRow: ReportRecord = {
  id: "rep-1",
  jobId: "job-1",
  type: "deep_dive",
  ticker: "AAPL",
  schemaVersion: "2.0.0",
  artifactKey: "reports/rep-1.json",
  createdAt: "2026-11-01T00:00:00.000Z",
};

const body = {
  report_id: "rep-1",
  job_id: "job-1",
  type: "deep_dive",
  ticker: "AAPL",
  generated_at: "2026-11-01T00:00:00.000Z",
  schema_version: "2.0.0",
  sections: [{ section_id: "thesis_statement", title: "Thesis statement", body: "Services keep growing." }],
  signal: { value: "positive", reasons: ["Services margin expands."] },
  confidence: { score: 0.7, label: "medium" },
  valuation: {
    fair_value_mid: 200,
    spot_price: 180,
    assumptions: {
      methodology: "deterministic_dcf",
      projection_years: 5,
      terminal_growth_rate: 0.02,
      wacc: 0.09,
    },
  },
};

function setup(withBody: boolean) {
  const deps = memoryDeps(withBody ? () => Promise.resolve(structuredClone(body)) : undefined);
  deps.store.reports.push(reportRow);
  deps.store.reportAccess.add(`${USER}:rep-1`);
  return deps;
}

const ctx = (method: string, suffix: string, extra: Record<string, unknown> = {}) => ({
  method,
  path: `/v1/reports/rep-1/${suffix}`,
  params: { id: "rep-1" },
  ...extra,
});

Deno.test("opposite case: unknown or foreign report is 404 report_not_found", async () => {
  const deps = setup(true);
  const get = oppositeCaseGetHandler(deps);
  const missing = await call(get, { path: "/v1/reports/nope/opposite-case", params: { id: "nope" } });
  assertEquals(missing.status, 404);
  assertEquals(missing.body.error, "report_not_found");
  const foreign = await call(get, { ...ctx("GET", "opposite-case"), userId: OTHER_USER });
  assertEquals(foreign.status, 404);
});

Deno.test("opposite case: free tier is 403 conviction_intelligence", async () => {
  const deps = setup(true);
  const res = await call(oppositeCaseCreateHandler(deps), ctx("POST", "opposite-case"));
  assertEquals(res.status, 403);
  assertEquals(res.body.feature, "conviction_intelligence");
});

Deno.test("opposite case: GET is 404 opposite_case_not_found until POST builds it", async () => {
  const deps = setup(true);
  deps.store.tiers.set(USER, "PRO");
  const none = await call(oppositeCaseGetHandler(deps), ctx("GET", "opposite-case"));
  assertEquals(none.status, 404);
  assertEquals(none.body.error, "opposite_case_not_found");

  const built = await call(oppositeCaseCreateHandler(deps), ctx("POST", "opposite-case"));
  assertEquals(built.status, 200);
  assertEquals(built.body.data.ticker, "AAPL");
  assertEquals(built.body.data.thesis_summary, "Services keep growing.");
  assertEquals(built.body.data.prompt_version, "thesis-m6-opposite-case");
  assertEquals(built.body.data.key_points.length, 3);
  assertEquals(deps.store.journal[0].eventType, "opposite_case_generated");

  const again = await call(oppositeCaseCreateHandler(deps), ctx("POST", "opposite-case"));
  assertEquals(again.body.data.opposite_case_id, built.body.data.opposite_case_id);
  const read = await call(oppositeCaseGetHandler(deps), ctx("GET", "opposite-case"));
  assertEquals(read.status, 200);
  assertEquals(read.body.data.opposite_case_id, built.body.data.opposite_case_id);
});

Deno.test("opposite case: unreadable body answers like the old missing artifact", async () => {
  const deps = setup(false);
  deps.store.tiers.set(USER, "PRO");
  const res = await call(oppositeCaseCreateHandler(deps), ctx("POST", "opposite-case"));
  assertEquals(res.status, 404);
  assertEquals(res.body, { error: "report_not_found", error_message: "Report artifact missing." });
});

Deno.test("what-if scenario: Pro only, bare response, 422s", async () => {
  const deps = setup(true);
  const h = reportScenarioHandler(deps);
  const free = await call(h, ctx("POST", "scenario", { body: { overrides: {} } }));
  assertEquals(free.status, 403);
  assertEquals(free.body.feature, "what_if_scenario");

  deps.store.tiers.set(USER, "PRO");
  const ok = await call(h, ctx("POST", "scenario", { body: { overrides: { wacc: 0.1 } } }));
  assertEquals(ok.status, 200);
  assertEquals(ok.body.report_id, "rep-1");
  assertEquals(ok.body.deterministic_model, "phase6_deterministic_v1");
  assert(!("data" in ok.body));

  const badYears = await call(h, ctx("POST", "scenario", { body: { overrides: { projection_years: 31 } } }));
  assertEquals(badYears.status, 422);
  const badPair = await call(h, ctx("POST", "scenario", { body: { overrides: { wacc: 0.01 } } }));
  assertEquals(badPair.body.error_message, "wacc must be greater than terminal_growth_rate.");
  assertEquals(deps.store.audit.filter((a) => a.eventType === "report.scenario_generated").length, 1);
});

Deno.test("what-if scenario: no valuation is 422 scenario_unavailable; no body is 404", async () => {
  const noValuation = memoryDeps(() => Promise.resolve({ ...structuredClone(body), valuation: undefined }));
  noValuation.store.reports.push(reportRow);
  noValuation.store.reportAccess.add(`${USER}:rep-1`);
  noValuation.store.tiers.set(USER, "PRO");
  const res = await call(reportScenarioHandler(noValuation), ctx("POST", "scenario", { body: {} }));
  assertEquals(res.status, 422);
  assertEquals(res.body.error, "scenario_unavailable");

  const missing = setup(false);
  missing.store.tiers.set(USER, "PRO");
  const gone = await call(reportScenarioHandler(missing), ctx("POST", "scenario", { body: {} }));
  assertEquals(gone.status, 404);
  assertEquals(gone.body.error_message, "Report artifact missing.");
});
