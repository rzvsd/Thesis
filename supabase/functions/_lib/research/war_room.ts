// Earnings state list and War Room evidence pack, copied from apps/product-api/src/server.ts
// (getEarningsEventStateListForUser, findEarningsState, buildWarRoomEvidencePack).
import { buildEarningsEventStates } from "./earnings_state.ts";
import type { ResearchStore } from "./store.ts";
import type {
  CallArtifact,
  EarningsEventState,
  EarningsEventStateListResponse,
  WarRoomTimelineEventRecord,
} from "./types.ts";
import { addDaysToIsoDate, uniqueUppercaseTickers } from "./util.ts";

export async function getEarningsEventStateListForUser(
  store: ResearchStore,
  input: {
    userId: string;
    asOf: string;
    tickers?: string[];
    windowPastDays?: number;
    windowAheadDays?: number;
  },
): Promise<EarningsEventStateListResponse> {
  const watchlistTickers = input.tickers && input.tickers.length > 0
    ? uniqueUppercaseTickers(input.tickers)
    : uniqueUppercaseTickers(await store.listWatchlistTickersByUser(input.userId));
  const windowPastDays = Math.max(0, Math.floor(input.windowPastDays ?? 7));
  const windowAheadDays = Math.max(1, Math.floor(input.windowAheadDays ?? 30));
  const windowStart = addDaysToIsoDate(input.asOf, -windowPastDays);
  const windowEnd = addDaysToIsoDate(input.asOf, windowAheadDays);
  if (watchlistTickers.length === 0) {
    return { as_of: input.asOf, window_start: windowStart, window_end: windowEnd, states: [] };
  }

  const events = await store.listUpcomingCalendarEventsByTickers({
    tickers: watchlistTickers,
    fromDate: windowStart,
    toDate: windowEnd,
    eventType: "earnings",
  });
  const artifactsByTicker = new Map<string, CallArtifact[]>();
  for (const ticker of watchlistTickers) {
    artifactsByTicker.set(ticker, await store.listCallArtifacts({ ticker, limit: 250 }));
  }

  return {
    as_of: input.asOf,
    window_start: windowStart,
    window_end: windowEnd,
    states: buildEarningsEventStates({ asOf: input.asOf, events, artifactsByTicker }),
  };
}

export function findEarningsState(
  states: EarningsEventState[],
  input: { ticker: string; eventId?: string; eventDate?: string },
): EarningsEventState | undefined {
  const ticker = input.ticker.trim().toUpperCase();
  const byTicker = states.filter((state) => state.ticker === ticker);
  if (byTicker.length === 0) return undefined;
  if (input.eventId) {
    const byEventId = byTicker.find((state) => state.earnings_event_id === input.eventId);
    if (byEventId) return byEventId;
  }
  if (input.eventDate) {
    const byDate = byTicker.find((state) => state.event_date === input.eventDate);
    if (byDate) return byDate;
  }
  return byTicker[0];
}

export function buildWarRoomEvidencePack(input: {
  state?: EarningsEventState;
  timeline: WarRoomTimelineEventRecord[];
}): {
  baseline: Record<string, unknown>;
  release_artifact: Record<string, unknown>;
  followup_context: Record<string, unknown>;
  transcript: Record<string, unknown>;
} {
  const preparedEvent = input.timeline
    .filter((event) => event.eventType === "prepared")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
  const followupEvent = input.timeline
    .filter((event) =>
      event.eventType === "deep_dive_queued" ||
      event.eventType === "post_event_closed" ||
      event.eventType === "playbook_updated"
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const baselineRef = preparedEvent?.sourceRefs?.[0];
  const baseline = baselineRef
    ? {
      kind: baselineRef.kind,
      ref_id: baselineRef.ref_id,
      label: baselineRef.label,
      captured_at: baselineRef.captured_at,
    }
    : {
      omission: {
        reason_code: "baseline_missing",
        reason_text: "No prepared baseline reference was found in War Room history.",
      },
    };

  const releaseArtifact = input.state?.release_artifact ? { ...input.state.release_artifact } : {
    omission: {
      reason_code: "release_artifact_missing",
      reason_text: "No release artifact has been ingested yet for this earnings event.",
    },
  };

  const followupContext = followupEvent
    ? {
      event_type: followupEvent.eventType,
      reason_text: followupEvent.reasonText,
      report_id: followupEvent.reportId,
      alert_ledger_id: followupEvent.alertLedgerId,
      created_at: followupEvent.createdAt,
    }
    : {
      omission: {
        reason_code: "followup_context_missing",
        reason_text: "No contradiction or follow-up summary exists yet for this War Room.",
      },
    };

  const transcript = input.state?.has_transcript
    ? { available: true, reason_text: "Transcript artifact is available." }
    : {
      available: false,
      omission: {
        reason_code: "transcript_optional",
        reason_text: "Transcript text is optional and not required for War Room readiness.",
      },
    };

  return { baseline, release_artifact: releaseArtifact, followup_context: followupContext, transcript };
}
