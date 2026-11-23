// Behaviour from apps/product-api/tests/ph4-m2-alert-ledger.test.ts.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { call, memoryDeps, OTHER_USER, USER } from "../../../_lib/research/testing.ts";
import type { AlertLedgerRecord } from "../../../_lib/research/types.ts";
import { alertFeedbackHandler, alertGetHandler, alertMuteHandler, alertsListHandler } from "./alerts.ts";

function alert(id: string, category: AlertLedgerRecord["category"], createdAt: string): AlertLedgerRecord {
  return {
    id,
    userId: USER,
    notificationType: "kill_switch",
    category,
    route: "names",
    title: "AAPL kill switch",
    body: "Headline",
    detailBody: "What changed in detail.",
    reasonCode: "kill_switch_triggered",
    reasonText: "Price crossed the rule.",
    deliveryState: "sent",
    context: { ticker: "AAPL" },
    createdAt,
    updatedAt: createdAt,
  };
}

function setup() {
  const deps = memoryDeps();
  deps.store.alerts.push(
    alert("a1", "thesis_drift", "2026-11-01T00:00:00.000Z"),
    alert("a2", "macro", "2026-11-02T00:00:00.000Z"),
  );
  return deps;
}

Deno.test("alerts list: newest first; Free gets detail_locked and no detail_body", async () => {
  const deps = setup();
  const res = await call(alertsListHandler(deps), { path: "/v1/user/alerts" });
  assertEquals(res.status, 200);
  assertEquals(res.body.data.map((a: { id: string }) => a.id), ["a2", "a1"]);
  assertEquals(res.body.data[0].detail_locked, true);
  assert(!("detail_body" in res.body.data[0]));

  deps.store.tiers.set(USER, "PRO");
  const pro = await call(alertsListHandler(deps), { path: "/v1/user/alerts?category=macro&limit=5" });
  assertEquals(pro.body.data.length, 1);
  assertEquals(pro.body.data[0].detail_body, "What changed in detail.");
  assert(!("detail_locked" in pro.body.data[0]));
});

Deno.test("alerts list 422s", async () => {
  const h = alertsListHandler(setup());
  assertEquals((await call(h, { path: "/v1/user/alerts?limit=0" })).status, 422);
  const bad = await call(h, { path: "/v1/user/alerts?category=nope" });
  assertEquals(bad.status, 422);
  assertEquals(bad.body.error_message, "category must be one of: thesis_drift, earnings, macro, system.");
});

Deno.test("alert detail: 200 for the owner, 404 alert_not_found otherwise", async () => {
  const deps = setup();
  const h = alertGetHandler(deps);
  const ok = await call(h, { path: "/v1/user/alerts/a1", params: { id: "a1" } });
  assertEquals(ok.status, 200);
  assertEquals(ok.body.data.id, "a1");
  const foreign = await call(h, { path: "/v1/user/alerts/a1", params: { id: "a1" }, userId: OTHER_USER });
  assertEquals(foreign.status, 404);
  assertEquals(foreign.body, { error: "alert_not_found", error_message: "Alert not found." });
});

Deno.test("alert feedback: stores it, writes a Pro journal entry, validates", async () => {
  const deps = setup();
  deps.store.tiers.set(USER, "PRO");
  const h = alertFeedbackHandler(deps);
  const ok = await call(h, {
    method: "POST",
    path: "/v1/user/alerts/a1/feedback",
    params: { id: "a1" },
    body: { feedback: "useful" },
  });
  assertEquals(ok.status, 200);
  assertEquals(ok.body.data.feedback_state, "useful");
  assertEquals(deps.store.journal.length, 1);
  assertEquals(deps.store.journal[0].eventType, "alert_feedback_recorded");
  assertEquals(deps.store.journal[0].summary, "User marked the alert as useful.");

  const bad = await call(h, {
    method: "POST",
    path: "/v1/user/alerts/a1/feedback",
    params: { id: "a1" },
    body: { feedback: "meh" },
  });
  assertEquals(bad.status, 422);
  const missing = await call(h, {
    method: "POST",
    path: "/v1/user/alerts/zz/feedback",
    params: { id: "zz" },
    body: { feedback: "not_useful" },
  });
  assertEquals(missing.status, 404);
});

Deno.test("alert feedback from a Free user writes no journal entry", async () => {
  const deps = setup();
  const res = await call(alertFeedbackHandler(deps), {
    method: "POST",
    path: "/v1/user/alerts/a1/feedback",
    params: { id: "a1" },
    body: { feedback: "not_useful" },
  });
  assertEquals(res.status, 200);
  assertEquals(deps.store.journal.length, 0);
});

Deno.test("alert mute: quiets the type for 24h and marks the alert", async () => {
  const deps = setup();
  const h = alertMuteHandler(deps);
  const before = Date.now();
  const ok = await call(h, { method: "POST", path: "/v1/user/alerts/a1/mute", params: { id: "a1" } });
  assertEquals(ok.status, 200);
  assert(ok.body.data.muted_at);
  const quiet = Date.parse(deps.store.quietUntil.get(`${USER}:kill_switch`)!);
  assert(quiet >= before + 24 * 60 * 60 * 1000 - 1000);
  const missing = await call(h, { method: "POST", path: "/v1/user/alerts/zz/mute", params: { id: "zz" } });
  assertEquals(missing.status, 404);
  assertEquals(missing.body.error, "alert_not_found");
});
