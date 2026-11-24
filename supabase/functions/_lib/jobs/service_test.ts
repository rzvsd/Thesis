import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { claimJob, completeJob, createDeepDiveJob, failJob, getDeepDiveJob, MSG_CAP } from "./service.ts";
import { MSG_NOT_STARTED, MSG_RUNNER_STOPPED } from "./sweeper.ts";
import { fakeDeps } from "./testdata/fakes.ts";
import type { AnalysisReport } from "./types.ts";
import fullReport from "./testdata/report-valid.json" with { type: "json" };

const fixture = fullReport as unknown as AnalysisReport;

function reportFor(jobId: string, id = crypto.randomUUID()): AnalysisReport {
  return { ...structuredClone(fixture), report_id: id, job_id: jobId, ticker: "AAPL" };
}

async function body(res: Response) {
  return await res.json();
}

Deno.test("POST /jobs: bad ticker 422, unknown ticker 404", async () => {
  const { deps } = fakeDeps();
  assertEquals((await createDeepDiveJob(deps, { userId: "u1", ticker: "a b", requestId: "r" })).status, 422);
  const res = await createDeepDiveJob(deps, { userId: "u1", ticker: "ZZZZ", requestId: "r" });
  assertEquals(res.status, 404);
  assertEquals((await body(res)).error, "ticker_not_found");
});

Deno.test("POST /jobs queues, dispatches once and returns the bare job", async () => {
  const { deps, runner, store } = fakeDeps();
  const res = await createDeepDiveJob(deps, { userId: "u1", ticker: "aapl", requestId: "r" });
  assertEquals(res.status, 202);
  const job = await body(res);
  assertEquals(job.status, "queued");
  assertEquals(job.ticker, "AAPL");
  assert(!("data" in job));
  assertEquals(runner.dispatched, [job.job_id]);
  assertEquals((await store.getJob(job.job_id))?.attempts, 1);
});

Deno.test("POST /jobs again for the same ticker returns the open job (H1)", async () => {
  const { deps, runner, store } = fakeDeps();
  store.tiers.set("u1", "PRO");
  const first = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  const second = await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" });
  assertEquals(second.status, 202);
  assertEquals((await body(second)).job_id, first.job_id);
  assertEquals(runner.dispatched.length, 1);
});

Deno.test("POST /jobs: FREE tier gets one generation a day", async () => {
  const { deps } = fakeDeps();
  assertEquals((await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" })).status, 202);
  const res = await createDeepDiveJob(deps, { userId: "u1", ticker: "MSFT", requestId: "r" });
  assertEquals(res.status, 403);
  const b = await body(res);
  assertEquals([b.error, b.feature], ["upgrade_required", "deep_dive_daily_limit"]);
});

Deno.test("POST /jobs: global dispatch cap gives 503 queue_unavailable and frees the user's quota", async () => {
  const { deps, store } = fakeDeps({ dailyCap: 1 });
  store.tiers.set("u1", "PRO");
  assertEquals((await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" })).status, 202);
  const res = await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" });
  assertEquals(res.status, 503);
  const b = await body(res);
  assertEquals(b.error, "queue_unavailable");
  assertEquals(b.error_message, MSG_CAP);
  assertEquals(b.job.status, "failed");
  assertEquals(store.usage.get("u2|2026-11-25"), 0);
});

Deno.test("POST /jobs: runner down gives 503 with the failed job", async () => {
  const { deps, runner, store } = fakeDeps();
  runner.fail = true;
  const res = await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" });
  assertEquals(res.status, 503);
  assertEquals((await body(res)).job.status, "failed");
  assertEquals(store.dispatches.get("2026-11-25"), 0);
});

Deno.test("GET /jobs/:id hides other users' jobs", async () => {
  const { deps } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  assertEquals((await getDeepDiveJob(deps, { userId: "u2", jobId: job.job_id })).status, 404);
  assertEquals((await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id })).status, 200);
});

Deno.test("full run: claim, complete, side effects, then reuse within freshness", async () => {
  const { deps, effects, pending, store, artifacts } = fakeDeps();
  store.tiers.set("u1", "PRO");
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));

  const claimRes = await claimJob(deps, {
    jobId: job.job_id,
    runUrl: "https://github.com/rzvsd/thesis/actions/runs/42",
    requestId: "r",
  });
  assertEquals(claimRes.status, 200);
  const claim = await body(claimRes);
  assertEquals(claim.analysis_request.job_id, job.job_id);
  assertEquals(claim.job.status, "running");
  assertEquals((await store.getJob(job.job_id))?.runUrl, "https://github.com/rzvsd/thesis/actions/runs/42");
  assertEquals((await claimJob(deps, { jobId: job.job_id, requestId: "r" })).status, 409);

  const report = reportFor(job.job_id);
  const done = await completeJob(deps, {
    jobId: job.job_id,
    body: { report, llm_usage: { usd: 0 } },
    requestId: "r",
  });
  assertEquals(done.status, 200);
  assertEquals(await body(done), { status: "ok", report_id: report.report_id });
  assertEquals(pending.length, 1);
  assertEquals(effects.applied, [{ reportId: report.report_id, includeMonitorSnapshot: true }]);
  const stored = store.reports.get(report.report_id)!;
  assertEquals(stored.fingerprint, "AAPL|2.0|LATEST_UNKNOWN");
  assert(artifacts.objects.has(stored.artifactKey));

  const polled = await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }));
  assertEquals([polled.status, polled.report_id], ["complete", report.report_id]);

  // Same ticker later: the fresh report is reused, 200 complete, no new dispatch.
  const reuse = await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" });
  assertEquals(reuse.status, 200);
  const reused = await body(reuse);
  assertEquals(reused.status, "complete");
  assert(reused.report_id !== report.report_id);
  assertEquals(effects.applied[1].includeMonitorSnapshot, false);
});

async function runToComplete(
  deps: ReturnType<typeof fakeDeps>["deps"],
  userId: string,
  latestPeriod?: string,
) {
  const res = await createDeepDiveJob(deps, { userId, ticker: "AAPL", requestId: "r" });
  assertEquals(res.status, 202);
  const job = await body(res);
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const report = reportFor(job.job_id);
  if (latestPeriod) {
    report.historical_context = {
      financial_snapshot_count: 4,
      transcript_count: 0,
      transcript_available: false,
      missing_reasons: [],
      latest_period: latestPeriod,
    };
  }
  assertEquals(
    (await completeJob(deps, { jobId: job.job_id, body: { report }, requestId: "r" })).status,
    200,
  );
  return report.report_id;
}

const HOUR = 3_600_000;

Deno.test("one report per filing: a user-run report is reused by everyone until the next filing", async () => {
  const { deps, store, runner, clock } = fakeDeps();
  store.coverage.set("AAPL", "2026Q3");
  for (const u of ["u1", "u2", "u3"]) store.tiers.set(u, "PRO");
  const start = clock.now.getTime();
  const reportId = await runToComplete(deps, "u1");
  const stored = store.reports.get(reportId)!;
  assertEquals(stored.fingerprint, "AAPL|2.0|2026Q3");
  assertEquals(stored.freshnessExpiresAt, new Date(start + 2160 * HOUR).toISOString());

  // A month later another customer gets the same report, with no new run.
  clock.now = new Date(start + 30 * 24 * HOUR);
  const reuse = await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" });
  assertEquals(reuse.status, 200);
  assertEquals(runner.dispatched.length, 1);

  // The next filing changes the fingerprint, so the next request runs a new Deep Dive.
  store.coverage.set("AAPL", "2026Q4");
  const fresh = await createDeepDiveJob(deps, { userId: "u3", ticker: "AAPL", requestId: "r" });
  assertEquals(fresh.status, 202);
  assertEquals(runner.dispatched.length, 2);
});

Deno.test("unknown filing period keeps the short reuse window, so a stale report is never pinned", async () => {
  const { deps, store, runner, clock } = fakeDeps();
  for (const u of ["u1", "u2", "u3"]) store.tiers.set(u, "PRO");
  const start = clock.now.getTime();
  const reportId = await runToComplete(deps, "u1");
  const stored = store.reports.get(reportId)!;
  assertEquals(stored.fingerprint, "AAPL|2.0|LATEST_UNKNOWN");
  assertEquals(stored.freshnessExpiresAt, new Date(start + 24 * HOUR).toISOString());

  clock.now = new Date(start + 23 * HOUR);
  assertEquals((await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" })).status, 200);
  clock.now = new Date(start + 25 * HOUR);
  assertEquals((await createDeepDiveJob(deps, { userId: "u3", ticker: "AAPL", requestId: "r" })).status, 202);
  assertEquals(runner.dispatched.length, 2);
});

Deno.test("fingerprint period: the analysed period wins; coverage fills in only when the report has none", async () => {
  const { deps, store, runner } = fakeDeps();
  for (const u of ["u1", "u2", "u3"]) store.tiers.set(u, "PRO");
  // Coverage moved to Q4 while a run analysed Q3: the report stays Q3 and does not block the Q4 analysis.
  store.coverage.set("AAPL", "2026Q4");
  const analysed = await runToComplete(deps, "u1", "2026q3");
  assertEquals(store.reports.get(analysed)!.fingerprint, "AAPL|2.0|2026Q3");
  assertEquals((await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" })).status, 202);
  assertEquals(runner.dispatched.length, 2);

  store.reports.clear();
  store.jobs.clear();
  const fromCoverage = await runToComplete(deps, "u3");
  assertEquals(store.reports.get(fromCoverage)!.fingerprint, "AAPL|2.0|2026Q4");
});

Deno.test("complete rejects a bad report or a job id mismatch", async () => {
  const { deps } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const bad = await completeJob(deps, { jobId: job.job_id, body: { report: { nope: 1 } }, requestId: "r" });
  assertEquals(bad.status, 422);
  assert(Array.isArray((await body(bad)).validation_errors));
  const other = await completeJob(deps, {
    jobId: job.job_id,
    body: { report: reportFor("other") },
    requestId: "r",
  });
  assertEquals(other.status, 422);
  assertEquals((await completeJob(deps, { jobId: job.job_id, body: null, requestId: "r" })).status, 422);
});

Deno.test("fail marks an open job failed but never overwrites a finished one", async () => {
  const { deps, store } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "FAIL", requestId: "r" }));
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const res = await failJob(deps, {
    jobId: job.job_id,
    errorMessage: "Forced failure for ticker FAIL",
    requestId: "r",
  });
  assertEquals(res.status, 200);
  const failed = await store.getJob(job.job_id);
  assertEquals([failed?.status, failed?.errorMessage], ["failed", "Forced failure for ticker FAIL"]);
  // A second, late fail is a no-op.
  assertEquals(
    (await failJob(deps, { jobId: job.job_id, errorMessage: "late", requestId: "r" })).status,
    200,
  );
  assertEquals((await store.getJob(job.job_id))?.errorMessage, "Forced failure for ticker FAIL");
  assertEquals(
    (await failJob(deps, { jobId: crypto.randomUUID(), errorMessage: "x", requestId: "r" })).status,
    404,
  );
});

Deno.test("poll-time sweeper: re-dispatches a stuck queued job, then gives up", async () => {
  const { deps, runner, clock, store } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  clock.now = new Date(clock.now.getTime() + 60_000);
  assertEquals(
    (await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }))).status,
    "queued",
  );
  assertEquals(runner.dispatched.length, 1);
  for (let i = 0; i < 2; i++) {
    clock.now = new Date(clock.now.getTime() + 130_000);
    await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id });
  }
  assertEquals(runner.dispatched.length, 3);
  assertEquals((await store.getJob(job.job_id))?.attempts, 3);
  clock.now = new Date(clock.now.getTime() + 130_000);
  const last = await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }));
  assertEquals([last.status, last.error_message], ["failed", MSG_NOT_STARTED]);
});

Deno.test("poll-time sweeper: a cancelled run fails its running job", async () => {
  const { deps, runner, clock } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  await claimJob(deps, {
    jobId: job.job_id,
    runUrl: "https://github.com/rzvsd/thesis/actions/runs/7",
    requestId: "r",
  });
  clock.now = new Date(clock.now.getTime() + 45_000);
  assertEquals(
    (await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }))).status,
    "running",
  );
  runner.state = "finished";
  // Checked less than 20 s ago: no new check yet.
  clock.now = new Date(clock.now.getTime() + 5_000);
  assertEquals(
    (await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }))).status,
    "running",
  );
  clock.now = new Date(clock.now.getTime() + 25_000);
  const out = await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }));
  assertEquals([out.status, out.error_message], ["failed", MSG_RUNNER_STOPPED]);
});

Deno.test("poll-time sweeper: a running job past the timeout fails even without a run url", async () => {
  const { deps, clock } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  clock.now = new Date(clock.now.getTime() + 11 * 60_000);
  const out = await body(await getDeepDiveJob(deps, { userId: "u1", jobId: job.job_id }));
  assertEquals(out.status, "failed");
});

Deno.test("complete is idempotent: a retried complete keeps the stored report", async () => {
  const { deps, store, artifacts, effects } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const report = reportFor(job.job_id);
  assertEquals(
    (await completeJob(deps, { jobId: job.job_id, body: { report }, requestId: "r" })).status,
    200,
  );
  const again = await completeJob(deps, { jobId: job.job_id, body: { report }, requestId: "r" });
  assertEquals(again.status, 200);
  assertEquals(await body(again), { status: "ok", report_id: report.report_id });
  assertEquals((await store.getJob(job.job_id))?.status, "complete");
  assert(store.reports.has(report.report_id));
  assertEquals(artifacts.objects.size, 1);
  assertEquals(effects.applied.length, 1);
});

Deno.test("complete after the sweeper failed the job stores nothing", async () => {
  const { deps, store, artifacts } = fakeDeps();
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  await store.failIfStatus(job.job_id, "running", "2026-11-25T12:20:00Z", "timeout");
  const res = await completeJob(deps, {
    jobId: job.job_id,
    body: { report: reportFor(job.job_id) },
    requestId: "r",
  });
  assertEquals(res.status, 404);
  assertEquals([store.reports.size, artifacts.objects.size], [0, 0]);
});

Deno.test("a side-effect error after completion does not undo the report", async () => {
  const { deps, store, effects } = fakeDeps();
  effects.apply = () => Promise.reject(new Error("boom"));
  const job = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const report = reportFor(job.job_id);
  assertEquals(
    (await completeJob(deps, { jobId: job.job_id, body: { report }, requestId: "r" })).status,
    200,
  );
  assertEquals((await store.getJob(job.job_id))?.status, "complete");
  assert(store.reports.has(report.report_id));
});

Deno.test("overlapping POST /jobs for one user and ticker create one job", async () => {
  const { deps, runner, store } = fakeDeps();
  store.tiers.set("u1", "PRO");
  // Both requests miss the first open-job check, then race on create.
  const realFind = store.findOpenJob.bind(store);
  let calls = 0;
  store.findOpenJob = (u, t, s) => (calls++ < 2 ? Promise.resolve(undefined) : realFind(u, t, s));
  const [a, b] = await Promise.all([
    createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }),
    createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }),
  ]);
  const [ja, jb] = [await body(a), await body(b)];
  assertEquals([a.status, b.status], [202, 202]);
  assertEquals(ja.job_id, jb.job_id);
  assertEquals(runner.dispatched.length, 1);
});
