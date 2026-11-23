import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
  type AnalysisRequest,
  claim,
  type Logger,
  runClaimed,
  UUID_RE,
} from "./runner.mts";

const JOB = "0b7b2f2e-3c5d-4c8e-9a1b-2f3e4d5c6b7a";
const quiet: Logger = { info: () => {}, error: () => {} };

function fakeApi(
  handler: (path: string, body: Record<string, unknown>) => Response,
) {
  const calls: Array<
    { path: string; body: Record<string, unknown>; token: string | null }
  > = [];
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? "{}"));
    const path = url.pathname.replace(/^\/api/, "");
    calls.push({
      path,
      body,
      token: new Headers(init?.headers).get("x-internal-token"),
    });
    return Promise.resolve(handler(path, body));
  }) as typeof fetch;
  return {
    api: { baseUrl: "https://example.test/api", token: "t0ken", fetchFn },
    calls,
  };
}

const request: AnalysisRequest = {
  request_id: "r1",
  type: "deep_dive",
  ticker: "AAPL",
  user_id: "u1",
  job_id: JOB,
  requested_at: "2026-11-25T00:00:00Z",
};

Deno.test("job ids must be UUIDs", () => {
  assertEquals(UUID_RE.test(JOB), true);
  assertEquals(UUID_RE.test("1; rm -rf /"), false);
  assertEquals(UUID_RE.test(JOB.toUpperCase()), false);
});

Deno.test("claim sends the token and run url and returns the request", async () => {
  const { api, calls } = fakeApi(() =>
    Response.json({ job: { job_id: JOB }, analysis_request: request }, {
      status: 200,
    })
  );
  const r = await claim(api, JOB, "https://github.com/o/r/actions/runs/1");
  assertEquals(r.ok, true);
  assertEquals(calls[0].path, `/internal/jobs/${JOB}/claim`);
  assertEquals(calls[0].token, "t0ken");
  assertEquals(calls[0].body.run_url, "https://github.com/o/r/actions/runs/1");
});

Deno.test("claim of a taken job is not_claimable", async () => {
  const { api } = fakeApi(() =>
    Response.json({ error: "job_not_claimable" }, { status: 409 })
  );
  assertEquals(await claim(api, JOB), {
    ok: false,
    reason: "not_claimable",
    status: 409,
  });
});

Deno.test("claim refuses a bad job id without calling the API", async () => {
  const { api, calls } = fakeApi(() => new Response(null, { status: 500 }));
  assertEquals((await claim(api, "nope")).ok, false);
  assertEquals(calls.length, 0);
});

Deno.test("a good run posts complete with report and usage", async () => {
  const { api, calls } = fakeApi(() => Response.json({ status: "ok" }));
  const out = await runClaimed(
    api,
    request,
    () => Promise.resolve({ report: { a: 1 }, usage: { c: 2 } }),
    quiet,
  );
  assertEquals(out, "complete");
  assertEquals(calls.map((c) => c.path), [`/internal/jobs/${JOB}/complete`]);
  assertEquals(calls[0].body, { report: { a: 1 }, llm_usage: { c: 2 } });
});

Deno.test("a pipeline error posts fail with the message", async () => {
  const { api, calls } = fakeApi(() => Response.json({ status: "ok" }));
  const out = await runClaimed(
    api,
    request,
    () => Promise.reject(new Error("Forced failure for ticker FAIL")),
    quiet,
  );
  assertEquals(out, "failed");
  assertEquals(calls.map((c) => c.path), [`/internal/jobs/${JOB}/fail`]);
  assertEquals(calls[0].body.error_message, "Forced failure for ticker FAIL");
});

Deno.test("a rejected report posts fail", async () => {
  const { api, calls } = fakeApi((path) =>
    path.endsWith("/complete")
      ? Response.json({ error: "validation_failed" }, { status: 422 })
      : Response.json({ status: "ok" })
  );
  const out = await runClaimed(
    api,
    request,
    () => Promise.resolve({ report: {} }),
    quiet,
  );
  assertEquals(out, "failed");
  assertEquals(calls.map((c) => c.path.split("/").pop()), ["complete", "fail"]);
});
