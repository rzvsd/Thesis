// Thesis monitor snapshot: state (intact / improved / weakened / unresolved) and freshness of a followed name.
import type { AnalysisReport } from "../types.ts";
import {
  clampNumber,
  freshnessAgingDays,
  freshnessStaleDays,
  freshnessTriggeredLookbackDays,
  monitorFreshnessWindowDays,
} from "./helpers.ts";
import type {
  EffectsStore,
  ThesisFreshnessState,
  ThesisMonitorSnapshotRecord,
  ThesisMonitorState,
} from "./types.ts";

export interface MonitorStateSummary {
  state: ThesisMonitorState;
  reason: string;
  score: number;
}

export interface MonitorFreshnessSummary {
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  freshnessState: ThesisFreshnessState;
  freshnessScore: number;
  killSwitchTriggeredAt?: string;
  freshnessReason: string;
}

function clampScore(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return clampNumber(value as number, 0, 1);
}

function daysSince(earlierIso: string | undefined, laterIso: string): number | undefined {
  if (!earlierIso) {
    return undefined;
  }
  const earlier = Date.parse(earlierIso);
  const later = Date.parse(laterIso);
  if (!Number.isFinite(earlier) || !Number.isFinite(later)) {
    return undefined;
  }
  const delta = Math.floor((later - earlier) / (24 * 60 * 60 * 1000));
  return Math.max(0, delta);
}

export function computeMonitorFreshness(input: {
  asOfIso: string;
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  killSwitchTriggeredAt?: string;
  fallbackReason?: string;
}): MonitorFreshnessSummary {
  const materialEventsCount = Math.max(0, Math.floor(input.materialEventsCount));
  const unreviewedEventsCount = Math.max(0, Math.floor(input.unreviewedEventsCount));
  const lastDeepDiveAt =
    typeof input.lastDeepDiveAt === "string" && Number.isFinite(Date.parse(input.lastDeepDiveAt))
      ? input.lastDeepDiveAt
      : undefined;
  const killSwitchTriggeredAt = typeof input.killSwitchTriggeredAt === "string" &&
      Number.isFinite(Date.parse(input.killSwitchTriggeredAt))
    ? input.killSwitchTriggeredAt
    : undefined;

  const asOfMillis = Date.parse(input.asOfIso);
  const triggeredLookbackStart = Number.isFinite(asOfMillis)
    ? asOfMillis - freshnessTriggeredLookbackDays * 24 * 60 * 60 * 1000
    : Number.NaN;
  const isTriggered = killSwitchTriggeredAt !== undefined &&
    Number.isFinite(triggeredLookbackStart) &&
    Number.isFinite(Date.parse(killSwitchTriggeredAt)) &&
    Date.parse(killSwitchTriggeredAt) >= triggeredLookbackStart;

  const ageDays = daysSince(lastDeepDiveAt, input.asOfIso);

  let freshnessState: ThesisFreshnessState;
  let freshnessReason: string;

  if (isTriggered) {
    freshnessState = "triggered";
    freshnessReason = `Kill-switch conditions fired recently and ${
      Math.max(1, unreviewedEventsCount)
    } material event(s) require review.`;
  } else if (ageDays === undefined) {
    freshnessState = "stale";
    freshnessReason = input.fallbackReason ?? "No Deep Dive baseline is available yet.";
  } else if (ageDays > freshnessStaleDays || unreviewedEventsCount >= 3) {
    freshnessState = "stale";
    if (ageDays > freshnessStaleDays && unreviewedEventsCount >= 3) {
      freshnessReason =
        `Deep Dive is ${ageDays} days old with ${unreviewedEventsCount} unreviewed material event(s).`;
    } else if (ageDays > freshnessStaleDays) {
      freshnessReason = `Deep Dive is ${ageDays} days old and now stale.`;
    } else {
      freshnessReason = `${unreviewedEventsCount} material event(s) remain unreviewed.`;
    }
  } else if (ageDays >= freshnessAgingDays || unreviewedEventsCount >= 1) {
    freshnessState = "aging";
    if (ageDays >= freshnessAgingDays && unreviewedEventsCount >= 1) {
      freshnessReason =
        `Deep Dive is ${ageDays} days old with ${unreviewedEventsCount} unreviewed material event(s).`;
    } else if (ageDays >= freshnessAgingDays) {
      freshnessReason = `Deep Dive is ${ageDays} days old and should be reviewed soon.`;
    } else {
      freshnessReason = `${unreviewedEventsCount} new material event(s) arrived since your last review.`;
    }
  } else {
    freshnessState = "current";
    freshnessReason = "Deep Dive is fresh and no material events are waiting for review.";
  }

  const agePenalty = ageDays === undefined
    ? 0.55
    : Math.min(1, ageDays / Math.max(90, freshnessStaleDays * 2)) * 0.55;
  const eventPenalty = Math.min(1, unreviewedEventsCount / 6) * 0.35;
  const triggerPenalty = isTriggered ? 0.2 : 0;
  const freshnessScore = clampNumber(1 - agePenalty - eventPenalty - triggerPenalty, 0, 1);

  return {
    lastDeepDiveAt,
    materialEventsCount,
    unreviewedEventsCount,
    freshnessState,
    freshnessScore,
    killSwitchTriggeredAt,
    freshnessReason,
  };
}

export function summarizeMonitorState(report: AnalysisReport, asOfIso: string): MonitorStateSummary {
  const trust = report.trust_metadata;
  const score = clampScore(report.confidence?.score);
  const generatedAtMs = Date.parse(report.generated_at);
  const staleCutoffMs = Date.parse(asOfIso) - monitorFreshnessWindowDays * 24 * 60 * 60 * 1000;
  const driftSummary: string = trust?.thesis_drift?.summary?.toLowerCase() ?? "";
  const driftUnavailable = trust?.thesis_drift?.status === "unavailable";
  const contradictionPresent = trust?.contradiction_state === "present" ||
    (trust?.contradictions?.length ?? 0) > 0;

  if (
    trust?.freshness_state === "stale" ||
    contradictionPresent ||
    !Number.isFinite(generatedAtMs) ||
    generatedAtMs < staleCutoffMs ||
    report.signal?.value === "no_signal"
  ) {
    return {
      state: "unresolved",
      reason: contradictionPresent
        ? "Evidence is conflicting and needs review."
        : "Evidence is stale or insufficient to confirm thesis state.",
      score,
    };
  }

  if (
    driftSummary.includes("weaken") ||
    driftSummary.includes("deteriorat") ||
    driftSummary.includes("risk") ||
    report.signal?.value === "negative"
  ) {
    return { state: "weakened", reason: "Latest evidence weakens the prior thesis.", score };
  }

  if (driftSummary.includes("improv") || driftSummary.includes("strengthen")) {
    return {
      state: "improved",
      reason: "Latest evidence strengthens conviction versus the prior thesis.",
      score,
    };
  }

  if (report.signal?.value === "positive" && !driftUnavailable) {
    return {
      state: "improved",
      reason: "Signal and drift are both supportive of the thesis direction.",
      score,
    };
  }

  return {
    state: "intact",
    reason: "Latest evidence remains broadly consistent with the prior thesis.",
    score,
  };
}

export function upsertSnapshotFromReport(
  store: EffectsStore,
  input: {
    userId: string;
    ticker: string;
    report: AnalysisReport;
    asOfIso: string;
    materialEventsCount: number;
    unreviewedEventsCount: number;
    killSwitchTriggeredAt?: string;
    updatedAt: string;
  },
): Promise<ThesisMonitorSnapshotRecord> {
  const summary = summarizeMonitorState(input.report, input.asOfIso);
  const freshness = computeMonitorFreshness({
    asOfIso: input.asOfIso,
    lastDeepDiveAt: input.report.generated_at,
    materialEventsCount: input.materialEventsCount,
    unreviewedEventsCount: input.unreviewedEventsCount,
    killSwitchTriggeredAt: input.killSwitchTriggeredAt,
  });
  return store.upsertThesisMonitorSnapshot({
    userId: input.userId,
    ticker: input.ticker.trim().toUpperCase(),
    state: summary.state,
    reason: summary.reason,
    score: summary.score,
    reportId: input.report.report_id,
    reportGeneratedAt: input.report.generated_at,
    reportSchemaVersion: input.report.schema_version,
    lastDeepDiveAt: freshness.lastDeepDiveAt,
    materialEventsCount: freshness.materialEventsCount,
    unreviewedEventsCount: freshness.unreviewedEventsCount,
    freshnessState: freshness.freshnessState,
    freshnessScore: freshness.freshnessScore,
    killSwitchTriggeredAt: freshness.killSwitchTriggeredAt,
    freshnessReason: freshness.freshnessReason,
    updatedAt: input.updatedAt,
  });
}
