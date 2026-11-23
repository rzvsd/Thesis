import { assertEquals } from "jsr:@std/assert@1.0.13";
import { supabaseStorageArtifacts, toArtifactKey } from "./artifacts.ts";
import type { AnalysisReport } from "./types.ts";

const report = {
  report_id: "r1",
  job_id: "j1",
  type: "deep_dive",
  schema_version: "2.0",
  generated_at: "2026-11-25T10:00:00Z",
  sections: [],
} as AnalysisReport;

Deno.test("artifact key keeps the old format", () => {
  assertEquals(toArtifactKey(report), "deep_dive/2026-11-25/r1.json");
});

Deno.test("writes, reads and deletes through the Storage API with the service key", async () => {
  const calls: Array<{ url: string; method: string; auth: string | null }> = [];
  const objects = new Map<string, string>();
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, auth: new Headers(init?.headers).get("authorization") });
    if (method === "POST") objects.set(url, String(init?.body));
    if (method === "GET") {
      const body = objects.get(url);
      return Promise.resolve(
        body ? new Response(body, { status: 200 }) : new Response("{}", { status: 400 }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;
  const store = supabaseStorageArtifacts({
    url: "https://p.supabase.co",
    key: "svc",
    bucket: "report-artifacts",
    fetchFn,
  });
  const key = await store.writeReport(report);
  assertEquals(
    calls[0].url,
    "https://p.supabase.co/storage/v1/object/report-artifacts/deep_dive/2026-11-25/r1.json",
  );
  assertEquals(calls[0].auth, "Bearer svc");
  assertEquals((await store.readReport(key))?.report_id, "r1");
  assertEquals(await store.readReport("deep_dive/x/missing.json"), undefined);
  await store.deleteReport(key);
  assertEquals(calls.at(-1)?.method, "DELETE");
});
