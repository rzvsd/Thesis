// Postgres implementation of EffectsStore. SQL copied from PostgresStore in apps/product-api/src/store.ts.
// The connection's search_path is "app", so table names are unqualified.
import type { Sql } from "../../../_shared/db.ts";
import type { ReportRecord } from "../types.ts";
import type { EffectsStore, ThesisMonitorSnapshotRecord } from "./types.ts";

type Row = Record<string, unknown>;
type JsonValue = Parameters<Sql["json"]>[0];

function asIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  return undefined;
}

function mapReport(row: Row): ReportRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as ReportRecord["type"],
    ticker: row.ticker ? String(row.ticker) : undefined,
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    fingerprint: row.fingerprint ? String(row.fingerprint) : undefined,
    freshnessExpiresAt: asIso(row.freshness_expires_at),
    createdAt: asIso(row.created_at) ?? new Date().toISOString(),
    isCurrent: Boolean(row.is_current),
    llmUsage: row.llm_usage ? (row.llm_usage as Record<string, unknown>) : undefined,
  };
}

function mapThesisMonitorSnapshot(row: Row): ThesisMonitorSnapshotRecord {
  const materialEventsCount = Number(row.material_events_count ?? 0);
  const unreviewedEventsCount = Number(row.unreviewed_events_count ?? 0);
  const freshnessScore = Number(row.freshness_score ?? 0);
  return {
    userId: String(row.user_id),
    ticker: String(row.ticker),
    state: String(row.state) as ThesisMonitorSnapshotRecord["state"],
    reason: String(row.reason ?? ""),
    score: Number(row.score ?? 0),
    reportId: row.report_id ? String(row.report_id) : undefined,
    reportGeneratedAt: asIso(row.report_generated_at),
    reportSchemaVersion: row.report_schema_version ? String(row.report_schema_version) : undefined,
    lastDeepDiveAt: asIso(row.last_deep_dive_at) ?? asIso(row.report_generated_at),
    materialEventsCount: Number.isFinite(materialEventsCount)
      ? Math.max(0, Math.floor(materialEventsCount))
      : 0,
    unreviewedEventsCount: Number.isFinite(unreviewedEventsCount)
      ? Math.max(0, Math.floor(unreviewedEventsCount))
      : 0,
    freshnessState: String(row.freshness_state ?? "stale") as ThesisMonitorSnapshotRecord["freshnessState"],
    freshnessScore: Number.isFinite(freshnessScore) ? Math.min(1, Math.max(0, freshnessScore)) : 0,
    killSwitchTriggeredAt: asIso(row.kill_switch_triggered_at),
    freshnessReason: String(row.freshness_reason ?? "Freshness has not been computed yet."),
    updatedAt: asIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function cleanUserIds(userIds: string[] | undefined): string[] {
  return (userIds ?? []).map((userId) => userId.trim()).filter((userId) => userId.length > 0);
}

export function postgresEffectsStore(sql: Sql): EffectsStore {
  // JSON.stringify drops undefined fields, as the old store's JSON.stringify did.
  const json = (value: unknown) => sql.json(JSON.parse(JSON.stringify(value ?? {})) as JsonValue);
  const textArray = (values: string[]) => values.length > 0 ? sql.array(values) : null;

  return {
    async appendAuditEvent(input) {
      await sql`
        insert into audit_events (id, user_id, event_type, payload, created_at)
        values (${input.id}, ${input.userId ?? null}, ${input.eventType}, ${
        json(input.payload)
      }, ${input.createdAt})`;
    },

    async createContrarianAlertAnchor(input) {
      await sql`
        insert into contrarian_alert_anchors (
          id, user_id, ticker, report_id, signal_value, anchor_price, anchored_at, expires_at, is_active, updated_at
        )
        values (
          ${input.id}, ${input.userId}, ${input.ticker.trim().toUpperCase()}, ${input.reportId ?? null},
          ${input.signalValue}, ${input.anchorPrice}, ${input.anchoredAt}::timestamptz, ${input.expiresAt}::timestamptz,
          ${input.isActive}, ${new Date().toISOString()}::timestamptz
        )`;
    },

    async deactivateActiveKillSwitchRulesByUserTicker(input) {
      const result = await sql`
        update kill_switch_rules
           set state = 'inactive',
               deactivated_at = ${input.deactivatedAt}::timestamptz,
               updated_at = ${input.deactivatedAt}::timestamptz
         where user_id = ${input.userId}
           and ticker = ${input.ticker.trim().toUpperCase()}
           and state = 'active'`;
      return result.count;
    },

    async createKillSwitchRule(input) {
      await sql`
        insert into kill_switch_rules (
          id, user_id, ticker, report_id, signal_value, anchor_price, condition_id, condition_text, signal_type,
          rationale, threshold_value, threshold_unit, direction, prompt_version, state, source,
          created_at, updated_at, deactivated_at
        )
        values (
          ${input.id}, ${input.userId}, ${input.ticker.trim().toUpperCase()}, ${input.reportId ?? null},
          ${input.signalValue ?? null}, ${
        input.anchorPrice ?? null
      }, ${input.conditionId}, ${input.conditionText},
          ${input.signalType}, ${input.rationale}, ${input.thresholdValue ?? null}, ${
        input.thresholdUnit ?? null
      },
          ${input.direction ?? null}, ${input.promptVersion}, ${input.state}, ${input.source},
          ${input.createdAt}::timestamptz, ${input.updatedAt}::timestamptz, ${
        input.deactivatedAt ?? null
      }::timestamptz
        )`;
    },

    async upsertNameRelationship(input) {
      await sql`
        insert into name_relationships (
          relationship_id, user_id, source_ticker, target_ticker, relationship_type, confidence, state,
          source_report_id, prompt_version, evidence_text, rationale, created_at, updated_at, suppressed_at
        )
        values (
          ${input.relationshipId}, ${input.userId}, ${input.sourceTicker.trim().toUpperCase()},
          ${input.targetTicker.trim().toUpperCase()}, ${input.relationshipType}, ${input.confidence}, ${input.state},
          ${input.sourceReportId}, ${input.promptVersion}, ${input.evidenceText}, ${input.rationale},
          ${input.createdAt}::timestamptz, ${input.updatedAt}::timestamptz, ${
        input.suppressedAt ?? null
      }::timestamptz
        )
        on conflict (relationship_id) do update set
          user_id = excluded.user_id,
          source_ticker = excluded.source_ticker,
          target_ticker = excluded.target_ticker,
          relationship_type = excluded.relationship_type,
          confidence = excluded.confidence,
          state = excluded.state,
          source_report_id = excluded.source_report_id,
          prompt_version = excluded.prompt_version,
          evidence_text = excluded.evidence_text,
          rationale = excluded.rationale,
          updated_at = excluded.updated_at,
          suppressed_at = excluded.suppressed_at`;
    },

    async listWatchlistTickersByUser(userId) {
      const rows = await sql<Row[]>`
        select ticker from watchlists where user_id = ${userId} order by ticker asc`;
      return rows.map((row) => String(row.ticker));
    },

    async upsertThesisMonitorSnapshot(input) {
      const rows = await sql<Row[]>`
        insert into thesis_monitor_snapshots (
          user_id, ticker, state, reason, score, report_id, report_generated_at, report_schema_version,
          last_deep_dive_at, material_events_count, unreviewed_events_count, freshness_state, freshness_score,
          kill_switch_triggered_at, freshness_reason, updated_at
        )
        values (
          ${input.userId}, ${input.ticker.trim().toUpperCase()}, ${input.state}, ${input.reason}, ${input.score},
          ${input.reportId ?? null}, ${input.reportGeneratedAt ?? null}::timestamptz,
          ${input.reportSchemaVersion ?? null},
          ${input.lastDeepDiveAt ?? input.reportGeneratedAt ?? null}::timestamptz,
          ${Math.max(0, Math.floor(input.materialEventsCount))},
          ${Math.max(0, Math.floor(input.unreviewedEventsCount))},
          ${input.freshnessState}, ${Math.min(1, Math.max(0, input.freshnessScore))},
          ${input.killSwitchTriggeredAt ?? null}::timestamptz, ${input.freshnessReason},
          ${input.updatedAt}::timestamptz
        )
        on conflict (user_id, ticker) do update set
          state = excluded.state,
          reason = excluded.reason,
          score = excluded.score,
          report_id = excluded.report_id,
          report_generated_at = excluded.report_generated_at,
          report_schema_version = excluded.report_schema_version,
          last_deep_dive_at = excluded.last_deep_dive_at,
          material_events_count = excluded.material_events_count,
          unreviewed_events_count = excluded.unreviewed_events_count,
          freshness_state = excluded.freshness_state,
          freshness_score = excluded.freshness_score,
          kill_switch_triggered_at = excluded.kill_switch_triggered_at,
          freshness_reason = excluded.freshness_reason,
          updated_at = excluded.updated_at
        returning *`;
      return mapThesisMonitorSnapshot(rows[0]);
    },

    async listThesisMonitorSnapshotsByUser(userId) {
      const rows = await sql<Row[]>`
        select * from thesis_monitor_snapshots where user_id = ${userId} order by ticker asc`;
      return rows.map(mapThesisMonitorSnapshot);
    },

    async getUserSubscriptionTier(userId) {
      await sql`
        insert into subscriptions (user_id, tier, updated_at)
        values (${userId}, 'FREE', ${new Date().toISOString()})
        on conflict (user_id) do nothing`;
      const rows = await sql<Row[]>`select tier from subscriptions where user_id = ${userId} limit 1`;
      return rows[0]?.tier === "PRO" ? "PRO" : "FREE";
    },

    async upsertConvictionJournalEntry(input) {
      const rows = await sql<Row[]>`
        insert into conviction_journal_entries (
          journal_entry_id, user_id, ticker, event_type, source_type, source_id, event_at, title, summary,
          thesis_snapshot, evidence_refs, report_id, alert_ledger_id, war_room_id, monitor_snapshot_key,
          opposite_case_id, created_at, updated_at
        )
        values (
          ${input.id}, ${input.userId}, ${input.ticker.trim().toUpperCase()}, ${input.eventType},
          ${input.sourceType}, ${input.sourceId}, ${input.eventAt}::timestamptz, ${input.title}, ${input.summary},
          ${json(input.thesisSnapshot)}, ${json(input.evidenceRefs)}, ${input.reportId ?? null},
          ${input.alertLedgerId ?? null}, ${input.warRoomId ?? null}, ${input.monitorSnapshotKey ?? null},
          ${input.oppositeCaseId ?? null}, ${input.createdAt}::timestamptz, ${input.updatedAt}::timestamptz
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
        returning journal_entry_id`;
      return { id: String(rows[0].journal_entry_id) };
    },

    async getSupportedTicker(symbol) {
      const normalized = symbol.trim().toUpperCase();
      if (!normalized) return undefined;
      const rows = await sql<Row[]>`
        select symbol, company_name, exchange
          from ticker_registry
         where symbol = ${normalized}
           and is_supported = true
           and listing_status = 'active'`;
      const row = rows[0];
      return row
        ? {
          symbol: String(row.symbol),
          companyName: String(row.company_name),
          exchange: String(row.exchange),
        }
        : undefined;
    },

    async findLatestComparableDeepDiveReport(input) {
      const rows = await sql<Row[]>`
        select r.*
          from reports r
         where r.type = 'deep_dive'
           and r.ticker = ${input.ticker}
           and split_part(r.schema_version, '.', 1) = ${String(input.schemaMajor)}
           and r.created_at >= ${input.sinceIso}::timestamptz
           and exists (
             select 1 from jobs j where j.report_id = r.id and j.status = 'complete'
           )
         order by r.created_at desc
         limit 1`;
      return rows[0] ? mapReport(rows[0]) : undefined;
    },

    async listUsersWithWatchlist() {
      const rows = await sql<Row[]>`
        select user_id, array_agg(ticker order by ticker asc) as tickers
          from watchlists
         group by user_id`;
      return rows.map((row) => ({
        userId: String(row.user_id),
        tickers: Array.isArray(row.tickers) ? row.tickers.map((value: unknown) => String(value)) : [],
      }));
    },

    async listUsersWithDeviceTokenByNotificationType(input) {
      const userIds = cleanUserIds(input.userIds);
      const rows = await sql<Row[]>`
        select ud.user_id, ud.installation_id, ud.device_token
          from user_devices ud
          left join notification_preferences np
            on np.user_id = ud.user_id
           and np.notification_type = ${input.notificationType}
         where ud.invalidated_at is null
           and length(trim(ud.device_token)) > 0
           and coalesce(np.enabled, true) = true
           and (np.quiet_until is null or np.quiet_until <= now())
           and (${textArray(userIds)}::text[] is null or ud.user_id = any(${textArray(userIds)}::text[]))`;
      return rows.map((row) => ({
        userId: String(row.user_id),
        installationId: String(row.installation_id),
        deviceToken: String(row.device_token),
      }));
    },

    async listUsersWithEmailByNotificationType(input) {
      const userIds = cleanUserIds(input.userIds);
      const rows = await sql<Row[]>`
        select u.id as user_id, lower(trim(u.email)) as email
          from users u
          left join notification_preferences np
            on np.user_id = u.id
           and np.notification_type = ${input.notificationType}
         where u.verified_at is not null
           and length(trim(u.email)) > 0
           and coalesce(np.enabled, true) = true
           and (np.quiet_until is null or np.quiet_until <= now())
           and (${textArray(userIds)}::text[] is null or u.id = any(${textArray(userIds)}::text[]))
           and not exists (
             select 1 from user_email_preferences ep
              where ep.user_id = u.id and ep.email_opt_out = true
           )
         order by u.id asc`;
      return rows.map((row) => ({ userId: String(row.user_id), email: String(row.email) }));
    },

    async getNotificationPreferences(userId) {
      const rows = await sql<Row[]>`
        select notification_type, enabled from notification_preferences where user_id = ${userId}`;
      return rows.map((row) => ({ type: String(row.notification_type), enabled: Boolean(row.enabled) }));
    },

    async getAlertLedgerItem(input) {
      const rows = await sql<Row[]>`
        select id from alert_ledger where id = ${input.id} and user_id = ${input.userId} limit 1`;
      return rows[0] ? { id: String(rows[0].id) } : undefined;
    },

    async createAlertLedgerItem(input) {
      await sql`
        insert into alert_ledger (
          id, user_id, notification_type, category, route, title, body, reason_code, reason_text,
          delivery_state, feedback_state, muted_at, context, created_at, updated_at, detail_body
        )
        values (
          ${input.id}, ${input.userId}, ${input.notificationType}, ${input.category}, ${input.route},
          ${input.title}, ${input.body}, ${input.reasonCode}, ${input.reasonText}, ${input.deliveryState},
          null, null, ${
        json(input.context)
      }, ${input.createdAt}::timestamptz, ${input.updatedAt}::timestamptz,
          ${input.detailBody ?? null}
        )`;
    },

    async invalidateUserDeviceByInstallation(input) {
      const result = await sql`
        update user_devices
           set invalidated_at = ${input.invalidatedAt}::timestamptz,
               invalidation_reason = ${input.reason},
               updated_at = ${input.invalidatedAt}::timestamptz
         where user_id = ${input.userId}
           and installation_id = ${input.installationId.trim()}
           and invalidated_at is null`;
      return result.count > 0;
    },
  };
}
