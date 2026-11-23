import { assertEquals } from "jsr:@std/assert@1.0.13";
import { handle } from "../../app.ts";
import type { PrecomputeStore } from "../../../_lib/evaluators/precompute.ts";
import type { ReportRecord } from "../../../_lib/jobs/types.ts";
import { setPrecomputeDeps } from "./index.ts";

const TOKEN = "precompute-test-token";

function fakeStore(opts: {
  covered: string[];
  pending?: string[];
  reusable?: string[];
  latest?: Record<string, string>;
}) {
  const created: Array<{ ticker?: string; userId?: string }> = [];
  const store: PrecomputeStore = {
    listCoveredTickers: () => Promise.resolve(opts.covered),
    listPendingPrecomputeTickers: () => Promise.resolve(opts.pending ?? []),
    jobs: {
      getCoverageLatestPeriod: (t) => Promise.resolve(t === "MSFT" ? "2026Q3" : undefined),
      findReusableDeepDiveReport: ({ ticker }) =>
        Promise.resolve((opts.reusable ?? []).includes(ticker) ? ({ id: "r" } as ReportRecord) : undefined),
      findLatestComparableDeepDiveReport: ({ ticker }) => {
        const fp = opts.latest?.[ticker];
        return Promise.resolve(fp ? ({ id: "old", fingerprint: fp } as ReportRecord) : undefined);
      },
      createJob: (input) => {
        created.push({ ticker: input.ticker, userId: input.userId });
        return Promise.resolve({ ...input, id: `job-${created.length}` } as never);
      },
    },
  };
  return { store, created };
}

async function call(body: unknown) {
  Deno.env.set("INTERNAL_API_TOKEN", TOKEN);
  const res = await handle(
    new Request("http://x/internal/deep-dive/precompute", {
      method: "POST",
      headers: { "x-internal-token": TOKEN, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

function use(store: PrecomputeStore, batchSize = 10, maxInFlight = 2) {
  setPrecomputeDeps({
    store,
    now: () => new Date("2026-11-23T11:30:00Z"),
    batchSize,
    maxInFlight,
    audit: () => Promise.resolve(),
  });
}

Deno.test("precompute creates system jobs for stale tickers, capped by in-flight", async () => {
  const { store, created } = fakeStore({
    covered: ["AAPL", "MSFT", "NVDA", "TSLA"],
    reusable: ["AAPL"],
    latest: { MSFT: "MSFT|2.0|2026Q2", NVDA: "NVDA|2.0|LATEST_UNKNOWN" },
  });
  use(store);
  const res = await call({});
  assertEquals(res.status, 200);
  assertEquals(res.body.status, "accepted");
  assertEquals(res.body.queued, 2);
  assertEquals(res.body.in_flight, 2);
  assertEquals(res.body.jobs.map((j: { ticker: string; reason: string }) => [j.ticker, j.reason]), [
    ["MSFT", "new_filing"],
    ["NVDA", "expired"],
  ]);
  assertEquals(created.every((c) => c.userId === undefined), true);
  setPrecomputeDeps(undefined);
});

Deno.test("precompute respects limit and pending jobs", async () => {
  const { store } = fakeStore({ covered: ["AAPL", "MSFT", "TSLA"], pending: ["AAPL"] });
  use(store, 10, 3);
  const res = await call({ limit: 1 });
  assertEquals(res.body.jobs.map((j: { ticker: string }) => j.ticker), ["MSFT"]);
  assertEquals(res.body.in_flight, 2);

  const full = fakeStore({ covered: ["MSFT"], pending: ["AAPL", "TSLA"] });
  use(full.store, 10, 2);
  const none = await call({});
  assertEquals([none.body.queued, none.body.in_flight], [0, 2]);
  setPrecomputeDeps(undefined);
});

Deno.test("precompute rejects a bad limit", async () => {
  use(fakeStore({ covered: [] }).store);
  const res = await call({ limit: "ten" });
  assertEquals(res.status, 422);
  setPrecomputeDeps(undefined);
});
