// Postgres EvaluatorStore, part 1 (ingest, users, alerts). SQL copied from apps/product-api/src/store.ts (PostgresStore).
// search_path is "app". jsonb params are JSON.stringify + $n::jsonb; lists are passed as jsonb arrays.
// The client is created lazily on the first query, never at import.
import type { Sql } from "../../_shared/db.ts";
import type { FearGreedSnapshot } from "../research/macro_stress.ts";
import type { EmailTarget } from "./push_port.ts";
import type { UserPage } from "./store.ts";
import {
  mapAlertLedger,
  mapCalendarEvent,
  mapCanonicalEvent,
  mapContrarianAnchor,
  mapFearGreed,
  mapFeedback,
  mapHolding,
  mapJournalEntry,
  mapKillSwitchEvaluation,
  mapKillSwitchRule,
  mapMonitorSnapshot,
  mapNameRelationship,
  mapPayload,
  mapReportMeta,
  mapResearchState,
  mapWarRoom,
  type Row,
  stringArray,
} from "./store_pg_map.ts";
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
  NotificationType,
  PushTarget,
  ReportMeta,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  UserResearchHoldingRecord,
  UserResearchStateRecord,
  WarRoomRow,
  WarRoomTimelineEventRecord,
} from "./types.ts";

type Params = Parameters<Sql["unsafe"]>[1];

// A jsonb array param, or null when the list is empty or missing.
export function list(values: string[] | undefined): string | null {
  const clean = (values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

export function inList(column: string, param: string): string {
  return `(${param}::jsonb is null or ${column} in (select jsonb_array_elements_text(${param}::jsonb)))`;
}

export class PgStoreBase {
  constructor(protected readonly sql: () => Sql) {}

  protected async q(text: string, params: unknown[] = []): Promise<Row[]> {
    const rows = await this.sql().unsafe(text, params as Params);
    return rows as unknown as Row[];
  }

  protected async run(text: string, params: unknown[] = []): Promise<number> {
    const result = await this.sql().unsafe(text, params as Params);
    return result.count ?? 0;
  }

  // ---- Ingest ----

  async upsertCanonicalEvents(events: CanonicalEvent[]): Promise<{ upserted: number }> {
    for (const e of events) {
      await this.run(
        `insert into canonical_events (id, family, subject_type, subject_id, title, occurred_at, source_state,
           source, missing_fields, metadata, retrieved_at, updated_at)
         values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::timestamptz,
           $12::timestamptz)
         on conflict (id) do update set
           family = excluded.family, subject_type = excluded.subject_type, subject_id = excluded.subject_id,
           title = excluded.title, occurred_at = excluded.occurred_at, source_state = excluded.source_state,
           source = excluded.source, missing_fields = excluded.missing_fields, metadata = excluded.metadata,
           retrieved_at = excluded.retrieved_at, updated_at = excluded.updated_at`,
        [
          e.id,
          e.family,
          e.subject_type,
          e.subject_id,
          e.title,
          e.occurred_at,
          e.source_state,
          JSON.stringify(e.source),
          JSON.stringify(e.missing_fields),
          JSON.stringify(e.metadata),
          e.retrieved_at,
          new Date().toISOString(),
        ],
      );
    }
    return { upserted: events.length };
  }

  async listCanonicalEvents(input: {
    subjectType?: CanonicalEvent["subject_type"];
    subjectId?: string;
    family?: CanonicalEvent["family"];
    limit: number;
  }): Promise<CanonicalEvent[]> {
    const rows = await this.q(
      `select * from canonical_events
        where ($1::text is null or subject_type = $1::text)
          and ($2::text is null or upper(subject_id) = $2::text)
          and ($3::text is null or family = $3::text)
        order by occurred_at desc
        limit $4`,
      [
        input.subjectType ?? null,
        input.subjectId?.trim().toUpperCase() ?? null,
        input.family ?? null,
        input.limit,
      ],
    );
    return rows.map(mapCanonicalEvent);
  }

  async upsertFirstPartyContextItems(items: FirstPartyContextItem[]): Promise<{ upserted: number }> {
    for (const item of items) {
      await this.run(
        `insert into first_party_context_items (context_id, ticker, event_id, source_url, source_domain, page_type,
           fetch_state, rights, payload, retrieved_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::timestamptz, $11::timestamptz)
         on conflict (context_id) do update set
           ticker = excluded.ticker, event_id = excluded.event_id, source_url = excluded.source_url,
           source_domain = excluded.source_domain, page_type = excluded.page_type,
           fetch_state = excluded.fetch_state, rights = excluded.rights, payload = excluded.payload,
           retrieved_at = excluded.retrieved_at, updated_at = excluded.updated_at`,
        [
          item.context_id,
          item.ticker.trim().toUpperCase(),
          item.event_id ?? null,
          item.source_url,
          item.source_domain,
          item.page_type,
          item.fetch_state,
          JSON.stringify(item.rights),
          JSON.stringify(item),
          item.retrieved_at,
          new Date().toISOString(),
        ],
      );
    }
    return { upserted: items.length };
  }

  async upsertCallArtifacts(artifacts: CallArtifact[]): Promise<{ upserted: number }> {
    for (const a of artifacts) {
      await this.run(
        `insert into call_artifacts (artifact_id, ticker, event_id, context_id, source_url, source_domain,
           artifact_type, completeness_state, rights, payload, retrieved_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::timestamptz, $12::timestamptz)
         on conflict (artifact_id) do update set
           ticker = excluded.ticker, event_id = excluded.event_id, context_id = excluded.context_id,
           source_url = excluded.source_url, source_domain = excluded.source_domain,
           artifact_type = excluded.artifact_type, completeness_state = excluded.completeness_state,
           rights = excluded.rights, payload = excluded.payload, retrieved_at = excluded.retrieved_at,
           updated_at = excluded.updated_at`,
        [
          a.artifact_id,
          a.ticker.trim().toUpperCase(),
          a.event_id ?? null,
          a.context_id ?? null,
          a.source_url,
          a.source_domain,
          a.artifact_type,
          a.completeness_state,
          JSON.stringify(a.rights),
          JSON.stringify(a),
          a.retrieved_at,
          new Date().toISOString(),
        ],
      );
    }
    return { upserted: artifacts.length };
  }

  async listFirstPartyContextItems(input: { ticker?: string; eventId?: string; limit: number }) {
    const rows = await this.q(
      `select payload from first_party_context_items
        where ($1::text is null or ticker = $1::text) and ($2::text is null or event_id = $2::text)
        order by retrieved_at desc limit $3`,
      [input.ticker?.trim().toUpperCase() ?? null, input.eventId ?? null, input.limit],
    );
    return rows.map((r) => mapPayload<FirstPartyContextItem>(r));
  }

  async listCallArtifacts(input: { ticker?: string; eventId?: string; limit: number }) {
    const rows = await this.q(
      `select payload from call_artifacts
        where ($1::text is null or ticker = $1::text) and ($2::text is null or event_id = $2::text)
        order by retrieved_at desc limit $3`,
      [input.ticker?.trim().toUpperCase() ?? null, input.eventId ?? null, input.limit],
    );
    return rows.map((r) => mapPayload<CallArtifact>(r));
  }

  protected async fearGreedByDate(marketDate: string): Promise<FearGreedSnapshot | undefined> {
    const rows = await this.q(`select * from fear_greed_daily where market_date = $1::date limit 1`, [
      marketDate,
    ]);
    return rows[0] ? mapFearGreed(rows[0]) : undefined;
  }

  async upsertFearGreedSnapshot(s: FearGreedSnapshot) {
    const existing = await this.fearGreedByDate(s.market_date);
    await this.run(
      `insert into fear_greed_daily (id, market_date, score, label, sub_scores, missing_inputs, calculated_at)
       values ($1, $2::date, $3, $4, $5::jsonb, $6::jsonb, $7::timestamptz)
       on conflict (market_date) do update set
         id = excluded.id, score = excluded.score, label = excluded.label, sub_scores = excluded.sub_scores,
         missing_inputs = excluded.missing_inputs, calculated_at = excluded.calculated_at`,
      [
        s.id,
        s.market_date,
        s.score,
        s.label,
        JSON.stringify(s.sub_scores),
        JSON.stringify(s.missing_inputs),
        s.calculated_at,
      ],
    );
    const snapshot = await this.fearGreedByDate(s.market_date);
    if (!snapshot) throw new Error("Failed to load stored fear_greed_daily snapshot after upsert");
    return { snapshot, created: existing === undefined };
  }

  async getLatestFearGreedSnapshot() {
    const rows = await this.q(`select * from fear_greed_daily order by market_date desc limit 1`);
    return rows[0] ? mapFearGreed(rows[0]) : undefined;
  }

  async listTickerCoverageTickers(limit: number): Promise<string[]> {
    const rows = await this.q(
      `select ticker from ticker_coverage where last_sync_status in ('success', 'partial')
        order by backfill_tier asc, ticker asc limit $1`,
      [Math.max(1, limit)],
    );
    return rows.map((r) => String(r.ticker).trim().toUpperCase());
  }

  // Unlike the old code, a conflict keeps the existing id: war rooms point at calendar ids,
  // so a re-sync must not change them (idempotent retries).
  async upsertCalendarEvents(events: CalendarEventRecord[]): Promise<{ upserted: number }> {
    for (const e of events) {
      await this.run(
        `insert into calendar_events (id, ticker, event_type, event_date, event_time, provider, timing_state,
           source_state, source_ref, reason_text, retrieved_at, updated_at)
         values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9::jsonb, $10, $11::timestamptz, $12::timestamptz)
         on conflict (ticker, event_type, event_date) do update set
           event_time = excluded.event_time, provider = excluded.provider, timing_state = excluded.timing_state,
           source_state = excluded.source_state, source_ref = excluded.source_ref,
           reason_text = excluded.reason_text, retrieved_at = excluded.retrieved_at,
           updated_at = excluded.updated_at`,
        [
          e.id,
          e.ticker.trim().toUpperCase(),
          e.eventType,
          e.eventDate,
          e.eventTime ?? null,
          e.provider,
          e.timingState,
          e.sourceState,
          JSON.stringify(e.sourceRef ?? {}),
          e.reasonText,
          e.retrievedAt,
          new Date().toISOString(),
        ],
      );
    }
    return { upserted: events.length };
  }

  async listCalendarEvents(input: {
    tickers: string[];
    fromDate: string;
    toDate: string;
    eventType?: CalendarEventRecord["eventType"];
  }): Promise<CalendarEventRecord[]> {
    const tickers = list(input.tickers.map((t) => t.toUpperCase()));
    if (!tickers) return [];
    const rows = await this.q(
      `select * from calendar_events
        where ${inList("ticker", "$1")}
          and event_date >= $2::date and event_date <= $3::date
          and ($4::text is null or event_type = $4::text)
        order by event_date asc, ticker asc`,
      [tickers, input.fromDate, input.toDate, input.eventType ?? null],
    );
    return rows.map(mapCalendarEvent);
  }

  async userExists(userId: string): Promise<boolean> {
    const rows = await this.q(`select 1 from users where id = $1 limit 1`, [userId]);
    return rows.length > 0;
  }

  async upsertNameRelationship(r: NameRelationshipRecord): Promise<void> {
    await this.run(
      `insert into name_relationships (relationship_id, user_id, source_ticker, target_ticker, relationship_type,
         confidence, state, source_report_id, prompt_version, evidence_text, rationale, created_at, updated_at,
         suppressed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz, $14::timestamptz)
       on conflict (relationship_id) do update set
         user_id = excluded.user_id, source_ticker = excluded.source_ticker,
         target_ticker = excluded.target_ticker, relationship_type = excluded.relationship_type,
         confidence = excluded.confidence, state = excluded.state, source_report_id = excluded.source_report_id,
         prompt_version = excluded.prompt_version, evidence_text = excluded.evidence_text,
         rationale = excluded.rationale, updated_at = excluded.updated_at, suppressed_at = excluded.suppressed_at`,
      [
        r.relationshipId,
        r.userId,
        r.sourceTicker.trim().toUpperCase(),
        r.targetTicker.trim().toUpperCase(),
        r.relationshipType,
        r.confidence,
        r.state,
        r.sourceReportId,
        r.promptVersion,
        r.evidenceText,
        r.rationale,
        r.createdAt,
        r.updatedAt,
        r.suppressedAt ?? null,
      ],
    );
  }

  async listActiveNameRelationshipsBySource(input: {
    sourceTicker: string;
    relationshipTypes?: NameRelationshipType[];
    minConfidence: number;
  }): Promise<NameRelationshipRecord[]> {
    const rows = await this.q(
      `select * from name_relationships
        where state = 'active' and source_ticker = $1 and ${inList("relationship_type", "$2")}
          and confidence >= $3
        order by confidence desc, updated_at asc`,
      [
        input.sourceTicker.trim().toUpperCase(),
        list(input.relationshipTypes),
        Math.max(0, Math.min(1, input.minConfidence)),
      ],
    );
    return rows.map(mapNameRelationship);
  }

  // ---- Users and audience ----

  async listAudience(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
    page?: UserPage;
  }): Promise<AudienceMember[]> {
    if (input.userIds && list(input.userIds) === null) return [];
    const rows = await this.q(
      `with aud as (
         select u.id as user_id
           from users u
           left join notification_preferences np on np.user_id = u.id and np.notification_type = $1
           left join subscriptions s on s.user_id = u.id
          where coalesce(np.enabled, true) = true
            and (np.quiet_until is null or np.quiet_until <= now())
            and ($2::text is null or coalesce(s.tier, 'FREE') = $2::text)
            and ${inList("u.id", "$3")}
            and ($4::text is null or u.id > $4::text)
          order by u.id asc
          limit $5
       )
       select aud.user_id, ud.installation_id, ud.device_token
         from aud
         left join user_devices ud
           on ud.user_id = aud.user_id and ud.invalidated_at is null and length(trim(ud.device_token)) > 0
        order by aud.user_id asc, ud.installation_id asc`,
      [
        input.notificationType,
        input.tier ?? null,
        list(input.userIds),
        input.page?.afterUserId ?? null,
        input.page?.limit ?? null,
      ],
    );
    const byUser = new Map<string, PushTarget[]>();
    for (const r of rows) {
      const userId = String(r.user_id);
      const targets = byUser.get(userId) ?? [];
      if (r.installation_id && r.device_token) {
        targets.push({
          userId,
          installationId: String(r.installation_id),
          deviceToken: String(r.device_token),
        });
      }
      byUser.set(userId, targets);
    }
    return [...byUser.entries()].map(([userId, targets]) => ({ userId, targets }));
  }

  async listEmailRecipients(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds: string[];
  }): Promise<EmailTarget[]> {
    const ids = list(input.userIds);
    if (!ids) return [];
    const rows = await this.q(
      `select u.id as user_id, lower(trim(u.email)) as email
         from users u
         left join notification_preferences np on np.user_id = u.id and np.notification_type = $1
         left join subscriptions s on s.user_id = u.id
        where u.verified_at is not null
          and length(trim(u.email)) > 0
          and coalesce(np.enabled, true) = true
          and (np.quiet_until is null or np.quiet_until <= now())
          and ($2::text is null or coalesce(s.tier, 'FREE') = $2::text)
          and ${inList("u.id", "$3")}
          and not exists (select 1 from user_email_preferences ep where ep.user_id = u.id and ep.email_opt_out = true)
        order by u.id asc`,
      [input.notificationType, input.tier ?? null, ids],
    );
    return rows.map((r) => ({ userId: String(r.user_id), email: String(r.email) }));
  }

  async invalidateDevice(input: { userId: string; installationId: string; at: string; reason: string }) {
    await this.run(
      `update user_devices set invalidated_at = $3, invalidation_reason = $4, updated_at = $3
        where user_id = $1 and installation_id = $2 and invalidated_at is null`,
      [input.userId, input.installationId.trim(), input.at, input.reason],
    );
  }

  // Read only. A user without a subscriptions row is FREE (the old code inserted that row).
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    const rows = await this.q(`select tier from subscriptions where user_id = $1 limit 1`, [userId]);
    return rows[0]?.tier === "PRO" ? "PRO" : "FREE";
  }

  async listWatchlistTickers(userId: string): Promise<string[]> {
    const rows = await this.q(`select ticker from watchlists where user_id = $1 order by ticker asc`, [
      userId,
    ]);
    return rows.map((r) => String(r.ticker));
  }

  async listUsersWithWatchlist(page?: UserPage) {
    const rows = await this.q(
      `select user_id, array_agg(ticker order by ticker asc) as tickers
         from watchlists
        where ($1::text is null or user_id > $1::text)
        group by user_id
        order by user_id asc
        limit $2`,
      [page?.afterUserId ?? null, page?.limit ?? null],
    );
    return rows.map((r) => ({ userId: String(r.user_id), tickers: stringArray(r.tickers) }));
  }

  async listUsersWithResearchUniverse(page?: UserPage) {
    const rows = await this.q(
      `select user_id,
              array_agg(distinct ticker order by ticker) filter (where source = 'watchlist') as watchlist_tickers,
              array_agg(distinct ticker order by ticker) filter (where source = 'holding') as holding_tickers
         from (
           select user_id, ticker, 'watchlist' as source from watchlists
           union all
           select user_id, ticker, 'holding' as source from user_research_holdings
         ) universe
        where ($1::text is null or user_id > $1::text)
        group by user_id
        order by user_id asc
        limit $2`,
      [page?.afterUserId ?? null, page?.limit ?? null],
    );
    return rows.map((r) => ({
      userId: String(r.user_id),
      watchlistTickers: stringArray(r.watchlist_tickers),
      holdingTickers: stringArray(r.holding_tickers),
    }));
  }

  // ---- Alerts and conviction ----

  async insertAlertLedgerItem(a: AlertLedgerRecord): Promise<boolean> {
    const count = await this.run(
      `insert into alert_ledger (id, user_id, notification_type, category, route, title, body, reason_code,
         reason_text, delivery_state, feedback_state, muted_at, context, created_at, updated_at, detail_body)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::jsonb, $14::timestamptz,
         $15::timestamptz, $16)
       on conflict (id) do nothing`,
      [
        a.id,
        a.userId,
        a.notificationType,
        a.category,
        a.route,
        a.title,
        a.body,
        a.reasonCode,
        a.reasonText,
        a.deliveryState,
        a.feedbackState ?? null,
        a.mutedAt ?? null,
        JSON.stringify(a.context ?? {}),
        a.createdAt,
        a.updatedAt,
        a.detailBody ?? null,
      ],
    );
    return count > 0;
  }

  async alertExists(id: string): Promise<boolean> {
    const rows = await this.q(`select 1 from alert_ledger where id = $1 limit 1`, [id]);
    return rows.length > 0;
  }

  async listAlertLedgerItemsByUser(input: { userId: string; limit: number }): Promise<AlertLedgerRecord[]> {
    const rows = await this.q(
      `select * from alert_ledger where user_id = $1 order by created_at desc limit $2`,
      [input.userId, Math.max(1, input.limit)],
    );
    return rows.map(mapAlertLedger);
  }

  async upsertConvictionJournalEntry(e: ConvictionJournalEntryRecord): Promise<void> {
    await this.run(
      `insert into conviction_journal_entries (journal_entry_id, user_id, ticker, event_type, source_type,
         source_id, event_at, title, summary, thesis_snapshot, evidence_refs, report_id, alert_ledger_id,
         war_room_id, monitor_snapshot_key, opposite_case_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16,
         $17::timestamptz, $18::timestamptz)
       on conflict (user_id, event_type, source_type, source_id) do update set
         ticker = excluded.ticker, event_at = excluded.event_at, title = excluded.title,
         summary = excluded.summary, thesis_snapshot = excluded.thesis_snapshot,
         evidence_refs = excluded.evidence_refs, report_id = excluded.report_id,
         alert_ledger_id = excluded.alert_ledger_id, war_room_id = excluded.war_room_id,
         monitor_snapshot_key = excluded.monitor_snapshot_key, opposite_case_id = excluded.opposite_case_id,
         updated_at = excluded.updated_at`,
      [
        e.id,
        e.userId,
        e.ticker.trim().toUpperCase(),
        e.eventType,
        e.sourceType,
        e.sourceId,
        e.eventAt,
        e.title,
        e.summary,
        JSON.stringify(e.thesisSnapshot),
        JSON.stringify(e.evidenceRefs),
        e.reportId ?? null,
        e.alertLedgerId ?? null,
        e.warRoomId ?? null,
        e.monitorSnapshotKey ?? null,
        e.oppositeCaseId ?? null,
        e.createdAt,
        e.updatedAt,
      ],
    );
  }

  async listConvictionJournalEntriesByUser(input: { userId: string; limit: number }) {
    const rows = await this.q(
      `select * from conviction_journal_entries where user_id = $1
        order by event_at desc, created_at desc limit $2`,
      [input.userId, Math.max(1, input.limit)],
    );
    return rows.map(mapJournalEntry);
  }

  async upsertConvictionInsightCard(c: ConvictionInsightCardRecord): Promise<void> {
    await this.run(
      `insert into conviction_insight_cards (insight_id, user_id, period_start, period_end, insight_type, status,
         title, summary, findings, source_journal_entry_ids, generated_at, created_at, updated_at)
       values ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::timestamptz,
         $12::timestamptz, $13::timestamptz)
       on conflict (user_id, period_start, period_end, insight_type) do update set
         status = excluded.status, title = excluded.title, summary = excluded.summary,
         findings = excluded.findings, source_journal_entry_ids = excluded.source_journal_entry_ids,
         generated_at = excluded.generated_at, updated_at = excluded.updated_at`,
      [
        c.id,
        c.userId,
        c.periodStart,
        c.periodEnd,
        c.insightType,
        c.status,
        c.title,
        c.summary,
        JSON.stringify(c.findings),
        JSON.stringify(c.sourceJournalEntryIds),
        c.generatedAt,
        c.createdAt,
        c.updatedAt,
      ],
    );
  }
}
