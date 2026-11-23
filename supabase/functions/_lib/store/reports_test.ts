// DB-gated tests for the report SQL (reports.ts). Run only with THESIS_TEST_DB_URL; every row is removed after.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { db } from "./common.ts";
import {
  appendAuditEvent,
  createReportShare,
  getReportById,
  getReportNote,
  getReportShareByToken,
  getReportShareToken,
  getSupportedTicker,
  hasReportAccessForUser,
  listReportsByUser,
  upsertReportNote,
} from "./reports.ts";

const DB_URL = Deno.env.get("THESIS_TEST_DB_URL");

function dbTest(name: string, fn: () => Promise<void>): void {
  Deno.test({ name, ignore: !DB_URL, sanitizeOps: false, sanitizeResources: false, fn });
}

async function seed() {
  const u = crypto.randomUUID();
  const owner = `m1-rep-owner-${u}`;
  const other = `m1-rep-other-${u}`;
  for (const id of [owner, other]) {
    await db()`insert into users (id, email, created_at) values (${id}, ${`${id}@example.test`}, now())`;
  }
  const jobDone = `m1-rep-job-${u}`;
  const jobOld = `m1-rep-job-old-${u}`;
  const reportA = `m1-rep-a-${u}`;
  const reportB = `m1-rep-b-${u}`;
  await db()`insert into jobs (id, type, status, user_id, ticker, created_at)
    values (${jobDone}, 'deep_dive', 'complete', ${owner}, 'AAPL', now()),
           (${jobOld}, 'deep_dive', 'running', ${owner}, 'MSFT', now())`;
  await db()`insert into reports (id, job_id, type, ticker, schema_version, artifact_key, created_at)
    values (${reportA}, ${jobDone}, 'deep_dive', 'AAPL', '2.0', ${`deep_dive/2026-03-30/${reportA}.json`},
            '2026-03-30T09:30:00Z'),
           (${reportB}, ${jobOld}, 'deep_dive', 'MSFT', '2.0', ${`deep_dive/2026-03-31/${reportB}.json`},
            '2026-03-31T09:30:00Z')`;
  await db()`update jobs set report_id = ${reportA} where id = ${jobDone}`;
  await db()`update jobs set report_id = ${reportB} where id = ${jobOld}`;
  const cleanup = async () => {
    await db()`delete from audit_events where user_id in (${owner}, ${other})`;
    await db()`delete from jobs where id in (${jobDone}, ${jobOld})`; // cascades reports, notes, shares
    await db()`delete from users where id in (${owner}, ${other})`;
  };
  return { owner, other, reportA, reportB, jobDone, cleanup };
}

dbTest("reports: read, access and list follow completed jobs only", async () => {
  const s = await seed();
  try {
    const a = await getReportById(s.reportA);
    assertEquals(a?.jobId, s.jobDone);
    assertEquals(a?.type, "deep_dive");
    assertEquals(a?.artifactKey, `deep_dive/2026-03-30/${s.reportA}.json`);
    assertEquals(a?.createdAt, "2026-03-30T09:30:00.000Z");
    assertEquals(a?.isCurrent, true);
    assertEquals(await getReportById(`${s.reportA}-nope`), undefined);
    assertEquals(await hasReportAccessForUser(s.owner, s.reportA), true);
    assertEquals(await hasReportAccessForUser(s.owner, s.reportB), false);
    assertEquals(await hasReportAccessForUser(s.other, s.reportA), false);
    assertEquals((await listReportsByUser(s.owner)).map((r) => r.id), [s.reportA]);
    assertEquals(await listReportsByUser(s.other), []);
  } finally {
    await s.cleanup();
  }
});

dbTest("reports: notes upsert and read back", async () => {
  const s = await seed();
  try {
    assertEquals(await getReportNote(s.reportA, s.owner), undefined);
    const first = await upsertReportNote({
      reportId: s.reportA,
      userId: s.owner,
      content: "first",
      updatedAt: "2026-04-01T10:00:00.000Z",
    });
    assertEquals(first, {
      reportId: s.reportA,
      userId: s.owner,
      content: "first",
      updatedAt: "2026-04-01T10:00:00.000Z",
    });
    await upsertReportNote({
      reportId: s.reportA,
      userId: s.owner,
      content: "second",
      updatedAt: "2026-04-02T10:00:00.000Z",
    });
    const note = await getReportNote(s.reportA, s.owner);
    assertEquals(note?.content, "second");
    assertEquals(note?.updatedAt, "2026-04-02T10:00:00.000Z");
    assertEquals(await getReportNote(s.reportA, s.other), undefined);
  } finally {
    await s.cleanup();
  }
});

dbTest("reports: share tokens and audit rows", async () => {
  const s = await seed();
  const token = `m1tok${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 32);
  try {
    assertEquals(await getReportShareToken({ userId: s.owner, reportId: s.reportA }), undefined);
    await createReportShare({
      token,
      reportId: s.reportA,
      userId: s.owner,
      createdAt: "2026-04-01T10:00:00.000Z",
    });
    assertEquals(await getReportShareToken({ userId: s.owner, reportId: s.reportA }), token);
    assertEquals(await getReportShareByToken(token), {
      token,
      reportId: s.reportA,
      userId: s.owner,
      createdAt: "2026-04-01T10:00:00.000Z",
    });
    assertEquals(await getReportShareByToken(`${token}x`), undefined);

    await appendAuditEvent("report.shared", { report_id: s.reportA, created: true }, s.owner);
    const rows = await db()`select event_type, payload from audit_events where user_id = ${s.owner}`;
    assertEquals(rows.length, 1);
    assertEquals(rows[0].event_type, "report.shared");
    assertEquals(rows[0].payload, { report_id: s.reportA, created: true });
  } finally {
    await s.cleanup();
  }
});

dbTest("reports: supported ticker lookup for issuer enrichment", async () => {
  const sym = `ZQR${crypto.randomUUID().replace(/[^A-Z]/gi, "").slice(0, 5).toUpperCase()}`;
  await db()`
    insert into ticker_registry (symbol, company_name, exchange, listing_status, is_supported, source_feed,
                                 source_updated_at, last_synced_at)
    values (${sym}, 'Zqr Test Corp', 'NYSE', 'active', true, 'm1-test', now(), now()),
           (${`${sym}D`}, 'Gone Corp', 'NYSE', 'delisted', true, 'm1-test', now(), now())`;
  try {
    assertEquals(await getSupportedTicker(` ${sym.toLowerCase()} `), {
      companyName: "Zqr Test Corp",
      exchange: "NYSE",
    });
    assertEquals(await getSupportedTicker(`${sym}D`), undefined);
    assertEquals(await getSupportedTicker("  "), undefined);
  } finally {
    await db()`delete from ticker_registry where symbol in (${sym}, ${`${sym}D`})`;
  }
});
