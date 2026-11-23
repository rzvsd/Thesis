// Ported from apps/product-api/tests/subscription.test.ts (webhook and sync-tier parts) with in-memory deps.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { Router } from "../../router.ts";
import { type BillingDeps, billingRoutes } from "./index.ts";
import type { SubscriptionRecord } from "../../../_lib/billing/revenuecat.ts";
import { noLimit } from "../user/http.ts";

const SECRET = "test-only-revenuecat-secret";

function fakeDeps(snapshot?: { tier: "FREE" | "PRO"; billingPeriodEnd?: string } | Error) {
  const users = new Set(["user-a", "user-b"]);
  const rows = new Map<string, SubscriptionRecord>();
  const audits: Array<{ type: string; payload: Record<string, unknown>; userId?: string }> = [];
  const fetched: string[] = [];
  const deps: BillingDeps = {
    limit: noLimit,
    webhookSecret: () => SECRET,
    userExists: (id) => Promise.resolve(users.has(id)),
    findUserIdByRevenuecatAppUserId: (appUserId) =>
      Promise.resolve([...rows.values()].find((r) => r.revenuecatAppUserId === appUserId)?.userId),
    getSubscription: (userId) => {
      if (!rows.has(userId)) rows.set(userId, { userId, tier: "FREE" });
      return Promise.resolve({ ...rows.get(userId)! });
    },
    upsertSubscription: (input) => {
      const prev = rows.get(input.userId);
      const next: SubscriptionRecord = {
        userId: input.userId,
        tier: input.tier,
        billingPeriodEnd: input.billingPeriodEnd,
        revenuecatAppUserId: input.revenuecatAppUserId ?? prev?.revenuecatAppUserId,
      };
      rows.set(input.userId, next);
      return Promise.resolve(next);
    },
    fetchSnapshot: (appUserId) => {
      fetched.push(appUserId);
      if (snapshot instanceof Error) return Promise.reject(snapshot);
      return Promise.resolve({
        appUserId,
        tier: snapshot?.tier ?? "FREE",
        billingPeriodEnd: snapshot?.billingPeriodEnd,
      });
    },
    profile: (userId) =>
      Promise.resolve(
        users.has(userId)
          ? {
            user_id: userId,
            email: `${userId}@example.test`,
            tier: rows.get(userId)?.tier ?? "FREE",
            billing_period_end: rows.get(userId)?.billingPeriodEnd,
            watchlist_limit: 5,
            daily_deep_dive_limit: 1,
            deep_dives_remaining_today: 1,
          }
          : undefined,
      ),
    audit: (type, payload, userId) => {
      audits.push({ type, payload, userId });
      return Promise.resolve();
    },
    now: () => "2026-11-23T09:00:00.000Z",
  };
  return { deps, rows, audits, fetched };
}

async function post(
  deps: BillingDeps,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  userId?: string,
) {
  const router = new Router([{ name: "billing", owner: "M4", routes: billingRoutes(deps) }]);
  const found = router.match("POST", path);
  if (found.kind !== "found") throw new Error("no route");
  const req = new Request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const res = await found.route.handler({
    req,
    url: new URL(req.url),
    path,
    params: found.params,
    auth: { mode: found.route.auth, userId: userId ?? null, accessToken: null },
  });
  return { status: res.status, body: await res.json() };
}

const hook = (deps: BillingDeps, event: Record<string, unknown>, auth = `Bearer ${SECRET}`) =>
  post(deps, "/v1/webhooks/revenuecat", { api_version: "1.0", event }, { authorization: auth });

Deno.test("webhook: bad or missing secret is 401", async () => {
  const { deps } = fakeDeps();
  assertEquals((await hook(deps, { type: "RENEWAL", app_user_id: "user-a" }, "Bearer wrong")).status, 401);
  assertEquals((await hook(deps, { type: "RENEWAL", app_user_id: "user-a" }, "")).status, 401);
  // Without "Bearer " also works, as in the old server.
  assertEquals((await hook(deps, { type: "RENEWAL", app_user_id: "user-a" }, SECRET)).status, 200);
});

Deno.test("webhook: no secret configured rejects everything", async () => {
  const { deps } = fakeDeps();
  deps.webhookSecret = () => undefined;
  assertEquals((await hook(deps, { type: "RENEWAL", app_user_id: "user-a" })).status, 401);
});

Deno.test("webhook: bad payload is 422, unknown user is 202 ignored", async () => {
  const { deps } = fakeDeps();
  const bad = await hook(deps, { app_user_id: "user-a" });
  assertEquals(bad, {
    status: 422,
    body: { error: "validation_failed", error_message: "Invalid RevenueCat webhook payload." },
  });
  const unknown = await hook(deps, { type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc" });
  assertEquals(unknown, { status: 202, body: { status: "ignored", reason: "user_not_found" } });
});

Deno.test("webhook lifecycle: purchase, renewal, cancellation keeps Pro, expiration drops to Free", async () => {
  const { deps, rows, audits } = fakeDeps();
  const purchase = await hook(deps, {
    type: "INITIAL_PURCHASE",
    app_user_id: "user-a",
    expiration_at_ms: Date.parse("2026-12-23T00:00:00.000Z"),
    environment: "SANDBOX",
  });
  assertEquals(purchase, { status: 200, body: { status: "ok" } });
  assertEquals(rows.get("user-a"), {
    userId: "user-a",
    tier: "PRO",
    billingPeriodEnd: "2026-12-23T00:00:00.000Z",
    revenuecatAppUserId: "user-a",
  });
  await hook(deps, { type: "RENEWAL", app_user_id: "user-a", expiration_at: "2027-01-23T00:00:00Z" });
  assertEquals(rows.get("user-a")?.billingPeriodEnd, "2027-01-23T00:00:00.000Z");
  await hook(deps, { type: "CANCELLATION", app_user_id: "user-a" });
  assertEquals(rows.get("user-a")?.tier, "PRO");
  assertEquals(rows.get("user-a")?.billingPeriodEnd, "2027-01-23T00:00:00.000Z");
  await hook(deps, { type: "EXPIRATION", app_user_id: "user-a" });
  assertEquals(rows.get("user-a")?.tier, "FREE");
  assertEquals(rows.get("user-a")?.billingPeriodEnd, undefined);
  assertEquals(audits.length, 4);
  assertEquals(audits[0].type, "subscription.webhook_processed");
  // Audit rows carry a hash, never the raw RevenueCat id (N10).
  assertEquals(String(audits[0].payload.revenuecat_user_id_hash).length, 16);
  assertEquals(Object.values(audits[0].payload).includes("user-a"), false);
});

Deno.test("webhook: an alias app user id maps through the stored revenuecat id", async () => {
  const { deps, rows } = fakeDeps();
  rows.set("user-b", { userId: "user-b", tier: "FREE", revenuecatAppUserId: "rc-alias-1" });
  await hook(deps, { type: "INITIAL_PURCHASE", app_user_id: "rc-alias-1" });
  assertEquals(rows.get("user-b")?.tier, "PRO");
});

Deno.test("webhook: unknown event types change nothing", async () => {
  const { deps, rows } = fakeDeps();
  rows.set("user-a", { userId: "user-a", tier: "PRO", billingPeriodEnd: "2027-01-01T00:00:00.000Z" });
  await hook(deps, { type: "TRANSFER", app_user_id: "user-a" });
  assertEquals(rows.get("user-a")?.tier, "PRO");
});

Deno.test("sync-tier: reads RevenueCat and returns the profile", async () => {
  const { deps, fetched } = fakeDeps({ tier: "PRO", billingPeriodEnd: "2027-01-01T00:00:00.000Z" });
  const res = await post(deps, "/v1/user/sync-tier", { revenuecat_app_user_id: "user-a" }, {}, "user-a");
  assertEquals(res.status, 200);
  assertEquals(res.body.data.tier, "PRO");
  assertEquals(fetched, ["user-a"]);
});

Deno.test("sync-tier: another user's RevenueCat id is 403 and the tier stays", async () => {
  const { deps, rows } = fakeDeps({ tier: "PRO" });
  const res = await post(deps, "/v1/user/sync-tier", { revenuecat_app_user_id: "user-b" }, {}, "user-a");
  assertEquals(res.status, 403);
  assertEquals(res.body.error, "forbidden");
  assertEquals(rows.get("user-a")?.tier, "FREE");
});

Deno.test("sync-tier: RevenueCat not configured or down is 503 sync_unavailable", async () => {
  const { deps } = fakeDeps(new Error("REVENUECAT_SERVER_API_KEY is required for sync-tier."));
  const res = await post(deps, "/v1/user/sync-tier", {}, {}, "user-a");
  assertEquals(res.status, 503);
  assertEquals(res.body.error, "sync_unavailable");
});

Deno.test("routes: webhook checks its own secret, sync-tier needs a user", () => {
  const { deps } = fakeDeps();
  assertEquals(billingRoutes(deps).map((r) => [r.path, r.auth]), [
    ["/v1/webhooks/revenuecat", "webhook"],
    ["/v1/user/sync-tier", "user"],
  ]);
});
