// SQL for report reads, notes and share links. Owner: M1. Copied from PostgresStore (apps/product-api/src/store.ts).
// app.reports and app.jobs belong to M2 (read only here); app.ticker_registry belongs to M3 (read only here).
import type { ReportRecord } from "../reports/types.ts";
import { db, iso, newId, nowIso } from "./common.ts";

export interface ReportNoteRecord {
  reportId: string;
  userId: string;
  content: string;
  updatedAt: string;
}

export interface ReportShareRecord {
  token: string;
  reportId: string;
  userId: string;
  createdAt: string;
}

export function mapReport(row: Record<string, unknown>): ReportRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as ReportRecord["type"],
    ticker: row.ticker ? String(row.ticker) : undefined,
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    fingerprint: row.fingerprint ? String(row.fingerprint) : undefined,
    freshnessExpiresAt: iso(row.freshness_expires_at),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    isCurrent: Boolean(row.is_current),
    llmUsage: row.llm_usage ? (row.llm_usage as Record<string, unknown>) : undefined,
  };
}

function mapReportNote(row: Record<string, unknown>): ReportNoteRecord {
  return {
    reportId: String(row.report_id),
    userId: String(row.user_id),
    content: String(row.content ?? ""),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

export async function getReportById(id: string): Promise<ReportRecord | undefined> {
  const rows = await db()`select * from reports where id = ${id}`;
  return rows[0] ? mapReport(rows[0]) : undefined;
}

// A user may read a report when one of their jobs completed with it.
export async function hasReportAccessForUser(userId: string, reportId: string): Promise<boolean> {
  const rows = await db()`
    select 1
      from jobs
     where user_id = ${userId}
       and status = 'complete'
       and report_id = ${reportId}
     limit 1`;
  return rows.length > 0;
}

export async function listReportsByUser(userId: string): Promise<ReportRecord[]> {
  const rows = await db()`
    select distinct r.*
      from reports r
      join jobs j on j.report_id = r.id
     where j.user_id = ${userId}
       and j.status = 'complete'
     order by r.created_at desc`;
  return rows.map((row) => mapReport(row));
}

export async function getReportNote(reportId: string, userId: string): Promise<ReportNoteRecord | undefined> {
  const rows = await db()`
    select *
      from report_notes
     where report_id = ${reportId}
       and user_id = ${userId}`;
  return rows[0] ? mapReportNote(rows[0]) : undefined;
}

export async function upsertReportNote(input: {
  reportId: string;
  userId: string;
  content: string;
  updatedAt: string;
}): Promise<ReportNoteRecord> {
  const rows = await db()`
    insert into report_notes (report_id, user_id, content, updated_at)
    values (${input.reportId}, ${input.userId}, ${input.content}, ${input.updatedAt}::timestamptz)
    on conflict (report_id, user_id) do update set
      content = excluded.content,
      updated_at = excluded.updated_at
    returning *`;
  return mapReportNote(rows[0]);
}

export async function getReportShareToken(
  input: { userId: string; reportId: string },
): Promise<string | undefined> {
  const rows = await db()`
    select token from report_shares where created_by = ${input.userId} and report_id = ${input.reportId} limit 1`;
  return rows[0] ? String(rows[0].token) : undefined;
}

export async function createReportShare(input: ReportShareRecord): Promise<void> {
  await db()`
    insert into report_shares (token, report_id, created_by, created_at)
    values (${input.token}, ${input.reportId}, ${input.userId}, ${input.createdAt}::timestamptz)`;
}

export async function getReportShareByToken(token: string): Promise<ReportShareRecord | undefined> {
  const rows = await db()`
    select token, report_id, created_by, created_at from report_shares where token = ${token}`;
  const row = rows[0];
  return row
    ? {
      token: String(row.token),
      reportId: String(row.report_id),
      userId: String(row.created_by),
      createdAt: iso(row.created_at) ?? "",
    }
    : undefined;
}

// Issuer name and exchange for a supported, active ticker (ticker_registry, M3's table).
export async function getSupportedTicker(
  symbol: string,
): Promise<{ companyName: string; exchange: string } | undefined> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  const rows = await db()`
    select company_name, exchange
      from ticker_registry
     where symbol = ${normalized}
       and is_supported = true
       and listing_status = 'active'`;
  return rows[0]
    ? { companyName: String(rows[0].company_name), exchange: String(rows[0].exchange) }
    : undefined;
}

// Audit row (app.audit_events, M0's table). Payloads carry ids only, never emails or tokens (N10).
export async function appendAuditEvent(
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  await db()`
    insert into audit_events (id, user_id, event_type, payload, created_at)
    values (${newId()}, ${userId ?? null}, ${eventType}, ${db().json(payload as never)}, ${nowIso()})`;
}
