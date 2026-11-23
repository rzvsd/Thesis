// POST /internal/research-state/refresh. Copied from apps/product-api/src/research-state.ts.
// Body: { as_of?, user_ids?, dry_run?, limit?, cursor? }. A user_ids list limits the run to those users
// (empty means nobody), as before. Paged by user.
// Retry safe: one row per (user, as_of) is upserted; a rerun keeps the row's state_id.
// Report bodies come through the report reader; while it is disabled each name with a Deep Dive gets the
// old "deep_dive_artifact_unavailable" omission and the summary falls back to the monitor snapshot.
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { extractThesisStatement, isAnalysisReport } from "./journal.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type {
  AnalysisReportLike,
  CalendarEventRecord,
  MarketPulseLike,
  ReportMeta,
  ThesisMonitorSnapshotRecord,
  UserResearchDailyDelta,
  UserResearchEvidenceRef,
  UserResearchHolding,
  UserResearchHoldingRecord,
  UserResearchNameState,
  UserResearchOmission,
  UserResearchState,
} from "./types.ts";
import {
  addDaysToIsoDate,
  createId,
  cursorValue,
  dateInTimeZone,
  isPlainRecord,
  nextCursor,
  normalizeDateInput,
  pageLimit,
  stringList,
} from "./util.ts";

export const researchStatePageSize = 100;

function reportEvidence(report: ReportMeta, ticker?: string): UserResearchEvidenceRef {
  return {
    kind: report.type === "market_pulse" ? "pulse" : "report",
    ref_id: report.id,
    label: report.type === "market_pulse" ? "Market Pulse" : "Deep Dive",
    ticker,
    captured_at: report.createdAt,
  };
}

function monitorEvidence(s: ThesisMonitorSnapshotRecord): UserResearchEvidenceRef {
  return {
    kind: "monitor_snapshot",
    ref_id: `${s.userId}:${s.ticker}`,
    label: s.freshnessState,
    ticker: s.ticker,
    captured_at: s.updatedAt,
  };
}

function holdingView(h: UserResearchHoldingRecord): UserResearchHolding {
  return {
    ticker: h.ticker,
    ...(h.quantity !== undefined ? { quantity: h.quantity } : {}),
    ...(h.costBasis !== undefined ? { cost_basis: h.costBasis } : {}),
    ...(h.label ? { label: h.label } : {}),
    ...(h.notes ? { notes: h.notes } : {}),
    updated_at: h.updatedAt,
  };
}

function thesisSummary(
  report: AnalysisReportLike | undefined,
  snapshot: ThesisMonitorSnapshotRecord | undefined,
) {
  const statement = report ? extractThesisStatement(report) : undefined;
  if (statement) return statement;
  if (snapshot?.reason.trim()) return snapshot.reason.trim();
  return "Research state is waiting for a completed Deep Dive.";
}

function buildDelta(input: {
  ticker: string;
  previous?: UserResearchNameState;
  report?: ReportMeta;
  snapshot?: ThesisMonitorSnapshotRecord;
  calendarEvents: CalendarEventRecord[];
  newCanonicalEvents: number;
  pulse?: MarketPulseLike;
  omissions: UserResearchOmission[];
  evidenceRefs: UserResearchEvidenceRef[];
}): UserResearchDailyDelta {
  const d = (state: string, title: string, body: string) => ({
    state,
    title,
    body,
    evidence_refs: input.evidenceRefs,
  });
  const t = input.ticker;
  if (!input.report) {
    return d(
      "needs_deep_dive_refresh",
      "Deep Dive needed",
      `${t} does not yet have a completed Deep Dive in the user's research state.`,
    );
  }
  if (!input.previous) {
    return d("unchanged", "Baseline established", `${t} is now tracked in the user's research state.`);
  }
  if (
    input.snapshot && input.previous.freshness_state &&
    input.snapshot.freshnessState !== input.previous.freshness_state
  ) {
    return d(
      "thesis_freshness_changed",
      "Thesis freshness changed",
      `${t} moved from ${input.previous.freshness_state} to ${input.snapshot.freshnessState}.`,
    );
  }
  if (input.calendarEvents.length > 0 || input.newCanonicalEvents > 0) {
    return d("new_event", "New event context", `${t} has new calendar or canonical event context to review.`);
  }
  if (input.pulse?.macro_news && input.pulse.macro_news.state !== "calm") {
    return d(
      "macro_context_changed",
      "Macro context changed",
      `${t} should be read against the current macro-news backdrop.`,
    );
  }
  if (input.omissions.length !== input.previous.omissions.length) {
    return d("coverage_changed", "Coverage changed", `${t} has a changed research coverage state.`);
  }
  return d(
    "unchanged",
    "No material research-state change",
    `${t} has no material user-research-state change for this cycle.`,
  );
}

async function readBody(deps: EvaluatorDeps, key: string): Promise<unknown> {
  if (!deps.reports.enabled) throw new Error("reader disabled");
  return await deps.reports.read(key);
}

async function latestReport(deps: EvaluatorDeps, reports: ReportMeta[], ticker: string) {
  const metadata = reports.find((r) => r.ticker?.trim().toUpperCase() === ticker);
  if (!metadata) {
    return {
      omission: {
        family: "deep_dive",
        code: "deep_dive_missing",
        ticker,
        reason: "No completed Deep Dive exists yet for this name.",
      } as UserResearchOmission,
    };
  }
  try {
    const report = await readBody(deps, metadata.artifactKey);
    if (isAnalysisReport(report) && report.type === "deep_dive") return { metadata, report };
    return {
      metadata,
      omission: {
        family: "deep_dive",
        code: "deep_dive_unreadable",
        ticker,
        reason: "Latest Deep Dive artifact is not readable as a Deep Dive report.",
      },
    };
  } catch {
    return {
      metadata,
      omission: {
        family: "deep_dive",
        code: "deep_dive_artifact_unavailable",
        ticker,
        reason: "Latest Deep Dive artifact could not be loaded.",
      },
    };
  }
}

async function latestPulse(
  deps: EvaluatorDeps,
  asOf: string,
): Promise<{ metadata?: ReportMeta; report?: MarketPulseLike; omission?: UserResearchOmission }> {
  const metadata = await deps.store.getPulseReportByDate(asOf);
  if (!metadata) {
    return {
      omission: {
        family: "pulse",
        code: "pulse_missing",
        reason: "No Market Pulse report exists for the requested as-of date.",
      },
    };
  }
  try {
    const report = await readBody(deps, metadata.artifactKey);
    if (isPlainRecord(report) && typeof report.report_id === "string" && "sections" in report) {
      return { metadata, report: report as unknown as MarketPulseLike };
    }
    return {
      metadata,
      omission: {
        family: "pulse",
        code: "pulse_unreadable",
        reason: "Latest Market Pulse artifact is not readable.",
      },
    };
  } catch {
    return {
      metadata,
      omission: {
        family: "pulse",
        code: "pulse_artifact_unavailable",
        reason: "Latest Market Pulse artifact could not be loaded.",
      },
    };
  }
}

export async function refreshResearchState(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOf = normalizeDateInput(body.as_of ?? today) ?? today;
  const dryRun = body.dry_run === true;
  const filter = Array.isArray(body.user_ids) ? new Set(stringList(body.user_ids)) : undefined;
  const limit = pageLimit(body.limit, researchStatePageSize);
  const page = await deps.store.listUsersWithResearchUniverse({
    afterUserId: cursorValue(body.cursor),
    limit,
  });
  const generatedAt = deps.now().toISOString();
  const pulse = await latestPulse(deps, asOf);
  const states: UserResearchState[] = [];
  let names = 0;
  let omissions = 0;
  let created = 0;
  let updated = 0;

  for (const user of page) {
    if (filter && !filter.has(user.userId)) continue;
    const holdings = await deps.store.listUserResearchHoldings(user.userId);
    const holdingsByTicker = new Map(holdings.map((h) => [h.ticker, h]));
    const universe = [
      ...new Set([...user.watchlistTickers, ...user.holdingTickers].map((t) => t.trim().toUpperCase())),
    ].filter(Boolean).sort();
    if (universe.length === 0) continue;

    const prior = await deps.store.getLatestUserResearchState({
      userId: user.userId,
      asOf: addDaysToIsoDate(asOf, -1),
    });
    const reports = (await deps.store.listDeepDiveReportsByUser(user.userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const snapshots = new Map(
      (await deps.store.listThesisMonitorSnapshotsByUser(user.userId)).map((s) => [s.ticker, s]),
    );
    const priorNames = new Map((prior?.state.names ?? []).map((n) => [n.ticker, n]));
    const stateOmissions: UserResearchOmission[] = pulse.omission ? [pulse.omission] : [];
    const nameStates: UserResearchNameState[] = [];

    for (const ticker of universe) {
      const holding = holdingsByTicker.get(ticker);
      const snapshot = snapshots.get(ticker);
      const latest = await latestReport(deps, reports, ticker);
      const previous = priorNames.get(ticker);
      const calendarEvents = await deps.store.listCalendarEvents({
        tickers: [ticker],
        fromDate: asOf,
        toDate: addDaysToIsoDate(asOf, 7),
        eventType: "earnings",
      });
      const canonical =
        (await deps.store.listCanonicalEvents({ subjectType: "ticker", subjectId: ticker, limit: 25 }))
          .filter((e) => e.occurred_at.slice(0, 10) <= asOf);
      const priorIds = new Set(
        (previous?.evidence_refs ?? []).filter((r) => r.kind === "canonical_event").map((r) => r.ref_id),
      );
      const newCanonicalEvents = previous ? canonical.filter((e) => !priorIds.has(e.id)).length : 0;
      const tickerOmissions: UserResearchOmission[] = latest.omission ? [latest.omission] : [];
      if (!snapshot) {
        tickerOmissions.push({
          family: "monitor_snapshot",
          code: "monitor_snapshot_missing",
          ticker,
          reason: "No thesis monitor snapshot exists yet for this name.",
        });
      }
      const evidenceRefs: UserResearchEvidenceRef[] = [
        ...(latest.metadata ? [reportEvidence(latest.metadata, ticker)] : []),
        ...(snapshot ? [monitorEvidence(snapshot)] : []),
        ...(holding
          ? [{
            kind: "holding",
            ref_id: `${user.userId}:${ticker}`,
            label: holding.label ?? "Manual holding",
            ticker,
            captured_at: holding.updatedAt,
          }]
          : []),
        ...canonical.slice(0, 3).map((e) => ({
          kind: "canonical_event",
          ref_id: e.id,
          label: e.title,
          ticker,
          captured_at: e.retrieved_at,
        })),
      ];
      const delta = buildDelta({
        ticker,
        previous,
        report: latest.metadata,
        snapshot,
        calendarEvents,
        newCanonicalEvents,
        pulse: pulse.report,
        omissions: tickerOmissions,
        evidenceRefs,
      });
      const report = "report" in latest ? latest.report : undefined;
      nameStates.push({
        ticker,
        ...(report?.issuer?.name ? { company_name: report.issuer.name } : {}),
        in_watchlist: user.watchlistTickers.includes(ticker),
        ...(holding ? { holding: holdingView(holding) } : {}),
        ...(snapshot?.state ? { monitor_state: snapshot.state } : {}),
        ...(snapshot?.freshnessState ? { freshness_state: snapshot.freshnessState } : {}),
        ...(latest.metadata?.id ? { latest_report_id: latest.metadata.id } : {}),
        ...(report?.generated_at ? { latest_report_generated_at: report.generated_at } : {}),
        ...(pulse.metadata?.id ? { latest_pulse_id: pulse.metadata.id } : {}),
        daily_delta: delta,
        summary: thesisSummary(report, snapshot),
        what_changed: delta.body,
        why_it_matters: latest.metadata
          ? `${ticker} should be read through the latest Deep Dive and current macro/Pulse context.`
          : `${ticker} needs a completed Deep Dive before Thesis can give a stronger user-specific read.`,
        what_to_watch: calendarEvents.length > 0
          ? `${ticker} has an earnings event inside the next seven days.`
          : `Watch for new official filings, earnings calendar changes, or thesis freshness movement for ${ticker}.`,
        evidence_refs: evidenceRefs,
        omissions: tickerOmissions,
      });
      stateOmissions.push(...tickerOmissions);
    }

    const existing = await deps.store.getLatestUserResearchState({ userId: user.userId, asOf });
    const sameDay = existing?.asOf === asOf ? existing : undefined;
    const state: UserResearchState = {
      state_id: sameDay?.stateId ?? createId(),
      user_id: user.userId,
      as_of: asOf,
      generated_at: generatedAt,
      ...(prior?.stateId ? { prior_state_id: prior.stateId } : {}),
      watchlist_tickers: [...user.watchlistTickers],
      holdings: holdings.map(holdingView),
      names: nameStates,
      omissions: stateOmissions,
      evidence_refs: pulse.metadata ? [reportEvidence(pulse.metadata)] : [],
    };
    names += nameStates.length;
    omissions += stateOmissions.length;
    if (!dryRun) {
      await deps.store.upsertUserResearchState({
        stateId: state.state_id,
        userId: user.userId,
        asOf,
        generatedAt,
        state,
      });
      if (sameDay) updated += 1;
      else created += 1;
    }
    states.push(state);
  }

  const counts = { users: states.length, names, created, updated, omissions, dry_run: dryRun };
  await appendAudit(deps.store, "research_state.refreshed", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOf,
    ...counts,
  });
  return ok({
    status: "ok",
    as_of: asOf,
    ...counts,
    ...(dryRun ? { states } : {}),
    next_cursor: nextCursor(page.map((u) => u.userId), limit),
  });
}
