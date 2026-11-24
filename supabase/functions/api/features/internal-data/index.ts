// Feature "internal-data". Owner: M3 (docs/rebuild/OWNERSHIP.md, docs/rebuild/M3-design.md).
// Internal routes the daily and weekly jobs call: data ingest, macro, calendar, prices and the evaluators.
// All routes need the internal token. The logic lives in _lib/evaluators; this file only parses the request
// and turns an EvalResult into a Response.
import { db, type Sql } from "../../../_shared/db.ts";
import { env } from "../../../_shared/env.ts";
import { apiError, json } from "../../../_shared/http.ts";
import { evaluateCoherence } from "../../../_lib/evaluators/coherence.ts";
import { evaluateContrarian } from "../../../_lib/evaluators/contrarian.ts";
import { evaluateCrossName } from "../../../_lib/evaluators/cross_name.ts";
import { type EvaluatorDeps, makeDeps } from "../../../_lib/evaluators/deps.ts";
import { storageReportReader } from "../../../_lib/evaluators/report_port.ts";
import { jobsDeepDiveQueue } from "../../../_lib/evaluators/deep_dive_queue.ts";
import { jobsDeps } from "../../../_lib/jobs/wiring.ts";
import { dispatchWeeklyDigest } from "../../../_lib/evaluators/digest.ts";
import { dispatchEarningsPreview } from "../../../_lib/evaluators/earnings_preview.ts";
import { listFeedbackQueue } from "../../../_lib/evaluators/feedback.ts";
import { dispatchFreshnessDecay } from "../../../_lib/evaluators/freshness.ts";
import {
  ingestCanonicalEvents,
  ingestFirstPartyContext,
  ingestNameRelationships,
  listCanonicalEvents,
  listFirstPartyContext,
} from "../../../_lib/evaluators/ingest.ts";
import { evaluateKillSwitch } from "../../../_lib/evaluators/kill_switch.ts";
import { dispatchMacroStress, syncCalendar } from "../../../_lib/evaluators/macro.ts";
import {
  defaultPulseSchemaVersion,
  dispatchMarketPulse,
  parseTickerList,
  type PulseDeps,
} from "../../../_lib/evaluators/pulse/dispatch.ts";
import { PostgresPulseJobStore, storageArtifacts } from "../../../_lib/evaluators/pulse/store.ts";
import { recomputeMonitor } from "../../../_lib/evaluators/monitor.ts";
import { ingestNews, listNews, listNewsSources } from "../../../_lib/evaluators/news.ts";
import {
  postgresPrecomputeStore,
  type PrecomputeDeps,
  precomputeLimitsFromEnv,
  runDeepDivePrecompute,
} from "../../../_lib/evaluators/precompute.ts";
import { postgresJobsStore } from "../../../_lib/jobs/store.ts";
import { appendAuditEvent } from "../../../_lib/store/reports.ts";
import { ingestPrices, listPriceTickers } from "../../../_lib/evaluators/prices.ts";
import { refreshResearchState } from "../../../_lib/evaluators/research_state.ts";
import type { EvalMeta, EvalResult } from "../../../_lib/evaluators/result.ts";
import { PostgresEvaluatorStore } from "../../../_lib/evaluators/store_pg.ts";
import { dispatchEarningsWarRoom } from "../../../_lib/evaluators/war_room.ts";
import type { FeatureModule, Route, RouteContext } from "../../router.ts";

// Built on first use so importing this module never opens a database connection.
let current: EvaluatorDeps | undefined;

function deps(): EvaluatorDeps {
  current ??= makeDeps(new PostgresEvaluatorStore(db), {
    reports: storageReportReader,
    deepDiveQueue: jobsDeepDiveQueue(jobsDeps),
  });
  return current;
}

// Tests swap in a memory store and a fixed clock. Pass undefined to go back to Postgres.
export function setInternalDataDeps(next: EvaluatorDeps | undefined): void {
  current = next;
}

// Pulse build: jobs and reports rows plus Storage for the issue body. Built on first use too.
let currentPulse: PulseDeps | undefined;

function pulseDeps(): PulseDeps {
  currentPulse ??= {
    evaluator: deps(),
    jobs: new PostgresPulseJobStore(db),
    artifacts: storageArtifacts,
    tickers: parseTickerList(env("MARKET_PULSE_TICKERS")),
    schemaVersion: env("MARKET_PULSE_SCHEMA_VERSION")?.trim() || defaultPulseSchemaVersion,
  };
  return currentPulse;
}

let currentPrecompute: PrecomputeDeps | undefined;
// The client the real deps were built with. resetDb() (request deadline) swaps the client, so the deps are
// rebuilt when db() hands out a new one. Unset for test deps.
let precomputeBuiltFor: Sql | undefined;

function precomputeDeps(): PrecomputeDeps {
  if (currentPrecompute && (!precomputeBuiltFor || precomputeBuiltFor === db())) return currentPrecompute;
  const sql = db();
  precomputeBuiltFor = sql;
  currentPrecompute = {
    store: postgresPrecomputeStore(sql, postgresJobsStore(sql)),
    now: () => new Date(),
    ...precomputeLimitsFromEnv(),
    audit: (eventType, payload) => appendAuditEvent(eventType, payload),
  };
  return currentPrecompute;
}

// Tests swap in a fake store. Pass undefined to go back to the real one.
export function setPrecomputeDeps(next: PrecomputeDeps | undefined): void {
  currentPrecompute = next;
  precomputeBuiltFor = undefined;
}

// Tests swap in memory stores. Pass undefined to go back to the real ones.
export function setPulseDeps(next: PulseDeps | undefined): void {
  currentPulse = next;
}

type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; res: Response };

// An empty body is {}. Bad JSON is 400; JSON that is not an object is 422.
async function readBody(req: Request): Promise<BodyResult> {
  const text = await req.text();
  if (!text.trim()) return { ok: true, body: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, res: apiError(400, "invalid_json", "Request body must be valid JSON.") };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, res: apiError(422, "validation_failed", "Request body must be a JSON object.") };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

function respond(result: EvalResult): Response {
  return json(result.body, result.status);
}

function meta(ctx: RouteContext): EvalMeta {
  return { requestId: ctx.req.headers.get("x-request-id") ?? crypto.randomUUID(), route: ctx.path };
}

type PostHandler = (d: EvaluatorDeps, body: Record<string, unknown>, m: EvalMeta) => Promise<EvalResult>;
type GetHandler = (d: EvaluatorDeps, query: URLSearchParams) => Promise<EvalResult>;

function post(path: string, run: PostHandler): Route {
  return {
    method: "POST",
    path,
    auth: "internal",
    handler: async (ctx) => {
      const parsed = await readBody(ctx.req);
      if (!parsed.ok) return parsed.res;
      return respond(await run(deps(), parsed.body, meta(ctx)));
    },
  };
}

function get(path: string, run: GetHandler): Route {
  return {
    method: "GET",
    path,
    auth: "internal",
    handler: async (ctx) => respond(await run(deps(), ctx.url.searchParams)),
  };
}

export const feature: FeatureModule = {
  name: "internal-data",
  owner: "M3",
  routes: [
    // Ingest and reads.
    post("/internal/canonical-events/ingest", (d, b) => ingestCanonicalEvents(d, b)),
    get("/internal/canonical-events", listCanonicalEvents),
    post("/internal/first-party/context/ingest", (d, b) => ingestFirstPartyContext(d, b)),
    get("/internal/first-party/context", listFirstPartyContext),
    post("/internal/name-relationships/ingest", ingestNameRelationships),
    // Market data sent by the job scripts.
    post("/internal/macro-stress/dispatch", dispatchMacroStress),
    post("/internal/sentiment/dispatch", dispatchMacroStress),
    post("/internal/calendar/sync", syncCalendar),
    get("/internal/data/price-tickers", (d) => listPriceTickers(d)),
    post("/internal/data/prices/ingest", ingestPrices),
    // Headlines the news job read; the Pulse job reads its window back (audit NG8).
    post("/internal/news/ingest", ingestNews),
    get("/internal/news", listNews),
    get("/internal/news/sources", (d) => listNewsSources(d)),
    // Evaluators.
    post("/internal/notifications/earnings-war-room", dispatchEarningsWarRoom),
    post("/internal/notifications/earnings-preview", dispatchEarningsPreview),
    post("/internal/notifications/cross-name/evaluate", evaluateCrossName),
    post("/internal/notifications/kill-switch/evaluate", evaluateKillSwitch),
    post("/internal/notifications/freshness-decay", dispatchFreshnessDecay),
    post("/internal/notifications/contrarian/evaluate", evaluateContrarian),
    post("/internal/notifications/weekly-digest", dispatchWeeklyDigest),
    post("/internal/conviction/coherence/evaluate", evaluateCoherence),
    post("/internal/monitor/recompute", recomputeMonitor),
    post("/internal/research-state/refresh", refreshResearchState),
    get("/internal/feedback/queue", listFeedbackQueue),
    // Pulse issue build. The daily job sends the fetched inputs; the response comes after the build.
    {
      method: "POST",
      path: "/internal/pulse/dispatch",
      auth: "internal",
      handler: async (ctx) => {
        const parsed = await readBody(ctx.req);
        if (!parsed.ok) return parsed.res;
        return respond(await dispatchMarketPulse(pulseDeps(), parsed.body, meta(ctx)));
      },
    },
    // Creates system Deep Dive jobs; the daily workflow runs them in process (N7). No runner per ticker.
    {
      method: "POST",
      path: "/internal/deep-dive/precompute",
      auth: "internal",
      handler: async (ctx) => {
        const parsed = await readBody(ctx.req);
        if (!parsed.ok) return parsed.res;
        return respond(await runDeepDivePrecompute(precomputeDeps(), parsed.body, meta(ctx)));
      },
    },
  ],
};
