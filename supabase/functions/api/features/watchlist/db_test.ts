// End to end through app.handle() against the local database (skipped without THESIS_TEST_DB_URL).
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { handle } from "../../app.ts";
import {
  cleanup,
  dbTest,
  insertCoverage,
  insertTicker,
  insertUser,
  testSymbol,
} from "../../../_lib/store/profile_testdb.ts";

function req(method: string, path: string, body?: unknown, token = "tok"): Request {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

dbTest("app: watchlist, holdings, profile, devices, tickers and coverage on Postgres", async () => {
  Deno.env.set("RATE_LIMIT_DISABLED", "1");
  const user = await insertUser();
  const syms = [testSymbol(), testSymbol(), testSymbol(), testSymbol()].sort();
  const verify = () => Promise.resolve(user);
  const run = async (method: string, path: string, body?: unknown) => {
    const res = await handle(req(method, path, body), verify);
    return { status: res.status, body: await res.json() };
  };
  try {
    for (const s of syms) await insertTicker(s);
    await insertCoverage(syms[0], "success");

    const [a, b, c, d] = syms;
    for (const t of [a, b, c]) {
      assertEquals((await run("POST", "/watchlist", { ticker: t.toLowerCase() })).status, 200);
    }
    const capped = await run("POST", "/watchlist", { ticker: d });
    assertEquals([capped.status, capped.body.feature], [403, "watchlist_cap"]);
    assertEquals(await run("DELETE", `/watchlist/${c}`), { status: 200, body: { data: [a, b] } });
    assertEquals(await run("GET", "/watchlist"), { status: 200, body: { data: [a, b] } });

    const imp = await run("POST", "/v1/user/holdings/import", {
      csv: `ticker,shares\n${a},1\n${c},2\n${d},3\nZZQQ,1`,
    });
    assertEquals(imp.status, 200);
    assertEquals(imp.body.data.imported, [a, c]);
    assertEquals(imp.body.data.newly_followed, [c]);
    assertEquals(imp.body.data.errors.map((e: { error: string }) => e.error), [
      "name_limit_reached",
      "ticker_not_found",
    ]);
    assertEquals(imp.body.data.watchlist, [a, b, c]);

    const added = await run("POST", "/v1/user/holdings", { ticker: b, quantity: 4, cost_basis: 10.5 });
    assertEquals([added.body.data.ticker, added.body.data.quantity, added.body.data.cost_basis], [
      b,
      4,
      10.5,
    ]);
    assertEquals((await run("GET", "/v1/user/holdings")).body.data.map((h: { ticker: string }) => h.ticker), [
      a,
      b,
      c,
    ]);
    assertEquals(await run("DELETE", `/v1/user/holdings/${c}`), { status: 200, body: { deleted: true } });

    const profile = await run("GET", "/v1/user/profile");
    assertEquals([profile.status, profile.body.data.user_id, profile.body.data.tier], [200, user, "FREE"]);

    const dev = await run("POST", "/notifications/device-token", {
      device_token: `tok-${crypto.randomUUID()}`,
    });
    assertEquals(dev.body, { status: "ok", has_device_token: true, installation_id: `legacy:${user}` });

    const search = await run("GET", `/tickers/search?q=${a}`);
    assertEquals([search.status, search.body.data[0].symbol], [200, a]);
    assertEquals((await run("GET", "/tickers/search?q=QQQQQQQQQQQQQ")).status, 404);

    // Public route: no bearer needed.
    const cov = await handle(new Request(`http://test/v1/coverage?ticker=${a}`), () => Promise.resolve(null));
    assertEquals(await cov.json(), { data: { ticker: a, is_covered: true } });
  } finally {
    Deno.env.delete("RATE_LIMIT_DISABLED");
    await cleanup([user], syms);
  }
});
