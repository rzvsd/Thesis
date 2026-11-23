// Pulse routes. Ports the route parts of apps/product-api/tests/market-pulse.test.ts: private cache headers, the
// research-state personalisation of the deterministic fallback, 404 for a missing day, /pulse/latest, 422 dates.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { memoryArtifactReader } from "../../../_lib/reports/artifacts.ts";
import type { ReportRecord } from "../../../_lib/reports/types.ts";
import type { UserResearchStateRecord } from "../../../_lib/store/pulse.ts";
import { ctx, jsonRequest } from "../../../_lib/store/testing.ts";
import { type PulseDeps, pulseHandlers } from "./handlers.ts";
import { pulseRoutes } from "./index.ts";

const USER = "user-pulse";

function section(id: string, title: string) {
  return { section_id: id, title, body: `${title} body.`, status: "complete", evidence: [] };
}

function pulseReport(reportId: string, day: string) {
  return {
    report_id: reportId,
    schema_version: "1.0",
    generated_at: `${day}T12:00:00.000Z`,
    cycle_start: `${day}T00:00:00.000Z`,
    cycle_end: `${day}T11:00:00.000Z`,
    macro_stress: { state: "calm", omissions: [] },
    morning_edition: { market_board: [], today_catalysts: [], portfolio_radar: [] },
    sections: {
      market_moves: section("market_moves", "Market Moves"),
      market_tape: section("market_tape", "Market Tape"),
      macro_releases: section("macro_releases", "Macro Releases"),
      rates_fx_commodities: section("rates_fx_commodities", "Rates FX Commodities"),
      news_summary: section("news_summary", "News Summary"),
      uncertainty_flags: section("uncertainty_flags", "Uncertainty Flags"),
    },
    flags: [],
    confidence: { score: 0.8, label: "high", limiting_factors: [] },
  };
}

function researchState(asOf: string) {
  return {
    user_id: USER,
    as_of: asOf,
    generated_at: `${asOf}T06:00:00.000Z`,
    holdings: [{ ticker: "AAPL", shares: 10 }],
    names: [{
      ticker: "AAPL",
      company_name: "Apple Inc.",
      summary: "AAPL summary line.",
      what_changed: "AAPL margins moved.",
      why_it_matters: "AAPL matters because of services.",
      what_to_watch: "AAPL earnings next week.",
    }],
    omissions: [],
  };
}

function record(id: string, day: string): ReportRecord {
  return {
    id,
    jobId: `job-${id}`,
    type: "market_pulse",
    schemaVersion: "1.0",
    artifactKey: `market_pulse/${day}/${id}.json`,
    createdAt: `${day}T12:00:01.000Z`,
    isCurrent: true,
  };
}

interface State {
  records: ReportRecord[];
  artifacts: Record<string, unknown>;
  states: UserResearchStateRecord[];
  audits: string[];
  stateQueries: Array<string | undefined>;
}

function fakeDeps(s: State): PulseDeps {
  return {
    getLatestReportByType: (type) =>
      Promise.resolve(
        s.records.filter((r) => r.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
      ),
    getReportByTypeAndDate: (type, date) =>
      Promise.resolve(s.records.find((r) => r.type === type && r.createdAt.slice(0, 10) === date)),
    getLatestUserResearchState: ({ userId, asOf }) => {
      s.stateQueries.push(asOf);
      return Promise.resolve(
        s.states.filter((x) => x.userId === userId && (!asOf || x.asOf <= asOf))
          .sort((a, b) => b.asOf.localeCompare(a.asOf))[0],
      );
    },
    readArtifact: memoryArtifactReader(s.artifacts),
    audit: (eventType) => {
      s.audits.push(eventType);
      return Promise.resolve();
    },
    rateLimit: () => Promise.resolve(null),
  };
}

function seeded(): State {
  const s: State = { records: [], artifacts: {}, states: [], audits: [], stateQueries: [] };
  for (const [id, day] of [["pulse-21", "2026-03-21"], ["pulse-22", "2026-03-22"]]) {
    const r = record(id, day);
    s.records.push(r);
    s.artifacts[r.artifactKey] = pulseReport(id, day);
  }
  return s;
}

function get(path: string, params: Record<string, string> = {}) {
  return ctx(jsonRequest("GET", path, undefined, { authorization: "Bearer t" }), { userId: USER, params });
}

// D4: no worker or LLM call per request. Any fetch fails the test.
function noFetch(fn: () => Promise<void>) {
  return async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("Pulse must not call the network"));
    try {
      await fn();
    } finally {
      globalThis.fetch = original;
    }
  };
}

Deno.test(
  "GET /pulse/:date serves the stored issue with private headers when there is no research state",
  noFetch(async () => {
    const s = seeded();
    const h = pulseHandlers(fakeDeps(s));
    const res = await h.byDate(get("/pulse/2026-03-21", { date: "2026-03-21" }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("cache-control"), "private, no-store");
    assertEquals(res.headers.get("vary"), "Authorization");
    const body = await res.json();
    assertEquals(body, pulseReport("pulse-21", "2026-03-21"));
    assertEquals(body.user_research_state, undefined);
    assertEquals(body.sections.watchlist_overlay, undefined);
    assertEquals(s.stateQueries, ["2026-03-21"]);
    assertEquals(s.audits, ["pulse.report_retrieved"]);
  }),
);

Deno.test(
  "GET /pulse/:date adds the deterministic brief from the user's research state",
  noFetch(async () => {
    const s = seeded();
    s.states.push({
      stateId: "state-1",
      userId: USER,
      asOf: "2026-03-21",
      generatedAt: "2026-03-21T06:00:00.000Z",
      state: researchState("2026-03-21"),
    });
    const h = pulseHandlers(fakeDeps(s));
    const res = await h.byDate(get("/pulse/2026-03-21", { date: "2026-03-21" }));
    assertEquals(res.status, 200);
    const report = await res.json();
    assert(report.user_research_state);
    assertEquals(report.user_research_state.holdings[0].ticker, "AAPL");
    assertMatch(report.sections.portfolio_radar.body, /AAPL: AAPL summary line\./);
    assertMatch(report.sections.what_changed.body, /AAPL margins moved/);
    assertMatch(report.sections.why_it_matters.body, /services/);
    assertMatch(report.sections.what_to_watch.body, /AAPL/);
    assertEquals(report.sections.portfolio_radar.status, "complete");
    assertEquals(report.sections.portfolio_radar.evidence[0].source_name, "User Research State");
    assertEquals(report.morning_edition.portfolio_radar[0].ticker, "AAPL");
    assertEquals(report.morning_edition.portfolio_radar[0].direction, "flat");
    // The six base sections stay.
    assertEquals(report.sections.market_moves.title, "Market Moves");
  }),
);

Deno.test(
  "GET /pulse/:date is 422 for a bad date and 404 for a missing or invalid day",
  noFetch(async () => {
    const s = seeded();
    const h = pulseHandlers(fakeDeps(s));
    for (const bad of ["2026-02-30", "2026-3-21", "latest-ish", "20260321"]) {
      const res = await h.byDate(get(`/pulse/${bad}`, { date: bad }));
      assertEquals(res.status, 422);
      assertEquals(await res.json(), {
        error: "validation_failed",
        error_message: "date must be in YYYY-MM-DD format.",
      });
    }
    const missing = await h.byDate(get("/pulse/2026-03-23", { date: "2026-03-23" }));
    assertEquals(missing.status, 404);
    assertEquals(await missing.json(), {
      error: "report_not_found",
      error_message: "Market Pulse report not found for the requested date.",
    });
    // A stored body without the six required sections is treated as missing.
    s.artifacts["market_pulse/2026-03-21/pulse-21.json"] = {
      report_id: "pulse-21",
      generated_at: "x",
      sections: {},
    };
    assertEquals((await h.byDate(get("/pulse/2026-03-21", { date: "2026-03-21" }))).status, 404);
  }),
);

Deno.test(
  "GET /pulse/latest serves the newest issue and reads research state as of its cycle_end",
  noFetch(async () => {
    const s = seeded();
    const h = pulseHandlers(fakeDeps(s));
    const res = await h.latest(get("/pulse/latest"));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("cache-control"), "private, no-store");
    assertEquals(res.headers.get("vary"), "Authorization");
    const latestPayload = await res.json();
    assertEquals(latestPayload.cycle_end.slice(0, 10), "2026-03-22");
    assertEquals(s.stateQueries, ["2026-03-22"]);

    const empty = pulseHandlers(
      fakeDeps({ records: [], artifacts: {}, states: [], audits: [], stateQueries: [] }),
    );
    const none = await empty.latest(get("/pulse/latest"));
    assertEquals(none.status, 404);
    assertEquals(await none.json(), {
      error: "report_not_found",
      error_message: "No Market Pulse report is available yet.",
    });
  }),
);

Deno.test("pulse routes: user auth, latest before :date, rate limit first", async () => {
  const routes = pulseRoutes({
    ...fakeDeps(seeded()),
    rateLimit: () => Promise.resolve(new Response("{}", { status: 429 })),
  });
  assertEquals(routes.map((r) => `${r.method} ${r.path} ${r.auth}`), [
    "GET /pulse/latest user",
    "GET /pulse/:date user",
  ]);
  for (const r of routes) assertEquals((await r.handler(get("/pulse/latest", { date: "x" }))).status, 429);
});
