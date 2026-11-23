// DB tests for _lib/store/auth.ts. Skipped unless THESIS_TEST_DB_URL is set (CI has no database).
// Run: THESIS_TEST_DB_URL=postgres://postgres@127.0.0.1:54329/thesis THESIS_DB_URL=$THESIS_TEST_DB_URL \
//      deno test --allow-env --allow-net=127.0.0.1 _lib/store/auth_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { db } from "./common.ts";
import { pgAuthStore as s } from "./auth.ts";

const ignore = !Deno.env.get("THESIS_TEST_DB_URL");
const opts = { ignore, sanitizeResources: false, sanitizeOps: false };

async function newUser(verified = false): Promise<{ id: string; email: string }> {
  const id = crypto.randomUUID();
  const email = `m1-auth-${id}@example.test`;
  // Local stand-in for Supabase's auth.users (app.users.auth_user_id references it).
  await db()`insert into auth.users (id) values (${id})`;
  const row = await s.insertUser({
    id,
    email: email.toUpperCase(),
    authUserId: id,
    verifiedAt: verified ? new Date().toISOString() : undefined,
  });
  assertEquals(row?.email, email);
  return { id, email };
}

async function cleanup(id: string) {
  await db()`delete from audit_events where user_id = ${id} or payload->>'deleted_user_id' = ${id}`;
  await db()`delete from users where id = ${id}`;
  await db()`delete from auth.users where id = ${id}::uuid`;
}

Deno.test({
  name: "db: insertUser keeps one row per email/id, markUserVerified",
  ...opts,
  fn: async () => {
    const u = await newUser();
    try {
      assertEquals(
        await s.insertUser({ id: u.id, email: "other@example.test", authUserId: u.id }),
        undefined,
      );
      assertEquals(
        await s.insertUser({ id: crypto.randomUUID(), email: u.email, authUserId: u.id }),
        undefined,
      );
      const found = await s.findUserByEmail(u.email);
      assertEquals(found?.authUserId, u.id);
      assertEquals(found?.verifiedAt, undefined);
      const v = await s.markUserVerified(u.id, "2026-11-23T10:00:00.000Z");
      assertEquals(v?.verifiedAt, "2026-11-23T10:00:00.000Z");
      const raw = await db()`select password_hash from users where id = ${u.id}`;
      assertEquals(raw[0].password_hash, null);
    } finally {
      await cleanup(u.id);
    }
  },
});

Deno.test({
  name: "db: lockout counts within the window, locks at max, resets after the window, clears",
  ...opts,
  fn: async () => {
    const u = await newUser(true);
    const at = (sec: number) => new Date(Date.parse("2026-11-23T10:00:00Z") + sec * 1000).toISOString();
    const attempt = (sec: number) =>
      s.recordFailedLoginAttempt({
        userId: u.id,
        attemptedAt: at(sec),
        windowSeconds: 60,
        maxFailures: 3,
        lockoutDurationSeconds: 30,
      });
    try {
      assertEquals((await attempt(0))?.failedLoginAttempts, 1);
      assertEquals((await attempt(10))?.lockedUntil, undefined);
      const third = await attempt(20);
      assertEquals(third?.failedLoginAttempts, 3);
      assertEquals(third?.lockedUntil, at(50));
      // Outside the window the count starts again.
      const fresh = await attempt(200);
      assertEquals(fresh?.failedLoginAttempts, 1);
      assertEquals(fresh?.failedLoginWindowStartedAt, at(200));
      assertEquals(fresh?.lockedUntil, undefined);
      const cleared = await s.clearFailedLoginAttempts(u.id);
      assertEquals(cleared?.failedLoginAttempts, 0);
      assertEquals(cleared?.failedLoginWindowStartedAt, undefined);
    } finally {
      await cleanup(u.id);
    }
  },
});

Deno.test({
  name: "db: account action tokens are single use, superseded, and expire",
  ...opts,
  fn: async () => {
    const u = await newUser(true);
    const now = new Date();
    const later = new Date(now.getTime() + 3600_000).toISOString();
    const mk = (hash: string, expiresAt = later) =>
      s.createAccountActionToken({
        userId: u.id,
        purpose: "account_deletion",
        tokenHash: hash,
        createdAt: now.toISOString(),
        expiresAt,
      });
    try {
      await mk(`h1-${u.id}`);
      await mk(`h2-${u.id}`);
      assertEquals(
        await s.consumeAccountActionToken("account_deletion", `h1-${u.id}`, now.toISOString()),
        undefined,
      );
      assertEquals(
        await s.consumeAccountActionToken("password_reset", `h2-${u.id}`, now.toISOString()),
        undefined,
      );
      assertEquals(await s.consumeAccountActionToken("account_deletion", `h2-${u.id}`, now.toISOString()), {
        userId: u.id,
      });
      assertEquals(
        await s.consumeAccountActionToken("account_deletion", `h2-${u.id}`, now.toISOString()),
        undefined,
      );
      await mk(`h3-${u.id}`, new Date(now.getTime() - 1000).toISOString());
      assertEquals(
        await s.consumeAccountActionToken("account_deletion", `h3-${u.id}`, now.toISOString()),
        undefined,
      );
    } finally {
      await cleanup(u.id);
    }
  },
});

Deno.test({
  name: "db: setProTier, audit append and email strip, deleteUserRows sweeps every user_id table",
  ...opts,
  fn: async () => {
    const u = await newUser(true);
    const sweep = `m1_test_sweep_${u.id.slice(0, 8)}`;
    const jobId = crypto.randomUUID();
    try {
      await s.setProTier(u.id);
      assertEquals(await s.getUserTier(u.id), "PRO");
      await s.appendAudit("auth.test", { email: "x@example.test", route: "/t" }, u.id);
      await s.stripAuditEmails(u.id);
      const audit = await db()`select payload from audit_events where user_id = ${u.id}`;
      assertEquals(audit[0].payload, { route: "/t" });

      await db()`insert into watchlists (id, user_id, ticker, added_at) values (${crypto.randomUUID()}, ${u.id}, 'AAPL', now())`;
      await db()`insert into jobs (id, type, status, user_id, created_at) values (${jobId}, 'deep_dive', 'queued', ${u.id}, now())`;
      // A table without a foreign key (like one a later milestone might add) is swept too.
      await db().unsafe(`create table app.${sweep} (user_id text not null)`);
      await db().unsafe(`insert into app.${sweep} values ($1)`, [u.id]);

      assertEquals(await s.deleteUserRows(u.id), true);
      assertEquals(await s.findUserById(u.id), undefined);
      assertEquals((await db()`select 1 from watchlists where user_id = ${u.id}`).length, 0);
      assertEquals((await db()`select 1 from subscriptions where user_id = ${u.id}`).length, 0);
      assertEquals((await db().unsafe(`select 1 from app.${sweep} where user_id = $1`, [u.id])).length, 0);
      // Jobs stay, detached, as before.
      const job = await db()`select user_id from jobs where id = ${jobId}`;
      assertEquals(job[0].user_id, null);
      const kept =
        await db()`select user_id from audit_events where event_type = 'auth.test' and payload->>'route' = '/t' and user_id is null`;
      assert(kept.length >= 1);
      assertEquals(await s.deleteUserRows(u.id), false);
    } finally {
      await db().unsafe(`drop table if exists app.${sweep}`);
      await db()`delete from jobs where id = ${jobId}`;
      await db()`delete from audit_events where event_type = 'auth.test' and user_id is null and payload->>'route' = '/t'`;
      await cleanup(u.id);
    }
  },
});
