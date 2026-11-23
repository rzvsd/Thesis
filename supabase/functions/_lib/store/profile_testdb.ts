// Helpers for the DB-gated tests of the M1 user/watchlist/holdings/devices/tickers stores.
// They run only when THESIS_TEST_DB_URL is set (CI has no database). Every row uses unique ids and is removed.
import { db } from "./common.ts";

export const DB_URL = Deno.env.get("THESIS_TEST_DB_URL");

// postgres.js keeps idle sockets and timers, so the Deno sanitizers are off for these tests.
export function dbTest(name: string, fn: () => Promise<void>): void {
  Deno.test({ name, ignore: !DB_URL, sanitizeOps: false, sanitizeResources: false, fn });
}

function letters(n: number): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % 26]).join("");
}

// A unique, valid-looking symbol, e.g. "ZQXKDJWA".
export function testSymbol(): string {
  return `ZQX${letters(5)}`;
}

export async function insertUser(): Promise<string> {
  const id = `m1-test-${crypto.randomUUID()}`;
  await db()`insert into users (id, email, created_at) values (${id}, ${`${id}@example.test`}, now())`;
  return id;
}

export async function insertTicker(
  symbol: string,
  opts: { company?: string; supported?: boolean; status?: string; exchange?: string } = {},
): Promise<void> {
  await db()`
    insert into ticker_registry (symbol, company_name, exchange, listing_status, is_supported, source_feed,
                                 source_updated_at, last_synced_at)
    values (${symbol}, ${opts.company ?? `${symbol} Test Corp`}, ${opts.exchange ?? "NASDAQ"},
            ${opts.status ?? "active"}, ${opts.supported ?? true}, 'm1-test', now(), now())`;
}

export async function insertCoverage(ticker: string, status: string, tier = 1): Promise<void> {
  await db()`
    insert into ticker_coverage (ticker, last_synced_at, last_sync_status, backfill_tier)
    values (${ticker}, now(), ${status}, ${tier})`;
}

// Deleting the user cascades to watchlists, holdings, devices and preferences.
export async function cleanup(userIds: string[], symbols: string[]): Promise<void> {
  const sql = db();
  if (userIds.length) {
    await sql`delete from subscriptions where user_id = any(${userIds}::text[])`;
    await sql`delete from deep_dive_daily_usage where user_id = any(${userIds}::text[])`;
    await sql`delete from users where id = any(${userIds}::text[])`;
  }
  if (symbols.length) {
    await sql`delete from ticker_coverage where ticker = any(${symbols}::text[])`;
    await sql`delete from ticker_registry where symbol = any(${symbols}::text[])`;
  }
}
