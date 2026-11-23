import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, memoryDeps, USER } from "../../../_lib/research/testing.ts";
import type { ConvictionJournalEntryRecord } from "../../../_lib/research/types.ts";
import { convictionInsightsHandler, convictionTimelineHandler } from "./conviction.ts";

function entry(id: string, ticker: string, eventAt: string): ConvictionJournalEntryRecord {
  return {
    id,
    userId: USER,
    ticker,
    eventType: "deep_dive_generated",
    sourceType: "report",
    sourceId: id,
    eventAt,
    title: `${ticker} thesis recorded`,
    summary: "s",
    thesisSnapshot: { ticker, signal_reasons: ["a"] },
    evidenceRefs: [{ kind: "report", ref_id: "r1" }],
    createdAt: eventAt,
    updatedAt: eventAt,
  };
}

Deno.test("conviction timeline: free tier is 403 conviction_intelligence", async () => {
  const deps = memoryDeps();
  const res = await call(convictionTimelineHandler(deps), { path: "/v1/conviction/timeline" });
  assertEquals(res.status, 403);
  assertEquals(res.body, {
    error: "upgrade_required",
    feature: "conviction_intelligence",
    error_message: "Conviction timeline is available on the Pro tier.",
  });
});

Deno.test("conviction timeline: Pro gets entries newest first, filtered by ticker", async () => {
  const deps = memoryDeps();
  deps.store.tiers.set(USER, "PRO");
  deps.store.journal.push(entry("j1", "AAPL", "2026-11-01T00:00:00.000Z"));
  deps.store.journal.push(entry("j2", "AAPL", "2026-11-02T00:00:00.000Z"));
  deps.store.journal.push(entry("j3", "MSFT", "2026-11-03T00:00:00.000Z"));
  const h = convictionTimelineHandler(deps);
  const all = await call(h, { path: "/v1/conviction/timeline" });
  assertEquals(all.status, 200);
  assertEquals(all.body.data.map((e: { journal_entry_id: string }) => e.journal_entry_id), [
    "j3",
    "j2",
    "j1",
  ]);
  const aapl = await call(h, { path: "/v1/conviction/timeline?ticker=aapl&limit=1" });
  assertEquals(aapl.body.data.length, 1);
  assertEquals(aapl.body.data[0].journal_entry_id, "j2");
  assertEquals(aapl.body.data[0].thesis_snapshot.signal_reasons, ["a"]);
  assertEquals(deps.store.audit.at(-1)?.eventType, "conviction.timeline_listed");
});

Deno.test("conviction timeline: bad limit and ticker are 422", async () => {
  const deps = memoryDeps();
  deps.store.tiers.set(USER, "PRO");
  const h = convictionTimelineHandler(deps);
  assertEquals((await call(h, { path: "/v1/conviction/timeline?limit=101" })).status, 422);
  const bad = await call(h, { path: "/v1/conviction/timeline?ticker=$$$" });
  assertEquals(bad.status, 422);
  assertEquals(bad.body.error_message, "ticker must be a valid US symbol.");
});

Deno.test("conviction insights: 403 for free, list for Pro, 422 for bad limit", async () => {
  const deps = memoryDeps();
  const h = convictionInsightsHandler(deps);
  assertEquals((await call(h, { path: "/v1/conviction/insights" })).body.feature, "conviction_intelligence");
  deps.store.tiers.set(USER, "PRO");
  deps.store.insights.push({
    id: "i1",
    userId: USER,
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    insightType: "monthly_coherence",
    status: "generated",
    title: "t",
    summary: "s",
    findings: [],
    sourceJournalEntryIds: ["j1"],
    generatedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  });
  const ok = await call(h, { path: "/v1/conviction/insights" });
  assertEquals(ok.status, 200);
  assertEquals(ok.body.data[0].insight_id, "i1");
  assertEquals(ok.body.data[0].period_start, "2026-10-01");
  assertEquals((await call(h, { path: "/v1/conviction/insights?limit=51" })).status, 422);
});
