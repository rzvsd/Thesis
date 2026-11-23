import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call } from "../user/test_fakes.ts";
import { type InternalPushDeps, internalPushRoutes } from "./index.ts";
import type { PushPayload, PushSender, PushTarget } from "../../../_lib/push/index.ts";

function setup(devices: Record<string, string[]>, disabledFor: Record<string, string[]> = {}) {
  const sent: Array<{ targets: PushTarget[]; payload: PushPayload }> = [];
  const invalidated: PushTarget[] = [];
  const sender: PushSender = {
    mode: "fcm",
    send(targets, payload) {
      sent.push({ targets, payload });
      const dead = targets.filter((t) => t.deviceToken.includes("dead"));
      return Promise.resolve({
        attempted: targets.length,
        delivered: targets.length - dead.length,
        failed: dead.length,
        skipped: 0,
        invalidTargets: dead,
      });
    },
  };
  const deps: InternalPushDeps = {
    sender: () => sender,
    listTargets: (userIds, type) =>
      Promise.resolve(
        userIds.filter((u) => !(disabledFor[u] ?? []).includes(type)).flatMap((u) =>
          (devices[u] ?? []).map((tok, i) => ({ userId: u, installationId: `${u}-i${i}`, deviceToken: tok }))
        ),
      ),
    invalidate: (targets) => {
      invalidated.push(...targets);
      return Promise.resolve(targets.length);
    },
    now: () => "2026-11-23T08:00:00.000Z",
  };
  return { sent, invalidated, routes: internalPushRoutes(deps) };
}

Deno.test("test push goes to every active device of the user", async () => {
  const { sent, routes } = setup({ u1: ["tok-a-1234567890123456", "tok-b-1234567890123456"] });
  const res = await call(routes, "POST", "/internal/push/test", { body: { user_id: "u1" } });
  assertEquals(res.status, 200);
  assertEquals(res.body.data, {
    mode: "fcm",
    users: 1,
    targets: 2,
    attempted: 2,
    delivered: 2,
    failed: 0,
    skipped: 0,
    invalidated: 0,
  });
  assertEquals(sent[0].payload.notificationType, "market_pulse_ready");
  assertEquals(sent[0].payload.title, "Thesis test notification");
});

Deno.test("send marks dead tokens invalid and respects preferences via listTargets", async () => {
  const { invalidated, routes } = setup(
    { u1: ["tok-live-123456789012"], u2: ["tok-dead-123456789012"], u3: ["tok-off-1234567890123"] },
    { u3: ["kill_switch"] },
  );
  const res = await call(routes, "POST", "/internal/push/send", {
    body: {
      user_ids: ["u1", "u2", "u3", "u1"],
      notification: {
        type: "kill_switch",
        route: "research",
        title: "Kill switch",
        body: "AAPL",
        data: { ticker: "AAPL" },
      },
    },
  });
  assertEquals(res.status, 200);
  const data = res.body.data as Record<string, number>;
  assertEquals([data.users, data.targets, data.delivered, data.failed, data.invalidated], [3, 2, 1, 1, 1]);
  assertEquals(invalidated.map((t) => t.userId), ["u2"]);
});

Deno.test("send validates the body", async () => {
  const { routes } = setup({});
  const bad = [
    {},
    { user_ids: [] },
    { user_ids: Array.from({ length: 501 }, (_, i) => `u${i}`) },
    { user_ids: ["u1"], notification: { type: "nope", route: "r", title: "t", body: "b" } },
    { user_ids: ["u1"], notification: { type: "kill_switch", route: "r", title: "", body: "b" } },
    {
      user_ids: ["u1"],
      notification: { type: "kill_switch", route: "r", title: "t", body: "b", data: { a: {} } },
    },
    { user_ids: [""], notification: { type: "kill_switch", route: "r", title: "t", body: "b" } },
  ];
  for (const body of bad) {
    const res = await call(routes, "POST", "/internal/push/send", { body });
    assertEquals(res.status, 422, JSON.stringify(body));
  }
  assertEquals((await call(routes, "POST", "/internal/push/test", { body: {} })).status, 422);
});

Deno.test("internal push routes require the internal token", () => {
  const { routes } = setup({});
  assertEquals(routes.map((r) => r.auth), ["internal", "internal"]);
});
