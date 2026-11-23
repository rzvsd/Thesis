// Watchlist rows (app.watchlists, M1). SQL from PostgresStore in apps/product-api.
import { db, newId, nowIso } from "./common.ts";

export async function listWatchlistTickers(userId: string): Promise<string[]> {
  const rows = await db()`
    select ticker from watchlists where user_id = ${userId} order by ticker asc`;
  return rows.map((row) => String(row.ticker));
}

// Adding a ticker that is already there only refreshes added_at. Returns the updated list.
export async function addWatchlistTicker(userId: string, ticker: string): Promise<string[]> {
  await db()`
    insert into watchlists (id, user_id, ticker, added_at)
    values (${newId()}, ${userId}, ${ticker.trim().toUpperCase()}, ${nowIso()})
    on conflict (user_id, ticker) do update set added_at = excluded.added_at`;
  return listWatchlistTickers(userId);
}

export async function removeWatchlistTicker(userId: string, ticker: string): Promise<string[]> {
  await db()`delete from watchlists where user_id = ${userId} and ticker = ${ticker.trim().toUpperCase()}`;
  return listWatchlistTickers(userId);
}
