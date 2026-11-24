import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import type { Sql } from "../../_shared/db.ts";
import type { FinancialSnapshotRow } from "./financials.ts";
import { MemoryFinancialsStore, postgresFinancialsStore } from "./financials_store.ts";

const NOW = "2026-11-20T15:00:00.000Z";

function row(period: string, extra: Partial<FinancialSnapshotRow> = {}): FinancialSnapshotRow {
  return {
    snapshotId: `sec-AAPL-${period}`,
    ticker: "AAPL",
    period,
    periodType: "annual",
    fiscalYear: Number(period.slice(0, 4)),
    provider: "sec_companyfacts",
    retrievedAt: NOW,
    data: { revenue: 1 },
    missingFields: [],
    ...extra,
  };
}

Deno.test("memory store: an existing row keeps its id; other tickers are not counted", async () => {
  const store = new MemoryFinancialsStore();
  store.snapshots.set(
    "AAPL|2024-FY|annual",
    row("2024-FY", { snapshotId: "finbase-1", provider: "finbase" }),
  );
  store.snapshots.set("MSFT|2020-FY|annual", row("2020-FY", { ticker: "MSFT", snapshotId: "m" }));
  const result = await store.ingestFinancials({
    ticker: "AAPL",
    rows: [row("2024-FY"), row("2023-FY")],
    latestPeriod: "2025-Q1",
    nowIso: NOW,
  });
  assertEquals(result, { upserted: 2, snapshotCount: 2, latestPeriod: "2025-Q1", earliestPeriod: "2023-FY" });
  const replaced = store.snapshots.get("AAPL|2024-FY|annual")!;
  assertEquals([replaced.snapshotId, replaced.provider], ["finbase-1", "sec_companyfacts"]);
});

// A fake postgres.js client: begin() runs the callback with a tx whose unsafe() records each query.
function fakeSql(answers: unknown[][]) {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const tx = {
    unsafe(text: string, params: unknown[] = []) {
      queries.push({ text, params });
      return Promise.resolve(answers.shift() ?? []);
    },
  };
  const sql = { begin: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as Sql;
  return { sql, queries };
}

Deno.test("postgres store: one transaction, rows as jsonb, coverage from the stored rows", async () => {
  const { sql, queries } = fakeSql([
    [{ snapshot_id: "sec-AAPL-2024-FY" }],
    [{ snapshot_count: 5, earliest_period: "2020-FY" }],
    [{ snapshot_count: 5, latest_period: "2025-Q1", earliest_period: "2020-FY" }],
  ]);
  const result = await postgresFinancialsStore(sql).ingestFinancials({
    ticker: "AAPL",
    rows: [row("2024-FY", { filingDate: "2024-11-01" })],
    latestPeriod: "2025-Q1",
    nowIso: NOW,
  });
  assertEquals(result, { upserted: 1, snapshotCount: 5, latestPeriod: "2025-Q1", earliestPeriod: "2020-FY" });
  assertEquals(queries.length, 3);
  assertStringIncludes(queries[0]!.text, "on conflict (ticker, period, period_type) do update");
  const sent = JSON.parse(String(queries[0]!.params[0]));
  assertEquals(sent[0].snapshot_id, "sec-AAPL-2024-FY");
  assertEquals(sent[0].filing_date, "2024-11-01");
  assertEquals(sent[0].data, { revenue: 1 });
  assertEquals(queries[1]!.params, ["AAPL"]);
  assertStringIncludes(queries[2]!.text, "coalesce(excluded.latest_period, ticker_coverage.latest_period)");
  assertEquals(queries[2]!.params, ["AAPL", 5, "2025-Q1", "2020-FY", NOW]);
});

Deno.test("postgres store: no rows skips the snapshot insert", async () => {
  const { sql, queries } = fakeSql([
    [{ snapshot_count: 0, earliest_period: null }],
    [{ snapshot_count: 0, latest_period: "2026-Q2", earliest_period: null }],
  ]);
  const result = await postgresFinancialsStore(sql).ingestFinancials({
    ticker: "NEWCO",
    rows: [],
    latestPeriod: "2026-Q2",
    nowIso: NOW,
  });
  assertEquals(result, { upserted: 0, snapshotCount: 0, latestPeriod: "2026-Q2", earliestPeriod: null });
  assertEquals(queries.length, 2);
});
