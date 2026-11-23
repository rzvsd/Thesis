// Integration test of postgresEffectsStore. Runs only when TEST_DB_URL points at a database with the app schema.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import postgres from "npm:postgres@3.4.5";
import { applyCompletionEffects } from "./apply.ts";
import { dispatchFilingChangeAlerts, findPriorDeepDive, noopNotifier } from "./filing-alerts.ts";
import { enrichAnalysisReportIssuer } from "../../reports/issuer.ts";
import { postgresEffectsStore } from "./store.ts";
import { deepDiveFixture } from "./testing/report_fixture.ts";

const url = Deno.env.get("TEST_DB_URL");

Deno.test({
  name: "postgresEffectsStore: completion effects and filing alert against Postgres",
  ignore: !url,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sql = postgres(url!, { prepare: false, connection: { search_path: "app, extensions, public" } });
    const tag = crypto.randomUUID().slice(0, 8);
    const userId = `effects_test_user_${tag}`;
    const ticker = `ZT${tag.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "Q")}`;
    const priorJobId = `effects_test_job0_${tag}`;
    const jobId = `effects_test_job1_${tag}`;
    const priorReportId = `effects_test_rpt0_${tag}`;
    const reportId = `effects_test_rpt1_${tag}`;
    const now = new Date().toISOString();
    try {
      await sql`insert into users (id, email, verified_at, created_at)
                values (${userId}, ${`${userId}@example.test`}, ${now}, ${now})`;
      await sql`insert into subscriptions (user_id, tier) values (${userId}, 'PRO')`;
      await sql`insert into watchlists (id, user_id, ticker, added_at)
                values (${`wl_${tag}`}, ${userId}, ${ticker}, ${now})`;
      await sql`insert into user_devices (id, user_id, installation_id, device_token, last_seen_at, created_at, updated_at)
                values (${`dev_${tag}`}, ${userId}, 'inst_1', 'token_1', ${now}, ${now}, ${now})`;
      await sql`insert into ticker_registry (symbol, company_name, exchange, listing_status, source_feed,
                  source_updated_at, last_synced_at)
                values (${ticker}, 'Zeta Test Corp', 'NYSE', 'active', 'test', ${now}, ${now})`;
      await sql`insert into jobs (id, type, status, user_id, ticker, report_id, created_at)
                values (${priorJobId}, 'deep_dive', 'complete', ${userId}, ${ticker}, ${priorReportId},
                        '2026-08-01T00:00:00Z')`;
      await sql`insert into reports (id, job_id, type, ticker, schema_version, artifact_key, created_at, fingerprint)
                values (${priorReportId}, ${priorJobId}, 'deep_dive', ${ticker}, '2.0', 'reports/prior.json',
                        '2026-08-01T00:00:00Z', ${`${ticker}|2.0|2026Q2`})`;
      await sql`insert into jobs (id, type, status, user_id, ticker, created_at)
                values (${jobId}, 'deep_dive', 'running', ${userId}, ${ticker}, ${now})`;

      const store = postgresEffectsStore(sql);
      const generatedAt = new Date().toISOString();
      let report = deepDiveFixture({
        report_id: reportId,
        job_id: jobId,
        ticker,
        generated_at: generatedAt,
        name_relationships: [{
          source_ticker: ticker,
          target_ticker: "TSM",
          relationship_type: "supplier",
          confidence: 0.9,
          evidence_text: "e",
          rationale: "r",
        }],
      });
      report = await enrichAnalysisReportIssuer(
        {
          getSupportedTicker: (s) => store.getSupportedTicker(s),
          fetchStructuralContext: () => Promise.resolve(undefined),
        },
        report,
      );
      assertEquals(report.issuer?.name, "Zeta Test Corp");

      const prior = await findPriorDeepDive(store, report);
      assertEquals(prior?.id, priorReportId);
      assertEquals(prior?.fingerprint, `${ticker}|2.0|2026Q2`);

      await sql`insert into reports (id, job_id, type, ticker, schema_version, artifact_key, created_at)
                values (${reportId}, ${jobId}, 'deep_dive', ${ticker}, '2.0', 'reports/new.json', ${generatedAt})`;
      await sql`update jobs set status = 'complete', report_id = ${reportId} where id = ${jobId}`;

      const deps = {
        store,
        latestClose: () => Promise.resolve(42.5),
        notifier: noopNotifier,
        readReport: () => Promise.resolve(undefined),
      };
      const input = { report, userId, requestId: "req", route: "/test", includeMonitorSnapshot: true };
      await applyCompletionEffects(deps, input);
      // Running twice deactivates the first rule set and upserts the rest.
      await applyCompletionEffects(deps, input);

      const anchors = await sql`select * from contrarian_alert_anchors where user_id = ${userId}`;
      assertEquals(anchors.length, 2);
      assertEquals(Number(anchors[0].anchor_price), 42.5);

      const rules = await sql`select state, count(*)::int as n from kill_switch_rules
                              where user_id = ${userId} group by state order by state`;
      assertEquals(rules.map((row) => [row.state, row.n]), [["active", 3], ["inactive", 3]]);

      const relationships = await sql`select source_ticker, target_ticker, confidence
                                      from name_relationships where user_id = ${userId}`;
      assertEquals(
        relationships.map((row) => [row.source_ticker, row.target_ticker, Number(row.confidence)]),
        [
          ["TSM", ticker, 0.9],
        ],
      );

      const [snapshot] = await sql`select * from thesis_monitor_snapshots where user_id = ${userId}`;
      assertEquals(snapshot.state, "improved");
      assertEquals(Number(snapshot.score), 0.7);
      assertEquals(snapshot.freshness_state, "current");

      const journal = await sql`select * from conviction_journal_entries where user_id = ${userId}`;
      assertEquals(journal.length, 1);
      assertEquals(journal[0].thesis_snapshot.monitor_state, "improved");
      assertEquals(journal[0].evidence_refs[0].ref_id, reportId);
      assertEquals(journal[0].thesis_snapshot.signal_reasons, ["Margins expand"]);
      assertEquals("freshness_score" in journal[0].thesis_snapshot, true);

      const audits = await sql`select event_type, payload from audit_events where user_id = ${userId}`;
      const snapshotAudit = audits.find((row) => row.event_type === "monitor.snapshot_upserted");
      assertEquals(snapshotAudit?.payload, {
        request_id: "req",
        route: "/test",
        ticker,
        state: "improved",
        score: 0.7,
      });
      assert(audits.some((row) => row.event_type === "kill_switch.rules_created"));

      await dispatchFilingChangeAlerts(deps, { report, prior });
      await dispatchFilingChangeAlerts(deps, { report, prior });
      const alerts = await sql`select * from alert_ledger where user_id = ${userId}`;
      assertEquals(alerts.length, 1);
      assertEquals(alerts[0].delivery_state, "partial_failure");
      assertEquals(alerts[0].context.filing_period, "2026Q3");

      assertEquals(await store.getUserSubscriptionTier(userId), "PRO");
      const pushTargets = await store.listUsersWithDeviceTokenByNotificationType({
        notificationType: "filing_change",
        userIds: [userId],
      });
      assertEquals(pushTargets.length, 1);
      const emailTargets = await store.listUsersWithEmailByNotificationType({
        notificationType: "filing_change",
        userIds: [userId],
      });
      assertEquals(emailTargets.length, 1);
      assert(
        await store.invalidateUserDeviceByInstallation({
          userId,
          installationId: "inst_1",
          invalidatedAt: now,
          reason: "test",
        }),
      );
    } finally {
      await sql`delete from audit_events where user_id = ${userId}`;
      await sql`delete from jobs where id in (${priorJobId}, ${jobId})`;
      await sql`delete from ticker_registry where symbol = ${ticker}`;
      await sql`delete from users where id = ${userId}`;
      await sql.end();
    }
  },
});
