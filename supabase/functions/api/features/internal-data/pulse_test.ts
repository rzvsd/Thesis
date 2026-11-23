// POST /internal/pulse/dispatch: build, store, dedup, failures, missing inputs and alerts.
// Uses memory stores for jobs, reports and Storage. The inputs file was made by jobs/data/run_pulse.py in
// fixture mode (as_of 2026-03-27), with RSS headlines from the news fixtures.
import { assert, assertEquals, assertExists } from "jsr:@std/assert@1.0.13";
import { artifactKeyFor } from "../../../_lib/reports/artifacts.ts";
import { isMarketPulseReport } from "../../../_lib/pulse/validate.ts";
import type { EvaluatorDeps } from "../../../_lib/evaluators/deps.ts";
import { MemoryPulseArtifacts, MemoryPulseJobStore } from "../../../_lib/evaluators/pulse/store_memory.ts";
import inputs from "../../../_lib/evaluators/pulse/testdata/inputs.json" with { type: "json" };
import { setPulseDeps } from "./index.ts";
import { addUser, call, post, recordingPush, setup, snapshot } from "./test_support.ts";

const ROUTE = "/internal/pulse/dispatch";
const CYCLE = { cycle_start: "2026-03-26T10:30:00.000Z", cycle_end: "2026-03-27T10:30:00.000Z" };

function pulseSetup(overrides: Partial<EvaluatorDeps> = {}) {
  const { store, deps } = setup(overrides);
  const jobs = new MemoryPulseJobStore();
  const artifacts = new MemoryPulseArtifacts();
  setPulseDeps({
    evaluator: deps,
    jobs,
    artifacts,
    tickers: ["AAPL", "MSFT", "TSLA"],
    schemaVersion: "1.0.0",
  });
  return { store, jobs, artifacts };
}

type Job = Record<string, string | undefined>;

Deno.test("pulse: fresh build stores the artifact and the reports row, then answers 202 with a complete job", async () => {
  const push = recordingPush();
  const { store, jobs, artifacts } = pulseSetup({ push });
  addUser(store, "free1", { device: true });
  addUser(store, "pro1", { tier: "PRO", device: true, tickers: ["AAPL"] });
  store.snapshots.push(snapshot("pro1", "AAPL", { freshnessState: "stale", freshnessReason: "Old." }));

  const res = await post(ROUTE, { ...CYCLE, inputs });
  assertEquals(res.status, 202);
  assertEquals(res.body.deduplicated, false);
  const job = res.body.job as Job;
  assertEquals(job.status, "complete");
  assertEquals(job.type, "market_pulse");
  assertExists(job.report_id);

  assertEquals(jobs.reports.length, 1);
  const row = jobs.reports[0];
  assertEquals(row.id, job.report_id);
  assertEquals(row.jobId, job.job_id);
  assertEquals(row.createdAt, CYCLE.cycle_end);
  const body = artifacts.objects.get(row.artifactKey) as Record<string, unknown>;
  assert(isMarketPulseReport(body));
  assertEquals(row.artifactKey, artifactKeyFor(body as { generated_at: string; report_id: string }));
  assert(row.artifactKey.startsWith("market_pulse/"));
  assertEquals(body.cycle_start, CYCLE.cycle_start);
  const flags = body.flags as string[];
  assert(!flags.includes("data_unavailable:market_tape"));
  assert(!flags.includes("data_incomplete:what_to_watch"));

  // Free user gets market_pulse_ready, Pro user the briefing. Inbox rows carry the pulse date.
  const types = store.alerts.map((a) => `${a.userId}:${a.notificationType}`).sort();
  assertEquals(types, ["free1:market_pulse_ready", "pro1:morning_exception_briefing"]);
  for (const alert of store.alerts) assertEquals(alert.context.pulse_date, "2026-03-27");
  const briefing = store.alerts.find((a) => a.userId === "pro1")!;
  assertEquals(briefing.title, "1 exception needs review");
  assertEquals(push.sent.length, 2);
  assert(store.audit.some((a) => a.eventType === "market_pulse.push_delivery"));
});

Deno.test("pulse: the same cycle_start is deduplicated with 200 and no second build", async () => {
  const { store, jobs } = pulseSetup();
  addUser(store, "free1");
  const first = await post(ROUTE, { ...CYCLE, inputs });
  const again = await post(ROUTE, { ...CYCLE, inputs });
  assertEquals(again.status, 200);
  assertEquals(again.body.deduplicated, true);
  assertEquals((again.body.job as Job).job_id, (first.body.job as Job).job_id);
  assertEquals(jobs.jobs.length, 1);
  assertEquals(jobs.reports.length, 1);
  assertEquals(store.alerts.length, 1);
});

Deno.test("pulse: force_fail fails the job; a failed cycle can run again", async () => {
  const { store, jobs, artifacts } = pulseSetup();
  addUser(store, "free1");
  const res = await post(ROUTE, { ...CYCLE, force_fail: true, inputs });
  assertEquals(res.status, 202);
  const job = res.body.job as Job;
  assertEquals(job.status, "failed");
  assertEquals(job.ticker, "FORCE_FAIL");
  assertEquals(job.error_message, "Forced market pulse failure");
  assertEquals(jobs.reports.length, 0);
  assertEquals(artifacts.objects.size, 0);
  assertEquals(store.alerts.length, 0);
  assert(store.audit.some((a) => a.eventType === "job.failed"));

  const retry = await post(ROUTE, { ...CYCLE, inputs });
  assertEquals(retry.status, 202);
  assertEquals((retry.body.job as Job).status, "complete");
  assertEquals(jobs.jobs.length, 2);
});

Deno.test("pulse: missing inputs take the data_unavailable paths and still store an issue", async () => {
  const { jobs, artifacts } = pulseSetup();
  const res = await post(ROUTE, CYCLE);
  assertEquals(res.status, 202);
  assertEquals((res.body.job as Job).status, "complete");
  const body = artifacts.objects.get(jobs.reports[0].artifactKey) as Record<string, unknown>;
  const flags = body.flags as string[];
  for (
    const flag of [
      "data_incomplete:what_to_watch",
      "data_unavailable:market_tape",
      "data_unavailable:official_macro_pressure",
      "data_unavailable:market_moves",
      "data_unavailable:bounded_context",
      "data_unavailable:canonical_events",
    ]
  ) assert(flags.includes(flag), flag);
  const sections = body.sections as Record<string, { status: string; body: string }>;
  assertEquals(sections.market_tape.status, "data_unavailable");
  assertEquals(sections.market_tape.body, "Market tape was unavailable for this cycle.");
  assertEquals((body.macro_news as { state?: string }).state !== undefined, true);
  assertEquals(body.market_tape, undefined);
});

Deno.test("pulse: an error envelope counts as a failed source", async () => {
  const { jobs, artifacts } = pulseSetup();
  const broken = {
    ...inputs,
    market_tape: { ok: false, data: null, error_flag: true, error_message: "HTTP 503" },
  };
  await post(ROUTE, { ...CYCLE, inputs: broken });
  const body = artifacts.objects.get(jobs.reports[0].artifactKey) as Record<string, unknown>;
  assert((body.flags as string[]).includes("data_unavailable:market_tape"));
  assert(!(body.flags as string[]).includes("data_unavailable:official_macro_pressure"));
});

Deno.test("pulse: alerts are sent once per user and pulse date, and the next issue reads the previous one", async () => {
  const { store, jobs, artifacts } = pulseSetup();
  addUser(store, "free1");
  addUser(store, "pro1", { tier: "PRO" });
  await post(ROUTE, { ...CYCLE, inputs });
  assertEquals(store.alerts.length, 2);

  // A second cycle that ends on the same date: a new issue, no new alerts.
  const second = await post(ROUTE, {
    cycle_start: "2026-03-26T11:30:00.000Z",
    cycle_end: "2026-03-27T11:30:00.000Z",
    inputs,
  });
  assertEquals(second.status, 202);
  assertEquals(jobs.reports.length, 2);
  assertEquals(store.alerts.length, 2);
  const audit = store.audit.filter((a) => a.eventType === "market_pulse.push_delivery");
  assertEquals([audit[1].payload.free_sent, audit[1].payload.free_deduped], [0, 1]);
  assertEquals([audit[1].payload.pro_sent, audit[1].payload.pro_deduped], [0, 1]);

  // The second issue was built with the first one as the previous issue (editorial delta).
  assertEquals(artifacts.reads, [jobs.reports[0].artifactKey]);
  const latest = artifacts.objects.get(jobs.reports[1].artifactKey) as { editorial_issue?: unknown };
  assertExists(latest.editorial_issue);
});

Deno.test("pulse: bad bodies are 422 and the route needs the internal token", async () => {
  pulseSetup();
  assertEquals((await post(ROUTE, { cycle_start: "nope" })).status, 422);
  assertEquals((await post(ROUTE, { cycle_start: 5 })).status, 422);
  assertEquals(
    (await post(ROUTE, { cycle_start: CYCLE.cycle_end, cycle_end: CYCLE.cycle_start })).status,
    422,
  );
  assertEquals((await call("POST", ROUTE, CYCLE, null)).status, 401);
});
