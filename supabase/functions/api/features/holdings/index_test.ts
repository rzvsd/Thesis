import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, FakeStore } from "../user/test_fakes.ts";
import { holdingsRoutes } from "./index.ts";

function setup() {
  const store = new FakeStore();
  store.addUser("u1");
  return { store, routes: holdingsRoutes(store.holdingsDeps()) };
}

// Ported from market-pulse.test.ts (the POST /v1/user/holdings step) plus the research-state-routes rules.
Deno.test("holdings upsert, list and delete", async () => {
  const { routes } = setup();
  const added = await call(routes, "POST", "/v1/user/holdings", {
    userId: "u1",
    body: { ticker: "aapl", quantity: 2, cost_basis: 170, label: " Core manual holding ", notes: "  " },
  });
  assertEquals(added, {
    status: 200,
    body: {
      data: {
        ticker: "AAPL",
        quantity: 2,
        cost_basis: 170,
        label: "Core manual holding",
        updated_at: "2026-11-23T00:00:00.000Z",
      },
    },
  });
  await call(routes, "POST", "/v1/user/holdings", { userId: "u1", body: { ticker: "MSFT" } });
  const list = await call(routes, "GET", "/v1/user/holdings", { userId: "u1" });
  assertEquals((list.body.data as Record<string, unknown>[]).map((h) => h.ticker), ["AAPL", "MSFT"]);
  assertEquals((list.body.data as Record<string, unknown>[])[1], {
    ticker: "MSFT",
    updated_at: "2026-11-23T00:00:00.000Z",
  });

  assertEquals(await call(routes, "DELETE", "/v1/user/holdings/aapl", { userId: "u1" }), {
    status: 200,
    body: { deleted: true },
  });
  assertEquals(await call(routes, "DELETE", "/v1/user/holdings/AAPL", { userId: "u1" }), {
    status: 200,
    body: { deleted: false },
  });
});

Deno.test("holdings validation: 422 ticker, 404 unknown, 422 quantity and cost_basis", async () => {
  const { routes } = setup();
  const badTicker = await call(routes, "POST", "/v1/user/holdings", { userId: "u1", body: { ticker: "A1" } });
  assertEquals(badTicker.status, 422);
  assertEquals(badTicker.body.error_message, "ticker must be a valid US symbol.");
  const unknown = await call(routes, "POST", "/v1/user/holdings", { userId: "u1", body: { ticker: "ZZZZ" } });
  assertEquals(unknown.status, 404);
  assertEquals(unknown.body.error, "ticker_not_found");
  for (const quantity of [-1, "2", null]) {
    const res = await call(routes, "POST", "/v1/user/holdings", {
      userId: "u1",
      body: { ticker: "AAPL", quantity },
    });
    assertEquals(res.status, 422);
    assertEquals(res.body.error_message, "quantity must be a non-negative number when provided.");
  }
  const cost = await call(routes, "POST", "/v1/user/holdings", {
    userId: "u1",
    body: { ticker: "AAPL", cost_basis: -5 },
  });
  assertEquals(cost.status, 422);
  assertEquals(cost.body.error_message, "cost_basis must be a non-negative number when provided.");
  const badDelete = await call(routes, "DELETE", "/v1/user/holdings/A1", { userId: "u1" });
  assertEquals(badDelete.status, 422);
});

Deno.test("CSV import: header, per-row errors, follows new names within the FREE cap", async () => {
  const { store, routes } = setup();
  await store.follow("u1", "AAPL");
  await store.holdingsDeps().upsert("u1", {
    ticker: "AAPL",
    quantity: 1,
    costBasis: 99,
    label: "keep",
    notes: "n",
  });
  const csv = [
    "﻿Symbol,Qty,Cost Basis",
    'AAPL,"1,234.5",',
    "msft,10,$300.10",
    "",
    "1BAD,1,1",
    "TSLA,abc,1",
    "META,1,-3",
    "MSFT,2,2",
    "ZZZZ,1,1",
    "NVDA,5,100",
    "BRK.B,1,1",
  ].join("\r\n");
  const res = await call(routes, "POST", "/v1/user/holdings/import", { userId: "u1", body: { csv } });
  assertEquals(res.status, 200);
  assertEquals(res.body.data, {
    rows: 9,
    imported: ["AAPL", "MSFT", "NVDA"],
    newly_followed: ["MSFT", "NVDA"],
    errors: [
      {
        line: 5,
        ticker: "1BAD",
        error: "invalid_ticker",
        error_message: "Ticker must be a valid US symbol.",
      },
      {
        line: 6,
        ticker: "TSLA",
        error: "invalid_shares",
        error_message: "Shares must be a non-negative number.",
      },
      {
        line: 7,
        ticker: "META",
        error: "invalid_cost_basis",
        error_message: "Cost basis must be a non-negative number when provided.",
      },
      {
        line: 8,
        ticker: "MSFT",
        error: "duplicate_ticker",
        error_message: "Ticker appears more than once in this file.",
      },
      {
        line: 9,
        ticker: "ZZZZ",
        error: "ticker_not_found",
        error_message: "Ticker not found in supported NYSE/NASDAQ universe.",
      },
      {
        line: 11,
        ticker: "BRK.B",
        error: "name_limit_reached",
        error_message: "Name limit reached for FREE tier (3). Holdings must be followed names.",
      },
    ],
    watchlist: ["AAPL", "MSFT", "NVDA"],
  });
  const aapl = store.holdings.get("u1")!.get("AAPL")!;
  // Empty cost cell keeps the old cost basis, label and notes.
  assertEquals([aapl.quantity, aapl.costBasis, aapl.label, aapl.notes], [1234.5, 99, "keep", "n"]);
  assertEquals(store.holdings.get("u1")!.get("MSFT")!.costBasis, 300.1);
});

Deno.test("CSV import without a header uses ticker, shares, cost_basis order", async () => {
  const { routes } = setup();
  const res = await call(routes, "POST", "/v1/user/holdings/import", {
    userId: "u1",
    body: { csv: "AAPL,3\n,\n" },
  });
  const data = res.body.data as Record<string, unknown>;
  assertEquals(data.rows, 1);
  assertEquals(data.imported, ["AAPL"]);
  assertEquals(data.watchlist, ["AAPL"]);
});

Deno.test("CSV import returns 422 for empty csv, missing shares column and too many rows", async () => {
  const { routes } = setup();
  for (const body of [{}, { csv: "  " }, { csv: 5 }]) {
    const res = await call(routes, "POST", "/v1/user/holdings/import", { userId: "u1", body });
    assertEquals(res.status, 422);
    assertEquals(
      res.body.error_message,
      "csv must be a non-empty string with columns ticker, shares and optional cost_basis.",
    );
  }
  const noShares = await call(routes, "POST", "/v1/user/holdings/import", {
    userId: "u1",
    body: { csv: "ticker,cost\nAAPL,1" },
  });
  assertEquals(noShares.status, 422);
  assertEquals(noShares.body.error_message, "CSV header must include a shares (or quantity) column.");
  const many = Array.from({ length: 501 }, () => "AAPL,1").join("\n");
  const tooMany = await call(routes, "POST", "/v1/user/holdings/import", {
    userId: "u1",
    body: { csv: many },
  });
  assertEquals(tooMany.status, 422);
  assertEquals(tooMany.body.error_message, "CSV may contain at most 500 holdings.");
});
