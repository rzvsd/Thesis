// Behaviour from apps/product-api/tests/m3-feedback.test.ts.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, memoryDeps, OTHER_USER, USER } from "../../../_lib/research/testing.ts";
import { reportFeedbackHandler, subscriptionFeedbackHandler } from "./feedback.ts";

function deps() {
  const d = memoryDeps();
  d.store.reports.push({
    id: "rep-1",
    jobId: "job-1",
    type: "deep_dive",
    ticker: "aapl",
    schemaVersion: "2.0.0",
    artifactKey: "k",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  d.store.reportAccess.add(`${USER}:rep-1`);
  return d;
}

Deno.test("report feedback is queued with 202", async () => {
  const d = deps();
  const res = await call(reportFeedbackHandler(d), {
    method: "POST",
    path: "/v1/feedback/report",
    body: { report_id: "rep-1", code: "stale", source_surface: "report_detail", message: "  old data  " },
  });
  assertEquals(res.status, 202);
  assertEquals(res.body.data.status, "queued_for_review");
  assertEquals(res.body.data.triage_status, "new");
  assertEquals(res.body.data.route_status, "pending");
  const row = d.store.feedback[0];
  assertEquals(row.ticker, "AAPL");
  assertEquals(row.message, "old data");
  assertEquals(row.severity, "normal");
  assertEquals(row.userTier, "FREE");
  assertEquals(row.metadata.report_type, "deep_dive");
});

Deno.test("report feedback 422s and 404s", async () => {
  const d = deps();
  const h = reportFeedbackHandler(d);
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ code: "stale", source_surface: "x" }, "report_id is required."],
    [
      { report_id: "rep-1", code: "meh", source_surface: "x" },
      "code must be one of: useful, confusing, generic, stale, bug_report.",
    ],
    [
      { report_id: "rep-1", code: "stale", source_surface: "x".repeat(101) },
      "source_surface is required and must be at most 100 characters.",
    ],
    [
      { report_id: "rep-1", code: "stale", source_surface: "x", severity: "urgent" },
      "severity must be one of: normal, high, blocker.",
    ],
    [
      { report_id: "rep-1", code: "stale", source_surface: "x", message: "m".repeat(2001) },
      "message must be at most 2000 characters.",
    ],
  ];
  for (const [body, message] of cases) {
    const res = await call(h, { method: "POST", path: "/v1/feedback/report", body });
    assertEquals(res.status, 422);
    assertEquals(res.body.error_message, message);
  }
  const unknown = await call(h, {
    method: "POST",
    path: "/v1/feedback/report",
    body: { report_id: "nope", code: "stale", source_surface: "x" },
  });
  assertEquals(unknown.status, 404);
  assertEquals(unknown.body.error, "report_not_found");
  const foreign = await call(h, {
    method: "POST",
    path: "/v1/feedback/report",
    body: { report_id: "rep-1", code: "stale", source_surface: "x" },
    userId: OTHER_USER,
  });
  assertEquals(foreign.status, 404);
});

Deno.test("subscription feedback is queued with 202 and validates its code", async () => {
  const d = deps();
  d.store.tiers.set(USER, "PRO");
  const h = subscriptionFeedbackHandler(d);
  const ok = await call(h, {
    method: "POST",
    path: "/v1/feedback/subscription",
    body: { code: "cancel_price", source_surface: "paywall", severity: "high" },
  });
  assertEquals(ok.status, 202);
  assertEquals(d.store.feedback[0].feedbackType, "subscription");
  assertEquals(d.store.feedback[0].userTier, "PRO");
  const bad = await call(h, { method: "POST", path: "/v1/feedback/subscription", body: { code: "stale" } });
  assertEquals(bad.status, 422);
});
