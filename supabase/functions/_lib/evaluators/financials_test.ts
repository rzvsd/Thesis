import { assertEquals } from "jsr:@std/assert@1.0.13";
import { ingestFinancials } from "./financials.ts";
import { MemoryFinancialsStore } from "./financials_store.ts";

const meta = { requestId: "req-1", route: "/internal/financials/ingest" };

function deps(audit: () => Promise<void> = () => Promise.resolve()) {
  const store = new MemoryFinancialsStore();
  return { store, deps: { store, now: () => new Date("2026-11-20T15:00:00.000Z"), audit } };
}

Deno.test("ingestFinancials: normalises ticker and periods, dedupes missing_fields", async () => {
  const { store, deps: d } = deps();
  const res = await ingestFinancials(d, {
    ticker: " brk.b ",
    provider: "sec_companyfacts",
    latest_period: "2025-q3",
    snapshots: [{
      period: "2024-fy",
      period_type: "annual",
      fiscal_year: 2024,
      data: { revenue: 371e9 },
      missing_fields: ["debt_total", "debt_total"],
    }],
  }, meta);
  assertEquals(res.status, 200);
  const row = store.snapshots.get("BRK.B|2024-FY|annual")!;
  assertEquals(row.snapshotId, "sec-BRK.B-2024-FY");
  assertEquals(row.filingDate, undefined);
  assertEquals(row.missingFields, ["debt_total"]);
  assertEquals(store.coverage.get("BRK.B")?.latestPeriod, "2025-Q3");
});

Deno.test("ingestFinancials: an audit failure does not fail the ingest", async () => {
  const { deps: d } = deps(() => Promise.reject(new Error("db down")));
  const res = await ingestFinancials(d, {
    ticker: "AAPL",
    provider: "sec_companyfacts",
    latest_period: "2025-FY",
    snapshots: [],
  }, meta);
  assertEquals(res.status, 200);
});
