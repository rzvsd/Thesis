// Postgres implementation of EvaluatorStore, part 2. Part 1 is store_pg_base.ts.
// SQL copied from apps/product-api/src/store.ts (PostgresStore). The client is created lazily.
import type { AuditEventRecord, EvaluatorStore } from "./store.ts";
import { inList, list, PgStoreBase } from "./store_pg_base.ts";
import {
  mapContrarianAnchor,
  mapFeedback,
  mapHolding,
  mapKillSwitchEvaluation,
  mapKillSwitchRule,
  mapMonitorSnapshot,
  mapReportMeta,
  mapResearchState,
  mapWarRoom,
} from "./store_pg_map.ts";
import type {
  ContrarianAnchorRecord,
  KillSwitchEvaluationRecord,
  KillSwitchOutcome,
  KillSwitchRuleRecord,
  KillSwitchSignalSource,
  MarketPriceRow,
  ReportMeta,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  UserResearchHoldingRecord,
  UserResearchStateRecord,
  WarRoomRow,
  WarRoomTimelineEventRecord,
} from "./types.ts";

export class PostgresEvaluatorStore extends PgStoreBase implements EvaluatorStore {
  // ---- Monitor, kill switch, contrarian ----

  async listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]> {
    const rows = await this.q(
      `select * from thesis_monitor_snapshots where user_id = $1 order by ticker asc`,
      [
        userId,
      ],
    );
    return rows.map(mapMonitorSnapshot);
  }

  async upsertThesisMonitorSnapshot(s: ThesisMonitorSnapshotRecord): Promise<ThesisMonitorSnapshotRecord> {
    const rows = await this.q(
      `insert into thesis_monitor_snapshots (user_id, ticker, state, reason, score, report_id, report_generated_at,
         report_schema_version, last_deep_dive_at, material_events_count, unreviewed_events_count,
         freshness_state, freshness_score, kill_switch_triggered_at, freshness_reason, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::timestamptz, $10, $11, $12, $13, $14::timestamptz,
         $15, $16::timestamptz)
       on conflict (user_id, ticker) do update set
         state = excluded.state, reason = excluded.reason, score = excluded.score, report_id = excluded.report_id,
         report_generated_at = excluded.report_generated_at,
         report_schema_version = excluded.report_schema_version, last_deep_dive_at = excluded.last_deep_dive_at,
         material_events_count = excluded.material_events_count,
         unreviewed_events_count = excluded.unreviewed_events_count, freshness_state = excluded.freshness_state,
         freshness_score = excluded.freshness_score, kill_switch_triggered_at = excluded.kill_switch_triggered_at,
         freshness_reason = excluded.freshness_reason, updated_at = excluded.updated_at
       returning *`,
      [
        s.userId,
        s.ticker.trim().toUpperCase(),
        s.state,
        s.reason,
        s.score,
        s.reportId ?? null,
        s.reportGeneratedAt ?? null,
        s.reportSchemaVersion ?? null,
        s.lastDeepDiveAt ?? s.reportGeneratedAt ?? null,
        Math.max(0, Math.floor(s.materialEventsCount)),
        Math.max(0, Math.floor(s.unreviewedEventsCount)),
        s.freshnessState,
        Math.min(1, Math.max(0, s.freshnessScore)),
        s.killSwitchTriggeredAt ?? null,
        s.freshnessReason,
        s.updatedAt,
      ],
    );
    return mapMonitorSnapshot(rows[0]);
  }

  async listActiveKillSwitchRules(
    input: { asOfIso: string; userIds?: string[] },
  ): Promise<KillSwitchRuleRecord[]> {
    if (input.userIds && list(input.userIds) === null) return [];
    const rows = await this.q(
      `select * from kill_switch_rules
        where state = 'active' and (deactivated_at is null or deactivated_at > $1::timestamptz)
          and ${inList("user_id", "$2")}
        order by created_at asc`,
      [input.asOfIso, list(input.userIds)],
    );
    return rows.map(mapKillSwitchRule);
  }

  async getKillSwitchEvaluation(
    input: { ruleId: string; signalSource: KillSwitchSignalSource; triggerKey: string },
  ) {
    const rows = await this.q(
      `select * from kill_switch_evaluations where rule_id = $1 and signal_source = $2 and trigger_key = $3 limit 1`,
      [input.ruleId, input.signalSource, input.triggerKey],
    );
    return rows[0] ? mapKillSwitchEvaluation(rows[0]) : undefined;
  }

  async createKillSwitchEvaluation(e: KillSwitchEvaluationRecord): Promise<void> {
    await this.run(
      `insert into kill_switch_evaluations (id, rule_id, user_id, ticker, signal_source, trigger_key, outcome,
         reason_code, reason_text, observed_value, alert_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz)
       on conflict (rule_id, signal_source, trigger_key) do update set
         outcome = excluded.outcome, reason_code = excluded.reason_code, reason_text = excluded.reason_text,
         observed_value = excluded.observed_value, alert_id = excluded.alert_id, updated_at = excluded.updated_at`,
      [
        e.id,
        e.ruleId,
        e.userId,
        e.ticker.trim().toUpperCase(),
        e.signalSource,
        e.triggerKey,
        e.outcome,
        e.reasonCode,
        e.reasonText,
        e.observedValue ?? null,
        e.alertId ?? null,
        e.createdAt,
        e.updatedAt,
      ],
    );
  }

  async listKillSwitchEvaluations(input: { userId: string; outcomes?: KillSwitchOutcome[]; limit: number }) {
    const rows = await this.q(
      `select * from kill_switch_evaluations where user_id = $1 and ${inList("outcome", "$2")}
        order by created_at desc limit $3`,
      [input.userId, list(input.outcomes), Math.max(1, input.limit)],
    );
    return rows.map(mapKillSwitchEvaluation);
  }

  async deactivateExpiredContrarianAnchors(asOfIso: string): Promise<number> {
    return await this.run(
      `update contrarian_alert_anchors set is_active = false, updated_at = $1::timestamptz
        where is_active = true and expires_at < $1::timestamptz`,
      [asOfIso],
    );
  }

  async listActiveContrarianAnchors(
    input: { asOfIso: string; userIds?: string[] },
  ): Promise<ContrarianAnchorRecord[]> {
    if (input.userIds && list(input.userIds) === null) return [];
    const rows = await this.q(
      `select * from contrarian_alert_anchors
        where is_active = true and expires_at >= $1::timestamptz and ${inList("user_id", "$2")}
        order by anchored_at asc`,
      [input.asOfIso, list(input.userIds)],
    );
    return rows.map(mapContrarianAnchor);
  }

  async deactivateContrarianAnchor(id: string, at: string): Promise<void> {
    await this.run(
      `update contrarian_alert_anchors set is_active = false, updated_at = $2::timestamptz where id = $1`,
      [id, at],
    );
  }

  // ---- War rooms ----

  async findWarRoomByEvent(input: { userId: string; ticker: string; earningsEventId: string }) {
    const rows = await this.q(
      `select * from war_rooms where user_id = $1 and ticker = $2 and earnings_event_id = $3 limit 1`,
      [input.userId, input.ticker.trim().toUpperCase(), input.earningsEventId],
    );
    return rows[0] ? mapWarRoom(rows[0]) : undefined;
  }

  async getWarRoom(input: { id: string; userId: string }) {
    const rows = await this.q(`select * from war_rooms where id = $1 and user_id = $2 limit 1`, [
      input.id,
      input.userId,
    ]);
    return rows[0] ? mapWarRoom(rows[0]) : undefined;
  }

  async createWarRoom(w: WarRoomRow): Promise<WarRoomRow> {
    const rows = await this.q(
      `insert into war_rooms (id, user_id, ticker, earnings_event_id, event_date, state, current_cadence_min,
         cadence_state, prepared_at, closed_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5::date, $6, $7, $8::jsonb, $9::timestamptz, $10::timestamptz, $11::timestamptz,
         $12::timestamptz)
       returning *`,
      [
        w.id,
        w.userId,
        w.ticker.trim().toUpperCase(),
        w.earningsEventId,
        w.eventDate.trim(),
        w.state,
        w.currentCadenceMin,
        JSON.stringify(w.cadenceState),
        w.preparedAt,
        w.closedAt ?? null,
        w.createdAt,
        w.updatedAt,
      ],
    );
    return mapWarRoom(rows[0]);
  }

  async updateWarRoom(w: WarRoomRow): Promise<WarRoomRow | undefined> {
    const rows = await this.q(
      `update war_rooms set ticker = $3, earnings_event_id = $4, event_date = $5::date, state = $6,
         current_cadence_min = $7, cadence_state = $8::jsonb, prepared_at = $9::timestamptz,
         closed_at = $10::timestamptz, updated_at = $11::timestamptz
       where id = $1 and user_id = $2
       returning *`,
      [
        w.id,
        w.userId,
        w.ticker.trim().toUpperCase(),
        w.earningsEventId,
        w.eventDate.trim(),
        w.state,
        w.currentCadenceMin,
        JSON.stringify(w.cadenceState),
        w.preparedAt,
        w.closedAt ?? null,
        w.updatedAt,
      ],
    );
    return rows[0] ? mapWarRoom(rows[0]) : undefined;
  }

  async listWarRoomsByUser(input: { userId: string; includeClosed: boolean; limit: number }) {
    const rows = await this.q(
      `select * from war_rooms where user_id = $1 and ($2::boolean = true or state <> 'closed')
        order by prepared_at desc limit $3`,
      [input.userId, input.includeClosed, Math.max(1, input.limit)],
    );
    return rows.map(mapWarRoom);
  }

  async createWarRoomTimelineEvent(e: WarRoomTimelineEventRecord): Promise<void> {
    await this.run(
      `insert into war_room_timeline_events (id, war_room_id, phase, event_type, reason_text, source_refs,
         alert_ledger_id, report_id, metadata, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10::timestamptz)`,
      [
        e.id,
        e.warRoomId,
        e.phase,
        e.eventType,
        e.reasonText,
        JSON.stringify(e.sourceRefs),
        e.alertLedgerId ?? null,
        e.reportId ?? null,
        JSON.stringify(e.metadata ?? {}),
        e.createdAt,
      ],
    );
  }

  // ---- Reports ----

  async listDeepDiveReportsByUser(userId: string): Promise<ReportMeta[]> {
    const rows = await this.q(
      `select distinct r.* from reports r join jobs j on j.report_id = r.id
        where j.user_id = $1 and j.status = 'complete' and r.type = 'deep_dive'
        order by r.created_at desc`,
      [userId],
    );
    return rows.map(mapReportMeta);
  }

  async getReportMeta(reportId: string): Promise<ReportMeta | undefined> {
    const rows = await this.q(`select * from reports where id = $1`, [reportId]);
    return rows[0] ? mapReportMeta(rows[0]) : undefined;
  }

  async getPulseReportByDate(date: string): Promise<ReportMeta | undefined> {
    const rows = await this.q(
      `select * from reports where type = 'market_pulse' and (created_at at time zone 'UTC')::date = $1::date
        order by created_at desc limit 1`,
      [date],
    );
    return rows[0] ? mapReportMeta(rows[0]) : undefined;
  }

  // ---- Research state ----

  async listUserResearchHoldings(userId: string): Promise<UserResearchHoldingRecord[]> {
    const rows = await this.q(`select * from user_research_holdings where user_id = $1 order by ticker asc`, [
      userId,
    ]);
    return rows.map(mapHolding);
  }

  async getLatestUserResearchState(input: { userId: string; asOf?: string }) {
    const rows = await this.q(
      `select * from user_research_states where user_id = $1 and ($2::date is null or as_of <= $2::date)
        order by as_of desc, generated_at desc limit 1`,
      [input.userId, input.asOf ?? null],
    );
    return rows[0] ? mapResearchState(rows[0]) : undefined;
  }

  async upsertUserResearchState(s: UserResearchStateRecord): Promise<void> {
    await this.run(
      `insert into user_research_states (state_id, user_id, as_of, generated_at, state, created_at, updated_at)
       values ($1, $2, $3::date, $4::timestamptz, $5::jsonb, $4::timestamptz, $4::timestamptz)
       on conflict (user_id, as_of) do update set
         state_id = excluded.state_id, generated_at = excluded.generated_at, state = excluded.state,
         updated_at = excluded.updated_at`,
      [s.stateId, s.userId, s.asOf, s.generatedAt, JSON.stringify(s.state)],
    );
  }

  // ---- Feedback ----

  async listUserFeedbackQueue(input: {
    limit: number;
    feedbackType?: "report" | "subscription";
    triageStatus?: string;
    userTier?: SubscriptionTier;
    sourceSurface?: string;
  }): Promise<UserFeedbackQueueRecord[]> {
    const rows = await this.q(
      `select * from user_feedback_queue
        where ($1::text is null or feedback_type = $1::text)
          and ($2::text is null or triage_status = $2::text)
          and ($3::text is null or user_tier = $3::text)
          and ($4::text is null or source_surface = $4::text)
        order by created_at desc limit $5`,
      [
        input.feedbackType ?? null,
        input.triageStatus ?? null,
        input.userTier ?? null,
        input.sourceSurface ?? null,
        Math.max(1, input.limit),
      ],
    );
    return rows.map(mapFeedback);
  }

  // ---- Prices ----

  async upsertMarketPrices(rows: MarketPriceRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    return await this.run(
      `insert into market_prices_daily (ticker, market_date, close, provider, retrieved_at)
       select x.ticker, x.market_date::date, x.close::numeric, x.provider, x.retrieved_at::timestamptz
         from jsonb_to_recordset($1::jsonb)
           as x(ticker text, market_date text, close text, provider text, retrieved_at text)
       on conflict (ticker, market_date) do update set
         close = excluded.close, provider = excluded.provider, retrieved_at = excluded.retrieved_at`,
      [
        JSON.stringify(rows.map((r) => ({
          ticker: r.ticker,
          market_date: r.marketDate,
          close: String(r.close),
          provider: r.provider,
          retrieved_at: r.retrievedAt,
        }))),
      ],
    );
  }

  async latestClosePrices(input: { tickers: string[]; asOfDate: string; maxAgeDays: number }) {
    const out = new Map<string, number>();
    const tickers = list(input.tickers.map((t) => t.toUpperCase()));
    if (!tickers) return out;
    const rows = await this.q(
      `select distinct on (ticker) ticker, close, market_date
         from market_prices_daily
        where ${inList("ticker", "$1")}
          and market_date <= $2::date
          and market_date >= $2::date - $3::int
        order by ticker, market_date desc`,
      [tickers, input.asOfDate, input.maxAgeDays],
    );
    for (const r of rows) {
      const close = Number(r.close);
      if (Number.isFinite(close) && close > 0) out.set(String(r.ticker).toUpperCase(), close);
    }
    return out;
  }

  async listPriceTickers(limit: number): Promise<string[]> {
    const rows = await this.q(
      `select ticker from (
         select upper(ticker) as ticker from kill_switch_rules
          where state = 'active' and deactivated_at is null and signal_type = 'price_move_pct'
         union
         select upper(ticker) from contrarian_alert_anchors where is_active = true and expires_at >= now()
         union
         select upper(ticker) from watchlists
       ) t
       order by ticker asc
       limit $1`,
      [limit],
    );
    return rows.map((r) => String(r.ticker));
  }

  // ---- Audit ----

  async appendAuditEvent(input: AuditEventRecord): Promise<void> {
    await this.run(
      `insert into audit_events (id, user_id, event_type, payload, created_at)
       values ($1, $2, $3, $4::jsonb, $5)`,
      [input.id, input.userId ?? null, input.eventType, JSON.stringify(input.payload), input.createdAt],
    );
  }
}
