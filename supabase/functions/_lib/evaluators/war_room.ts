// POST /internal/notifications/earnings-war-room. Copied from server.ts.
// Body: { as_of?, phase?: "auto"|"pre"|"live"|"post", live_fixtures?, limit?, cursor? }.
// Batched by user (PRO earnings_war_room audience). fallback_user_ids lists users whose prep failed on this page.
// Retry notes:
// - pre: the room id is stable per (user, ticker, event) and an existing room is skipped, as before.
//   The pre alert id is stable per room.
// - live: each call is one live cycle by design (it moves the cadence streaks). The cadence alert id is
//   stable per (room, as_of, new cadence), so a retried call cannot send the same cadence alert twice.
// - post: a closed room is skipped. Kill-switch rows are keyed by trigger key; the post alert id is stable
//   per room, and the alert is written before the room is closed so a crash in between is retried.
// force_fail_user_ids (a smoke-test hook of the in-memory server) is not supported.
import { logError } from "../../_shared/log.ts";
import { addTally, deliverAlert, emptyTally } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { findEarningsState, getEarningsEventStateListForUser } from "./earnings_state.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type {
  EarningsEventState,
  WarRoomCycleStatus,
  WarRoomRow,
  WarRoomTimelineEventRecord,
} from "./types.ts";
import {
  addDaysToIsoDate,
  createId,
  cursorValue,
  dateInTimeZone,
  groupTargets,
  isPlainRecord,
  nextCursor,
  normalizeDateInput,
  notificationRoute,
  notificationTitle,
  pageLimit,
  stableId,
} from "./util.ts";

const fastCadence = 15;
const fallbackCadence = 30;
const fallbackConsecutiveThreshold = 2;
const recoveryHealthyThreshold = 3;
const lagFallbackThreshold = 20;
const runtimeFallbackThreshold = 12;
const lagRecoveryThreshold = 10;
const runtimeRecoveryThreshold = 8;
const preparationLookaheadDays = 2;
export const warRoomPageSize = 100;

export interface WarRoomCycleMetrics {
  status: WarRoomCycleStatus;
  lagMinutes: number;
  runtimeMinutes: number;
}

export interface WarRoomStreaks {
  currentCadenceMin: number;
  failureStreak: number;
  lagBreachStreak: number;
  runtimeBreachStreak: number;
  healthyStreak: number;
}

export interface WarRoomCadenceResult {
  nextCadenceMin: 15 | 30;
  failureStreak: number;
  lagBreachStreak: number;
  runtimeBreachStreak: number;
  healthyStreak: number;
  triggerType?: "failures" | "lag_breach" | "runtime_breach" | "healthy_recovery";
  transitioned: boolean;
}

function asCycleStatus(value: unknown): WarRoomCycleStatus {
  if (typeof value !== "string") return "success";
  const v = value.trim().toLowerCase();
  if (v === "failed" || v === "failure") return "failure";
  if (v === "timeout") return "timeout";
  return "success";
}

function boundedWholeNumber(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : fallback;
}

export function computeWarRoomCadence(
  room: WarRoomStreaks,
  cycle: WarRoomCycleMetrics,
): WarRoomCadenceResult {
  const failed = cycle.status === "failure" || cycle.status === "timeout";
  const failureStreak = failed ? room.failureStreak + 1 : 0;
  const lagBreachStreak = cycle.lagMinutes >= lagFallbackThreshold ? room.lagBreachStreak + 1 : 0;
  const runtimeBreachStreak = cycle.runtimeMinutes > runtimeFallbackThreshold
    ? room.runtimeBreachStreak + 1
    : 0;
  const healthy = cycle.status === "success" && cycle.lagMinutes <= lagRecoveryThreshold &&
    cycle.runtimeMinutes <= runtimeRecoveryThreshold;
  const healthyStreak = healthy ? room.healthyStreak + 1 : 0;

  let next: 15 | 30 = room.currentCadenceMin === fallbackCadence ? fallbackCadence : fastCadence;
  let triggerType: WarRoomCadenceResult["triggerType"];
  if (next === fastCadence) {
    if (failureStreak >= fallbackConsecutiveThreshold) {
      next = fallbackCadence;
      triggerType = "failures";
    } else if (lagBreachStreak >= fallbackConsecutiveThreshold) {
      next = fallbackCadence;
      triggerType = "lag_breach";
    } else if (runtimeBreachStreak >= fallbackConsecutiveThreshold) {
      next = fallbackCadence;
      triggerType = "runtime_breach";
    }
  } else if (healthyStreak >= recoveryHealthyThreshold) {
    next = fastCadence;
    triggerType = "healthy_recovery";
  }
  const transitioned = next !== room.currentCadenceMin;
  const reset = transitioned && triggerType === "healthy_recovery";
  return {
    nextCadenceMin: next,
    failureStreak: reset ? 0 : failureStreak,
    lagBreachStreak: reset ? 0 : lagBreachStreak,
    runtimeBreachStreak: reset ? 0 : runtimeBreachStreak,
    healthyStreak,
    triggerType,
    transitioned,
  };
}

export function parseWarRoomCycleFixture(
  value: unknown,
): { warRoomId?: string; ticker?: string; metrics: WarRoomCycleMetrics } | undefined {
  if (!isPlainRecord(value)) return undefined;
  const id = typeof value.war_room_id === "string" ? value.war_room_id.trim() : "";
  const ticker = typeof value.ticker === "string" ? value.ticker.trim().toUpperCase() : "";
  return {
    warRoomId: id || undefined,
    ticker: ticker || undefined,
    metrics: {
      status: asCycleStatus(value.status),
      lagMinutes: boundedWholeNumber(value.lag_minutes, 0, 120),
      runtimeMinutes: boundedWholeNumber(value.runtime_minutes, 0, 120),
    },
  };
}

function streaksOf(room: WarRoomRow): WarRoomStreaks {
  return {
    currentCadenceMin: room.currentCadenceMin,
    failureStreak: room.cadenceState.consecutive_failures,
    lagBreachStreak: room.cadenceState.consecutive_lag_breaches,
    runtimeBreachStreak: room.cadenceState.consecutive_runtime_breaches,
    healthyStreak: room.cadenceState.consecutive_healthy_cycles,
  };
}

function earningsFields(state: EarningsEventState | undefined) {
  return {
    timing: state?.timing_state ?? "estimated",
    source: state?.source_state ?? "derived",
    evidence: state?.evidence_state ?? "calendar_only",
    conflict: state?.conflict.has_conflict ?? false,
  };
}

function earningsData(e: ReturnType<typeof earningsFields>): Record<string, string> {
  return {
    earnings_timing_state: e.timing,
    earnings_source_state: e.source,
    earnings_evidence_state: e.evidence,
    earnings_conflict: e.conflict ? "true" : "false",
  };
}

function earningsMeta(e: ReturnType<typeof earningsFields>): Record<string, unknown> {
  return {
    earnings_timing_state: e.timing,
    earnings_source_state: e.source,
    earnings_evidence_state: e.evidence,
    earnings_conflict: e.conflict,
  };
}

async function timeline(
  deps: EvaluatorDeps,
  input: Omit<WarRoomTimelineEventRecord, "id" | "sourceRefs" | "metadata" | "createdAt"> & {
    sourceRefs?: WarRoomTimelineEventRecord["sourceRefs"];
    metadata?: Record<string, unknown>;
    createdAt?: string;
  },
): Promise<void> {
  await deps.store.createWarRoomTimelineEvent({
    id: createId(),
    sourceRefs: [],
    metadata: {},
    createdAt: deps.now().toISOString(),
    ...input,
  });
}

async function roomEarnings(deps: EvaluatorDeps, room: WarRoomRow, asOf: string) {
  const list = await getEarningsEventStateListForUser(deps, {
    userId: room.userId,
    asOf,
    tickers: [room.ticker],
    windowPastDays: 14,
    windowAheadDays: 14,
  });
  return earningsFields(
    findEarningsState(list.states, {
      ticker: room.ticker,
      eventId: room.earningsEventId,
      eventDate: room.eventDate,
    }),
  );
}

export async function dispatchEarningsWarRoom(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOf = normalizeDateInput(body.as_of ?? today) ?? today;
  const phase = typeof body.phase === "string" ? body.phase.trim().toLowerCase() : "auto";
  const includePre = phase === "auto" || phase === "pre";
  const includeLive = phase === "auto" || phase === "live";
  const includePost = phase === "auto" || phase === "post";
  const limit = pageLimit(body.limit, warRoomPageSize);

  const audience = await deps.store.listAudience({
    notificationType: "earnings_war_room",
    tier: "PRO",
    page: { afterUserId: cursorValue(body.cursor), limit },
  });
  const targetsByUser = groupTargets(audience);
  const userIds = audience.map((m) => m.userId);

  const byRoomId = new Map<string, WarRoomCycleMetrics>();
  const byTicker = new Map<string, WarRoomCycleMetrics>();
  for (
    const f of (Array.isArray(body.live_fixtures) ? body.live_fixtures : []).map(parseWarRoomCycleFixture)
  ) {
    if (f?.warRoomId) byRoomId.set(f.warRoomId, f.metrics);
    else if (f?.ticker) byTicker.set(f.ticker, f.metrics);
  }

  let prepared = 0;
  let liveUpdated = 0;
  let postClosed = 0;
  let postDeferred = 0;
  const tally = emptyTally();
  const fallbackUserIds = new Set<string>();
  const route = notificationRoute("earnings_war_room");

  if (includePre) {
    const toDate = addDaysToIsoDate(asOf, preparationLookaheadDays);
    for (const userId of userIds) {
      try {
        const watchlist = await deps.store.listWatchlistTickers(userId);
        if (watchlist.length === 0) continue;
        const events = (await deps.store.listCalendarEvents({
          tickers: watchlist,
          fromDate: asOf,
          toDate,
          eventType: "earnings",
        })).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.ticker.localeCompare(b.ticker));
        const lead = events[0];
        if (!lead) continue;
        const ticker = lead.ticker.trim().toUpperCase();
        const existing = await deps.store.findWarRoomByEvent({ userId, ticker, earningsEventId: lead.id });
        if (existing) continue;

        const list = await getEarningsEventStateListForUser(deps, {
          userId,
          asOf,
          tickers: [ticker],
          windowPastDays: 14,
          windowAheadDays: Math.max(7, preparationLookaheadDays + 3),
        });
        const e = earningsFields(
          findEarningsState(list.states, { ticker, eventId: lead.id, eventDate: lead.eventDate }),
        );
        const now = deps.now().toISOString();
        const room = await deps.store.createWarRoom({
          id: await stableId(`war_room:${userId}:${ticker}:${lead.id}`),
          userId,
          ticker,
          earningsEventId: lead.id,
          eventDate: lead.eventDate,
          state: "ready",
          currentCadenceMin: fastCadence,
          cadenceState: {
            current_cadence_min: fastCadence,
            default_cadence_min: fastCadence,
            fallback_cadence_min: fallbackCadence,
            consecutive_failures: 0,
            consecutive_lag_breaches: 0,
            consecutive_runtime_breaches: 0,
            consecutive_healthy_cycles: 0,
            updated_at: now,
          },
          preparedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        prepared += 1;
        await timeline(deps, {
          warRoomId: room.id,
          phase: "pre",
          eventType: "prepared",
          reasonText: `${ticker} reports on ${lead.eventDate}. War Room prep is ready.`,
          sourceRefs: [{
            kind: "calendar_event",
            ref_id: lead.id,
            label: `${ticker} earnings ${lead.eventDate}`,
          }],
          metadata: { ticker, event_date: lead.eventDate, ...earningsMeta(e) },
          createdAt: now,
        });

        const reasonText = `${ticker} reports on ${lead.eventDate}. Timing is ${e.timing} (${
          e.source.replace("_", " ")
        }). Open War Room to review thesis watchpoints.`;
        const data = {
          ticker,
          war_room_id: room.id,
          earnings_event_id: lead.id,
          event_date: lead.eventDate,
          current_cadence_min: String(room.currentCadenceMin),
          war_room_phase: "pre",
          ...earningsData(e),
        };
        const result = await deliverAlert(deps, {
          alertId: await stableId(`war_room_pre:${room.id}`),
          userId,
          targets: targetsByUser.get(userId) ?? [],
          notificationType: "earnings_war_room",
          route,
          title: notificationTitle("earnings_war_room", ticker),
          body: reasonText,
          reasonCode: "war_room_prepared",
          reasonText,
          pushData: {
            ...data,
            reason_code: "war_room_prepared",
            reason_text: reasonText,
            deep_link_target: route,
          },
          ledgerData: { ...data, deep_link_target: route },
        });
        addTally(tally, result.push);
        if (result.alert) {
          await timeline(deps, {
            warRoomId: room.id,
            phase: "pre",
            eventType: "alert_emitted",
            reasonText,
            alertLedgerId: result.alert.id,
            sourceRefs: [{
              kind: "alert_ledger",
              ref_id: result.alert.id,
              label: "War Room pre-event alert",
            }],
            metadata: { ticker, event_date: lead.eventDate, ...earningsMeta(e) },
          });
        }
      } catch (error) {
        // The old code degraded the user to the plain earnings preview. The daily job passes these
        // ids on to /earnings-preview as fallback_user_ids.
        fallbackUserIds.add(userId);
        logError("War Room preparation degraded to legacy path", {
          request_id: meta.requestId,
          route: meta.route,
          user_id: userId,
          error_name: error instanceof Error ? error.name : "unknown",
        });
      }
    }
  }

  const openRooms = async (): Promise<WarRoomRow[]> => {
    const rooms: WarRoomRow[] = [];
    for (const userId of userIds) {
      rooms.push(...await deps.store.listWarRoomsByUser({ userId, includeClosed: false, limit: 250 }));
    }
    return rooms.filter((r) => r.state === "ready" || r.state === "live" || r.state === "post");
  };

  if (includeLive) {
    for (const room of (await openRooms()).filter((r) => r.eventDate === asOf)) {
      const now = deps.now().toISOString();
      const cycle = byRoomId.get(room.id) ?? byTicker.get(room.ticker) ??
        { status: "success", lagMinutes: 0, runtimeMinutes: 0 };
      const cadence = computeWarRoomCadence(streaksOf(room), cycle);
      const updated: WarRoomRow = {
        ...room,
        state: room.state === "ready" ? "live" : room.state,
        currentCadenceMin: cadence.nextCadenceMin,
        cadenceState: {
          ...room.cadenceState,
          current_cadence_min: cadence.nextCadenceMin,
          consecutive_failures: cadence.failureStreak,
          consecutive_lag_breaches: cadence.lagBreachStreak,
          consecutive_runtime_breaches: cadence.runtimeBreachStreak,
          consecutive_healthy_cycles: cadence.healthyStreak,
          latest_cycle_status: cycle.status,
          latest_source_freshness_lag_min: cycle.lagMinutes,
          latest_runtime_min: cycle.runtimeMinutes,
          updated_at: now,
        },
        updatedAt: now,
      };
      await deps.store.updateWarRoom(updated);
      const e = await roomEarnings(deps, updated, asOf);
      liveUpdated += 1;
      await timeline(deps, {
        warRoomId: room.id,
        phase: "live",
        eventType: cadence.transitioned ? "cadence_changed" : "live_cycle_completed",
        reasonText: cadence.transitioned
          ? `Cadence changed from ${room.currentCadenceMin} min to ${updated.currentCadenceMin} min (${
            cadence.triggerType ?? "rule"
          }).`
          : `Live cycle completed with status ${cycle.status}.`,
        sourceRefs: [{
          kind: "live_cycle_metrics",
          ref_id: `${room.id}:${now}`,
          label: `status=${cycle.status}`,
        }],
        metadata: {
          status: cycle.status,
          lag_minutes: cycle.lagMinutes,
          runtime_minutes: cycle.runtimeMinutes,
          trigger_type: cadence.triggerType,
          ...earningsMeta(e),
        },
        createdAt: now,
      });
      if (!cadence.transitioned) continue;

      const recovered = cadence.triggerType === "healthy_recovery";
      const reasonCode = recovered ? "war_room_cadence_recovered" : "war_room_cadence_fallback";
      const reasonText = recovered
        ? `${room.ticker} War Room recovered to 15-minute cadence.`
        : `${room.ticker} War Room shifted to 30-minute cadence due to source degradation.`;
      const data = {
        ticker: room.ticker,
        war_room_id: room.id,
        earnings_event_id: room.earningsEventId,
        event_date: room.eventDate,
        current_cadence_min: String(updated.currentCadenceMin),
        war_room_phase: "live",
        ...earningsData(e),
      };
      const result = await deliverAlert(deps, {
        alertId: await stableId(`war_room_cadence:${room.id}:${asOf}:${updated.currentCadenceMin}`),
        userId: room.userId,
        targets: targetsByUser.get(room.userId) ?? [],
        notificationType: "earnings_war_room",
        route,
        title: notificationTitle("earnings_war_room", room.ticker),
        body: reasonText,
        reasonCode,
        reasonText,
        pushData: { ...data, reason_code: reasonCode, reason_text: reasonText, deep_link_target: route },
        ledgerData: { ...data, deep_link_target: route },
      });
      addTally(tally, result.push);
      if (result.alert) {
        await timeline(deps, {
          warRoomId: room.id,
          phase: "live",
          eventType: "alert_emitted",
          reasonText,
          alertLedgerId: result.alert.id,
          sourceRefs: [{ kind: "alert_ledger", ref_id: result.alert.id, label: "War Room cadence alert" }],
        });
      }
    }
  }

  if (includePost) {
    for (const room of (await openRooms()).filter((r) => r.eventDate <= asOf)) {
      // Closing a room queues its Deep Dive refresh. Until M2's queue is wired, leave the room open so a
      // later run can still close it and queue the refresh, instead of claiming a refresh that never happened.
      if (!deps.deepDiveQueue.enabled) {
        postDeferred += 1;
        continue;
      }
      const now = deps.now().toISOString();
      const e = await roomEarnings(deps, room, asOf);
      const queued = await deps.deepDiveQueue.queueRefresh({
        userId: room.userId,
        ticker: room.ticker,
        createdAt: now,
      });
      const triggerKey = `war_room_post:${room.id}:${asOf}`;

      const rules = await deps.store.listActiveKillSwitchRules({ asOfIso: now, userIds: [room.userId] });
      for (const rule of rules.filter((r) => r.ticker === room.ticker)) {
        if (
          await deps.store.getKillSwitchEvaluation({ ruleId: rule.id, signalSource: "event", triggerKey })
        ) continue;
        await deps.store.createKillSwitchEvaluation({
          id: createId(),
          ruleId: rule.id,
          userId: room.userId,
          ticker: room.ticker,
          signalSource: "event",
          triggerKey,
          outcome: "skipped",
          reasonCode: "war_room_post_recheck",
          reasonText: "Post-earnings re-evaluation queued from War Room closure.",
          createdAt: now,
          updatedAt: now,
        });
      }

      const snapshot = (await deps.store.listThesisMonitorSnapshotsByUser(room.userId))
        .find((s) => s.ticker === room.ticker);
      if (snapshot) {
        await deps.store.upsertThesisMonitorSnapshot({
          ...snapshot,
          freshnessState: "current",
          freshnessScore: 1,
          materialEventsCount: 0,
          unreviewedEventsCount: 0,
          killSwitchTriggeredAt: undefined,
          freshnessReason: "War Room post-event closure reset freshness and queued Deep Dive review.",
          updatedAt: now,
        });
      }

      const reasonText = `${room.ticker} post-event review started. Deep Dive refresh has been queued.`;
      const data = {
        ticker: room.ticker,
        war_room_id: room.id,
        earnings_event_id: room.earningsEventId,
        event_date: room.eventDate,
        war_room_phase: "post",
        ...earningsData(e),
        report_id: queued?.reportId ?? "",
      };
      const result = await deliverAlert(deps, {
        alertId: await stableId(`war_room_post:${room.id}`),
        userId: room.userId,
        targets: targetsByUser.get(room.userId) ?? [],
        notificationType: "earnings_war_room",
        route,
        title: notificationTitle("earnings_war_room", room.ticker),
        body: reasonText,
        reasonCode: "war_room_post_refresh_queued",
        reasonText,
        pushData: {
          ...data,
          reason_code: "war_room_post_refresh_queued",
          reason_text: reasonText,
          deep_link_target: route,
        },
        ledgerData: { ...data, deep_link_target: route },
      });
      addTally(tally, result.push);

      await deps.store.updateWarRoom({ ...room, state: "closed", closedAt: now, updatedAt: now });
      postClosed += 1;
      await timeline(deps, {
        warRoomId: room.id,
        phase: "post",
        eventType: "deep_dive_queued",
        reasonText,
        alertLedgerId: result.alert?.id,
        reportId: queued?.reportId,
        sourceRefs: [{ kind: "job", ref_id: queued?.id ?? triggerKey, label: "Deep Dive refresh queued" }],
        metadata: {
          trigger_key: triggerKey,
          closed: true,
          deep_dive_queued: Boolean(queued),
          ...earningsMeta(e),
        },
        createdAt: now,
      });
    }
  }

  const counts = {
    prepared,
    live_updated: liveUpdated,
    post_closed: postClosed,
    post_deferred: postDeferred,
    ...tally,
  };
  await appendAudit(deps.store, "earnings_war_room.dispatched", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOf,
    phase,
    ...counts,
    fallback_user_count: fallbackUserIds.size,
  });
  return ok({
    status: "ok",
    as_of: asOf,
    phase,
    ...counts,
    fallback_user_ids: [...fallbackUserIds],
    next_cursor: nextCursor(userIds, limit),
  });
}
