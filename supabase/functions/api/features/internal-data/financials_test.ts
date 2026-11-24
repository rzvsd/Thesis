// POST /internal/financials/ingest through the real router and the internal-token guard.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { MemoryFinancialsStore } from "../../../_lib/evaluators/financials_store.ts";
import { setFinancialsDeps } from "./index.ts";
import { call, NOW, post, TOKEN } from "./test_support.ts";

const ROUTE = "/internal/financials/ingest";

function setupFinancials() {
  Deno.env.set("INTERNAL_API_TOKEN", TOKEN);
  const store = new MemoryFinancialsStore();
  const audits: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  setFinancialsDeps({
    store,
    now: () => NOW,
    audit: (eventType, payload) => {
      audits.push({ eventType, payload });
      return Promise.resolve();
    },
  });
  return { store, audits };
}

function snapshot(year: number, extra: Record<string, unknown> = {}) {
  return {
    period: `${year}-FY`,
    period_type: "annual",
    fiscal_year: year,
    filing_date: `${year}-11-01`,
    data: { revenue: 391e9, gross_margin: 46.2, net_income: 93.7e9 },
    missing_fields: ["debt_total"],
    ...extra,
  };
}

function body(extra: Record<string, unknown> = {}) {
  return {
    ticker: "aapl",
    provider: "sec_companyfacts",
    latest_period: "2025-Q1",
    snapshots: [snapshot(2023), snapshot(2024)],
    ...extra,
  };
}

Deno.test("financials ingest needs the internal token", async () => {
  setupFinancials();
  assertEquals((await call("POST", ROUTE, body(), null)).status, 401);
  assertEquals((await call("POST", ROUTE, body(), "wrong")).status, 401);
});

Deno.test("financials ingest: upserts rows and coverage; a rerun keeps one row per period", async () => {
  const { store, audits } = setupFinancials();
  const first = await post(ROUTE, body());
  assertEquals(first.status, 200);
  assertEquals(first.body, {
    status: "ok",
    ticker: "AAPL",
    upserted: 2,
    snapshot_count: 2,
    latest_period: "2025-Q1",
    earliest_period: "2023-FY",
  });
  const row = store.snapshots.get("AAPL|2024-FY|annual")!;
  assertEquals(row.snapshotId, "sec-AAPL-2024-FY");
  assertEquals(row.provider, "sec_companyfacts");
  assertEquals(row.fiscalYear, 2024);
  assertEquals(row.filingDate, "2024-11-01");
  assertEquals(row.retrievedAt, NOW.toISOString());
  assertEquals(row.data.gross_margin, 46.2);
  assertEquals(row.missingFields, ["debt_total"]);
  assertEquals(audits[0]?.eventType, "financials.ingested");

  // Rerun with one more year and a new latest period: still one row per period.
  const again = await post(
    ROUTE,
    body({ latest_period: "2025-fy", snapshots: [snapshot(2024), snapshot(2025)] }),
  );
  assertEquals(again.status, 200);
  assertEquals(store.snapshots.size, 3);
  const coverage = store.coverage.get("AAPL")!;
  assertEquals(coverage.snapshotCount, 3);
  assertEquals(coverage.latestPeriod, "2025-FY");
  assertEquals(coverage.earliestPeriod, "2023-FY");
  assertEquals([coverage.lastSyncStatus, coverage.backfillTier], ["success", 1]);
});

Deno.test("financials ingest keeps transcript_count, and a null latest_period keeps the stored one", async () => {
  const { store } = setupFinancials();
  store.coverage.set("AAPL", {
    ticker: "AAPL",
    snapshotCount: 0,
    transcriptCount: 7,
    latestPeriod: "2024-FY",
    earliestPeriod: null,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
    lastSyncStatus: "partial",
    backfillTier: 3,
  });
  const res = await post(ROUTE, body({ latest_period: null }));
  assertEquals(res.status, 200);
  const coverage = store.coverage.get("AAPL")!;
  assertEquals(coverage.transcriptCount, 7);
  assertEquals(coverage.latestPeriod, "2024-FY");
  assertEquals(coverage.lastSyncStatus, "success");
});

Deno.test("financials ingest: a latest period with no annual rows (a recent IPO) still updates coverage", async () => {
  const { store } = setupFinancials();
  const res = await post(ROUTE, body({ snapshots: [], latest_period: "2026-Q2" }));
  assertEquals(res.status, 200);
  assertEquals(store.coverage.get("AAPL")?.latestPeriod, "2026-Q2");
  assertEquals(store.coverage.get("AAPL")?.snapshotCount, 0);
});

Deno.test("financials ingest: strict validation answers 422", async () => {
  setupFinancials();
  const bad: Array<[string, unknown]> = [
    ["unknown top-level field", body({ extra: 1 })],
    ["bad ticker", body({ ticker: "not a ticker" })],
    ["missing ticker", body({ ticker: undefined })],
    ["wrong provider", body({ provider: "finbase" })],
    ["bad latest period", body({ latest_period: "2025Q1" })],
    ["Q4 is not a 10-Q period", body({ latest_period: "2025-Q4" })],
    ["snapshots not an array", body({ snapshots: {} })],
    ["nothing to store", body({ snapshots: [], latest_period: null })],
    ["too many snapshots", body({ snapshots: Array.from({ length: 41 }, (_, i) => snapshot(1980 + i)) })],
    ["snapshot not an object", body({ snapshots: [1] })],
    ["unknown snapshot field", body({ snapshots: [snapshot(2024, { segments: [] })] })],
    ["quarterly period", body({ snapshots: [snapshot(2024, { period: "2024-Q1" })] })],
    ["period type", body({ snapshots: [snapshot(2024, { period_type: "quarterly" })] })],
    ["fiscal year does not match", body({ snapshots: [snapshot(2024, { fiscal_year: 2023 })] })],
    ["duplicate period", body({ snapshots: [snapshot(2024), snapshot(2024)] })],
    ["bad filing date", body({ snapshots: [snapshot(2024, { filing_date: "2024-02-30" })] })],
    ["unknown data key", body({ snapshots: [snapshot(2024, { data: { ebitda: 1 } })] })],
    ["non-number value", body({ snapshots: [snapshot(2024, { data: { revenue: "1" } })] })],
    [
      "infinite value",
      body({ snapshots: [snapshot(2024, { data: { revenue: Number.POSITIVE_INFINITY } })] }),
    ],
    ["missing_fields not an array", body({ snapshots: [snapshot(2024, { missing_fields: "x" })] })],
    ["missing field that data has", body({ snapshots: [snapshot(2024, { missing_fields: ["revenue"] })] })],
  ];
  for (const [label, payload] of bad) {
    const res = await post(ROUTE, payload);
    assertEquals(res.status, 422, label);
    assertEquals(res.body.error, "validation_failed", label);
  }
  // 40 is allowed.
  const forty = await post(
    ROUTE,
    body({ snapshots: Array.from({ length: 40 }, (_, i) => snapshot(1980 + i)) }),
  );
  assertEquals(forty.status, 200);
  assertEquals(forty.body.snapshot_count, 40);
});
