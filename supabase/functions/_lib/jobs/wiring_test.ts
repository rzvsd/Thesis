// latestClose against a real Postgres with M3's market_prices_daily table, only when TEST_DB_URL is set.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import postgres from "npm:postgres@3.4.5";
import { postgresLatestClose } from "./wiring.ts";

const url = Deno.env.get("TEST_DB_URL");

Deno.test({
  name: "latestClose reads the newest close no older than 5 days, else undefined",
  ignore: !url,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sql = postgres(url!, {
      prepare: false,
      max: 2,
      connection: { search_path: "app, extensions, public" },
    });
    const ticker = `T${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    try {
      await sql`insert into market_prices_daily (ticker, market_date, close, provider) values
        (${ticker}, '2026-11-20', 101.5, 'test'), (${ticker}, '2026-11-23', 103.25, 'test'),
        (${ticker}, '2026-11-26', 999, 'test')`;
      const at = (iso: string) => postgresLatestClose(sql, () => new Date(iso));
      assertEquals(await at("2026-11-24T12:00:00Z")(ticker.toLowerCase()), 103.25);
      assertEquals(await at("2026-11-21T12:00:00Z")(ticker), 101.5);
      assertEquals(await at("2026-12-10T12:00:00Z")(ticker), undefined);
      assertEquals(await at("2026-11-24T12:00:00Z")("NOPE"), undefined);
    } finally {
      await sql`delete from market_prices_daily where ticker = ${ticker}`;
      await sql.end();
    }
  },
});

Deno.test("latestClose returns undefined when the query fails", async () => {
  const failing = (() => Promise.reject(new Error("relation does not exist"))) as unknown as Parameters<
    typeof postgresLatestClose
  >[0];
  assertEquals(await postgresLatestClose(failing)("AAPL"), undefined);
});
