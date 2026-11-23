// SQL for Pulse reads. Owner: M1. Copied from PostgresStore (apps/product-api/src/store.ts).
// app.reports rows of type market_pulse are written by M3; app.user_research_states is M3's table (read only here).
import type { ReportRecord, UserResearchState } from "../reports/types.ts";
import { db, iso } from "./common.ts";
import { mapReport } from "./reports.ts";

export interface UserResearchStateRecord {
  stateId: string;
  userId: string;
  asOf: string;
  generatedAt: string;
  state: UserResearchState;
}

export async function getLatestReportByType(type: ReportRecord["type"]): Promise<ReportRecord | undefined> {
  const rows = await db()`
    select *
      from reports
     where type = ${type}
     order by created_at desc
     limit 1`;
  return rows[0] ? mapReport(rows[0]) : undefined;
}

export async function getReportByTypeAndDate(
  type: ReportRecord["type"],
  date: string,
): Promise<ReportRecord | undefined> {
  const rows = await db()`
    select *
      from reports
     where type = ${type}
       and (created_at at time zone 'UTC')::date = ${date}::date
     order by created_at desc
     limit 1`;
  return rows[0] ? mapReport(rows[0]) : undefined;
}

function mapUserResearchState(row: Record<string, unknown>): UserResearchStateRecord {
  const raw = row.state;
  const state = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
  const asOf = row.as_of instanceof Date
    ? row.as_of.toISOString().slice(0, 10)
    : (iso(row.as_of)?.slice(0, 10) ?? String(row.as_of).slice(0, 10));
  return {
    stateId: String(row.state_id),
    userId: String(row.user_id),
    asOf,
    generatedAt: iso(row.generated_at) ?? new Date().toISOString(),
    state: JSON.parse(JSON.stringify(state)),
  };
}

export async function getLatestUserResearchState(
  input: { userId: string; asOf?: string },
): Promise<UserResearchStateRecord | undefined> {
  const asOf = input.asOf ?? null;
  const rows = await db()`
    select *
      from user_research_states
     where user_id = ${input.userId}
       and (${asOf}::date is null or as_of <= ${asOf}::date)
     order by as_of desc, generated_at desc
     limit 1`;
  return rows[0] ? mapUserResearchState(rows[0]) : undefined;
}
