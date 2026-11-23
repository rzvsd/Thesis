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
  Deno.env.set("SUPABASE_URL", "https://p.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.delete("REPORT_ARTIFACT_BUCKET");
  const calls: Array<{ url: string; method: string; auth: string | null }> = [];
  const objects = new Map<string, string>();
  const fetchFn = (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, auth: new Headers(init?.headers).get("authorization") });
    if (method === "POST") objects.set(url, String(init?.body));
    if (method === "GET") {
      const body = objects.get(url);
      if (body) return Promise.resolve(new Response(body, { status: 200 }));
      if (url.includes("broken")) return Promise.resolve(new Response("boom", { status: 500 }));
      return Promise.resolve(new Response("not found", { status: 404 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  const store = supabaseStorageArtifacts(fetchFn);
  const key = await store.writeReport(report);
  assertEquals(
    calls[0].url,
    "https://p.supabase.co/storage/v1/object/report-artifacts/deep_dive/2026-11-25/r1.json",
  );
  assertEquals(calls[0].auth, "Bearer svc");
  assertEquals((await store.readReport(key))?.report_id, "r1");
  assertEquals(await store.readReport("deep_dive/x/missing.json"), undefined);
  assertEquals(await store.readReport("deep_dive/x/broken.json"), undefined);
  await store.deleteReport(key);
  assertEquals(calls.at(-1)?.method, "DELETE");
});
