// In-memory EvaluatorStore for tests. Logic follows InMemoryStore in apps/product-api/src/store.ts.
// Public arrays let tests seed rows directly.
import type { FearGreedSnapshot } from "../research/macro_stress.ts";
import type { EmailTarget } from "./push_port.ts";
import type { AuditEventRecord, EvaluatorStore, UserPage } from "./store.ts";
import type {
  AlertLedgerRecord,
  AudienceMember,
  CalendarEventRecord,
  CallArtifact,
  CanonicalEvent,
  ContrarianAnchorRecord,
  ConvictionInsightCardRecord,
  ConvictionJournalEntryRecord,
  FirstPartyContextItem,
  KillSwitchEvaluationRecord,
  KillSwitchOutcome,
  KillSwitchRuleRecord,
  KillSwitchSignalSource,
  MarketPriceRow,
  NameRelationshipRecord,
  NameRelationshipType,
  NewsItemRow,
  NewsSourceCheck,
  NewsSourceStatusRecord,
  NotificationType,
  ReportMeta,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  UserResearchHoldingRecord,
  UserResearchStateRecord,
  WarRoomRow,
  WarRoomTimelineEventRecord,
} from "./types.ts";
import { addDaysToIsoDate } from "./util.ts";

export interface MemoryUser {
  id: string;
  email: string;
  verified: boolean;
  tier?: SubscriptionTier;
  emailOptOut?: boolean;
}

export interface MemoryDevice {
  userId: string;
  installationId: string;
  deviceToken: string;
  invalidatedAt?: string;
}

export interface MemoryPreference {
  userId: string;
  type: NotificationType;
  enabled: boolean;
  quietUntil?: string;
}

const clone = <T>(v: T): T => structuredClone(v);

function page<T extends { userId: string }>(rows: T[], p?: UserPage): T[] {
  const sorted = [...rows].sort((a, b) => a.userId.localeCompare(b.userId));
  const after = p?.afterUserId;
  const filtered = after ? sorted.filter((r) => r.userId > after) : sorted;
  return p ? filtered.slice(0, p.limit) : filtered;
}

export class MemoryEvaluatorStore implements EvaluatorStore {
  users: MemoryUser[] = [];
  devices: MemoryDevice[] = [];
  preferences: MemoryPreference[] = [];
  watchlists: Array<{ userId: string; ticker: string }> = [];
  holdings: UserResearchHoldingRecord[] = [];
  coverage: string[] = [];
  canonicalEvents = new Map<string, CanonicalEvent>();
  contextItems = new Map<string, FirstPartyContextItem>();
  callArtifacts = new Map<string, CallArtifact>();
  fearGreed = new Map<string, FearGreedSnapshot>();
  calendar: CalendarEventRecord[] = [];
  relationships = new Map<string, NameRelationshipRecord>();
  alerts: AlertLedgerRecord[] = [];
  journal: ConvictionJournalEntryRecord[] = [];
  insightCards: ConvictionInsightCardRecord[] = [];
  snapshots: ThesisMonitorSnapshotRecord[] = [];
  rules: KillSwitchRuleRecord[] = [];
  evaluations: KillSwitchEvaluationRecord[] = [];
  anchors: ContrarianAnchorRecord[] = [];
  warRooms: WarRoomRow[] = [];
  timeline: WarRoomTimelineEventRecord[] = [];
  reports: Array<ReportMeta & { userId?: string }> = [];
  researchStates: UserResearchStateRecord[] = [];
  feedback: UserFeedbackQueueRecord[] = [];
  prices: MarketPriceRow[] = [];
  news: NewsItemRow[] = [];
  newsStatus: NewsSourceStatusRecord[] = [];
  audit: AuditEventRecord[] = [];

  // ---- Ingest ----

  upsertCanonicalEvents(events: CanonicalEvent[]) {
    for (const e of events) this.canonicalEvents.set(e.id, clone(e));
    return Promise.resolve({ upserted: events.length });
  }

  listCanonicalEvents(input: {
    subjectType?: CanonicalEvent["subject_type"];
    subjectId?: string;
    family?: CanonicalEvent["family"];
    limit: number;
  }) {
    const subject = input.subjectId?.trim().toUpperCase();
    const rows = [...this.canonicalEvents.values()]
      .filter((e) => !input.subjectType || e.subject_type === input.subjectType)
      .filter((e) => !subject || e.subject_id.toUpperCase() === subject)
      .filter((e) => !input.family || e.family === input.family)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, input.limit);
    return Promise.resolve(clone(rows));
  }

  upsertFirstPartyContextItems(items: FirstPartyContextItem[]) {
    for (const i of items) {
      this.contextItems.set(i.context_id, clone({ ...i, ticker: i.ticker.toUpperCase() }));
    }
    return Promise.resolve({ upserted: items.length });
  }

  upsertCallArtifacts(artifacts: CallArtifact[]) {
    for (const a of artifacts) {
      this.callArtifacts.set(a.artifact_id, clone({ ...a, ticker: a.ticker.toUpperCase() }));
    }
    return Promise.resolve({ upserted: artifacts.length });
  }

  private filterContext<T extends { ticker: string; event_id?: string; retrieved_at: string }>(
    rows: T[],
    input: { ticker?: string; eventId?: string; limit: number },
  ): T[] {
    const ticker = input.ticker?.trim().toUpperCase();
    return clone(
      rows.filter((r) => !ticker || r.ticker === ticker)
        .filter((r) => !input.eventId || r.event_id === input.eventId)
        .sort((a, b) => b.retrieved_at.localeCompare(a.retrieved_at))
        .slice(0, input.limit),
    );
  }

  listFirstPartyContextItems(input: { ticker?: string; eventId?: string; limit: number }) {
    return Promise.resolve(this.filterContext([...this.contextItems.values()], input));
  }

  listCallArtifacts(input: { ticker?: string; eventId?: string; limit: number }) {
    return Promise.resolve(this.filterContext([...this.callArtifacts.values()], input));
  }

  upsertFearGreedSnapshot(snapshot: FearGreedSnapshot) {
    const created = !this.fearGreed.has(snapshot.market_date);
    this.fearGreed.set(snapshot.market_date, clone(snapshot));
    return Promise.resolve({ snapshot: clone(snapshot), created });
  }

  getLatestFearGreedSnapshot() {
    const latest = [...this.fearGreed.values()].sort((a, b) => b.market_date.localeCompare(a.market_date))[0];
    return Promise.resolve(latest ? clone(latest) : undefined);
  }

  listTickerCoverageTickers(limit: number) {
    return Promise.resolve(this.coverage.slice(0, limit).map((t) => t.toUpperCase()));
  }

  upsertCalendarEvents(events: CalendarEventRecord[]) {
    for (const e of events) {
      const ticker = e.ticker.trim().toUpperCase();
      const idx = this.calendar.findIndex((c) =>
        c.ticker === ticker && c.eventType === e.eventType && c.eventDate === e.eventDate
      );
      if (idx >= 0) this.calendar[idx] = { ...clone(e), ticker, id: this.calendar[idx].id };
      else this.calendar.push({ ...clone(e), ticker });
    }
    return Promise.resolve({ upserted: events.length });
  }

  listCalendarEvents(input: {
    tickers: string[];
    fromDate: string;
    toDate: string;
    eventType?: CalendarEventRecord["eventType"];
  }) {
    const set = new Set(input.tickers.map((t) => t.trim().toUpperCase()));
    const rows = this.calendar
      .filter((e) => set.has(e.ticker) && e.eventDate >= input.fromDate && e.eventDate <= input.toDate)
      .filter((e) => !input.eventType || e.eventType === input.eventType)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.ticker.localeCompare(b.ticker));
    return Promise.resolve(clone(rows));
  }

  userExists(userId: string) {
    return Promise.resolve(this.users.some((u) => u.id === userId));
  }

  upsertNameRelationship(input: NameRelationshipRecord) {
    this.relationships.set(input.relationshipId, clone(input));
    return Promise.resolve();
  }

  listActiveNameRelationshipsBySource(input: {
    sourceTicker: string;
    relationshipTypes?: NameRelationshipType[];
    minConfidence: number;
  }) {
    const source = input.sourceTicker.trim().toUpperCase();
    const rows = [...this.relationships.values()]
      .filter((r) => r.state === "active" && r.sourceTicker === source && r.confidence >= input.minConfidence)
      .filter((r) => !input.relationshipTypes?.length || input.relationshipTypes.includes(r.relationshipType))
      .sort((a, b) => b.confidence - a.confidence || a.updatedAt.localeCompare(b.updatedAt));
    return Promise.resolve(clone(rows));
  }

  // ---- Users and audience ----

  private tierOf(userId: string): SubscriptionTier {
    return this.users.find((u) => u.id === userId)?.tier ?? "FREE";
  }

  private wants(userId: string, type: NotificationType): boolean {
    const pref = this.preferences.find((p) => p.userId === userId && p.type === type);
    if (!pref) return true;
    return pref.enabled && (!pref.quietUntil || Date.parse(pref.quietUntil) <= Date.now());
  }

  listAudience(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
    page?: UserPage;
  }): Promise<AudienceMember[]> {
    const ids = input.userIds ? new Set(input.userIds) : undefined;
    const members = this.users
      .filter((u) => !ids || ids.has(u.id))
      .filter((u) => this.wants(u.id, input.notificationType))
      .filter((u) => !input.tier || this.tierOf(u.id) === input.tier)
      .map((u) => ({
        userId: u.id,
        targets: this.devices
          .filter((d) => d.userId === u.id && !d.invalidatedAt && d.deviceToken.trim().length > 0)
          .map((d) => ({ userId: d.userId, installationId: d.installationId, deviceToken: d.deviceToken })),
      }));
    return Promise.resolve(page(members, input.page));
  }

  listEmailRecipients(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds: string[];
  }): Promise<EmailTarget[]> {
    const ids = new Set(input.userIds);
    return Promise.resolve(
      this.users
        .filter((u) => ids.has(u.id) && u.verified && !u.emailOptOut && u.email.trim().length > 0)
        .filter((u) => this.wants(u.id, input.notificationType))
        .filter((u) => !input.tier || this.tierOf(u.id) === input.tier)
        .map((u) => ({ userId: u.id, email: u.email.trim().toLowerCase() })),
    );
  }

  invalidateDevice(input: { userId: string; installationId: string; at: string; reason: string }) {
    for (const d of this.devices) {
      if (d.userId === input.userId && d.installationId === input.installationId && !d.invalidatedAt) {
        d.invalidatedAt = input.at;
      }
    }
    return Promise.resolve();
  }

  getUserTier(userId: string) {
    return Promise.resolve(this.tierOf(userId));
  }

  listWatchlistTickers(userId: string) {
    return Promise.resolve(
      this.watchlists.filter((w) => w.userId === userId).map((w) => w.ticker).sort(),
    );
  }

  listUsersWithWatchlist(p?: UserPage) {
    const byUser = new Map<string, string[]>();
    for (const w of this.watchlists) byUser.set(w.userId, [...(byUser.get(w.userId) ?? []), w.ticker]);
    const rows = [...byUser.entries()].map(([userId, tickers]) => ({ userId, tickers: tickers.sort() }));
    return Promise.resolve(page(rows, p));
  }

  listUsersWithResearchUniverse(p?: UserPage) {
    const ids = new Set([...this.watchlists.map((w) => w.userId), ...this.holdings.map((h) => h.userId)]);
    const rows = [...ids].map((userId) => ({
      userId,
      watchlistTickers: this.watchlists.filter((w) => w.userId === userId).map((w) => w.ticker).sort(),
      holdingTickers: this.holdings.filter((h) => h.userId === userId).map((h) => h.ticker).sort(),
    }));
    return Promise.resolve(page(rows, p));
  }

  // ---- Alerts and conviction ----

  insertAlertLedgerItem(input: AlertLedgerRecord) {
    if (this.alerts.some((a) => a.id === input.id)) return Promise.resolve(false);
    this.alerts.push(clone(input));
    return Promise.resolve(true);
  }

  alertExists(id: string) {
    return Promise.resolve(this.alerts.some((a) => a.id === id));
  }

  listAlertLedgerItemsByUser(input: { userId: string; limit: number }) {
    return Promise.resolve(clone(
      this.alerts.filter((a) => a.userId === input.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, input.limit),
    ));
  }

  upsertConvictionJournalEntry(input: ConvictionJournalEntryRecord) {
    const idx = this.journal.findIndex((j) =>
      j.userId === input.userId && j.eventType === input.eventType && j.sourceType === input.sourceType &&
      j.sourceId === input.sourceId
    );
    if (idx >= 0) this.journal[idx] = { ...clone(input), id: this.journal[idx].id };
    else this.journal.push(clone(input));
    return Promise.resolve();
  }

  listConvictionJournalEntriesByUser(input: { userId: string; limit: number }) {
    return Promise.resolve(clone(
      this.journal.filter((j) => j.userId === input.userId)
        .sort((a, b) => b.eventAt.localeCompare(a.eventAt))
        .slice(0, input.limit),
    ));
  }

  upsertConvictionInsightCard(input: ConvictionInsightCardRecord) {
    const idx = this.insightCards.findIndex((c) =>
      c.userId === input.userId && c.periodStart === input.periodStart && c.periodEnd === input.periodEnd &&
      c.insightType === input.insightType
    );
    if (idx >= 0) this.insightCards[idx] = { ...clone(input), id: this.insightCards[idx].id };
    else this.insightCards.push(clone(input));
    return Promise.resolve();
  }

  // ---- Monitor, kill switch, contrarian ----

  listThesisMonitorSnapshotsByUser(userId: string) {
    return Promise.resolve(clone(
      this.snapshots.filter((s) => s.userId === userId).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    ));
  }

  upsertThesisMonitorSnapshot(input: ThesisMonitorSnapshotRecord) {
    const row = clone({ ...input, ticker: input.ticker.toUpperCase() });
    const idx = this.snapshots.findIndex((s) => s.userId === row.userId && s.ticker === row.ticker);
    if (idx >= 0) this.snapshots[idx] = row;
    else this.snapshots.push(row);
    return Promise.resolve(clone(row));
  }

  listActiveKillSwitchRules(input: { asOfIso: string; userIds?: string[] }) {
    const ids = input.userIds ? new Set(input.userIds) : undefined;
    return Promise.resolve(clone(
      this.rules.filter((r) => r.state === "active" && (!ids || ids.has(r.userId)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ));
  }

  getKillSwitchEvaluation(
    input: { ruleId: string; signalSource: KillSwitchSignalSource; triggerKey: string },
  ) {
    const found = this.evaluations.find((e) =>
      e.ruleId === input.ruleId && e.signalSource === input.signalSource && e.triggerKey === input.triggerKey
    );
    return Promise.resolve(found ? clone(found) : undefined);
  }

  createKillSwitchEvaluation(input: KillSwitchEvaluationRecord) {
    const idx = this.evaluations.findIndex((e) =>
      e.ruleId === input.ruleId && e.signalSource === input.signalSource && e.triggerKey === input.triggerKey
    );
    if (idx >= 0) this.evaluations[idx] = { ...clone(input), id: this.evaluations[idx].id };
    else this.evaluations.push(clone(input));
    return Promise.resolve();
  }

  listKillSwitchEvaluations(input: { userId: string; outcomes?: KillSwitchOutcome[]; limit: number }) {
    return Promise.resolve(clone(
      this.evaluations.filter((e) => e.userId === input.userId)
        .filter((e) => !input.outcomes?.length || input.outcomes.includes(e.outcome))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, input.limit),
    ));
  }

  deactivateExpiredContrarianAnchors(asOfIso: string) {
    let count = 0;
    for (const a of this.anchors) {
      if (a.isActive && a.expiresAt < asOfIso) {
        a.isActive = false;
        count += 1;
      }
    }
    return Promise.resolve(count);
  }

  listActiveContrarianAnchors(input: { asOfIso: string; userIds?: string[] }) {
    const ids = input.userIds ? new Set(input.userIds) : undefined;
    return Promise.resolve(clone(
      this.anchors.filter((a) => a.isActive && a.expiresAt >= input.asOfIso && (!ids || ids.has(a.userId)))
        .sort((a, b) => a.anchoredAt.localeCompare(b.anchoredAt)),
    ));
  }

  deactivateContrarianAnchor(id: string) {
    for (const a of this.anchors) if (a.id === id) a.isActive = false;
    return Promise.resolve();
  }

  // ---- War rooms ----

  findWarRoomByEvent(input: { userId: string; ticker: string; earningsEventId: string }) {
    const w = this.warRooms.find((r) =>
      r.userId === input.userId && r.ticker === input.ticker.toUpperCase() &&
      r.earningsEventId === input.earningsEventId
    );
    return Promise.resolve(w ? clone(w) : undefined);
  }

  getWarRoom(input: { id: string; userId: string }) {
    const w = this.warRooms.find((r) => r.id === input.id && r.userId === input.userId);
    return Promise.resolve(w ? clone(w) : undefined);
  }

  createWarRoom(input: WarRoomRow) {
    if (
      this.warRooms.some((r) =>
        r.userId === input.userId && r.ticker === input.ticker && r.earningsEventId === input.earningsEventId
      )
    ) {
      return Promise.reject(new Error("duplicate war room"));
    }
    this.warRooms.push(clone(input));
    return Promise.resolve(clone(input));
  }

  updateWarRoom(input: WarRoomRow) {
    const idx = this.warRooms.findIndex((r) => r.id === input.id && r.userId === input.userId);
    if (idx < 0) return Promise.resolve(undefined);
    this.warRooms[idx] = clone(input);
    return Promise.resolve(clone(input));
  }

  listWarRoomsByUser(input: { userId: string; includeClosed: boolean; limit: number }) {
    return Promise.resolve(clone(
      this.warRooms.filter((r) => r.userId === input.userId && (input.includeClosed || r.state !== "closed"))
        .sort((a, b) => b.preparedAt.localeCompare(a.preparedAt))
        .slice(0, input.limit),
    ));
  }

  createWarRoomTimelineEvent(input: WarRoomTimelineEventRecord) {
    this.timeline.push(clone(input));
    return Promise.resolve();
  }

  // ---- Reports ----

  listDeepDiveReportsByUser(userId: string) {
    return Promise.resolve(clone(
      this.reports.filter((r) => r.userId === userId && r.type === "deep_dive")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ));
  }

  getReportMeta(reportId: string) {
    const r = this.reports.find((x) => x.id === reportId);
    return Promise.resolve(r ? clone(r) : undefined);
  }

  getPulseReportByDate(date: string) {
    const r = this.reports.filter((x) => x.type === "market_pulse" && x.createdAt.slice(0, 10) === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return Promise.resolve(r ? clone(r) : undefined);
  }

  // ---- Research state ----

  listUserResearchHoldings(userId: string) {
    return Promise.resolve(clone(this.holdings.filter((h) => h.userId === userId)));
  }

  getLatestUserResearchState(input: { userId: string; asOf?: string }) {
    const r =
      this.researchStates.filter((s) => s.userId === input.userId && (!input.asOf || s.asOf <= input.asOf))
        .sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
    return Promise.resolve(r ? clone(r) : undefined);
  }

  upsertUserResearchState(input: UserResearchStateRecord) {
    const idx = this.researchStates.findIndex((s) => s.userId === input.userId && s.asOf === input.asOf);
    if (idx >= 0) this.researchStates[idx] = clone(input);
    else this.researchStates.push(clone(input));
    return Promise.resolve();
  }

  // ---- Feedback ----

  listUserFeedbackQueue(input: {
    limit: number;
    feedbackType?: "report" | "subscription";
    triageStatus?: string;
    userTier?: SubscriptionTier;
    sourceSurface?: string;
  }) {
    return Promise.resolve(clone(
      this.feedback
        .filter((f) => !input.feedbackType || f.feedbackType === input.feedbackType)
        .filter((f) => !input.triageStatus || f.triageStatus === input.triageStatus)
        .filter((f) => !input.userTier || f.userTier === input.userTier)
        .filter((f) => !input.sourceSurface || f.sourceSurface === input.sourceSurface)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, input.limit),
    ));
  }

  // ---- Prices ----

  upsertMarketPrices(rows: MarketPriceRow[]) {
    for (const r of rows) {
      const idx = this.prices.findIndex((p) => p.ticker === r.ticker && p.marketDate === r.marketDate);
      if (idx >= 0) this.prices[idx] = clone(r);
      else this.prices.push(clone(r));
    }
    return Promise.resolve(rows.length);
  }

  latestClosePrices(input: { tickers: string[]; asOfDate: string; maxAgeDays: number }) {
    const out = new Map<string, number>();
    const oldest = addDaysToIsoDate(input.asOfDate, -input.maxAgeDays);
    for (const ticker of input.tickers.map((t) => t.toUpperCase())) {
      const latest = this.prices
        .filter((p) => p.ticker === ticker && p.marketDate <= input.asOfDate && p.marketDate >= oldest)
        .sort((a, b) => b.marketDate.localeCompare(a.marketDate))[0];
      if (latest) out.set(ticker, latest.close);
    }
    return Promise.resolve(out);
  }

  listPriceTickers(limit: number) {
    const set = new Set<string>([
      ...this.rules.filter((r) => r.state === "active" && r.signalType === "price_move_pct").map((r) =>
        r.ticker
      ),
      ...this.anchors.filter((a) => a.isActive).map((a) => a.ticker),
      ...this.watchlists.map((w) => w.ticker),
    ].map((t) => t.toUpperCase()));
    return Promise.resolve([...set].sort().slice(0, limit));
  }

  // ---- News ----

  upsertNewsItems(rows: NewsItemRow[]) {
    for (const r of rows) {
      const idx = this.news.findIndex((n) => n.articleId === r.articleId);
      if (idx >= 0) {
        // Like the SQL: the source and rights of a stored link stay; title, date, tickers and seenAt refresh.
        const kept = this.news[idx];
        this.news[idx] = {
          ...clone(r),
          sourceKey: kept.sourceKey,
          sourceName: kept.sourceName,
          rights: kept.rights,
        };
      } else this.news.push(clone(r));
    }
    return Promise.resolve(rows.length);
  }

  listNewsItems(input: { since: string; until: string; limit: number }) {
    const since = Date.parse(input.since);
    const until = Date.parse(input.until);
    return Promise.resolve(clone(
      this.news
        .filter((n) => Date.parse(n.publishedAt) >= since && Date.parse(n.publishedAt) <= until)
        .sort((a, b) =>
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.articleId.localeCompare(b.articleId)
        )
        .slice(0, Math.max(1, input.limit)),
    ));
  }

  recordNewsSourceChecks(rows: NewsSourceCheck[]) {
    for (const r of rows) {
      const old = this.newsStatus.find((s) => s.sourceKey === r.sourceKey);
      const next: NewsSourceStatusRecord = {
        sourceKey: r.sourceKey,
        lastCheckedAt: r.checkedAt,
        lastOkAt: r.ok ? r.checkedAt : old?.lastOkAt,
        lastErrorCode: r.errorCode,
        lastArticleCount: r.articleCount,
        newestItemAt: r.newestItemAt ?? old?.newestItemAt,
        consecutiveFailures: r.ok ? 0 : (old?.consecutiveFailures ?? 0) + 1,
      };
      if (old) Object.assign(old, next);
      else this.newsStatus.push(next);
    }
    return Promise.resolve();
  }

  listNewsSourceStatus() {
    return Promise.resolve(
      clone([...this.newsStatus].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))),
    );
  }

  // ---- Audit ----

  appendAuditEvent(input: AuditEventRecord) {
    this.audit.push(clone(input));
    return Promise.resolve();
  }
}
