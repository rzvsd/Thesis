// Macro Stress dispatch and calendar sync. The old server fetched data-openbb here; now the daily job
// sends that payload in the body (docs/rebuild/M3-design.md). Both are upserts keyed by date, safe to retry.
import { logError, logInfo } from "../../_shared/log.ts";
import {
  buildMacroStressSnapshot,
  legacySnapshotToMacroStress,
  macroStressToLegacySnapshot,
} from "../research/macro_stress.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { normalizeEarningsSourceState, normalizeEarningsTimingState } from "./earnings_state.ts";
import { type EvalMeta, type EvalResult, fail, ok, validation } from "./result.ts";
import type { CalendarEventRecord, CalendarEventTime } from "./types.ts";
import {
  addDaysToIsoDate,
  createId,
  dateInTimeZone,
  isPlainRecord,
  isUsTradingDay,
  normalizeDateInput,
} from "./util.ts";

type Observation = Parameters<typeof buildMacroStressSnapshot>[0]["observations"][number];

// body: { market_date?, macro }. macro is the body of the old GET /v1/official/macro?scope=daily.
export async function dispatchMacroStress(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const fallback = dateInTimeZone(deps.now(), "America/New_York");
  const marketDate = body.market_date === undefined ? fallback : normalizeDateInput(body.market_date);
  if (!marketDate) return validation("market_date must be in YYYY-MM-DD format.");
  if (body.macro !== undefined && !isPlainRecord(body.macro)) return validation("macro must be an object.");

  if (!isUsTradingDay(marketDate)) {
    await appendAudit(deps.store, "macro_stress.skipped_non_trading_day", {
      request_id: meta.requestId,
      route: meta.route,
      market_date: marketDate,
    });
    logInfo("Macro Stress dispatch skipped on non-trading day", { market_date: marketDate });
    return ok({ status: "skipped", market_date: marketDate, reason: "non_trading_day" });
  }
  if (!isPlainRecord(body.macro)) return validation("macro is required: the official daily macro payload.");

  const macro = body.macro as {
    ok?: unknown;
    data?: { observations?: unknown } | null;
    error_flag?: unknown;
    error_message?: unknown;
  };
  try {
    const success = macro.ok === true && macro.error_flag !== true && macro.data !== undefined &&
      macro.data !== null;
    if (!success) {
      const msg = typeof macro.error_message === "string" ? macro.error_message.trim() : "";
      throw new Error(msg || "Official macro payload returned no data.");
    }
    const observations = Array.isArray(macro.data?.observations) ? macro.data.observations : [];
    const omissions = observations.length === 0
      ? [{
        registry_id: "OFFICIAL_MACRO",
        reason_code: "missing_input",
        reason_text: "Official macro payload returned no observations.",
      }]
      : [];
    const snapshot = buildMacroStressSnapshot({
      asOf: marketDate,
      generatedAt: deps.now().toISOString(),
      observations: observations as Observation[],
      omissions,
    });
    const persisted = await deps.store.upsertFearGreedSnapshot(macroStressToLegacySnapshot(snapshot));
    const stored = legacySnapshotToMacroStress(persisted.snapshot);
    await appendAudit(deps.store, "macro_stress.snapshot_upserted", {
      request_id: meta.requestId,
      route: meta.route,
      market_date: marketDate,
      state: stored.state,
      summary: stored.summary,
      created: persisted.created,
      omissions_count: stored.omissions.length,
    });
    return ok({
      status: persisted.created ? "created" : "updated",
      market_date: marketDate,
      state: stored.state,
      summary: stored.summary,
      no_material_change: stored.no_material_change,
      omissions: stored.omissions,
      score: persisted.snapshot.score,
      label: persisted.snapshot.label,
      missing_inputs: persisted.snapshot.missing_inputs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Macro Stress dispatch failed";
    await appendAudit(deps.store, "macro_stress.dispatch_failed", {
      request_id: meta.requestId,
      route: meta.route,
      market_date: marketDate,
      error_message: message,
    });
    logError("Macro Stress dispatch failed", { market_date: marketDate });
    return fail(503, "macro_stress_unavailable", "Macro Stress snapshot could not be generated.");
  }
}

interface CalendarEventSource {
  ticker: string;
  event_date: string;
  event_time?: CalendarEventTime;
  provider: string;
  retrieved_at: string;
  timing_state: CalendarEventRecord["timingState"];
  source_state: CalendarEventRecord["sourceState"];
  source_ref: Record<string, unknown>;
  reason_text: string;
}

// Same filtering as the old fetchCalendarEventsFromDataOpenbb.
export function parseCalendarEvents(raw: unknown[], nowIso: string): CalendarEventSource[] {
  const events: CalendarEventSource[] = [];
  for (const row of raw) {
    if (!isPlainRecord(row)) continue;
    const ticker = typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
    const eventDate = typeof row.event_date === "string" ? row.event_date.trim() : "";
    if (!ticker || !eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) continue;
    const t = typeof row.event_time === "string" ? row.event_time.trim() : undefined;
    const eventTime = t === "before_market" || t === "after_market" || t === "during_market" ? t : undefined;
    const provider = typeof row.provider === "string" && row.provider.trim().length > 0
      ? row.provider.trim()
      : "calendar_feed";
    const retrievedAt = typeof row.retrieved_at === "string" && row.retrieved_at.trim().length > 0
      ? row.retrieved_at
      : nowIso;
    const timingState = normalizeEarningsTimingState(
      typeof row.timing_state === "string" ? row.timing_state.trim() : undefined,
    );
    const sourceState = normalizeEarningsSourceState(
      typeof row.source_state === "string" ? row.source_state.trim() : undefined,
      provider,
    );
    const reasonRaw = typeof row.reason_text === "string" ? row.reason_text.trim() : "";
    events.push({
      ticker,
      event_date: eventDate,
      event_time: eventTime,
      provider,
      retrieved_at: retrievedAt,
      timing_state: timingState,
      source_state: sourceState,
      source_ref: isPlainRecord(row.source_ref) ? { ...row.source_ref } : {},
      reason_text: reasonRaw.length > 0
        ? reasonRaw
        : timingState === "confirmed"
        ? "Company or official source confirms the earnings timing."
        : "Earnings timing is estimated pending stronger source confirmation.",
    });
  }
  return events;
}

// body: { start_date?, end_date?, events }. events is data.events of the old POST /internal/calendar/earnings.
export async function syncCalendar(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const startDate = normalizeDateInput(body.start_date ?? today) ?? today;
  const endDate = normalizeDateInput(body.end_date ?? addDaysToIsoDate(startDate, 14)) ??
    addDaysToIsoDate(startDate, 14);
  if (Date.parse(`${startDate}T00:00:00.000Z`) > Date.parse(`${endDate}T00:00:00.000Z`)) {
    return validation("start_date must be on or before end_date.");
  }
  if (!Array.isArray(body.events)) return validation("events is required: the earnings calendar rows.");

  const nowIso = deps.now().toISOString();
  const events = parseCalendarEvents(body.events, nowIso);
  if (events.length === 0) {
    logInfo("Calendar sync returned no usable events", { start_date: startDate, end_date: endDate });
  }
  const supported = new Set(await deps.store.listTickerCoverageTickers(10_000));
  const filtered = events.filter((e) => supported.has(e.ticker));
  const upserted = await deps.store.upsertCalendarEvents(filtered.map((e) => ({
    id: createId(),
    ticker: e.ticker,
    eventType: "earnings" as const,
    eventDate: e.event_date,
    eventTime: e.event_time,
    provider: e.provider,
    retrievedAt: e.retrieved_at,
    timingState: e.timing_state,
    sourceState: e.source_state,
    sourceRef: e.source_ref,
    reasonText: e.reason_text,
  })));
  const counts = {
    start_date: startDate,
    end_date: endDate,
    source_rows: events.length,
    supported_rows: filtered.length,
    events_upserted: upserted.upserted,
  };
  await appendAudit(deps.store, "calendar.sync_completed", { request_id: meta.requestId, route: meta.route, ...counts });
  logInfo("Calendar sync complete", counts);
  return ok({ status: "ok", ...counts });
}
