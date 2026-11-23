// Shared setup for the internal-data tests: a memory store, a fixed clock and an HTTP helper that goes
// through the real router and the internal-token guard.
import { handle } from "../../app.ts";
import { type EvaluatorDeps, makeDeps } from "../../../_lib/evaluators/deps.ts";
import type { PushResult, PushSender } from "../../../_lib/evaluators/push_port.ts";
import { MemoryEvaluatorStore } from "../../../_lib/evaluators/store_memory.ts";
import type {
  CalendarEventRecord,
  KillSwitchRuleRecord,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
} from "../../../_lib/evaluators/types.ts";
import { setInternalDataDeps } from "./index.ts";

export const TOKEN = "test-internal-token";
// Friday 2026-11-20, a US trading day.
export const NOW = new Date("2026-11-20T15:00:00.000Z");

export function setup(overrides: Partial<EvaluatorDeps> = {}, now: Date = NOW) {
  Deno.env.set("INTERNAL_API_TOKEN", TOKEN);
  const store = new MemoryEvaluatorStore();
  const deps = makeDeps(store, { now: () => now, ...overrides });
  setInternalDataDeps(deps);
  return { store, deps };
}

export async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  token: string | null = TOKEN,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers["x-internal-token"] = token;
  const res = await handle(
    new Request(`http://x/functions/v1/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    () => Promise.resolve(null),
  );
  return { status: res.status, body: await res.json() };
}

export const post = (path: string, body?: unknown) => call("POST", path, body ?? {});
export const get = (path: string) => call("GET", path);

// A push sender that records what it was asked to send and delivers everything.
export function recordingPush(): PushSender & { sent: Array<{ userId: string; title: string }> } {
  const sent: Array<{ userId: string; title: string }> = [];
  return {
    mode: "test",
    sent,
    send(targets, payload): Promise<PushResult> {
      for (const t of targets) sent.push({ userId: t.userId, title: payload.title });
      return Promise.resolve({
        attempted: targets.length,
        delivered: targets.length,
        failed: 0,
        skipped: 0,
        invalidTargets: [],
      });
    },
  };
}

export function addUser(
  store: MemoryEvaluatorStore,
  id: string,
  opts: { tier?: SubscriptionTier; device?: boolean; tickers?: string[] } = {},
): void {
  store.users.push({ id, email: `${id}@example.test`, verified: true, tier: opts.tier ?? "FREE" });
  if (opts.device) {
    store.devices.push({ userId: id, installationId: `inst-${id}`, deviceToken: `tok-${id}` });
  }
  for (const t of opts.tickers ?? []) store.watchlists.push({ userId: id, ticker: t });
}

export function earnings(id: string, ticker: string, date: string): CalendarEventRecord {
  return {
    id,
    ticker,
    eventType: "earnings",
    eventDate: date,
    provider: "calendar_feed",
    retrievedAt: "2026-11-19T00:00:00.000Z",
    timingState: "estimated",
    sourceState: "derived",
    sourceRef: {},
    reasonText: "Estimated.",
  };
}

export function rule(id: string, userId: string, ticker: string, extra: Partial<KillSwitchRuleRecord> = {}) {
  const r: KillSwitchRuleRecord = {
    id,
    userId,
    ticker,
    signalValue: "positive",
    anchorPrice: 100,
    conditionId: `c-${id}`,
    conditionText: "Price falls 5% below the anchor.",
    signalType: "price_move_pct",
    rationale: "Test rule.",
    thresholdValue: 5,
    direction: "against_signal",
    state: "active",
    createdAt: "2026-11-01T00:00:00.000Z",
    ...extra,
  };
  return r;
}

export function snapshot(
  userId: string,
  ticker: string,
  extra: Partial<ThesisMonitorSnapshotRecord> = {},
): ThesisMonitorSnapshotRecord {
  return {
    userId,
    ticker,
    state: "intact",
    reason: "Thesis holds.",
    score: 0.6,
    materialEventsCount: 0,
    unreviewedEventsCount: 0,
    freshnessState: "current",
    freshnessScore: 0.9,
    freshnessReason: "Fresh.",
    updatedAt: "2026-11-19T00:00:00.000Z",
    ...extra,
  };
}

export function price(ticker: string, close: number, marketDate = "2026-11-19") {
  return { ticker, marketDate, close, provider: "eod", retrievedAt: "2026-11-19T22:00:00.000Z" };
}
