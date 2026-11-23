// In-memory EffectsStore for unit tests. Records every write so tests can assert on order and content.
import type { ReportRecord } from "../../types.ts";
import type {
  AlertLedgerRecord,
  AuditEventRecord,
  ContrarianAlertAnchorRecord,
  ConvictionJournalEntryRecord,
  EffectsStore,
  EmailTarget,
  KillSwitchRuleRecord,
  NameRelationshipRecord,
  PushTarget,
  SupportedTickerRecord,
  ThesisMonitorSnapshotRecord,
} from "../types.ts";

export class FakeEffectsStore implements EffectsStore {
  calls: string[] = [];
  audits: AuditEventRecord[] = [];
  anchors: ContrarianAlertAnchorRecord[] = [];
  killSwitchRules: KillSwitchRuleRecord[] = [];
  relationships = new Map<string, NameRelationshipRecord>();
  snapshots = new Map<string, ThesisMonitorSnapshotRecord>();
  journal: ConvictionJournalEntryRecord[] = [];
  alerts: AlertLedgerRecord[] = [];
  invalidatedDevices: string[] = [];

  watchlists = new Map<string, string[]>();
  tiers = new Map<string, "FREE" | "PRO">();
  tickers = new Map<string, SupportedTickerRecord>();
  priorReport?: ReportRecord;
  pushTargets: PushTarget[] = [];
  emailTargets: EmailTarget[] = [];
  preferences = new Map<string, Array<{ type: string; enabled: boolean }>>();

  appendAuditEvent(input: AuditEventRecord): Promise<void> {
    this.calls.push(`audit:${input.eventType}`);
    this.audits.push(input);
    return Promise.resolve();
  }
  createContrarianAlertAnchor(input: ContrarianAlertAnchorRecord): Promise<void> {
    this.calls.push("anchor");
    this.anchors.push(input);
    return Promise.resolve();
  }
  deactivateActiveKillSwitchRulesByUserTicker(
    input: { userId: string; ticker: string; deactivatedAt: string },
  ): Promise<number> {
    this.calls.push("kill_switch.deactivate");
    let count = 0;
    for (const rule of this.killSwitchRules) {
      if (rule.userId === input.userId && rule.ticker === input.ticker && rule.state === "active") {
        rule.state = "inactive";
        rule.deactivatedAt = input.deactivatedAt;
        count += 1;
      }
    }
    return Promise.resolve(count);
  }
  createKillSwitchRule(input: KillSwitchRuleRecord): Promise<void> {
    this.calls.push("kill_switch.create");
    this.killSwitchRules.push({ ...input });
    return Promise.resolve();
  }
  upsertNameRelationship(input: NameRelationshipRecord): Promise<void> {
    this.calls.push("name_relationship");
    this.relationships.set(input.relationshipId, input);
    return Promise.resolve();
  }
  listWatchlistTickersByUser(userId: string): Promise<string[]> {
    this.calls.push("watchlist");
    return Promise.resolve(this.watchlists.get(userId) ?? []);
  }
  upsertThesisMonitorSnapshot(input: ThesisMonitorSnapshotRecord): Promise<ThesisMonitorSnapshotRecord> {
    this.calls.push("snapshot");
    this.snapshots.set(`${input.userId}|${input.ticker}`, input);
    return Promise.resolve(input);
  }
  listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]> {
    return Promise.resolve([...this.snapshots.values()].filter((entry) => entry.userId === userId));
  }
  getUserSubscriptionTier(userId: string): Promise<"FREE" | "PRO"> {
    return Promise.resolve(this.tiers.get(userId) ?? "FREE");
  }
  upsertConvictionJournalEntry(input: ConvictionJournalEntryRecord): Promise<{ id: string }> {
    this.calls.push("journal");
    this.journal.push(input);
    return Promise.resolve({ id: input.id });
  }
  getSupportedTicker(symbol: string): Promise<SupportedTickerRecord | undefined> {
    return Promise.resolve(this.tickers.get(symbol.trim().toUpperCase()));
  }
  findLatestComparableDeepDiveReport(): Promise<ReportRecord | undefined> {
    return Promise.resolve(this.priorReport);
  }
  listUsersWithWatchlist(): Promise<Array<{ userId: string; tickers: string[] }>> {
    return Promise.resolve([...this.watchlists.entries()].map(([userId, tickers]) => ({ userId, tickers })));
  }
  listUsersWithDeviceTokenByNotificationType(input: { userIds?: string[] }): Promise<PushTarget[]> {
    return Promise.resolve(
      this.pushTargets.filter((t) => !input.userIds || input.userIds.includes(t.userId)),
    );
  }
  listUsersWithEmailByNotificationType(input: { userIds?: string[] }): Promise<EmailTarget[]> {
    return Promise.resolve(
      this.emailTargets.filter((t) => !input.userIds || input.userIds.includes(t.userId)),
    );
  }
  getNotificationPreferences(userId: string): Promise<Array<{ type: string; enabled: boolean }>> {
    return Promise.resolve(this.preferences.get(userId) ?? []);
  }
  getAlertLedgerItem(input: { id: string; userId: string }): Promise<{ id: string } | undefined> {
    const found = this.alerts.find((alert) => alert.id === input.id && alert.userId === input.userId);
    return Promise.resolve(found ? { id: found.id } : undefined);
  }
  createAlertLedgerItem(input: AlertLedgerRecord): Promise<void> {
    this.alerts.push(input);
    return Promise.resolve();
  }
  invalidateUserDeviceByInstallation(input: { userId: string; installationId: string }): Promise<boolean> {
    this.invalidatedDevices.push(`${input.userId}:${input.installationId}`);
    return Promise.resolve(true);
  }
}
