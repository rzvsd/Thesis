// Research holdings (app.user_research_holdings, M1). SQL from PostgresStore in apps/product-api.
import { db, iso, nowIso } from "./common.ts";

export interface HoldingRecord {
  ticker: string;
  quantity?: number;
  costBasis?: number;
  label?: string;
  notes?: string;
  updatedAt: string;
}

export interface HoldingInput {
  ticker: string;
  quantity?: number;
  costBasis?: number;
  label?: string;
  notes?: string;
}

function mapHolding(row: Record<string, unknown>): HoldingRecord {
  return {
    ticker: String(row.ticker),
    quantity: row.quantity == null ? undefined : Number(row.quantity),
    costBasis: row.cost_basis == null ? undefined : Number(row.cost_basis),
    label: row.label == null ? undefined : String(row.label),
    notes: row.notes == null ? undefined : String(row.notes),
    updatedAt: iso(row.updated_at) ?? nowIso(),
  };
}

// The JSON shape the old server returns (UserResearchHolding).
export function toHoldingView(h: HoldingRecord): Record<string, unknown> {
  return {
    ticker: h.ticker,
    ...(h.quantity !== undefined ? { quantity: h.quantity } : {}),
    ...(h.costBasis !== undefined ? { cost_basis: h.costBasis } : {}),
    ...(h.label ? { label: h.label } : {}),
    ...(h.notes ? { notes: h.notes } : {}),
    updated_at: h.updatedAt,
  };
}

export async function listHoldings(userId: string): Promise<HoldingRecord[]> {
  const rows = await db()`
    select * from user_research_holdings where user_id = ${userId} order by ticker asc`;
  return rows.map(mapHolding);
}

export async function upsertHolding(userId: string, input: HoldingInput): Promise<HoldingRecord> {
  const now = nowIso();
  const rows = await db()`
    insert into user_research_holdings (user_id, ticker, quantity, cost_basis, label, notes, created_at, updated_at)
    values (${userId}, ${input.ticker.trim().toUpperCase()}, ${input.quantity ?? null}, ${
    input.costBasis ?? null
  },
            ${input.label ?? null}, ${input.notes ?? null}, ${now}::timestamptz, ${now}::timestamptz)
    on conflict (user_id, ticker) do update set
      quantity = excluded.quantity,
      cost_basis = excluded.cost_basis,
      label = excluded.label,
      notes = excluded.notes,
      updated_at = excluded.updated_at
    returning *`;
  return mapHolding(rows[0]);
}

export async function deleteHolding(userId: string, ticker: string): Promise<boolean> {
  const rows = await db()`
    delete from user_research_holdings
     where user_id = ${userId} and ticker = ${ticker.trim().toUpperCase()}
    returning ticker`;
  return rows.length > 0;
}
