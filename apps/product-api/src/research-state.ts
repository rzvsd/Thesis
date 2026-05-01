import { randomUUID } from "node:crypto";

import type {
  AnalysisReport,
  MarketPulseReport,
  UserResearchDailyDelta,
  UserResearchEvidenceRef,
  UserResearchHolding,
  UserResearchNameState,
  UserResearchOmission,
  UserResearchState
} from "../../../packages/contracts/src";
import type { ArtifactStore } from "./artifact-store";
import type { ProductStore } from "./store";
import type {
  CalendarEventRecord,
  ReportRecord,
  ThesisMonitorSnapshotRecord,
  UserResearchHoldingRecord,
  UserResearchStateRecord
} from "./types";

export interface RefreshUserResearchStateOptions {
  store: ProductStore;
  artifactStore: ArtifactStore;
  asOf: string;
  userIds?: string[];
  dryRun?: boolean;
}

export interface RefreshUserResearchStateResult {
  users: number;
  names: number;
  created: number;
  updated: number;
  omissions: number;
  dry_run: boolean;
  states: UserResearchState[];
}

function addDaysToIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function normalizedTicker(value: string): string {
  return value.trim().toUpperCase();
}

function isAnalysisReport(value: unknown): value is AnalysisReport {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "type" in value &&
    value.type === "deep_dive" &&
    "report_id" in value &&
    typeof value.report_id === "string"
  );
}

function isMarketPulseReport(value: unknown): value is MarketPulseReport {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "report_id" in value &&
    typeof value.report_id === "string" &&
    "sections" in value
  );
}

function reportEvidence(report: ReportRecord, ticker?: string): UserResearchEvidenceRef {
  return {
    kind: report.type === "market_pulse" ? "pulse" : "report",
    ref_id: report.id,
    label: report.type === "market_pulse" ? "Market Pulse" : "Deep Dive",
    ticker,
    captured_at: report.createdAt
  };
}

function monitorEvidence(snapshot: ThesisMonitorSnapshotRecord): UserResearchEvidenceRef {
  return {
    kind: "monitor_snapshot",
    ref_id: `${snapshot.userId}:${snapshot.ticker}`,
    label: snapshot.freshnessState,
    ticker: snapshot.ticker,
    captured_at: snapshot.updatedAt
  };
}

function holdingToContract(holding: UserResearchHoldingRecord): UserResearchHolding {
  return {
    ticker: holding.ticker,
    ...(holding.quantity !== undefined ? { quantity: holding.quantity } : {}),
    ...(holding.costBasis !== undefined ? { cost_basis: holding.costBasis } : {}),
    ...(holding.label ? { label: holding.label } : {}),
    ...(holding.notes ? { notes: holding.notes } : {}),
    updated_at: holding.updatedAt
  };
}

function thesisSummary(report: AnalysisReport | undefined, snapshot: ThesisMonitorSnapshotRecord | undefined): string {
  if (report) {
    const section = report.sections.find((entry) =>
      entry.section_id === "thesis_statement" ||
      entry.title.trim().toLowerCase() === "thesis statement"
    );
    if (section?.body?.trim()) {
      return section.body.trim();
    }
  }
  if (snapshot?.reason.trim()) {
    return snapshot.reason.trim();
  }
  return "Research state is waiting for a completed Deep Dive.";
}

function buildDelta(input: {
  ticker: string;
  previous?: UserResearchNameState;
  report?: ReportRecord;
  snapshot?: ThesisMonitorSnapshotRecord;
  calendarEvents: CalendarEventRecord[];
  newCanonicalEvents: number;
  latestPulse?: MarketPulseReport;
  omissions: UserResearchOmission[];
  evidenceRefs: UserResearchEvidenceRef[];
}): UserResearchDailyDelta {
  if (!input.report) {
    return {
      state: "needs_deep_dive_refresh",
      title: "Deep Dive needed",
      body: `${input.ticker} does not yet have a completed Deep Dive in the user's research state.`,
      evidence_refs: input.evidenceRefs
    };
  }
  if (!input.previous) {
    return {
      state: "unchanged",
      title: "Baseline established",
      body: `${input.ticker} is now tracked in the user's research state.`,
      evidence_refs: input.evidenceRefs
    };
  }
  if (
    input.snapshot &&
    input.previous.freshness_state &&
    input.snapshot.freshnessState !== input.previous.freshness_state
  ) {
    return {
      state: "thesis_freshness_changed",
      title: "Thesis freshness changed",
      body: `${input.ticker} moved from ${input.previous.freshness_state} to ${input.snapshot.freshnessState}.`,
      evidence_refs: input.evidenceRefs
    };
  }
  if (input.calendarEvents.length > 0 || input.newCanonicalEvents > 0) {
    return {
      state: "new_event",
      title: "New event context",
      body: `${input.ticker} has new calendar or canonical event context to review.`,
      evidence_refs: input.evidenceRefs
    };
  }
  if (input.latestPulse?.macro_news && input.latestPulse.macro_news.state !== "calm") {
    return {
      state: "macro_context_changed",
      title: "Macro context changed",
      body: `${input.ticker} should be read against the current macro-news backdrop.`,
      evidence_refs: input.evidenceRefs
    };
  }
  if (input.omissions.length !== input.previous.omissions.length) {
    return {
      state: "coverage_changed",
      title: "Coverage changed",
      body: `${input.ticker} has a changed research coverage state.`,
      evidence_refs: input.evidenceRefs
    };
  }
  return {
    state: "unchanged",
    title: "No material research-state change",
    body: `${input.ticker} has no material user-research-state change for this cycle.`,
    evidence_refs: input.evidenceRefs
  };
}

async function latestReadableReport(
  artifactStore: ArtifactStore,
  reports: ReportRecord[],
  ticker: string
): Promise<{ metadata?: ReportRecord; report?: AnalysisReport; omission?: UserResearchOmission }> {
  const metadata = reports.find((entry) => entry.ticker === ticker);
  if (!metadata) {
    return {
      omission: {
        family: "deep_dive",
        code: "deep_dive_missing",
        ticker,
        reason: "No completed Deep Dive exists yet for this name."
      }
    };
  }
  try {
    const report = await artifactStore.readReport(metadata.artifactKey);
    if (isAnalysisReport(report)) {
      return { metadata, report };
    }
    return {
      metadata,
      omission: {
        family: "deep_dive",
        code: "deep_dive_unreadable",
        ticker,
        reason: "Latest Deep Dive artifact is not readable as a Deep Dive report."
      }
    };
  } catch {
    return {
      metadata,
      omission: {
        family: "deep_dive",
        code: "deep_dive_artifact_unavailable",
        ticker,
        reason: "Latest Deep Dive artifact could not be loaded."
      }
    };
  }
}

async function latestPulse(
  store: ProductStore,
  artifactStore: ArtifactStore,
  asOf: string
): Promise<{ metadata?: ReportRecord; report?: MarketPulseReport; omission?: UserResearchOmission }> {
  const metadata = await store.getReportByTypeAndDate("market_pulse", asOf);
  if (!metadata) {
    return {
      omission: {
        family: "pulse",
        code: "pulse_missing",
        reason: "No Market Pulse report exists for the requested as-of date."
      }
    };
  }
  try {
    const report = await artifactStore.readReport(metadata.artifactKey);
    if (isMarketPulseReport(report)) {
      return { metadata, report };
    }
    return {
      metadata,
      omission: {
        family: "pulse",
        code: "pulse_unreadable",
        reason: "Latest Market Pulse artifact is not readable."
      }
    };
  } catch {
    return {
      metadata,
      omission: {
        family: "pulse",
        code: "pulse_artifact_unavailable",
        reason: "Latest Market Pulse artifact could not be loaded."
      }
    };
  }
}

export async function refreshUserResearchStates(
  options: RefreshUserResearchStateOptions
): Promise<RefreshUserResearchStateResult> {
  const filterUserIds = options.userIds
    ? new Set(options.userIds.map((userId) => userId.trim()).filter(Boolean))
    : undefined;
  const generatedAt = new Date().toISOString();
  const allUsers = await options.store.listUsersWithResearchUniverse();
  const pulse = await latestPulse(options.store, options.artifactStore, options.asOf);
  const states: UserResearchState[] = [];
  let names = 0;
  let omissions = 0;
  let created = 0;
  let updated = 0;

  for (const user of allUsers) {
    if (filterUserIds && !filterUserIds.has(user.userId)) {
      continue;
    }

    const holdings = await options.store.listUserResearchHoldings(user.userId);
    const holdingsByTicker = new Map(holdings.map((holding) => [holding.ticker, holding]));
    const universe = [...new Set([...user.watchlistTickers, ...user.holdingTickers].map(normalizedTicker))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    if (universe.length === 0) {
      continue;
    }

    const prior = await options.store.getLatestUserResearchState({
      userId: user.userId,
      asOf: addDaysToIsoDate(options.asOf, -1)
    });
    const reports = (await options.store.listReportsByUser(user.userId))
      .filter((report) => report.type === "deep_dive")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const snapshots = await options.store.listThesisMonitorSnapshotsByUser(user.userId);
    const snapshotsByTicker = new Map(snapshots.map((snapshot) => [snapshot.ticker, snapshot]));
    const priorNames = new Map((prior?.state.names ?? []).map((name) => [name.ticker, name]));
    const stateOmissions: UserResearchOmission[] = [];
    if (pulse.omission) {
      stateOmissions.push(pulse.omission);
    }
    const stateEvidence: UserResearchEvidenceRef[] = pulse.metadata ? [reportEvidence(pulse.metadata)] : [];
    const nameStates: UserResearchNameState[] = [];

    for (const ticker of universe) {
      const holding = holdingsByTicker.get(ticker);
      const snapshot = snapshotsByTicker.get(ticker);
      const latest = await latestReadableReport(options.artifactStore, reports, ticker);
      const previous = priorNames.get(ticker);
      const calendarEvents = await options.store.listUpcomingCalendarEventsByTickers({
        tickers: [ticker],
        fromDate: options.asOf,
        toDate: addDaysToIsoDate(options.asOf, 7),
        eventType: "earnings"
      });
      const canonicalEvents = (await options.store.listCanonicalEvents({
        subjectType: "ticker",
        subjectId: ticker,
        limit: 25
      })).filter((event) => event.occurred_at.slice(0, 10) <= options.asOf);
      const priorCanonicalEventIds = new Set(
        (previous?.evidence_refs ?? [])
          .filter((ref) => ref.kind === "canonical_event")
          .map((ref) => ref.ref_id)
      );
      const newCanonicalEvents = previous
        ? canonicalEvents.filter((event) => !priorCanonicalEventIds.has(event.id)).length
        : 0;
      const tickerOmissions: UserResearchOmission[] = [];
      if (latest.omission) {
        tickerOmissions.push(latest.omission);
      }
      if (!snapshot) {
        tickerOmissions.push({
          family: "monitor_snapshot",
          code: "monitor_snapshot_missing",
          ticker,
          reason: "No thesis monitor snapshot exists yet for this name."
        });
      }
      const evidenceRefs: UserResearchEvidenceRef[] = [
        ...(latest.metadata ? [reportEvidence(latest.metadata, ticker)] : []),
        ...(snapshot ? [monitorEvidence(snapshot)] : []),
        ...(holding ? [{
          kind: "holding" as const,
          ref_id: `${user.userId}:${ticker}`,
          label: holding.label ?? "Manual holding",
          ticker,
          captured_at: holding.updatedAt
        }] : []),
        ...canonicalEvents.slice(0, 3).map((event) => ({
          kind: "canonical_event" as const,
          ref_id: event.id,
          label: event.title,
          ticker,
          captured_at: event.retrieved_at
        }))
      ];
      const dailyDelta = buildDelta({
        ticker,
        previous,
        report: latest.metadata,
        snapshot,
        calendarEvents,
        newCanonicalEvents,
        latestPulse: pulse.report,
        omissions: tickerOmissions,
        evidenceRefs
      });
      const summary = thesisSummary(latest.report, snapshot);
      nameStates.push({
        ticker,
        ...(latest.report?.issuer?.name ? { company_name: latest.report.issuer.name } : {}),
        in_watchlist: user.watchlistTickers.includes(ticker),
        ...(holding ? { holding: holdingToContract(holding) } : {}),
        ...(snapshot?.state ? { monitor_state: snapshot.state } : {}),
        ...(snapshot?.freshnessState ? { freshness_state: snapshot.freshnessState } : {}),
        ...(latest.metadata?.id ? { latest_report_id: latest.metadata.id } : {}),
        ...(latest.report?.generated_at ? { latest_report_generated_at: latest.report.generated_at } : {}),
        ...(pulse.metadata?.id ? { latest_pulse_id: pulse.metadata.id } : {}),
        daily_delta: dailyDelta,
        summary,
        what_changed: dailyDelta.body,
        why_it_matters: latest.metadata
          ? `${ticker} should be read through the latest Deep Dive and current macro/Pulse context.`
          : `${ticker} needs a completed Deep Dive before Thesis can give a stronger user-specific read.`,
        what_to_watch: calendarEvents.length > 0
          ? `${ticker} has an earnings event inside the next seven days.`
          : `Watch for new official filings, earnings calendar changes, or thesis freshness movement for ${ticker}.`,
        evidence_refs: evidenceRefs,
        omissions: tickerOmissions
      });
      stateOmissions.push(...tickerOmissions);
    }

    const state: UserResearchState = {
      state_id: randomUUID(),
      user_id: user.userId,
      as_of: options.asOf,
      generated_at: generatedAt,
      ...(prior?.stateId ? { prior_state_id: prior.stateId } : {}),
      watchlist_tickers: [...user.watchlistTickers],
      holdings: holdings.map(holdingToContract),
      names: nameStates,
      omissions: stateOmissions,
      evidence_refs: stateEvidence
    };
    names += nameStates.length;
    omissions += stateOmissions.length;
    if (!options.dryRun) {
      const existing = await options.store.getLatestUserResearchState({
        userId: user.userId,
        asOf: options.asOf
      });
      const record: UserResearchStateRecord = {
        stateId: state.state_id,
        userId: user.userId,
        asOf: options.asOf,
        generatedAt,
        state
      };
      await options.store.upsertUserResearchState(record);
      if (existing?.asOf === options.asOf) {
        updated += 1;
      } else {
        created += 1;
      }
    }
    states.push(state);
  }

  return {
    users: states.length,
    names,
    created,
    updated,
    omissions,
    dry_run: Boolean(options.dryRun),
    states
  };
}
