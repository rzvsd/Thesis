// Runs the Postgres store and the handlers against a real database with the M0 baseline schema.
// Skipped unless RESEARCH_TEST_DB_URL is set, e.g. a local throwaway Postgres on 127.0.0.1:
//   RESEARCH_TEST_DB_URL=postgres://postgres@127.0.0.1:54329/postgres deno test --allow-env --allow-net=127.0.0.1
// Never point it at the hosted project: it writes rows.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import postgres from "npm:postgres@3.4.5";
import { alertRoutes } from "../../api/features/alerts/index.ts";
import { researchRoutes } from "../../api/features/research/index.ts";
import type { Route } from "../../api/router.ts";
import type { ResearchDeps } from "./deps.ts";
import { PostgresResearchStore } from "./store.ts";
import { call } from "./testing.ts";

const url = Deno.env.get("RESEARCH_TEST_DB_URL");

Deno.test({
  name: "postgres store drives every research and alerts route",
  ignore: !url,
  fn: async () => {
    const sql = postgres(url!, {
      prepare: false,
      max: 1,
      connection: { search_path: "app, extensions, public" },
    });
    const u = `pg-test-${crypto.randomUUID()}`;
    const deps: ResearchDeps = {
      store: new PostgresResearchStore(() => sql),
      readReportBody: () => Promise.resolve(undefined),
    };
    const routes = [...researchRoutes(deps), ...alertRoutes(deps)];
    const route = (method: string, path: string): Route =>
      routes.find((r) => r.method === method && r.path === path)!;
    try {
      await sql.unsafe(`insert into users (id, email, created_at) values ($1, $2, now())`, [
        u,
        `${u}@example.invalid`,
      ]);
      await sql.unsafe(`insert into subscriptions (user_id, tier) values ($1, 'PRO')`, [u]);
      await sql.unsafe(
        `insert into watchlists (id, user_id, ticker, added_at) values ($1, $2, 'AAPL', now())`,
        [
          `${u}-w`,
          u,
        ],
      );
      await sql.unsafe(
        `insert into jobs (id, type, status, user_id, ticker, report_id, created_at)
         values ($1, 'deep_dive', 'complete', $2, 'AAPL', $3, now())`,
        [`${u}-job`, u, `${u}-rep`],
      );
      await sql.unsafe(
        `insert into reports (id, job_id, type, ticker, schema_version, artifact_key, created_at)
         values ($1, $2, 'deep_dive', 'AAPL', '2.0.0', 'k', now())`,
        [`${u}-rep`, `${u}-job`],
      );
      await sql.unsafe(
        `insert into fear_greed_daily (id, market_date, score, label, sub_scores, missing_inputs, calculated_at)
         values ($1, '2099-01-02', 47.5, 'neutral', '[]'::jsonb, '["x"]'::jsonb, now())
         on conflict do nothing`,
        [`${u}-fg`],
      );
      await sql.unsafe(
        `insert into name_relationships (relationship_id, user_id, source_ticker, target_ticker, relationship_type,
           confidence, state, source_report_id, prompt_version, evidence_text, rationale)
         values ($1, $2, 'AAPL', 'TSM', 'supplier', 0.85, 'active', $3, 'v1', 'e', 'r')`,
        [`${u}-rel`, u, `${u}-rep`],
      );
      await sql.unsafe(
        `insert into calendar_events (id, ticker, event_type, event_date, provider, retrieved_at, timing_state, source_state)
         values ($1, 'AAPL', 'earnings', '2099-01-05', 'issuer_ir', now(), 'confirmed', 'first_party')
         on conflict do nothing`,
        [`${u}-ev`],
      );
      await sql.unsafe(
        `insert into war_rooms (id, user_id, ticker, earnings_event_id, event_date, state, current_cadence_min,
           cadence_state, prepared_at)
         values ($1, $2, 'AAPL', $3, '2099-01-05', 'preparing', 15, '{"latest_runtime_min": 4}'::jsonb, now())`,
        [`${u}-wr`, u, `${u}-ev`],
      );
      await sql.unsafe(
        `insert into war_room_timeline_events (id, war_room_id, phase, event_type, reason_text, source_refs)
         values ($1, $2, 'pre', 'prepared', 'Prepared.', '[{"kind":"report","ref_id":"r1"}]'::jsonb)`,
        [`${u}-te`, `${u}-wr`],
      );
      await sql.unsafe(
        `insert into alert_ledger (id, user_id, notification_type, category, route, title, body, reason_code,
           reason_text, delivery_state, context, detail_body)
         values ($1, $2, 'kill_switch', 'thesis_drift', 'names', 'AAPL alert', 'Body', 'rc', 'rt', 'sent',
           '{"ticker":"AAPL"}'::jsonb, 'Detail')`,
        [`${u}-al`, u],
      );
      await sql.unsafe(
        `insert into thesis_monitor_snapshots (user_id, ticker, state, reason, score, freshness_score)
         values ($1, 'AAPL', 'intact', 'ok', 0.75, 0.5)`,
        [u],
      );

      const as = { userId: u };
      const rel = await call(route("GET", "/v1/names/relationships").handler, {
        path: "/v1/names/relationships?state=active,suppressed&min_confidence=0.5",
        ...as,
      });
      assertEquals(rel.status, 200);
      assertEquals(rel.body.data[0].confidence, 0.85);

      const es = await call(route("GET", "/v1/research/earnings/state").handler, {
        path: "/v1/research/earnings/state?as_of=2099-01-01",
        ...as,
      });
      assertEquals(es.body.data.states[0].event_date, "2099-01-05");

      const wr = await call(route("GET", "/v1/research/war-room/:id").handler, {
        path: `/v1/research/war-room/${u}-wr`,
        params: { id: `${u}-wr` },
        ...as,
      });
      assertEquals(wr.status, 200);
      assertEquals(wr.body.data.event_date, "2099-01-05");
      assertEquals(wr.body.data.last_runtime_min, 4);
      assertEquals(wr.body.data.earnings_state.timing_state, "confirmed");
      assertEquals(wr.body.data.timeline.length, 1);

      const tpl = await call(route("GET", "/v1/scenarios/templates").handler, {
        path: "/v1/scenarios/templates",
        ...as,
      });
      assertEquals(tpl.body.data.length, 5);
      const run = await call(route("POST", "/v1/scenarios/runs").handler, {
        method: "POST",
        path: "/v1/scenarios/runs",
        body: { scenario_id: "ai_hype_burst", as_of: "2099-01-02" },
        ...as,
      });
      assertEquals(run.status, 200);
      assertEquals(run.body.data.run.as_of, "2099-01-02");
      const runId = run.body.data.run.scenario_run_id;
      const runGet = await call(route("GET", "/v1/scenarios/runs/:id").handler, {
        path: `/v1/scenarios/runs/${runId}`,
        params: { id: runId },
        ...as,
      });
      assertEquals(runGet.body.data.impacts.length, run.body.data.impacts.length);
      if (runGet.body.data.impacts.length > 0) {
        assertEquals(typeof runGet.body.data.impacts[0].stress_score, "number");
      }

      const opp = await call(route("POST", "/v1/reports/:id/opposite-case").handler, {
        method: "POST",
        path: `/v1/reports/${u}-rep/opposite-case`,
        params: { id: `${u}-rep` },
        ...as,
      });
      assertEquals(opp.status, 404);
      assertEquals(opp.body.error_message, "Report artifact missing.");
      const oppGet = await call(route("GET", "/v1/reports/:id/opposite-case").handler, {
        path: `/v1/reports/${u}-rep/opposite-case`,
        params: { id: `${u}-rep` },
        ...as,
      });
      assertEquals(oppGet.body.error, "opposite_case_not_found");

      for (const p of ["/v1/conviction/timeline", "/v1/conviction/insights"]) {
        assertEquals((await call(route("GET", p).handler, { path: p, ...as })).status, 200);
      }

      const macro = await call(route("GET", "/v1/macro-stress/current").handler, { path: "/x", ...as });
      assertEquals(macro.status, 200);
      const senti = await call(route("GET", "/v1/sentiment/history").handler, { path: "/x?days=365", ...as });
      assert(
        senti.body.data.some((s: { id: string; score: number }) => s.id === `${u}-fg` && s.score === 47.5),
      );

      const mon = await call(route("GET", "/v1/user/monitor-snapshots").handler, { path: "/x", ...as });
      assertEquals(mon.body.data[0].score, 0.75);

      const fb = await call(route("POST", "/v1/feedback/report").handler, {
        method: "POST",
        path: "/v1/feedback/report",
        body: { report_id: `${u}-rep`, code: "useful", source_surface: "test" },
        ...as,
      });
      assertEquals(fb.status, 202);
      const fs = await call(route("POST", "/v1/feedback/subscription").handler, {
        method: "POST",
        path: "/v1/feedback/subscription",
        body: { code: "cancel_other", source_surface: "test" },
        ...as,
      });
      assertEquals(fs.status, 202);

      const alerts = await call(route("GET", "/v1/user/alerts").handler, { path: "/v1/user/alerts", ...as });
      assertEquals(alerts.body.data[0].detail_body, "Detail");
      const one = await call(route("GET", "/v1/user/alerts/:id").handler, {
        path: "/x",
        params: { id: `${u}-al` },
        ...as,
      });
      assertEquals(one.body.data.id, `${u}-al`);
      const feedback = await call(route("POST", "/v1/user/alerts/:id/feedback").handler, {
        method: "POST",
        path: "/x",
        params: { id: `${u}-al` },
        body: { feedback: "useful" },
        ...as,
      });
      assertEquals(feedback.body.data.feedback_state, "useful");
      const muted = await call(route("POST", "/v1/user/alerts/:id/mute").handler, {
        method: "POST",
        path: "/x",
        params: { id: `${u}-al` },
        ...as,
      });
      assert(muted.body.data.muted_at);
      const [pref] = await sql.unsafe(
        `select quiet_until from notification_preferences where user_id = $1 and notification_type = 'kill_switch'`,
        [u],
      );
      assert(pref.quiet_until instanceof Date && pref.quiet_until.getTime() > Date.now());

      const timeline = await call(route("GET", "/v1/conviction/timeline").handler, { path: "/x", ...as });
      assertEquals(timeline.body.data[0].event_type, "alert_feedback_recorded");

      const [audit] = await sql.unsafe(`select count(*)::int as n from audit_events where user_id = $1`, [u]);
      assert(audit.n > 10);
    } finally {
      await sql.unsafe(`delete from users where id = $1`, [u]);
      await sql.unsafe(`delete from jobs where id = $1`, [`${u}-job`]);
      await sql.unsafe(`delete from fear_greed_daily where id = $1`, [`${u}-fg`]);
      await sql.unsafe(`delete from calendar_events where id = $1`, [`${u}-ev`]);
      await sql.end();
    }
  },
});
