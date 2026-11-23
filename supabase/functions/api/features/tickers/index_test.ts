import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, FakeStore } from "../user/test_fakes.ts";
import { SEARCH_LIMIT, tickersRoutes } from "./index.ts";

// Ported from ticker-search.test.ts "ticker search endpoint enforces auth and returns supported symbols".
// The 401 part is the auth guard's job (app_test.ts); the /jobs part belongs to M2.
Deno.test("ticker search returns supported symbols and 404 when nothing matches", async () => {
  const store = new FakeStore();
  const routes = tickersRoutes(store.tickersDeps());
  const found = await call(routes, "GET", "/tickers/search?q=AAPL", { userId: "u1" });
  assertEquals(found.status, 200);
  const rows = found.body.data as Record<string, unknown>[];
  assertEquals(rows[0], { symbol: "AAPL", company_name: "Apple Inc.", exchange: "NASDAQ" });

  const missing = await call(routes, "GET", "/tickers/search?q=ZZZZZZ", { userId: "u1" });
  assertEquals(missing.status, 404);
  assertEquals(missing.body, {
    error: "ticker_not_found",
    error_message: "Ticker not found in supported NYSE/NASDAQ universe.",
  });

  const alias = await call(routes, "GET", "/tickers?q=micro", { userId: "u1" });
  assertEquals((alias.body.data as Record<string, unknown>[]).map((r) => r.symbol), ["MSFT"]);
});

Deno.test("ticker search needs q and asks for at most 25", async () => {
  const store = new FakeStore();
  let asked = 0;
  const routes = tickersRoutes({
    ...store.tickersDeps(),
    search: (q, limit) => {
      asked = limit;
      return store.tickersDeps().search(q, limit);
    },
  });
  for (const path of ["/tickers/search", "/tickers/search?q=", "/tickers/search?q=%20%20"]) {
    const res = await call(routes, "GET", path, { userId: "u1" });
    assertEquals(res.status, 422);
    assertEquals(res.body, { error: "validation_failed", error_message: "query parameter q is required." });
  }
  await call(routes, "GET", "/tickers/search?q=a", { userId: "u1" });
  assertEquals(asked, SEARCH_LIMIT);
  assertEquals(SEARCH_LIMIT, 25);
});

Deno.test("coverage lists covered tickers and answers per ticker", async () => {
  const store = new FakeStore();
  const routes = tickersRoutes(store.tickersDeps());
  assertEquals(routes.find((r) => r.path === "/v1/coverage")?.auth, "none");
  assertEquals(await call(routes, "GET", "/v1/coverage"), {
    status: 200,
    body: { data: { count: 2, tickers: ["AAPL", "MSFT"] } },
  });
  assertEquals(await call(routes, "GET", "/v1/coverage?ticker=aapl"), {
    status: 200,
    body: { data: { ticker: "AAPL", is_covered: true } },
  });
  assertEquals(await call(routes, "GET", "/v1/coverage?ticker=TSLA"), {
    status: 200,
    body: { data: { ticker: "TSLA", is_covered: false } },
  });
  for (const q of ["", "A1"]) {
    const bad = await call(routes, "GET", `/v1/coverage?ticker=${q}`);
    assertEquals(bad.status, 422);
    assertEquals(bad.body.error_message, "ticker must be a valid US symbol.");
  }
});
