// DB-gated tests for the Pulse SQL (pulse.ts). Run only with THESIS_TEST_DB_URL; every row is removed after.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { db } from "./common.ts";
import { getLatestReportByType, getLatestUserResearchState, getReportByTypeAndDate } from "./pulse.ts";

const DB_URL = Deno.env.get("THESIS_TEST_DB_URL");

function dbTest(name: string, fn: () => Promise<void>): void {
  Deno.test({ name, ignore: !DB_URL, sanitizeOps: false, sanitizeResources: false, fn });
}

dbTest("pulse: latest and by-date market_pulse rows (UTC day)", async () => {
  const u = crypto.randomUUID();
  const jobs = [`m1-pj1-${u}`, `m1-pj2-${u}`, `m1-pj3-${u}`];
  // Far-future dates so real rows never win "latest".
  const rows: Array<[string, string, string]> = [
    [`m1-p1-${u}`, jobs[0], "2099-03-21T08:00:00Z"],
    [`m1-p2-${u}`, jobs[1], "2099-03-21T23:30:00Z"],
    [`m1-p3-${u}`, jobs[2], "2099-03-22T00:30:00+02:00"], // 2099-03-21 22:30 UTC
  ];
  for (const [, job] of rows) {
    await db()`insert into jobs (id, type, status, created_at) values (${job}, 'market_pulse', 'complete', now())`;
  }
  for (const [id, job, created] of rows) {
    await db()`insert into reports (id, job_id, type, schema_version, artifact_key, created_at)
      values (${id}, ${job}, 'market_pulse', '1.0', ${`market_pulse/x/${id}.json`}, ${created})`;
  }
  try {
    assertEquals((await getReportByTypeAndDate("market_pulse", "2099-03-21"))?.id, rows[1][0]);
    assertEquals(await getReportByTypeAndDate("market_pulse", "2099-03-22"), undefined);
    assertEquals((await getLatestReportByType("market_pulse"))?.id, rows[1][0]);
  } finally {
    await db()`delete from jobs where id in ${db()(jobs)}`;
  }
});

dbTest("pulse: latest research state on or before a date", async () => {
  const user = `m1-prs-${crypto.randomUUID()}`;
  await db()`insert into users (id, email, created_at) values (${user}, ${`${user}@example.test`}, now())`;
  const insert = (id: string, asOf: string) =>
    db()`insert into user_research_states (state_id, user_id, as_of, generated_at, state)
      values (${id}, ${user}, ${asOf}, ${`${asOf}T06:00:00Z`}, ${db().json({ as_of: asOf, names: [] })})`;
  try {
    await insert(`${user}-a`, "2026-03-20");
    await insert(`${user}-b`, "2026-03-22");
    const onDay = await getLatestUserResearchState({ userId: user, asOf: "2026-03-21" });
    assertEquals(onDay?.stateId, `${user}-a`);
    assertEquals(onDay?.asOf, "2026-03-20");
    assertEquals(onDay?.generatedAt, "2026-03-20T06:00:00.000Z");
    assertEquals(onDay?.state, { as_of: "2026-03-20", names: [] });
    assertEquals((await getLatestUserResearchState({ userId: user }))?.stateId, `${user}-b`);
    assertEquals(await getLatestUserResearchState({ userId: user, asOf: "2026-03-19" }), undefined);
  } finally {
    await db()`delete from user_research_states where user_id = ${user}`;
    await db()`delete from users where id = ${user}`;
  }
});
