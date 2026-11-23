import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, FakeStore } from "../user/test_fakes.ts";
import { watchlistRoutes } from "./index.ts";

function setup() {
  const store = new FakeStore();
  store.addUser("u1");
  return { store, routes: watchlistRoutes(store.watchlistDeps()) };
}

// Ported from subscription.test.ts "M4 subscriptions enforce Free/Pro gating and tier updates" (watchlist parts).
Deno.test("FREE watchlist caps at 3 with upgrade_required watchlist_cap; PRO lifts it", async () => {
  const { store, routes } = setup();
  for (const ticker of ["AAPL", "MSFT", "TSLA"]) {
    const added = await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker } });
    assertEquals(added.status, 200);
  }
  const blocked = await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker: "META" } });
  assertEquals(blocked.status, 403);
  assertEquals(blocked.body, {
    error: "upgrade_required",
    feature: "watchlist_cap",
    error_message: "Watchlist limit reached for FREE tier (3).",
  });

  // Adding one that is already there is fine at the cap.
  const again = await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker: "aapl" } });
  assertEquals(again, { status: 200, body: { data: ["AAPL", "MSFT", "TSLA"] } });

  store.tiers.set("u1", "PRO");
  const afterUpgrade = await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker: "META" } });
  assertEquals(afterUpgrade, { status: 200, body: { data: ["AAPL", "META", "MSFT", "TSLA"] } });
});

Deno.test("GET and DELETE return the list", async () => {
  const { routes } = setup();
  assertEquals(await call(routes, "GET", "/watchlist", { userId: "u1" }), {
    status: 200,
    body: { data: [] },
  });
  await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker: " brk.b " } });
  await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker: "AAPL" } });
  assertEquals(await call(routes, "GET", "/watchlist", { userId: "u1" }), {
    status: 200,
    body: { data: ["AAPL", "BRK.B"] },
  });
  assertEquals(await call(routes, "DELETE", "/watchlist/brk.b", { userId: "u1" }), {
    status: 200,
    body: { data: ["AAPL"] },
  });
  // Deleting a ticker that is not there still returns the list.
  assertEquals(await call(routes, "DELETE", "/watchlist/MSFT", { userId: "u1" }), {
    status: 200,
    body: { data: ["AAPL"] },
  });
});

Deno.test("bad tickers are 422, unknown ones 404 ticker_not_found", async () => {
  const { routes } = setup();
  for (const body of [{}, { ticker: "" }, { ticker: "AAPL1" }, { ticker: "TOOLONGTICKER" }, { ticker: 5 }]) {
    const res = await call(routes, "POST", "/watchlist", { userId: "u1", body });
    assertEquals(res.status, 422);
    assertEquals(res.body, {
      error: "validation_failed",
      error_message: "ticker must be a valid US symbol.",
    });
  }
  const unknown = await call(routes, "POST", "/watchlist", { userId: "u1", body: { ticker: "ZZZZZZ" } });
  assertEquals(unknown.status, 404);
  assertEquals(unknown.body.error, "ticker_not_found");
  const badDelete = await call(routes, "DELETE", "/watchlist/A1", { userId: "u1" });
  assertEquals(badDelete.status, 422);
});

Deno.test("watchlist buckets collapse like the old server", async () => {
  const store = new FakeStore();
  store.addUser("u1");
  const keys: string[] = [];
  const routes = watchlistRoutes({
    ...store.watchlistDeps(),
    limit: (_req, key) => {
      keys.push(key);
      return Promise.resolve(null);
    },
  });
  await call(routes, "GET", "/watchlist", { userId: "u1" });
  await call(routes, "DELETE", "/watchlist/AAPL", { userId: "u1" });
  await call(routes, "DELETE", "/watchlist/MSFT", { userId: "u1" });
  assertEquals(keys, ["/watchlist", "/watchlist/:ticker", "/watchlist/:ticker"]);
});
