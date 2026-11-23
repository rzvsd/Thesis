import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { githubActionsRunner, runIdFromUrl } from "./dispatch.ts";

function fakeFetch(status: number, body?: unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(
      body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
    );
  }) as typeof fetch;
  return { fetchFn, calls };
}

Deno.test("dispatch posts workflow_dispatch with only the job id", async () => {
  const { fetchFn, calls } = fakeFetch(204);
  const runner = githubActionsRunner({ token: "tok", repo: "rzvsd/thesis", ref: "rebuild", fetchFn });
  await runner.dispatch("job-1");
  assertEquals(
    calls[0].url,
    "https://api.github.com/repos/rzvsd/thesis/actions/workflows/rebuild-deep-dive.yml/dispatches",
  );
  assertEquals(JSON.parse(String(calls[0].init?.body)), { ref: "rebuild", inputs: { job_id: "job-1" } });
  assertEquals(new Headers(calls[0].init?.headers).get("authorization"), "Bearer tok");
});

Deno.test("dispatch throws without a token or on an error status", async () => {
  const { fetchFn } = fakeFetch(422);
  Deno.env.delete("GITHUB_DISPATCH_TOKEN");
  await assertRejects(() => githubActionsRunner({ fetchFn }).dispatch("j"));
  await assertRejects(() => githubActionsRunner({ token: "t", fetchFn }).dispatch("j"));
});

Deno.test("runState reads the run status and ignores foreign run urls", async () => {
  const done = fakeFetch(200, { status: "completed", conclusion: "cancelled" });
  const r = githubActionsRunner({ token: "t", repo: "rzvsd/thesis", fetchFn: done.fetchFn });
  assertEquals(await r.runState("https://github.com/rzvsd/thesis/actions/runs/123"), "finished");
  assertEquals(done.calls[0].url, "https://api.github.com/repos/rzvsd/thesis/actions/runs/123");
  assertEquals(await r.runState("https://github.com/evil/repo/actions/runs/1"), "unknown");
  const going = fakeFetch(200, { status: "in_progress" });
  const r2 = githubActionsRunner({ token: "t", repo: "rzvsd/thesis", fetchFn: going.fetchFn });
  assertEquals(await r2.runState("https://github.com/rzvsd/thesis/actions/runs/5"), "active");
  assertEquals(
    runIdFromUrl("https://github.com/rzvsd/thesis/actions/runs/9/attempts/2", "rzvsd/thesis"),
    "9",
  );
});
