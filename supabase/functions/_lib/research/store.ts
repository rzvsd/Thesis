// Data access for the research and alerts features.
// The SQL is copied unchanged from PostgresStore in apps/product-api/src/store.ts and runs with
// sql.unsafe(text, params) in schema "app". Handlers only see the ResearchStore interface, so tests
// can use the in-memory fake in memory_store.ts.
import type { Sql } from "../../_shared/db.ts";
import type { FearGreedSnapshot } from "./macro_stress.ts";
import {
  mapAlertLedgerRecord,
  mapCalendarEvent,
  mapCallArtifact,
  mapConvictionInsightCardRecord,
  mapConvictionJournalEntryRecord,
  mapFearGreedSnapshot,
  mapNameRelationship,
  mapOppositeCaseReportRecord,
  mapReport,
  mapScenarioStressImpactRecord,
  mapScenarioStressRuleSuggestionRecord,
  mapScenarioStressRunRecord,
  mapScenarioStressTemplateRecord,
  mapSubscriptionTier,
  mapThesisMonitorSnapshot,
  mapUserFeedbackQueueRecord,
  mapWarRoomRecord,
  mapWarRoomTimelineEvent,
  type Row,
} from "./rows.ts";
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

export interface AuditEventInput {
  id: string;
  userId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type EnqueueFeedbackInput = Omit<UserFeedbackQueueRecord, "metadata"> & {
  metadata?: Record<string, unknown>;
};

export interface ResearchStore {
  getSubscriptionTier(userId: string): Promise<SubscriptionTier>;
  listWatchlistTickersByUser(userId: string): Promise<string[]>;
  listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]>;

  getReportById(id: string): Promise<ReportRecord | undefined>;
  hasReportAccessForUser(userId: string, reportId: string): Promise<boolean>;
  listReportsByUser(userId: string): Promise<ReportRecord[]>;

  listConvictionJournalEntriesByUser(
    input: { userId: string; ticker?: string; limit: number },
  ): Promise<ConvictionJournalEntryRecord[]>;
  upsertConvictionJournalEntry(input: ConvictionJournalEntryRecord): Promise<ConvictionJournalEntryRecord>;
  listConvictionInsightCardsByUser(
    input: { userId: string; limit: number },
  ): Promise<ConvictionInsightCardRecord[]>;
  getOppositeCaseReportBySource(
    input: { userId: string; sourceReportId: string },
  ): Promise<OppositeCaseReportRecord | undefined>;
  upsertOppositeCaseReport(input: OppositeCaseReportRecord): Promise<OppositeCaseReportRecord>;

  listScenarioStressTemplates(
    input?: { includeInactive?: boolean; limit?: number },
  ): Promise<ScenarioStressTemplateRecord[]>;
  getScenarioStressTemplate(id: ScenarioStressTemplateId): Promise<ScenarioStressTemplateRecord | undefined>;
  createScenarioStressRun(input: ScenarioStressRunRecord): Promise<ScenarioStressRunRecord>;
  getScenarioStressRun(input: { id: string; userId: string }): Promise<ScenarioStressRunRecord | undefined>;
  createScenarioStressImpacts(input: ScenarioStressImpactRecord[]): Promise<ScenarioStressImpactRecord[]>;
  listScenarioStressImpactsByRun(
    input: { scenarioRunId: string; userId: string },
  ): Promise<ScenarioStressImpactRecord[]>;
  createScenarioStressRuleSuggestions(
    input: ScenarioStressRuleSuggestionRecord[],
  ): Promise<ScenarioStressRuleSuggestionRecord[]>;
  listScenarioStressRuleSuggestionsByRun(
    input: { scenarioRunId: string; userId: string },
  ): Promise<ScenarioStressRuleSuggestionRecord[]>;

  listAlertLedgerItemsByUser(
    input: { userId: string; limit: number; category?: AlertLedgerCategory },
  ): Promise<AlertLedgerRecord[]>;
  getAlertLedgerItem(input: { id: string; userId: string }): Promise<AlertLedgerRecord | undefined>;
  setAlertLedgerFeedback(
    input: { id: string; userId: string; feedback: AlertFeedbackState; updatedAt: string },
  ): Promise<AlertLedgerRecord | undefined>;
  markAlertLedgerMuted(
    input: { id: string; userId: string; mutedAt: string },
  ): Promise<AlertLedgerRecord | undefined>;
  // The quiet_until half of the old upsertNotificationPreferences (the only part mute uses).
  setNotificationQuietUntil(
    input: { userId: string; type: NotificationType; quietUntil: string; updatedAt: string },
  ): Promise<void>;

  enqueueUserFeedback(input: EnqueueFeedbackInput): Promise<UserFeedbackQueueRecord>;

  getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined>;
  listFearGreedHistory(days: number): Promise<FearGreedSnapshot[]>;

  listNameRelationshipsByUser(input: {
    userId: string;
    sourceTicker?: string;
    targetTicker?: string;
    states?: NameRelationshipState[];
    minConfidence?: number;
    limit: number;
  }): Promise<NameRelationshipRecord[]>;

  listUpcomingCalendarEventsByTickers(
    input: { tickers: string[]; fromDate: string; toDate: string; eventType?: string },
  ): Promise<CalendarEventRecord[]>;
  listCallArtifacts(input: { ticker?: string; eventId?: string; limit: number }): Promise<CallArtifact[]>;
  getWarRoom(input: { id: string; userId: string }): Promise<WarRoomRecord | undefined>;
  listWarRoomTimelineEvents(
    input: { warRoomId: string; limit: number },
  ): Promise<WarRoomTimelineEventRecord[]>;

  appendAuditEvent(input: AuditEventInput): Promise<void>;
}

export class PostgresResearchStore implements ResearchStore {
  // The client is resolved on the first query, never at import time.
  constructor(private readonly sql: () => Sql) {}

  private async q(text: string, params: unknown[] = []): Promise<Row[]> {
    const rows = await this.sql().unsafe(text, params as never[]);
    return rows as unknown as Row[];
  }

  async getSubscriptionTier(userId: string): Promise<SubscriptionTier> {
    const rows = await this.q(`select tier from subscriptions where user_id = $1 limit 1`, [userId]);
    return mapSubscriptionTier(rows[0]);
  }

  async listWatchlistTickersByUser(userId: string): Promise<string[]> {
    const rows = await this.q(
      `select ticker
         from watchlists
        where user_id = $1
        order by ticker asc`,
      [userId],
    );
    return rows.map((row) => String(row.ticker));
  }

  async listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]> {
    const rows = await this.q(
      `select *
         from thesis_monitor_snapshots
        where user_id = $1
        order by ticker asc`,
      [userId],
    );
    return rows.map(mapThesisMonitorSnapshot);
  }

  async getReportById(id: string): Promise<ReportRecord | undefined> {
    const rows = await this.q("select * from reports where id = $1", [id]);
    return rows[0] ? mapReport(rows[0]) : undefined;
  }

  async hasReportAccessForUser(userId: string, reportId: string): Promise<boolean> {
    const rows = await this.q(
      `select 1
         from jobs
        where user_id = $1
          and status = 'complete'
          and report_id = $2
        limit 1`,
      [userId, reportId],
    );
    return rows.length > 0;
  }

  async listReportsByUser(userId: string): Promise<ReportRecord[]> {
    const rows = await this.q(
      `select distinct r.*
         from reports r
         join jobs j on j.report_id = r.id
        where j.user_id = $1
          and j.status = 'complete'
        order by r.created_at desc`,
      [userId],
    );
    return rows.map(mapReport);
  }

  async listConvictionJournalEntriesByUser(
    input: { userId: string; ticker?: string; limit: number },
  ): Promise<ConvictionJournalEntryRecord[]> {
    const rows = await this.q(
      `select *
         from conviction_journal_entries
        where user_id = $1
          and ($2::text is null or ticker = $2::text)
        order by event_at desc, created_at desc
        limit $3`,
      [input.userId, input.ticker?.trim().toUpperCase() ?? null, Math.max(1, input.limit)],
    );
    return rows.map(mapConvictionJournalEntryRecord);
  }

  async upsertConvictionJournalEntry(
    input: ConvictionJournalEntryRecord,
  ): Promise<ConvictionJournalEntryRecord> {
    const rows = await this.q(
      `insert into conviction_journal_entries (
         journal_entry_id, user_id, ticker, event_type, source_type, source_id, event_at, title, summary,
         thesis_snapshot, evidence_refs, report_id, alert_ledger_id, war_room_id, monitor_snapshot_key,
         opposite_case_id, created_at, updated_at
       )
       values (
         $1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16,
         $17::timestamptz, $18::timestamptz
       )
       on conflict (user_id, event_type, source_type, source_id) do update set
         ticker = excluded.ticker,
         event_at = excluded.event_at,
         title = excluded.title,
         summary = excluded.summary,
         thesis_snapshot = excluded.thesis_snapshot,
         evidence_refs = excluded.evidence_refs,
         report_id = excluded.report_id,
         alert_ledger_id = excluded.alert_ledger_id,
         war_room_id = excluded.war_room_id,
         monitor_snapshot_key = excluded.monitor_snapshot_key,
         opposite_case_id = excluded.opposite_case_id,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.id,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.eventType,
        input.sourceType,
        input.sourceId,
        input.eventAt,
        input.title,
        input.summary,
        JSON.stringify(input.thesisSnapshot),
        JSON.stringify(input.evidenceRefs),
        input.reportId ?? null,
        input.alertLedgerId ?? null,
        input.warRoomId ?? null,
        input.monitorSnapshotKey ?? null,
        input.oppositeCaseId ?? null,
        input.createdAt,
        input.updatedAt,
      ],
    );
    return mapConvictionJournalEntryRecord(rows[0]);
  }

  async listConvictionInsightCardsByUser(
    input: { userId: string; limit: number },
  ): Promise<ConvictionInsightCardRecord[]> {
    const rows = await this.q(
      `select *
         from conviction_insight_cards
        where user_id = $1
        order by generated_at desc
        limit $2`,
      [input.userId, Math.max(1, input.limit)],
    );
    return rows.map(mapConvictionInsightCardRecord);
  }

  async getOppositeCaseReportBySource(
    input: { userId: string; sourceReportId: string },
  ): Promise<OppositeCaseReportRecord | undefined> {
    const rows = await this.q(
      `select *
         from opposite_case_reports
        where user_id = $1
          and source_report_id = $2
        limit 1`,
      [input.userId, input.sourceReportId],
    );
    return rows[0] ? mapOppositeCaseReportRecord(rows[0]) : undefined;
  }

  async upsertOppositeCaseReport(input: OppositeCaseReportRecord): Promise<OppositeCaseReportRecord> {
    const rows = await this.q(
      `insert into opposite_case_reports (
         opposite_case_id, user_id, source_report_id, ticker, prompt_version, thesis_summary,
         opposite_case_summary, key_points, shared_evidence_refs, decisive_factors, generated_at, created_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::timestamptz, $12::timestamptz)
       on conflict (user_id, source_report_id) do update set
         ticker = excluded.ticker,
         prompt_version = excluded.prompt_version,
         thesis_summary = excluded.thesis_summary,
         opposite_case_summary = excluded.opposite_case_summary,
         key_points = excluded.key_points,
         shared_evidence_refs = excluded.shared_evidence_refs,
         decisive_factors = excluded.decisive_factors,
         generated_at = excluded.generated_at
       returning *`,
      [
        input.id,
        input.userId,
        input.sourceReportId,
        input.ticker.trim().toUpperCase(),
        input.promptVersion,
        input.thesisSummary,
        input.oppositeCaseSummary,
        JSON.stringify(input.keyPoints),
        JSON.stringify(input.sharedEvidenceRefs),
        JSON.stringify(input.decisiveFactors),
        input.generatedAt,
        input.createdAt,
      ],
    );
    return mapOppositeCaseReportRecord(rows[0]);
  }

  async listScenarioStressTemplates(
    input?: { includeInactive?: boolean; limit?: number },
  ): Promise<ScenarioStressTemplateRecord[]> {
    const rows = await this.q(
      `select *
         from scenario_stress_templates
        where ($1::boolean = true or is_active = true)
        order by display_order asc, updated_at desc
        limit $2`,
      [input?.includeInactive ?? false, Math.max(1, input?.limit ?? 50)],
    );
    return rows.map(mapScenarioStressTemplateRecord);
  }

  async getScenarioStressTemplate(
    id: ScenarioStressTemplateId,
  ): Promise<ScenarioStressTemplateRecord | undefined> {
    const rows = await this.q(
      `select *
         from scenario_stress_templates
        where scenario_id = $1
        limit 1`,
      [id],
    );
    return rows[0] ? mapScenarioStressTemplateRecord(rows[0]) : undefined;
  }

  async createScenarioStressRun(input: ScenarioStressRunRecord): Promise<ScenarioStressRunRecord> {
    const rows = await this.q(
      `insert into scenario_stress_runs (
         scenario_run_id, user_id, scenario_id, status, run_mode, as_of, total_names, impacted_names,
         critical_names, summary, created_at, completed_at
       )
       values ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
       returning *`,
      [
        input.id,
        input.userId,
        input.scenarioId,
        input.status,
        input.runMode,
        input.asOf,
        Math.max(0, Math.floor(input.totalNames)),
        Math.max(0, Math.floor(input.impactedNames)),
        Math.max(0, Math.floor(input.criticalNames)),
        input.summary,
        input.createdAt,
        input.completedAt,
      ],
    );
    return mapScenarioStressRunRecord(rows[0]);
  }

  async getScenarioStressRun(
    input: { id: string; userId: string },
  ): Promise<ScenarioStressRunRecord | undefined> {
    const rows = await this.q(
      `select *
         from scenario_stress_runs
        where scenario_run_id = $1
          and user_id = $2
        limit 1`,
      [input.id, input.userId],
    );
    return rows[0] ? mapScenarioStressRunRecord(rows[0]) : undefined;
  }

  async createScenarioStressImpacts(
    input: ScenarioStressImpactRecord[],
  ): Promise<ScenarioStressImpactRecord[]> {
    const created: ScenarioStressImpactRecord[] = [];
    for (const item of input) {
      const rows = await this.q(
        `insert into scenario_stress_impacts (
           scenario_impact_id, scenario_run_id, user_id, ticker, impact_level, thesis_break_likelihood,
           stress_score, rationale, evidence_refs, created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
         returning *`,
        [
          item.id,
          item.scenarioRunId,
          item.userId,
          item.ticker.trim().toUpperCase(),
          item.impactLevel,
          item.thesisBreakLikelihood,
          Math.min(1, Math.max(0, item.stressScore)),
          item.rationale,
          JSON.stringify(item.evidenceRefs),
          item.createdAt,
        ],
      );
      created.push(mapScenarioStressImpactRecord(rows[0]));
    }
    return created;
  }

  async listScenarioStressImpactsByRun(
    input: { scenarioRunId: string; userId: string },
  ): Promise<ScenarioStressImpactRecord[]> {
    const rows = await this.q(
      `select impacts.*
         from scenario_stress_impacts impacts
         join scenario_stress_runs runs on runs.scenario_run_id = impacts.scenario_run_id
        where impacts.scenario_run_id = $1
          and runs.user_id = $2
        order by impacts.stress_score desc, impacts.ticker asc`,
      [input.scenarioRunId, input.userId],
    );
    return rows.map(mapScenarioStressImpactRecord);
  }

  async createScenarioStressRuleSuggestions(
    input: ScenarioStressRuleSuggestionRecord[],
  ): Promise<ScenarioStressRuleSuggestionRecord[]> {
    const created: ScenarioStressRuleSuggestionRecord[] = [];
    for (const item of input) {
      const rows = await this.q(
        `insert into scenario_stress_rule_suggestions (
           scenario_rule_suggestion_id, scenario_run_id, user_id, ticker, signal_type, direction,
           condition_text, rationale, confidence, created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
         returning *`,
        [
          item.id,
          item.scenarioRunId,
          item.userId,
          item.ticker.trim().toUpperCase(),
          item.signalType,
          item.direction,
          item.conditionText,
          item.rationale,
          Math.min(1, Math.max(0, item.confidence)),
          item.createdAt,
        ],
      );
      created.push(mapScenarioStressRuleSuggestionRecord(rows[0]));
    }
    return created;
  }

  async listScenarioStressRuleSuggestionsByRun(
    input: { scenarioRunId: string; userId: string },
  ): Promise<ScenarioStressRuleSuggestionRecord[]> {
    const rows = await this.q(
      `select suggestions.*
         from scenario_stress_rule_suggestions suggestions
         join scenario_stress_runs runs on runs.scenario_run_id = suggestions.scenario_run_id
        where suggestions.scenario_run_id = $1
          and runs.user_id = $2
        order by suggestions.confidence desc, suggestions.ticker asc`,
      [input.scenarioRunId, input.userId],
    );
    return rows.map(mapScenarioStressRuleSuggestionRecord);
  }

  async listAlertLedgerItemsByUser(
    input: { userId: string; limit: number; category?: AlertLedgerCategory },
  ): Promise<AlertLedgerRecord[]> {
    const rows = await this.q(
      `select *
         from alert_ledger
        where user_id = $1
          and ($2::text is null or category = $2::text)
        order by created_at desc
        limit $3`,
      [input.userId, input.category ?? null, Math.max(1, input.limit)],
    );
    return rows.map(mapAlertLedgerRecord);
  }

  async getAlertLedgerItem(input: { id: string; userId: string }): Promise<AlertLedgerRecord | undefined> {
    const rows = await this.q(
      `select *
         from alert_ledger
        where id = $1
          and user_id = $2
        limit 1`,
      [input.id, input.userId],
    );
    return rows[0] ? mapAlertLedgerRecord(rows[0]) : undefined;
  }

  async setAlertLedgerFeedback(
    input: { id: string; userId: string; feedback: AlertFeedbackState; updatedAt: string },
  ): Promise<AlertLedgerRecord | undefined> {
    const rows = await this.q(
      `update alert_ledger
          set feedback_state = $3,
              updated_at = $4::timestamptz
        where id = $1
          and user_id = $2
        returning *`,
      [input.id, input.userId, input.feedback, input.updatedAt],
    );
    return rows[0] ? mapAlertLedgerRecord(rows[0]) : undefined;
  }

  async markAlertLedgerMuted(
    input: { id: string; userId: string; mutedAt: string },
  ): Promise<AlertLedgerRecord | undefined> {
    const rows = await this.q(
      `update alert_ledger
          set muted_at = $3::timestamptz,
              updated_at = $3::timestamptz
        where id = $1
          and user_id = $2
        returning *`,
      [input.id, input.userId, input.mutedAt],
    );
    return rows[0] ? mapAlertLedgerRecord(rows[0]) : undefined;
  }

  async setNotificationQuietUntil(
    input: { userId: string; type: NotificationType; quietUntil: string; updatedAt: string },
  ): Promise<void> {
    // Same statement as the old upsertNotificationPreferences with enabled not given and quietUntil given.
    await this.q(
      `insert into notification_preferences (
         id, user_id, notification_type, enabled, quiet_until, updated_at, created_at
        )
       values ($1, $2, $3, coalesce($4::boolean, true), $5::timestamptz, $6::timestamptz, $6::timestamptz)
       on conflict (user_id, notification_type) do update set
         enabled = case
           when $7::boolean then coalesce($4::boolean, notification_preferences.enabled)
           else notification_preferences.enabled
         end,
         quiet_until = case
           when $8::boolean then $5::timestamptz
           else notification_preferences.quiet_until
         end,
         updated_at = $6::timestamptz`,
      [crypto.randomUUID(), input.userId, input.type, null, input.quietUntil, input.updatedAt, false, true],
    );
  }

  async enqueueUserFeedback(input: EnqueueFeedbackInput): Promise<UserFeedbackQueueRecord> {
    const rows = await this.q(
      `insert into user_feedback_queue (
         id, user_id, feedback_type, code, severity, source_surface, user_tier, report_id, ticker, message,
         metadata, triage_status, route_status, triage_owner, triaged_at, created_at, updated_at
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11::jsonb, $12, $13, $14, $15::timestamptz,
         $16::timestamptz, $17::timestamptz
       )
       returning *`,
      [
        input.id,
        input.userId,
        input.feedbackType,
        input.code,
        input.severity,
        input.sourceSurface,
        input.userTier,
        input.reportId ?? null,
        input.ticker?.trim().toUpperCase() ?? null,
        input.message,
        JSON.stringify(input.metadata ?? {}),
        input.triageStatus,
        input.routeStatus,
        input.triageOwner ?? null,
        input.triagedAt ?? null,
        input.createdAt,
        input.updatedAt,
      ],
    );
    return mapUserFeedbackQueueRecord(rows[0]);
  }

  async getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined> {
    const rows = await this.q(
      `select *
         from fear_greed_daily
        order by market_date desc
        limit 1`,
    );
    return rows[0] ? mapFearGreedSnapshot(rows[0]) : undefined;
  }

  async listFearGreedHistory(days: number): Promise<FearGreedSnapshot[]> {
    const rows = await this.q(
      `select *
         from (
           select *
             from fear_greed_daily
            order by market_date desc
            limit $1
         ) as latest
        order by market_date asc`,
      [Math.max(1, days)],
    );
    return rows.map(mapFearGreedSnapshot);
  }

  async listNameRelationshipsByUser(input: {
    userId: string;
    sourceTicker?: string;
    targetTicker?: string;
    states?: NameRelationshipState[];
    minConfidence?: number;
    limit: number;
  }): Promise<NameRelationshipRecord[]> {
    const states = input.states?.filter((state) => typeof state === "string") ?? [];
    const minConfidence = Math.max(0, Math.min(1, input.minConfidence ?? 0));
    const rows = await this.q(
      `select *
         from name_relationships
        where user_id = $1
          and ($2::text is null or source_ticker = $2::text)
          and ($3::text is null or target_ticker = $3::text)
          and (array_length($4::text[], 1) is null or state = any($4::text[]))
          and confidence >= $5
        order by updated_at desc
        limit $6`,
      [
        input.userId,
        input.sourceTicker?.trim().toUpperCase() ?? null,
        input.targetTicker?.trim().toUpperCase() ?? null,
        states.length > 0 ? states : null,
        minConfidence,
        Math.max(1, input.limit),
      ],
    );
    return rows.map(mapNameRelationship);
  }

  async listUpcomingCalendarEventsByTickers(
    input: { tickers: string[]; fromDate: string; toDate: string; eventType?: string },
  ): Promise<CalendarEventRecord[]> {
    const tickers = input.tickers.map((t) => t.trim().toUpperCase()).filter((t) => t.length > 0);
    if (tickers.length === 0) return [];
    const rows = await this.q(
      `select *
         from calendar_events
        where ticker = any($1::text[])
          and event_date >= $2::date
          and event_date <= $3::date
          and ($4::text is null or event_type = $4::text)
        order by event_date asc, ticker asc`,
      [tickers, input.fromDate, input.toDate, input.eventType ?? null],
    );
    return rows.map(mapCalendarEvent);
  }

  async listCallArtifacts(
    input: { ticker?: string; eventId?: string; limit: number },
  ): Promise<CallArtifact[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (input.ticker) {
      values.push(input.ticker.trim().toUpperCase());
      conditions.push(`ticker = $${values.length}`);
    }
    if (input.eventId) {
      values.push(input.eventId);
      conditions.push(`event_id = $${values.length}`);
    }
    values.push(Math.max(1, input.limit));
    const whereClause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
    const rows = await this.q(
      `select payload
         from call_artifacts
        ${whereClause}
        order by retrieved_at desc
        limit $${values.length}`,
      values,
    );
    return rows.map(mapCallArtifact);
  }

  async getWarRoom(input: { id: string; userId: string }): Promise<WarRoomRecord | undefined> {
    const rows = await this.q(
      `select *
         from war_rooms
        where id = $1
          and user_id = $2
        limit 1`,
      [input.id, input.userId],
    );
    return rows[0] ? mapWarRoomRecord(rows[0]) : undefined;
  }

  async listWarRoomTimelineEvents(
    input: { warRoomId: string; limit: number },
  ): Promise<WarRoomTimelineEventRecord[]> {
    const rows = await this.q(
      `select *
         from war_room_timeline_events
        where war_room_id = $1
        order by created_at desc
        limit $2`,
      [input.warRoomId, Math.max(1, input.limit)],
    );
    return rows.map(mapWarRoomTimelineEvent).reverse();
  }

  async appendAuditEvent(input: AuditEventInput): Promise<void> {
    await this.q(
      `insert into audit_events (id, user_id, event_type, payload, created_at)
       values ($1, $2, $3, $4::jsonb, $5)`,
      [input.id, input.userId ?? null, input.eventType, JSON.stringify(input.payload), input.createdAt],
    );
  }
}
