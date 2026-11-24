// GET /v1/reports/:id/page: the in-app Deep Dive page (DECISIONS D3, 2026-11-24).
import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { handle } from "../../app.ts";
import { ctx, jsonRequest } from "../../../_lib/store/testing.ts";
import { READER_CSP, READER_V2_CSP } from "../../../_lib/reports/share_reader.ts";
import { CLIENT_JS } from "../../../_lib/reports/deep_dive_v2/client.ts";
import { sampleInstitutionalReport } from "../../../_lib/reports/testdata/editorial_institutional.ts";
import { fakeReportsDeps, type FakeState, OTHER, OWNER, REPORT_ID, seededState } from "./fakes.ts";
import { type ReportsDeps, reportsHandlers } from "./handlers.ts";
import { pageOptions } from "./page.ts";

const DOWNLOAD = "https://example.com/get-thesis";

function setup(overrides: Partial<ReportsDeps> = {}) {
  const s: FakeState = seededState();
  s.artifacts[s.reports[0].artifactKey] = sampleInstitutionalReport("job-1", REPORT_ID);
  const h = reportsHandlers({ ...fakeReportsDeps(s), ...overrides });
  const get = (userId: string, id = REPORT_ID, query = "") =>
    h.page(ctx(jsonRequest("GET", `/v1/reports/${id}/page${query}`), { userId, params: { id } }));
  return { s, get };
}

async function withDownloadUrl<T>(fn: () => Promise<T>): Promise<T> {
  Deno.env.set("APP_DOWNLOAD_URL", DOWNLOAD);
  try {
    return await fn();
  } finally {
    Deno.env.delete("APP_DOWNLOAD_URL");
  }
}

function assertPageHeaders(res: Response, csp: string) {
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(res.headers.get("x-thesis-content-type"), "text/html; charset=utf-8");
  assertEquals(res.headers.get("content-security-policy"), csp);
  assertEquals(res.headers.get("x-thesis-csp"), csp);
  assertEquals(res.headers.get("cache-control"), "private, no-store");
  assertEquals(res.headers.get("x-robots-tag"), "noindex, nofollow");
  assertEquals(res.headers.get("referrer-policy"), "no-referrer");
  assertEquals(res.headers.get("x-frame-options"), "DENY");
  assertEquals(res.headers.get("x-content-type-options"), "nosniff");
}

Deno.test("GET /v1/reports/:id/page is 401 without a token, before touching the database", async () => {
  for (const path of [`/v1/reports/${REPORT_ID}/page`, `/v1/reports/${REPORT_ID}/page?embed=1&theme=dark`]) {
    const res = await handle(new Request(`http://x/functions/v1/api${path}`), () => Promise.resolve(null));
    assertEquals(res.status, 401, path);
    assertEquals((await res.json()).error, "unauthorized");
  }
});

Deno.test("GET /v1/reports/:id/page serves the Deep Dive 2.0 page with the reader CSP, never cached", async () => {
  const { s, get } = setup();
  const res = await withDownloadUrl(() => get(OWNER));
  assertEquals(res.status, 200);
  assertPageHeaders(res, READER_V2_CSP);
  const body = await res.text();
  assertMatch(body, /^<!doctype html><html lang="en"><head>/);
  assertStringIncludes(body, "<title>Apple Inc. Deep Dive</title>");
  // No query: the same page as the share link, app bar and app link included.
  assertStringIncludes(body, '<div class="appbar">');
  assertStringIncludes(body, `<a href="${DOWNLOAD}">Get the Thesis app</a>`);
  const scripts = [...body.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  assertEquals(scripts.map((m) => m[1]), [' type="application/json" id="dd-data"', ""]);
  assertEquals(scripts[1][2], CLIENT_JS);
  assertEquals(body.includes(OWNER), false);
  assertEquals(s.audits.map((a) => [a.eventType, a.payload.route, a.payload.report_id, a.userId]), [
    ["report.retrieved", "/v1/reports/:id/page", REPORT_ID, OWNER],
  ]);
});

Deno.test("GET /v1/reports/:id/page?theme=..&embed=1: server theme, no app bar, switch or app link", async () => {
  const { get } = setup();
  for (const theme of ["light", "dark"]) {
    const res = await withDownloadUrl(() => get(OWNER, REPORT_ID, `?theme=${theme}&embed=1`));
    assertEquals(res.status, 200);
    assertPageHeaders(res, READER_V2_CSP);
    const body = await res.text();
    assertMatch(body, new RegExp(`^<!doctype html><html lang="en" data-theme="${theme}"><head>`));
    const page = body.replace(/<script>[\s\S]*?<\/script>/, "");
    assertEquals(page.includes('class="appbar"'), false);
    assertEquals(page.includes("data-dd-theme"), false);
    assertEquals(page.includes("Get the Thesis app"), false);
    assertEquals(page.includes(DOWNLOAD), false);
    assertStringIncludes(page, "Thesis is research, not financial advice.");
    assertStringIncludes(page, '<nav class="chipnav"');
  }
  // theme alone keeps the app bar; embed alone sets no theme.
  const themed = await (await get(OWNER, REPORT_ID, "?theme=dark")).text();
  assertMatch(themed, /^<!doctype html><html lang="en" data-theme="dark"><head>/);
  assertStringIncludes(themed, '<div class="appbar">');
  const embedded = await (await get(OWNER, REPORT_ID, "?embed=1")).text();
  assertMatch(embedded, /^<!doctype html><html lang="en"><head>/);
  assertEquals(embedded.includes('<div class="appbar">'), false);
});

Deno.test("GET /v1/reports/:id/page ignores any other theme or embed value", async () => {
  const { get } = setup();
  const base = await (await get(OWNER)).text();
  for (
    const q of [
      "?theme=blue",
      "?theme=DARK",
      "?theme=",
      "?embed=true",
      "?embed=0",
      "?embed=1x",
      "?theme=%22%3E",
    ]
  ) {
    assertEquals(await (await get(OWNER, REPORT_ID, q)).text(), base, q);
  }
  const url = (q: string) => new URL(`http://x/v1/reports/a/page${q}`);
  assertEquals(pageOptions(url("?theme=light&embed=1")), { theme: "light", embed: true });
  assertEquals(pageOptions(url("?theme=Light&embed=yes")), { theme: undefined, embed: false });
  assertEquals(pageOptions(url("?theme=dark&theme=light")), { theme: "dark", embed: false });
});

Deno.test("GET /v1/reports/:id/page is a 404 page for no row, no access, not a Deep Dive, or no artifact", async () => {
  const { s, get } = setup();
  s.reports.push({ ...s.reports[0], id: "pulse-1", type: "market_pulse" });
  s.access[OWNER].push("pulse-1");
  const cases: Array<[string, string, string]> = [
    [OWNER, "missing-report", "Report not found."],
    [OTHER, REPORT_ID, "Report not found."],
    [OWNER, "pulse-1", "Report not found."],
  ];
  const key = s.reports[0].artifactKey;
  const check = async ([userId, id, message]: [string, string, string]) => {
    const res = await get(userId, id, "?embed=1&theme=dark");
    assertEquals(res.status, 404, `${userId} ${id}`);
    assertPageHeaders(res, READER_CSP);
    const body = await res.text();
    assertMatch(body, /^<!doctype html>/);
    assertStringIncludes(body, `<p data-error="report_not_found">${message}</p>`);
    assertEquals(body.includes("<script"), false);
    assertEquals(body.includes("Get the Thesis app"), false);
  };
  for (const c of cases) await check(c);
  s.artifacts[key] = { report_id: REPORT_ID, type: "deep_dive" };
  await check([OWNER, REPORT_ID, "Report artifact missing."]);
  delete s.artifacts[key];
  await check([OWNER, REPORT_ID, "Report artifact missing."]);
  assertEquals(s.audits.length, 0);
});

Deno.test("GET /v1/reports/:id/page falls back to the editorial page when Deep Dive 2.0 throws", async () => {
  const { get } = setup({
    renderV2: () => {
      throw new Error("boom");
    },
  });
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.map(String).join(" "));
  let plain: Response, embed: Response;
  try {
    plain = await withDownloadUrl(() => get(OWNER));
    embed = await withDownloadUrl(() => get(OWNER, REPORT_ID, "?embed=1&theme=dark"));
  } finally {
    console.error = orig;
  }
  for (const res of [plain, embed]) {
    assertEquals(res.status, 200);
    assertPageHeaders(res, READER_CSP);
  }
  const plainBody = await plain.text();
  assertEquals(plainBody.includes("<script"), false);
  assertStringIncludes(plainBody, "Apple Inc.");
  assertStringIncludes(plainBody, "Thesis is research, not financial advice.");
  assertStringIncludes(plainBody, "Get the Thesis app");
  const embedBody = await embed.text();
  assertStringIncludes(embedBody, "Thesis is research, not financial advice.");
  assertEquals(embedBody.includes("Get the Thesis app"), false);
  assertEquals(embedBody.includes(DOWNLOAD), false);
  assertEquals(errors.length, 2);
  for (const e of errors) {
    assertStringIncludes(e, "deep_dive_v2_render_failed");
    assertStringIncludes(e, REPORT_ID);
  }
});

Deno.test("GET /v1/reports/:id/page passes the rate limit answer through", async () => {
  const { get } = setup({ rateLimit: () => Promise.resolve(new Response("{}", { status: 429 })) });
  const res = await get(OWNER);
  assert(res.status === 429);
});
