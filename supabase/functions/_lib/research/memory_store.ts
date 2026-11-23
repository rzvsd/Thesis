// In-memory ResearchStore for tests. Follows InMemoryStore in apps/product-api/src/store.ts for the
// methods the research and alerts routes use (same filters and ordering).
import type { FearGreedSnapshot } from "./macro_stress.ts";
import type { AuditEventInput, EnqueueFeedbackInput, ResearchStore } from "./store.ts";
import type {
  AlertFeedbackState,
  AlertLedgerCategory,
  AlertLedgerRecord,
  CalendarEventRecord,
  CallArtifact,
  ConvictionInsightCardRecord,
  ConvictionJournalEntryRecord,
  NameRelationshipRecord,
  NameRelationshipState,
  NotificationType,
  OppositeCaseReportRecord,
  ReportRecord,
  ScenarioStressImpactRecord,
  ScenarioStressRuleSuggestionRecord,
  ScenarioStressRunRecord,
  ScenarioStressTemplateId,
  ScenarioStressTemplateRecord,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  WarRoomRecord,
  WarRoomTimelineEventRecord,
} from "./types.ts";

const clone = <T>(value: T): T => structuredClone(value);

export function defaultScenarioStressTemplates(nowIso: string): ScenarioStressTemplateRecord[] {
  const t = (
    templateId: ScenarioStressTemplateId,
    title: string,
    summary: string,
    hypothesis: string,
    displayOrder: number,
  ): ScenarioStressTemplateRecord => ({
    templateId,
    title,
    summary,
    hypothesis,
    displayOrder,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return [
    t(
      "rates_higher_for_longer",
      "Rates Stay Higher for Longer",
      "Stress-tests valuation durability if discount rates remain elevated.",
      "Higher discount rates can compress valuation multiples for duration-sensitive theses.",
      1,
    ),
    t(
      "recession_in_6m",
      "Recession in 6 Months",
      "Evaluates revenue and margin fragility under demand contraction.",
      "A broad slowdown can challenge cyclical demand assumptions across followed names.",
      2,
    ),
    t(
      "usd_up_10",
      "USD Strengthens 10%",
      "Assesses translation and competitiveness pressure from a stronger dollar.",
      "Foreign revenue translation pressure can weaken globally exposed thesis assumptions.",
      3,
    ),
    t(
      "ai_hype_burst",
      "AI Hype Cycle Bursts",
      "Examines downside if AI spending and sentiment reset sharply.",
      "AI-linked narratives can break quickly when adoption or monetization disappoints.",
      4,
    ),
    t(
      "oil_120_spike",
      "Oil Spikes to $120",
      "Measures cost and demand pressure from a rapid energy shock.",
      "Energy-sensitive cost structures can invalidate margin and demand assumptions.",
      5,
    ),
  ];
}

export class MemoryResearchStore implements ResearchStore {
  tiers = new Map<string, SubscriptionTier>();
  watchlists = new Map<string, string[]>();
  monitorSnapshots: ThesisMonitorSnapshotRecord[] = [];
  reports: ReportRecord[] = [];
  // "userId:reportId" pairs with a complete job.
  reportAccess = new Set<string>();
  journal: ConvictionJournalEntryRecord[] = [];
  insights: ConvictionInsightCardRecord[] = [];
  oppositeCases: OppositeCaseReportRecord[] = [];
  templates: ScenarioStressTemplateRecord[] = defaultScenarioStressTemplates("2026-01-01T00:00:00.000Z");
  runs: ScenarioStressRunRecord[] = [];
  impacts: ScenarioStressImpactRecord[] = [];
  suggestions: ScenarioStressRuleSuggestionRecord[] = [];
  alerts: AlertLedgerRecord[] = [];
  quietUntil = new Map<string, string>();
  feedback: UserFeedbackQueueRecord[] = [];
  fearGreed: FearGreedSnapshot[] = [];
  relationships: NameRelationshipRecord[] = [];
  calendarEvents: CalendarEventRecord[] = [];
  callArtifacts: CallArtifact[] = [];
  warRooms: WarRoomRecord[] = [];
  warRoomEvents: WarRoomTimelineEventRecord[] = [];
  audit: AuditEventInput[] = [];

  getSubscriptionTier(userId: string): Promise<SubscriptionTier> {
    return Promise.resolve(this.tiers.get(userId) ?? "FREE");
  }

  listWatchlistTickersByUser(userId: string): Promise<string[]> {
    return Promise.resolve([...(this.watchlists.get(userId) ?? [])].sort());
  }

  listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]> {
    return Promise.resolve(
      this.monitorSnapshots.filter((s) => s.userId === userId).sort((a, b) =>
        a.ticker.localeCompare(b.ticker)
      )
        .map(clone),
    );
  }

  getReportById(id: string): Promise<ReportRecord | undefined> {
    return Promise.resolve(clone(this.reports.find((r) => r.id === id)));
  }

  hasReportAccessForUser(userId: string, reportId: string): Promise<boolean> {
    return Promise.resolve(this.reportAccess.has(`${userId}:${reportId}`));
  }

  listReportsByUser(userId: string): Promise<ReportRecord[]> {
    return Promise.resolve(
      this.reports.filter((r) => this.reportAccess.has(`${userId}:${r.id}`))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone),
    );
  }

  listConvictionJournalEntriesByUser(
    input: { userId: string; ticker?: string; limit: number },
  ): Promise<ConvictionJournalEntryRecord[]> {
    const ticker = input.ticker?.trim().toUpperCase();
    return Promise.resolve(
      this.journal
        .filter((e) => e.userId === input.userId && (!ticker || e.ticker === ticker))
        .sort((a, b) => b.eventAt.localeCompare(a.eventAt) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, input.limit))
        .map(clone),
    );
  }

  upsertConvictionJournalEntry(input: ConvictionJournalEntryRecord): Promise<ConvictionJournalEntryRecord> {
    const i = this.journal.findIndex((e) =>
      e.userId === input.userId && e.eventType === input.eventType && e.sourceType === input.sourceType &&
      e.sourceId === input.sourceId
    );
    if (i >= 0) {
      const existing = this.journal[i];
      this.journal[i] = { ...clone(input), id: existing.id, createdAt: existing.createdAt };
      return Promise.resolve(clone(this.journal[i]));
    }
    this.journal.push(clone(input));
    return Promise.resolve(clone(input));
  }

  listConvictionInsightCardsByUser(
    input: { userId: string; limit: number },
  ): Promise<ConvictionInsightCardRecord[]> {
    return Promise.resolve(
      this.insights.filter((c) => c.userId === input.userId)
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .slice(0, Math.max(1, input.limit)).map(clone),
    );
  }

  getOppositeCaseReportBySource(
    input: { userId: string; sourceReportId: string },
  ): Promise<OppositeCaseReportRecord | undefined> {
    return Promise.resolve(
      clone(
        this.oppositeCases.find((c) =>
          c.userId === input.userId && c.sourceReportId === input.sourceReportId
        ),
      ),
    );
  }

  upsertOppositeCaseReport(input: OppositeCaseReportRecord): Promise<OppositeCaseReportRecord> {
    const i = this.oppositeCases.findIndex((c) =>
      c.userId === input.userId && c.sourceReportId === input.sourceReportId
    );
    if (i >= 0) {
      const existing = this.oppositeCases[i];
      this.oppositeCases[i] = { ...clone(input), id: existing.id, createdAt: existing.createdAt };
      return Promise.resolve(clone(this.oppositeCases[i]));
    }
    this.oppositeCases.push(clone(input));
    return Promise.resolve(clone(input));
  }

  listScenarioStressTemplates(
    input?: { includeInactive?: boolean; limit?: number },
  ): Promise<ScenarioStressTemplateRecord[]> {
    return Promise.resolve(
      this.templates.filter((t) => input?.includeInactive || t.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, Math.max(1, input?.limit ?? 50)).map(clone),
    );
  }

  getScenarioStressTemplate(id: ScenarioStressTemplateId): Promise<ScenarioStressTemplateRecord | undefined> {
    return Promise.resolve(clone(this.templates.find((t) => t.templateId === id)));
  }

  createScenarioStressRun(input: ScenarioStressRunRecord): Promise<ScenarioStressRunRecord> {
    this.runs.push(clone(input));
    return Promise.resolve(clone(input));
  }

  getScenarioStressRun(input: { id: string; userId: string }): Promise<ScenarioStressRunRecord | undefined> {
    return Promise.resolve(clone(this.runs.find((r) => r.id === input.id && r.userId === input.userId)));
  }

  createScenarioStressImpacts(input: ScenarioStressImpactRecord[]): Promise<ScenarioStressImpactRecord[]> {
    this.impacts.push(...input.map(clone));
    return Promise.resolve(input.map(clone));
  }

  private ownsRun(runId: string, userId: string): boolean {
    return this.runs.some((r) => r.id === runId && r.userId === userId);
  }

  listScenarioStressImpactsByRun(
    input: { scenarioRunId: string; userId: string },
  ): Promise<ScenarioStressImpactRecord[]> {
    if (!this.ownsRun(input.scenarioRunId, input.userId)) return Promise.resolve([]);
    return Promise.resolve(
      this.impacts.filter((i) => i.scenarioRunId === input.scenarioRunId)
        .sort((a, b) => b.stressScore - a.stressScore || a.ticker.localeCompare(b.ticker)).map(clone),
    );
  }

  createScenarioStressRuleSuggestions(
    input: ScenarioStressRuleSuggestionRecord[],
  ): Promise<ScenarioStressRuleSuggestionRecord[]> {
    this.suggestions.push(...input.map(clone));
    return Promise.resolve(input.map(clone));
  }

  listScenarioStressRuleSuggestionsByRun(
    input: { scenarioRunId: string; userId: string },
  ): Promise<ScenarioStressRuleSuggestionRecord[]> {
    if (!this.ownsRun(input.scenarioRunId, input.userId)) return Promise.resolve([]);
    return Promise.resolve(
      this.suggestions.filter((s) => s.scenarioRunId === input.scenarioRunId)
        .sort((a, b) => b.confidence - a.confidence || a.ticker.localeCompare(b.ticker)).map(clone),
    );
  }

  listAlertLedgerItemsByUser(
    input: { userId: string; limit: number; category?: AlertLedgerCategory },
  ): Promise<AlertLedgerRecord[]> {
    return Promise.resolve(
      this.alerts.filter((a) =>
        a.userId === input.userId && (!input.category || a.category === input.category)
      )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, input.limit)).map(clone),
    );
  }

  getAlertLedgerItem(input: { id: string; userId: string }): Promise<AlertLedgerRecord | undefined> {
    return Promise.resolve(clone(this.alerts.find((a) => a.id === input.id && a.userId === input.userId)));
  }

  setAlertLedgerFeedback(
    input: { id: string; userId: string; feedback: AlertFeedbackState; updatedAt: string },
  ): Promise<AlertLedgerRecord | undefined> {
    const alert = this.alerts.find((a) => a.id === input.id && a.userId === input.userId);
    if (!alert) return Promise.resolve(undefined);
    alert.feedbackState = input.feedback;
    alert.updatedAt = input.updatedAt;
    return Promise.resolve(clone(alert));
  }

  markAlertLedgerMuted(
    input: { id: string; userId: string; mutedAt: string },
  ): Promise<AlertLedgerRecord | undefined> {
    const alert = this.alerts.find((a) => a.id === input.id && a.userId === input.userId);
    if (!alert) return Promise.resolve(undefined);
    alert.mutedAt = input.mutedAt;
    alert.updatedAt = input.mutedAt;
    return Promise.resolve(clone(alert));
  }

  setNotificationQuietUntil(
    input: { userId: string; type: NotificationType; quietUntil: string; updatedAt: string },
  ): Promise<void> {
    this.quietUntil.set(`${input.userId}:${input.type}`, input.quietUntil);
    return Promise.resolve();
  }

  enqueueUserFeedback(input: EnqueueFeedbackInput): Promise<UserFeedbackQueueRecord> {
    const record: UserFeedbackQueueRecord = {
      ...clone(input),
      ticker: input.ticker?.trim().toUpperCase(),
      metadata: clone(input.metadata ?? {}),
    };
    this.feedback.push(record);
    return Promise.resolve(clone(record));
  }

  getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined> {
    const sorted = [...this.fearGreed].sort((a, b) => b.market_date.localeCompare(a.market_date));
    return Promise.resolve(clone(sorted[0]));
  }

  listFearGreedHistory(days: number): Promise<FearGreedSnapshot[]> {
    const latest = [...this.fearGreed].sort((a, b) => b.market_date.localeCompare(a.market_date))
      .slice(0, Math.max(1, days));
    return Promise.resolve(latest.sort((a, b) => a.market_date.localeCompare(b.market_date)).map(clone));
  }

  listNameRelationshipsByUser(input: {
    userId: string;
    sourceTicker?: string;
    targetTicker?: string;
    states?: NameRelationshipState[];
    minConfidence?: number;
    limit: number;
  }): Promise<NameRelationshipRecord[]> {
    const source = input.sourceTicker?.trim().toUpperCase();
    const target = input.targetTicker?.trim().toUpperCase();
    const minConfidence = Math.max(0, Math.min(1, input.minConfidence ?? 0));
    return Promise.resolve(
      this.relationships
        .filter((r) =>
          r.userId === input.userId && (!source || r.sourceTicker === source) &&
          (!target || r.targetTicker === target) &&
          (!input.states || input.states.length === 0 || input.states.includes(r.state)) &&
          r.confidence >= minConfidence
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, Math.max(1, input.limit)).map(clone),
    );
  }

  listUpcomingCalendarEventsByTickers(
    input: { tickers: string[]; fromDate: string; toDate: string; eventType?: string },
  ): Promise<CalendarEventRecord[]> {
    const tickers = new Set(input.tickers.map((t) => t.trim().toUpperCase()).filter(Boolean));
    return Promise.resolve(
      this.calendarEvents
        .filter((e) =>
          tickers.has(e.ticker) && e.eventDate >= input.fromDate && e.eventDate <= input.toDate &&
          (!input.eventType || e.eventType === input.eventType)
        )
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.ticker.localeCompare(b.ticker)).map(
          clone,
        ),
    );
  }

  listCallArtifacts(input: { ticker?: string; eventId?: string; limit: number }): Promise<CallArtifact[]> {
    const ticker = input.ticker?.trim().toUpperCase();
    return Promise.resolve(
      this.callArtifacts
        .filter((a) => (!ticker || a.ticker === ticker) && (!input.eventId || a.event_id === input.eventId))
        .sort((a, b) => b.retrieved_at.localeCompare(a.retrieved_at))
        .slice(0, Math.max(1, input.limit)).map(clone),
    );
  }

  getWarRoom(input: { id: string; userId: string }): Promise<WarRoomRecord | undefined> {
    return Promise.resolve(
      clone(this.warRooms.find((r) => r.warRoomId === input.id && r.userId === input.userId)),
    );
  }

  listWarRoomTimelineEvents(
    input: { warRoomId: string; limit: number },
  ): Promise<WarRoomTimelineEventRecord[]> {
    return Promise.resolve(
      this.warRoomEvents.filter((e) => e.warRoomId === input.warRoomId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, input.limit)).reverse().map(clone),
    );
  }

  appendAuditEvent(input: AuditEventInput): Promise<void> {
    this.audit.push(clone(input));
    return Promise.resolve();
  }
}
