// Names research routes:
//   GET /v1/names/relationships
//   GET /v1/research/earnings/state
//   GET /v1/research/war-room/:id   (Pro only)
//   GET /v1/user/monitor-snapshots
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import { requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import {
  type NameRelationshipRecord,
  type NameRelationshipState,
  nameRelationshipStates,
  type ThesisMonitorSnapshotRecord,
} from "../../../_lib/research/types.ts";
import {
  buildUpgradeRequiredPayload,
  dateInTimeZone,
  normalizeDateInput,
  normalizeTickerSymbol,
  parsePositiveInteger,
  subscriptionTimezone,
  uniqueUppercaseTickers,
} from "../../../_lib/research/util.ts";
import {
  buildWarRoomEvidencePack,
  findEarningsState,
  getEarningsEventStateListForUser,
} from "../../../_lib/research/war_room.ts";
import type { RouteContext } from "../../router.ts";

const invalid = (message: string) => json({ error: "validation_failed", error_message: message }, 422);

function toNameRelationshipView(record: NameRelationshipRecord) {
  return {
    relationship_id: record.relationshipId,
    user_id: record.userId,
    source_ticker: record.sourceTicker,
    target_ticker: record.targetTicker,
    relationship_type: record.relationshipType,
    confidence: record.confidence,
    state: record.state,
    source_report_id: record.sourceReportId,
    prompt_version: record.promptVersion,
    evidence_text: record.evidenceText,
    rationale: record.rationale,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    suppressed_at: record.suppressedAt,
  };
}

export function nameRelationshipsHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const sourceTicker = normalizeTickerSymbol(url.searchParams.get("source_ticker") ?? undefined);
    const targetTicker = normalizeTickerSymbol(url.searchParams.get("target_ticker") ?? undefined);
    const stateRaw = url.searchParams.get("state")?.trim();
    const states = stateRaw && stateRaw.length > 0
      ? stateRaw.split(",").map((s) => s.trim()).filter((s): s is NameRelationshipState =>
        (nameRelationshipStates as readonly string[]).includes(s)
      )
      : undefined;
    if (stateRaw && stateRaw.length > 0 && (!states || states.length === 0)) {
      return invalid("state must be active, suppressed, inactive, or a comma-separated list.");
    }
    const minConfidenceRaw = url.searchParams.get("min_confidence");
    const minConfidence = minConfidenceRaw === null || minConfidenceRaw.trim().length === 0
      ? undefined
      : Number.parseFloat(minConfidenceRaw);
    if (
      minConfidence !== undefined &&
      (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)
    ) {
      return invalid("min_confidence must be a number between 0 and 1.");
    }
    const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 100, 1, 250);
    if (limit === undefined) return invalid("limit must be an integer between 1 and 250.");

    const relationships = await store.listNameRelationshipsByUser({
      userId,
      sourceTicker,
      targetTicker,
      states,
      minConfidence,
      limit,
    });
    await appendAudit(store, "name_relationships.retrieved", {
      request_id: requestId(req),
      route: path,
      relationship_count: relationships.length,
    }, userId);
    return json({ data: relationships.map(toNameRelationshipView) });
  };
}

export function earningsStateHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const today = dateInTimeZone(new Date(), subscriptionTimezone);
    const asOf = normalizeDateInput(url.searchParams.get("as_of")?.trim() ?? today) ?? today;
    const windowPastDays = parsePositiveInteger(
      url.searchParams.get("window_past_days")?.trim() ?? undefined,
      7,
      1,
      30,
    );
    if (windowPastDays === undefined) return invalid("window_past_days must be an integer between 1 and 30.");
    const windowAheadDays = parsePositiveInteger(
      url.searchParams.get("window_ahead_days")?.trim() ?? undefined,
      30,
      1,
      120,
    );
    if (windowAheadDays === undefined) {
      return invalid("window_ahead_days must be an integer between 1 and 120.");
    }
    const tickers = uniqueUppercaseTickers(
      (url.searchParams.get("tickers") ?? "").split(",").map((v) => v.trim()),
    );

    const stateList = await getEarningsEventStateListForUser(store, {
      userId,
      asOf,
      tickers: tickers.length > 0 ? tickers : undefined,
      windowPastDays,
      windowAheadDays,
    });
    await appendAudit(store, "earnings_state.retrieved", {
      request_id: requestId(req),
      route: path,
      ticker_count: tickers.length,
      state_count: stateList.states.length,
      as_of: asOf,
    }, userId);
    return json({ data: stateList });
  };
}

export function warRoomHandler({ store }: ResearchDeps) {
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const warRoomId = params.id.trim();
    const notFound = () => json({ error: "war_room_not_found", error_message: "War Room not found." }, 404);
    if (!warRoomId) return notFound();
    if ((await store.getSubscriptionTier(userId)) !== "PRO") {
      return json(
        buildUpgradeRequiredPayload("earnings_war_room", "Earnings War Room is available on the Pro tier."),
        403,
      );
    }

    const warRoom = await store.getWarRoom({ id: warRoomId, userId });
    if (!warRoom) return notFound();

    const timeline = await store.listWarRoomTimelineEvents({ warRoomId: warRoom.warRoomId, limit: 200 });
    const earningsStateList = await getEarningsEventStateListForUser(store, {
      userId,
      asOf: normalizeDateInput(warRoom.eventDate) ?? dateInTimeZone(new Date(), subscriptionTimezone),
      tickers: [warRoom.ticker],
      windowPastDays: 30,
      windowAheadDays: 30,
    });
    const earningsState = findEarningsState(earningsStateList.states, {
      ticker: warRoom.ticker,
      eventId: warRoom.earningsEventId,
      eventDate: warRoom.eventDate,
    });
    const evidencePack = buildWarRoomEvidencePack({ state: earningsState, timeline });
    await appendAudit(store, "war_room.retrieved", {
      request_id: requestId(req),
      route: path,
      war_room_id: warRoom.warRoomId,
      timeline_count: timeline.length,
      earnings_timing_state: earningsState?.timing_state,
      earnings_source_state: earningsState?.source_state,
    }, userId);

    return json({
      data: {
        war_room_id: warRoom.warRoomId,
        ticker: warRoom.ticker,
        earnings_event_id: warRoom.earningsEventId,
        event_date: warRoom.eventDate,
        state: warRoom.state,
        current_cadence_min: warRoom.currentCadenceMin,
        prepared_at: warRoom.preparedAt,
        closed_at: warRoom.closedAt,
        last_cycle_status: warRoom.lastCycleStatus,
        last_lag_min: warRoom.lastLagMin,
        last_runtime_min: warRoom.lastRuntimeMin,
        last_cycle_at: warRoom.lastCycleAt,
        earnings_state: earningsState ?? null,
        evidence_pack: evidencePack,
        reason_path: {
          earnings_state_reason: earningsState?.reason_text,
          latest_timeline_reason: timeline.length > 0 ? timeline[0]?.reasonText : undefined,
        },
        timeline: timeline.map((event) => ({
          war_room_event_id: event.id,
          war_room_id: event.warRoomId,
          phase: event.phase,
          event_type: event.eventType,
          reason_text: event.reasonText,
          source_refs: event.sourceRefs,
          alert_ledger_id: event.alertLedgerId,
          report_id: event.reportId,
          created_at: event.createdAt,
        })),
      },
    });
  };
}

function toMonitorSnapshotView(snapshot: ThesisMonitorSnapshotRecord) {
  return {
    user_id: snapshot.userId,
    ticker: snapshot.ticker,
    state: snapshot.state,
    reason: snapshot.reason,
    score: snapshot.score,
    report_id: snapshot.reportId,
    report_generated_at: snapshot.reportGeneratedAt,
    report_schema_version: snapshot.reportSchemaVersion,
    last_deep_dive_at: snapshot.lastDeepDiveAt,
    material_events_count: snapshot.materialEventsCount,
    unreviewed_events_count: snapshot.unreviewedEventsCount,
    freshness_state: snapshot.freshnessState,
    freshness_score: snapshot.freshnessScore,
    kill_switch_triggered_at: snapshot.killSwitchTriggeredAt,
    freshness_reason: snapshot.freshnessReason,
    updated_at: snapshot.updatedAt,
  };
}

export function monitorSnapshotsHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const snapshots = await store.listThesisMonitorSnapshotsByUser(userId);
    await appendAudit(store, "monitor.snapshots_retrieved", {
      request_id: requestId(req),
      route: path,
      snapshot_count: snapshots.length,
    }, userId);
    return json({ data: snapshots.map(toMonitorSnapshotView) });
  };
}
