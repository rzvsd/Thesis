import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { claimJob, completeJob, createDeepDiveJob, failJob, getDeepDiveJob, MSG_CAP } from "./service.ts";
import { MSG_NOT_STARTED, MSG_RUNNER_STOPPED } from "./sweeper.ts";
import { fakeDeps } from "./testdata/fakes.ts";
import type { AnalysisReport } from "./types.ts";
import fullReport from "./testdata/report-valid.json" with { type: "json" };

const fixture = fullReport as unknown as AnalysisReport;

// The runner writes schema 2.1 (fact pack) since Deep Dive 2.0; the stored fixture is an older 2.0 body.
function reportFor(jobId: string, id = crypto.randomUUID()): AnalysisReport {
  return { ...structuredClone(fixture), report_id: id, job_id: jobId, ticker: "AAPL", schema_version: "2.1" };
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
  // A different ticker: a second customer on the same open ticker follows that run instead.
  const res = await createDeepDiveJob(deps, { userId: "u2", ticker: "MSFT", requestId: "r" });
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
  // Filing alerts plus the follower settle step.
  assertEquals(pending.length, 2);
  assertEquals(effects.applied, [{ reportId: report.report_id, includeMonitorSnapshot: true }]);
  const stored = store.reports.get(report.report_id)!;
  assertEquals(stored.fingerprint, "AAPL|2.1|LATEST_UNKNOWN");
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
  assertEquals(stored.fingerprint, "AAPL|2.1|2026Q3");
  assertEquals(stored.freshnessExpiresAt, new Date(start + 4380 * HOUR).toISOString());

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
  assertEquals(stored.fingerprint, "AAPL|2.1|LATEST_UNKNOWN");
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
  assertEquals(store.reports.get(analysed)!.fingerprint, "AAPL|2.1|2026Q3");
  assertEquals((await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" })).status, 202);
  assertEquals(runner.dispatched.length, 2);

  store.reports.clear();
  store.jobs.clear();
  const fromCoverage = await runToComplete(deps, "u3");
  assertEquals(store.reports.get(fromCoverage)!.fingerprint, "AAPL|2.1|2026Q4");
});

Deno.test("fingerprint period: the fact pack's latest filing label wins over historical_context", async () => {
  const { deps, store, runner } = fakeDeps();
  for (const u of ["u1", "u2", "u3"]) store.tiers.set(u, "PRO");
  const res = await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" });
  const job = await body(res);
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const report = reportFor(job.job_id) as AnalysisReport & { fact_pack?: unknown };
  report.historical_context = {
    financial_snapshot_count: 4,
    transcript_count: 0,
    transcript_available: false,
    missing_reasons: [],
    latest_period: "2026Q3",
  };
  report.fact_pack = { version: 1, latest_filing: { form: "10-K", period_label: "2026-FY" }, annual: [] };
  assertEquals(
    (await completeJob(deps, { jobId: job.job_id, body: { report }, requestId: "r" })).status,
    200,
  );
  assertEquals(store.reports.get(report.report_id)!.fingerprint, "AAPL|2.1|2026-FY");

  // The runner's ingest sets coverage to the same label, so the next customer reuses the report.
  store.coverage.set("AAPL", "2026-FY");
  assertEquals((await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" })).status, 200);
  assertEquals(runner.dispatched.length, 1);

  // A fact pack without a latest filing falls back to historical_context.
  store.reports.clear();
  store.jobs.clear();
  const fallback = await runToComplete(deps, "u3", "2026q3");
  assertEquals(store.reports.get(fallback)!.fingerprint, "AAPL|2.1|2026Q3");
});

Deno.test("lookup uses schema 2.1: a stored 2.0 report for the same filing is not reused", async () => {
  const { deps, store, runner } = fakeDeps();
  store.coverage.set("AAPL", "2026Q3");
  for (const u of ["u1", "u2"]) store.tiers.set(u, "PRO");
  const res = await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" });
  const job = await body(res);
  await claimJob(deps, { jobId: job.job_id, requestId: "r" });
  const old = { ...reportFor(job.job_id), schema_version: "2.0" };
  assertEquals(
    (await completeJob(deps, { jobId: job.job_id, body: { report: old }, requestId: "r" })).status,
    200,
  );
  assertEquals(store.reports.get(old.report_id)!.fingerprint, "AAPL|2.0|2026Q3");
  assertEquals((await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" })).status, 202);
  assertEquals(runner.dispatched.length, 2);
});

Deno.test("a second customer follows the open run for the ticker and gets the same report", async () => {
  const { deps, store, runner, artifacts, pending } = fakeDeps();
  store.coverage.set("AAPL", "2026Q3");
  for (const u of ["u1", "u2", "u3"]) store.tiers.set(u, "FREE");
  const leader = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));

  // u2 asks while u1's run is open: no second run, no daily quota used, a queued job that follows u1's run.
  const res = await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" });
  assertEquals(res.status, 202);
  const follower = await body(res);
  assertEquals(follower.status, "queued");
  assertEquals(runner.dispatched, [leader.job_id]);
  assertEquals(store.usage.get("u2|2026-11-25") ?? 0, 0);
  assertEquals((await store.getJob(follower.job_id))?.followsJobId, leader.job_id);
  // Asking again returns the same following job.
  assertEquals(
    (await body(await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" }))).job_id,
    follower.job_id,
  );
  // Polling while the run is open keeps it queued and never dispatches a runner for it.
  assertEquals(
    (await body(await getDeepDiveJob(deps, { userId: "u2", jobId: follower.job_id }))).status,
    "queued",
  );
  assertEquals(runner.dispatched.length, 1);

  // A third customer who polls never: completion hands it its copy in the background.
  const third = await body(await createDeepDiveJob(deps, { userId: "u3", ticker: "AAPL", requestId: "r" }));

  await claimJob(deps, { jobId: leader.job_id, requestId: "r" });
  const report = reportFor(leader.job_id);
  assertEquals(
    (await completeJob(deps, { jobId: leader.job_id, body: { report }, requestId: "r" })).status,
    200,
  );
  await Promise.all(pending);

  const thirdJob = (await store.getJob(third.job_id))!;
  assertEquals(thirdJob.status, "complete");
  const polled = await body(await getDeepDiveJob(deps, { userId: "u2", jobId: follower.job_id }));
  assertEquals(polled.status, "complete");
  const copy = store.reports.get(polled.report_id)!;
  assertEquals(copy.fingerprint, store.reports.get(report.report_id)!.fingerprint);
  assert(artifacts.objects.has(copy.artifactKey));
  assertEquals(runner.dispatched.length, 1);
});

Deno.test("a follower fails with the run's message when the followed run fails", async () => {
  const { deps, store, pending } = fakeDeps();
  for (const u of ["u1", "u2"]) store.tiers.set(u, "PRO");
  const leader = await body(await createDeepDiveJob(deps, { userId: "u1", ticker: "AAPL", requestId: "r" }));
  const follower = await body(
    await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" }),
  );
  await failJob(deps, {
    jobId: leader.job_id,
    errorMessage: "Forced failure for ticker AAPL",
    requestId: "r",
  });
  await Promise.all(pending);
  const job = (await store.getJob(follower.job_id))!;
  assertEquals([job.status, job.errorMessage], ["failed", "Forced failure for ticker AAPL"]);
  // The follower is no longer open, so a retry starts its own run.
  assertEquals((await createDeepDiveJob(deps, { userId: "u2", ticker: "AAPL", requestId: "r" })).status, 202);
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
