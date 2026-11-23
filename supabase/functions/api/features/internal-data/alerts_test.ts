// Alert evaluators: kill switch, contrarian, freshness, earnings preview, cross-name, weekly digest.
// Each test covers the happy path, inbox rows while push is disabled, a rerun (no duplicates) and paging.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import type { EmailSender } from "../../../_lib/evaluators/push_port.ts";
import { addUser, earnings, post, price, recordingPush, rule, setup, snapshot } from "./test_support.ts";

const KS = "/internal/notifications/kill-switch/evaluate";

Deno.test("kill switch: inbox row with push disabled, rerun adds nothing", async () => {
  const { store } = setup();
  addUser(store, "u1", { device: true });
  store.rules.push(rule("r1", "u1", "AAPL"));
  store.prices.push(price("AAPL", 90));
  const res = await post(KS, { as_of: "2026-11-20" });
  assertEquals(res.status, 200);
  assertEquals([res.body.evaluated, res.body.matched, res.body.attempted, res.body.delivered], [1, 1, 0, 0]);
  assertEquals(res.body.trigger_key, "daily:2026-11-20");
  assertEquals(res.body.next_cursor, null);
  assertEquals(store.alerts.length, 1);
  assertEquals(store.alerts[0].notificationType, "kill_switch");
  assertEquals(store.alerts[0].deliveryState, "sent");

  const again = await post(KS, { as_of: "2026-11-20" });
  assertEquals([again.body.evaluated, again.body.matched, again.body.skipped], [0, 0, 1]);
  assertEquals(store.alerts.length, 1);
  assertEquals(store.evaluations.length, 1);
});

Deno.test("kill switch: no price means skipped, fixtures match other signal types", async () => {
  const { store } = setup();
  addUser(store, "u1");
  store.rules.push(rule("r1", "u1", "AAPL"));
  store.rules.push(rule("r2", "u1", "MSFT", { signalType: "news_sentiment", anchorPrice: undefined }));
  const res = await post(KS, {
    as_of: "2026-11-20",
    fixtures: [{ ticker: "msft", signal_type: "sentiment", reason_text: "Bad news." }],
  });
  assertEquals([res.body.evaluated, res.body.matched, res.body.skipped], [2, 1, 1]);
  assertEquals(store.alerts[0].reasonText, "Bad news.");
});

Deno.test("kill switch: pages by user with next_cursor", async () => {
  const { store } = setup();
  for (const id of ["u1", "u2", "u3"]) {
    addUser(store, id);
    store.rules.push(rule(`r-${id}`, id, "AAPL"));
  }
  store.prices.push(price("AAPL", 90));
  const p1 = await post(KS, { as_of: "2026-11-20", limit: 2 });
  assertEquals(p1.body.evaluated, 2);
  assertEquals(p1.body.next_cursor, "u2");
  const p2 = await post(KS, { as_of: "2026-11-20", limit: 2, cursor: "u2" });
  assertEquals(p2.body.evaluated, 1);
  assertEquals(p2.body.next_cursor, null);
  assertEquals(store.alerts.length, 3);
});

Deno.test("kill switch: push sender is used when wired", async () => {
  const push = recordingPush();
  const { store } = setup({ push });
  addUser(store, "u1", { device: true });
  store.rules.push(rule("r1", "u1", "AAPL"));
  store.prices.push(price("AAPL", 90));
  const res = await post(KS, { as_of: "2026-11-20" });
  assertEquals([res.body.attempted, res.body.delivered], [1, 1]);
  assertEquals(push.sent.length, 1);
  await post(KS, { as_of: "2026-11-20" });
  assertEquals(push.sent.length, 1);
});

Deno.test("contrarian: fires once per anchor, deactivates it, expires old anchors", async () => {
  const { store } = setup();
  addUser(store, "u1");
  const anchor = {
    userId: "u1",
    signalValue: "positive" as const,
    anchorPrice: 100,
    anchoredAt: "2026-11-01T00:00:00Z",
    isActive: true,
  };
  store.anchors.push({ ...anchor, id: "a1", ticker: "AAPL", expiresAt: "2026-12-31T00:00:00Z" });
  store.anchors.push({ ...anchor, id: "a2", ticker: "MSFT", expiresAt: "2026-11-01T00:00:00Z" });
  store.prices.push(price("AAPL", 94));
  const url = "/internal/notifications/contrarian/evaluate";
  const res = await post(url, { as_of: "2026-11-20" });
  assertEquals([res.body.fired, res.body.expired_count], [1, 1]);
  assertEquals(store.alerts.length, 1);
  assertEquals(store.anchors.every((a) => !a.isActive), true);
  const again = await post(url, { as_of: "2026-11-20" });
  assertEquals(again.body.fired, 0);
  assertEquals(store.alerts.length, 1);
});

Deno.test("freshness decay: one alert per user and date, cooldown, empty user_ids means everyone", async () => {
  const { store } = setup();
  addUser(store, "u1");
  addUser(store, "u2");
  store.snapshots.push(snapshot("u1", "AAPL", { freshnessState: "stale", freshnessScore: 0.3 }));
  store.snapshots.push(snapshot("u1", "MSFT", { freshnessState: "triggered", freshnessScore: 0.2 }));
  const url = "/internal/notifications/freshness-decay";
  const res = await post(url, { as_of: "2026-11-20", user_ids: [] });
  assertEquals([res.body.evaluated, res.body.fired], [2, 1]);
  assertEquals(store.alerts[0].context.ticker, "MSFT");
  const again = await post(url, { as_of: "2026-11-20" });
  assertEquals(again.body.fired, 0);
  assertEquals(store.alerts.length, 1);
  const filtered = await post(url, { as_of: "2026-11-21", user_ids: ["u2"] });
  assertEquals(filtered.body.evaluated, 0);
});

Deno.test("earnings preview: free users plus war room fallback users, stable per session date", async () => {
  const { store } = setup();
  addUser(store, "free1", { tickers: ["AAPL"] });
  addUser(store, "pro1", { tier: "PRO", tickers: ["AAPL"] });
  addUser(store, "pro2", { tier: "PRO", tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-23"));
  const url = "/internal/notifications/earnings-preview";
  const res = await post(url, { as_of: "2026-11-20", fallback_user_ids: ["pro1"], user_ids: ["pro1"] });
  assertEquals(res.status, 200);
  assertEquals(res.body.fallback_user_count, 1);
  assertEquals(store.alerts.map((a) => a.userId).sort(), ["free1", "pro1"]);
  assertEquals(store.alerts[0].context.ticker, "AAPL");
  await post(url, { as_of: "2026-11-20", user_ids: ["pro1"] });
  assertEquals(store.alerts.length, 2);
  // The old body key (user_ids) still works on its own.
  await post(url, { as_of: "2026-11-20", user_ids: ["pro2"] });
  assertEquals(store.alerts.length, 3);
});

Deno.test("earnings preview: fallback users only on the first page", async () => {
  const { store } = setup();
  addUser(store, "a", { tickers: ["AAPL"] });
  addUser(store, "b", { tickers: ["AAPL"] });
  addUser(store, "p", { tier: "PRO", tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-23"));
  const url = "/internal/notifications/earnings-preview";
  const p1 = await post(url, { as_of: "2026-11-20", limit: 1, fallback_user_ids: ["p"] });
  assertEquals(p1.body.next_cursor, "a");
  const p2 = await post(url, { as_of: "2026-11-20", limit: 1, fallback_user_ids: ["p"], cursor: "a" });
  assertEquals(p2.body.next_cursor, "b");
  assertEquals(store.alerts.map((x) => x.userId).sort(), ["a", "b", "p"]);
});

Deno.test("cross-name: Pro user with the target on the watchlist gets one alert per trigger key", async () => {
  const { store } = setup();
  addUser(store, "pro", { tier: "PRO", tickers: ["NVDA"] });
  addUser(store, "free", { tickers: ["NVDA"] });
  const rel = {
    sourceTicker: "TSM",
    targetTicker: "NVDA",
    relationshipType: "supplier" as const,
    confidence: 0.9,
    state: "active" as const,
    sourceReportId: "r1",
    promptVersion: "v1",
    evidenceText: "Supplier.",
    rationale: "TSM makes NVDA chips.",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
  store.relationships.set("rel-pro", { ...rel, relationshipId: "rel-pro", userId: "pro" });
  store.relationships.set("rel-free", { ...rel, relationshipId: "rel-free", userId: "free" });
  store.relationships.set("rel-low", { ...rel, relationshipId: "rel-low", userId: "pro", confidence: 0.5 });
  const url = "/internal/notifications/cross-name/evaluate";
  const body = { as_of: "2026-11-20", fixtures: [{ source_ticker: "tsm", signal_type: "price_move_pct" }] };
  const res = await post(url, body);
  assertEquals([res.body.evaluated, res.body.matched, res.body.suppressed], [2, 1, 1]);
  assertEquals(store.alerts.length, 1);
  assertEquals(store.alerts[0].userId, "pro");
  const again = await post(url, body);
  assertEquals([again.body.matched, again.body.suppressed], [0, 2]);
  assertEquals(store.alerts.length, 1);
  assertEquals((await post(url, { ...body, confidence_threshold: 0.1 })).body.confidence_threshold, 0.7);
});

Deno.test("weekly digest: Sunday only, inbox + email per Pro user, rerun sends nothing", async () => {
  const mails: string[] = [];
  const email: EmailSender = {
    mode: "test",
    send: (targets) => {
      for (const t of targets) mails.push(t.userId);
      return Promise.resolve({ attempted: targets.length, delivered: targets.length, failed: 0, skipped: 0 });
    },
  };
  const { store } = setup({ email });
  addUser(store, "pro", { tier: "PRO", tickers: ["AAPL"] });
  addUser(store, "free", { tickers: ["AAPL"] });
  const url = "/internal/notifications/weekly-digest";
  const friday = await post(url, { digest_date: "2026-11-20" });
  assertEquals(friday.body, {
    status: "skipped",
    digest_date: "2026-11-20",
    reason: "not_weekly_digest_day",
  });

  const res = await post(url, { digest_date: "2026-11-22" });
  assertEquals(res.status, 200);
  assertEquals([res.body.email_attempted, res.body.email_delivered, res.body.attempted], [1, 1, 0]);
  assertEquals(store.alerts.length, 1);
  assertEquals(store.alerts[0].context.digest_date, "2026-11-22");
  assertEquals(mails, ["pro"]);

  const again = await post(url, { digest_date: "2026-11-22" });
  assertEquals([again.body.email_attempted, again.body.already_sent], [0, 1]);
  assertEquals(store.alerts.length, 1);
  assertEquals(mails.length, 1);
});

Deno.test("weekly digest: disabled email and push still write the inbox row", async () => {
  const { store } = setup();
  addUser(store, "pro", { tier: "PRO", device: true });
  const res = await post("/internal/notifications/weekly-digest", { digest_date: "2026-11-22", limit: 1 });
  assertEquals([res.body.total_attempted, res.body.total_failed], [0, 0]);
  assertEquals(res.body.next_cursor, "pro");
  assertEquals(store.alerts.length, 1);
  assert(String(store.alerts[0].body).includes("Macro Stress data is not ready yet."));
});
