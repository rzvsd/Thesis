// Public HTML pages: legal, shared report reader (/r/:token), email unsubscribe.
// Ported behaviour from apps/product-api/src/routes/{legal-routes,report-share-routes,email-unsubscribe-routes}.ts.
import { assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { handle } from "../../app.ts";
import { ctx, jsonRequest } from "../../../_lib/store/testing.ts";
import { signUnsubscribeToken } from "../../../_lib/reports/unsubscribe_token.ts";
import { fakeReportsDeps, OWNER, REPORT_ID, seededState } from "../reports/fakes.ts";
import { sampleInstitutionalReport } from "../../../_lib/reports/testdata/editorial_institutional.ts";
import { LEGAL_CSP } from "./legal.ts";
import { defaultVerify } from "./unsubscribe.ts";
import { type WebDeps, webRoutes } from "./index.ts";

const READER_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";

function deps(overrides: Partial<WebDeps> = {}) {
  const state = seededState();
  const optOuts: Array<{ userId: string; optOut: boolean }> = [];
  const base: WebDeps = {
    share: fakeReportsDeps(state),
    unsubscribe: {
      verify: (token) => Promise.resolve(token === "good-token" ? OWNER : undefined),
      setEmailOptOut: (input) => {
        optOuts.push({ userId: input.userId, optOut: input.optOut });
        return Promise.resolve();
      },
    },
    rateLimit: () => Promise.resolve(null),
  };
  return { state, optOuts, routes: webRoutes({ ...base, ...overrides }) };
}

function route(routes: ReturnType<typeof webRoutes>, method: string, path: string) {
  const r = routes.find((x) => x.method === method && x.path === path);
  if (!r) throw new Error(`no route ${method} ${path}`);
  return r;
}

Deno.test("legal pages are public HTML with the old headers, trailing slash accepted", async () => {
  for (const path of ["/legal/privacy", "/legal/terms/", "/functions/v1/api/legal/privacy/"]) {
    const res = await handle(new Request(`http://x${path}`), () => Promise.resolve(null));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    assertEquals(res.headers.get("x-thesis-content-type"), "text/html; charset=utf-8");
    assertEquals(res.headers.get("cache-control"), "public, max-age=300");
    assertEquals(res.headers.get("content-security-policy"), LEGAL_CSP);
    assertEquals(res.headers.get("x-thesis-csp"), LEGAL_CSP);
    const body = await res.text();
    assertMatch(body, /^<!doctype html>/);
    assertStringIncludes(body, "DRAFT - requires legal review before publication");
  }
  const privacy = await (await handle(new Request("http://x/legal/privacy"))).text();
  assertStringIncludes(privacy, "<title>Thesis Privacy Policy</title>");
});

Deno.test("/r/:token renders the shared Deep Dive with reader headers", async () => {
  const { state, routes } = deps();
  const key = state.reports[0].artifactKey;
  state.artifacts[key] = sampleInstitutionalReport("job-1", REPORT_ID);
  state.shares.push({
    token: TOKEN,
    reportId: REPORT_ID,
    userId: OWNER,
    createdAt: "2026-03-30T10:00:00.000Z",
  });
  const res = await route(routes, "GET", "/r/:token").handler(
    ctx(jsonRequest("GET", `/r/${TOKEN}`), { params: { token: TOKEN } }),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("cache-control"), "private, max-age=300");
  assertEquals(res.headers.get("x-robots-tag"), "noindex, nofollow");
  assertEquals(res.headers.get("referrer-policy"), "no-referrer");
  assertEquals(res.headers.get("content-security-policy"), READER_CSP);
  assertEquals(res.headers.get("x-thesis-csp"), READER_CSP);
  assertEquals(res.headers.get("x-thesis-content-type"), "text/html; charset=utf-8");
  const body = await res.text();
  assertStringIncludes(body, '<meta name="robots" content="noindex, nofollow" />');
  assertStringIncludes(body, "Thesis is research, not financial advice.");
  assertStringIncludes(body, "Get the Thesis app");
  assertStringIncludes(body, "Apple Inc.");
  assertStringIncludes(body, "Page 17 of 17");
  // The sharer's identity is never rendered.
  assertEquals(body.includes(OWNER), false);
});

Deno.test("/r/:token is 404 HTML for a bad token, unknown token, or non Deep Dive", async () => {
  const { state, routes } = deps();
  state.shares.push({
    token: TOKEN,
    reportId: "pulse-1",
    userId: OWNER,
    createdAt: "2026-03-30T10:00:00.000Z",
  });
  state.reports.push({ ...state.reports[0], id: "pulse-1", type: "market_pulse" });
  const reader = route(routes, "GET", "/r/:token");
  for (const token of ["short", "x".repeat(65), "bad token with spaces!!!!", TOKEN, "Z".repeat(32)]) {
    const res = await reader.handler(ctx(jsonRequest("GET", `/r/${token}`), { params: { token } }));
    assertEquals(res.status, 404);
    assertEquals(res.headers.get("content-security-policy"), READER_CSP);
    assertEquals(res.headers.get("cache-control"), "private, max-age=300");
    assertStringIncludes(await res.text(), "This shared report is not available.");
  }
});

Deno.test("unsubscribe: 400 for a bad token, GET confirm form, POST sets the opt-out", async () => {
  const { routes, optOuts } = deps();
  const get = route(routes, "GET", "/v1/email/unsubscribe");
  const post = route(routes, "POST", "/v1/email/unsubscribe");

  const bad = await get.handler(ctx(jsonRequest("GET", "/v1/email/unsubscribe?token=nope")));
  assertEquals(bad.status, 400);
  assertEquals(bad.headers.get("cache-control"), "no-store");
  assertStringIncludes(await bad.text(), "This unsubscribe link is not valid.");

  const confirm = await get.handler(ctx(jsonRequest("GET", "/v1/email/unsubscribe?token=good-token")));
  assertEquals(confirm.status, 200);
  assertEquals(confirm.headers.get("x-thesis-content-type"), "text/html; charset=utf-8");
  assertStringIncludes(
    await confirm.text(),
    '<form method="post" action="/v1/email/unsubscribe?token=good-token"><button type="submit">Unsubscribe</button></form>',
  );
  assertEquals(optOuts.length, 0);

  const done = await post.handler(ctx(jsonRequest("POST", "/v1/email/unsubscribe?token=good-token")));
  assertEquals(done.status, 200);
  assertStringIncludes(await done.text(), "You will no longer get Thesis notification emails.");
  assertEquals(optOuts, [{ userId: OWNER, optOut: true }]);

  const badPost = await post.handler(ctx(jsonRequest("POST", "/v1/email/unsubscribe")));
  assertEquals(badPost.status, 400);
  assertEquals(optOuts.length, 1);
});

Deno.test("unsubscribe uses the real signed token with EMAIL_LINK_SECRET", async () => {
  Deno.env.set("EMAIL_LINK_SECRET", "unsubscribe-test-secret");
  try {
    const optOuts: string[] = [];
    const real = webRoutes({
      share: fakeReportsDeps(seededState()),
      unsubscribe: {
        verify: defaultVerify,
        setEmailOptOut: (input) => {
          optOuts.push(input.userId);
          return Promise.resolve();
        },
      },
      rateLimit: () => Promise.resolve(null),
    });
    const token = await signUnsubscribeToken("user-42");
    const res = await route(real, "POST", "/v1/email/unsubscribe").handler(
      ctx(jsonRequest("POST", `/v1/email/unsubscribe?token=${token}`)),
    );
    assertEquals(res.status, 200);
    assertEquals(optOuts, ["user-42"]);
  } finally {
    Deno.env.delete("EMAIL_LINK_SECRET");
  }
});

Deno.test("web routes are public and rate limited except legal pages", async () => {
  const { routes } = deps({ rateLimit: () => Promise.resolve(new Response("{}", { status: 429 })) });
  assertEquals(routes.map((r) => `${r.method} ${r.path} ${r.auth}`), [
    "GET /legal/privacy none",
    "GET /legal/terms none",
    "GET /r/:token none",
    "GET /v1/email/unsubscribe none",
    "POST /v1/email/unsubscribe none",
  ]);
  const statuses = [];
  for (const r of routes) {
    statuses.push(
      (await r.handler(ctx(jsonRequest(r.method, "/x?token=good-token"), { params: { token: TOKEN } })))
        .status,
    );
  }
  assertEquals(statuses, [200, 200, 429, 429, 429]);
});
