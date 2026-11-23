// Reports, notes and share. Ports the notes part of apps/product-api/tests/m7-report-features.test.ts and the
// report read rules from server.ts; share rules from routes/report-share-routes.ts.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { ctx, jsonRequest } from "../../../_lib/store/testing.ts";
import { reportsHandlers } from "./handlers.ts";
import { reportsRoutes } from "./index.ts";
import { fakeReportsDeps, OTHER, OWNER, REPORT_ID, seededState } from "./fakes.ts";

const noteUrl = `/v1/reports/${REPORT_ID}/note`;

Deno.test("M7 notes CRUD enforces access (port)", async () => {
  const s = seededState();
  const h = reportsHandlers(fakeReportsDeps(s));
  const params = { id: REPORT_ID };

  const getMissingNote = await h.getNote(ctx(jsonRequest("GET", noteUrl), { userId: OWNER, params }));
  assertEquals(getMissingNote.status, 404);
  assertEquals((await getMissingNote.json()).error, "note_not_found");

  const saveNote = await h.putNote(
    ctx(jsonRequest("PUT", noteUrl, { content: "Track margin progression next quarter." }), {
      userId: OWNER,
      params,
    }),
  );
  assertEquals(saveNote.status, 200);
  const saveData = (await saveNote.json()).data;
  assertEquals(saveData.content, "Track margin progression next quarter.");
  assertEquals(saveData.report_id, REPORT_ID);
  assertEquals(typeof saveData.updated_at, "string");

  const getNote = await h.getNote(ctx(jsonRequest("GET", noteUrl), { userId: OWNER, params }));
  assertEquals(getNote.status, 200);
  assertEquals((await getNote.json()).data.content, "Track margin progression next quarter.");

  const otherCannotReadNote = await h.getNote(ctx(jsonRequest("GET", noteUrl), { userId: OTHER, params }));
  assertEquals(otherCannotReadNote.status, 404);
  assertEquals((await otherCannotReadNote.json()).error, "report_not_found");

  const otherCannotWrite = await h.putNote(
    ctx(jsonRequest("PUT", noteUrl, { content: "x" }), { userId: OTHER, params }),
  );
  assertEquals(otherCannotWrite.status, 404);
  assertEquals(s.audits.filter((a) => a.eventType === "report.note_upserted").length, 1);
});

Deno.test("PUT note validates content and trims it", async () => {
  const s = seededState();
  const h = reportsHandlers(fakeReportsDeps(s));
  const params = { id: REPORT_ID };
  const put = (body: unknown) => h.putNote(ctx(jsonRequest("PUT", noteUrl, body), { userId: OWNER, params }));

  for (const bad of [{}, { content: 42 }, { content: null }]) {
    const res = await put(bad);
    assertEquals(res.status, 422);
    assertEquals((await res.json()).error, "validation_failed");
  }
  const tooLong = await put({ content: "a".repeat(10_001) });
  assertEquals(tooLong.status, 422);
  assertEquals((await tooLong.json()).error_message, "content must be at most 10000 characters.");

  const ok = await put({ content: `  ${"a".repeat(10_000)}  ` });
  assertEquals(ok.status, 200);
  assertEquals((await ok.json()).data.content.length, 10_000);

  const missing = await h.putNote(
    ctx(jsonRequest("PUT", "/v1/reports/nope/note", { content: "x" }), {
      userId: OWNER,
      params: { id: "nope" },
    }),
  );
  assertEquals(missing.status, 404);
  assertEquals((await missing.json()).error, "report_not_found");
});

Deno.test("GET /reports returns a bare array of the user's reports", async () => {
  const s = seededState();
  const h = reportsHandlers(fakeReportsDeps(s));
  const res = await h.list(ctx(jsonRequest("GET", "/reports"), { userId: OWNER }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), [{
    report_id: REPORT_ID,
    job_id: "job-1",
    type: "deep_dive",
    ticker: "AAPL",
    schema_version: "2.0",
    created_at: "2026-03-30T09:31:00.000Z",
  }]);
  const other = await h.list(ctx(jsonRequest("GET", "/reports"), { userId: OTHER }));
  assertEquals(await other.json(), []);
});

Deno.test("GET /reports/:id returns the validated report with issuer enriched", async () => {
  const s = seededState();
  const h = reportsHandlers(fakeReportsDeps(s));
  const res = await h.read(
    ctx(jsonRequest("GET", `/reports/${REPORT_ID}`), { userId: OWNER, params: { id: REPORT_ID } }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.report_id, REPORT_ID);
  assertEquals(body.issuer, { name: "Apple Inc.", exchange: "NASDAQ" });
  assertEquals(body.valuation.fair_value_mid, 210);
  assertEquals(s.audits[0].eventType, "report.retrieved");
  assertEquals(s.audits[0].payload.report_id, REPORT_ID);
});

Deno.test("GET /reports/:id is 404 report_not_found for no row, no access, no artifact, bad artifact", async () => {
  const s = seededState();
  const h = reportsHandlers(fakeReportsDeps(s));
  const read = (userId: string, id: string) =>
    h.read(ctx(jsonRequest("GET", `/reports/${id}`), { userId, params: { id } }));

  const cases: Array<[string, string, string]> = [];
  cases.push([OWNER, "missing-report", "Report not found."]);
  cases.push([OTHER, REPORT_ID, "Report not found."]);
  for (const [userId, id, message] of cases) {
    const res = await read(userId, id);
    assertEquals(res.status, 404);
    assertEquals(await res.json(), { error: "report_not_found", error_message: message });
  }

  const key = s.reports[0].artifactKey;
  s.artifacts[key] = { report_id: REPORT_ID, type: "deep_dive" };
  const invalid = await read(OWNER, REPORT_ID);
  assertEquals(invalid.status, 404);
  assertEquals((await invalid.json()).error_message, "Report artifact missing.");

  delete s.artifacts[key];
  const missing = await read(OWNER, REPORT_ID);
  assertEquals(missing.status, 404);
  assertEquals((await missing.json()).error_message, "Report artifact missing.");
});

Deno.test("POST /v1/reports/:id/share is 201 once, then 200 with the same token", async () => {
  Deno.env.delete("PUBLIC_API_BASE_URL");
  const s = seededState();
  const h = reportsHandlers(fakeReportsDeps(s));
  const share = (userId: string, id = REPORT_ID) =>
    h.share(ctx(jsonRequest("POST", `/v1/reports/${id}/share`), { userId, params: { id } }));

  const first = await share(OWNER);
  assertEquals(first.status, 201);
  const firstData = (await first.json()).data;
  assertMatch(firstData.share_token, /^[A-Za-z0-9_-]{32}$/);
  assertEquals(firstData.path, `/r/${firstData.share_token}`);
  assertEquals(firstData.url, null);

  Deno.env.set("PUBLIC_API_BASE_URL", "https://thesis.example.workers.dev/");
  try {
    const second = await share(OWNER);
    assertEquals(second.status, 200);
    const secondData = (await second.json()).data;
    assertEquals(secondData.share_token, firstData.share_token);
    assertEquals(secondData.url, `https://thesis.example.workers.dev/r/${firstData.share_token}`);
  } finally {
    Deno.env.delete("PUBLIC_API_BASE_URL");
  }
  assertEquals(s.shares.length, 1);
  assertEquals(s.audits.map((a) => a.payload.created), [true, false]);

  const otherShare = await share(OTHER);
  assertEquals(otherShare.status, 404);
  assertEquals((await otherShare.json()).error, "report_not_found");

  // Deep Dive only.
  s.reports.push({ ...s.reports[0], id: "pulse-1", type: "market_pulse" });
  s.access[OWNER].push("pulse-1");
  assertEquals((await share(OWNER, "pulse-1")).status, 404);
});

Deno.test("reports routes register the contract paths with user auth and pass the rate limit through", async () => {
  const s = seededState();
  const deps = fakeReportsDeps(s);
  const routes = reportsRoutes({
    ...deps,
    rateLimit: () => Promise.resolve(new Response("{}", { status: 429 })),
  });
  assertEquals(routes.map((r) => `${r.method} ${r.path} ${r.auth}`), [
    "GET /reports user",
    "GET /reports/:id user",
    "GET /v1/reports/:id/note user",
    "PUT /v1/reports/:id/note user",
    "POST /v1/reports/:id/share user",
  ]);
  for (const route of routes) {
    const res = await route.handler(
      ctx(jsonRequest(route.method, "/x"), { userId: OWNER, params: { id: REPORT_ID } }),
    );
    assert(res.status === 429);
  }
});
