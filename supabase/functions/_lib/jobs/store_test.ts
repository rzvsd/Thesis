// Runs against a real Postgres with the baseline and M2 migrations, only when TEST_DB_URL is set.
// CI has no Postgres, so there it is skipped. Locally: TEST_DB_URL=postgres://... deno test ...
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import postgres from "npm:postgres@3.4.5";
import { postgresJobsStore } from "./store.ts";

const url = Deno.env.get("TEST_DB_URL");

Deno.test({
  name: "postgres jobs store: claim, dispatch guard, caps and the stale sweep",
  ignore: !url,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sql = postgres(url!, {
      prepare: false,
      max: 4,
      connection: { search_path: "app, extensions, public" },
    });
    const store = postgresJobsStore(sql);
    const userId = `test-m2-${crypto.randomUUID()}`;
    const day = "2001-01-01";
    try {
      await sql`insert into users (id, email, created_at) values (${userId}, ${
        userId + "@example.test"
      }, now())`;
      const now = new Date().toISOString();
      const job = await store.createJob({
        id: crypto.randomUUID(),
        type: "deep_dive",
        userId,
        ticker: "AAPL",
        createdAt: now,
      });
      assertEquals([job.status, job.attempts], ["queued", 0]);
      assertEquals(
        (await store.findOpenJob(userId, "AAPL", new Date(Date.now() - 60_000).toISOString()))?.id,
        job.id,
      );

      // Two polls race to re-dispatch from the same previous value: only one wins.
      const [a, b] = await Promise.all([
        store.markDispatched(job.id, new Date().toISOString(), null),
        store.markDispatched(job.id, new Date().toISOString(), null),
      ]);
      assertEquals([a, b].filter(Boolean).length, 1);

      // Two runners race to claim: only one wins.
      const claims = await Promise.all([
        store.claimJob(job.id, now, "https://github.com/rzvsd/thesis/actions/runs/1"),
        store.claimJob(job.id, now, "https://github.com/rzvsd/thesis/actions/runs/2"),
      ]);
      assertEquals(claims.filter(Boolean).length, 1);
      assert(
        (await store.getJob(job.id))?.runUrl?.startsWith("https://github.com/rzvsd/thesis/actions/runs/"),
      );

      // A failIfStatus for the wrong status changes nothing.
      assertEquals(await store.failIfStatus(job.id, "queued", now, "x"), undefined);

      // Global cap.
      await sql`delete from deep_dive_dispatch_daily where usage_date = ${day}::date`;
      assertEquals(await store.reserveDispatch(day, 2), true);
      assertEquals(await store.reserveDispatch(day, 2), true);
      assertEquals(await store.reserveDispatch(day, 2), false);
      await store.releaseDispatch(day);
      assertEquals(await store.reserveDispatch(day, 2), true);

      // Daily user limit.
      assertEquals(await store.reserveDailyUsage(userId, day, 1), true);
      assertEquals(await store.reserveDailyUsage(userId, day, 1), false);
      assertEquals(await store.getSubscriptionTier(userId), "FREE");

      // The pg_cron sweep fails a running job older than 11 minutes.
      await sql`update jobs set started_at = now() - interval '12 minutes' where id = ${job.id}`;
      const [{ n }] = await sql`select app.sweep_stale_deep_dive_jobs() as n`;
      assert(Number(n) >= 1);
      const swept = await store.getJob(job.id);
      assertEquals(swept?.status, "failed");

      // Report round trip and comparable lookup.
      const done = await store.createJob({
        id: crypto.randomUUID(),
        type: "deep_dive",
        userId,
        ticker: "AAPL",
        createdAt: now,
      });
      const reportId = crypto.randomUUID();
      await store.createReport({
        id: reportId,
        jobId: done.id,
        type: "deep_dive",
        ticker: "AAPL",
        schemaVersion: "2.0",
        artifactKey: `deep_dive/2026-11-25/${reportId}.json`,
        fingerprint: "AAPL|2.0|LATEST_UNKNOWN",
        freshnessExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        createdAt: now,
        isCurrent: true,
        llmUsage: { usd: 0 },
      });
      assertEquals(
        await store.findReusableDeepDiveReport({
          ticker: "AAPL",
          fingerprint: "AAPL|2.0|LATEST_UNKNOWN",
          nowIso: now,
        }),
        undefined,
      );
      await store.markJobComplete(done.id, now, reportId);
      const reusable = await store.findReusableDeepDiveReport({
        ticker: "AAPL",
        fingerprint: "AAPL|2.0|LATEST_UNKNOWN",
        nowIso: now,
      });
      assertEquals(reusable?.id, reportId);
      assertEquals(reusable?.llmUsage, { usd: 0 });
      const comparable = await store.findLatestComparableDeepDiveReport({
        ticker: "AAPL",
        schemaMajor: 2,
        sinceIso: new Date(Date.now() - 86_400_000).toISOString(),
      });
      assertEquals(comparable?.id, reportId);
    } finally {
      await sql`delete from jobs where user_id = ${userId}`;
      await sql`delete from deep_dive_daily_usage where user_id = ${userId}`;
      await sql`delete from users where id = ${userId}`;
      await sql`delete from deep_dive_dispatch_daily where usage_date = ${day}::date`;
      await sql.end();
    }
  },
});
