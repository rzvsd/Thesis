import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { artifactKeyFor, storageArtifactReader, writeArtifact } from "./artifacts.ts";

function withEnv(fn: () => Promise<void>) {
  return async () => {
    Deno.env.set("SUPABASE_URL", "https://proj.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key-for-test");
    Deno.env.delete("REPORT_ARTIFACT_BUCKET");
    try {
      await fn();
    } finally {
      Deno.env.delete("SUPABASE_URL");
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    }
  };
}

Deno.test("artifactKeyFor keeps the old key format", () => {
  assertEquals(
    artifactKeyFor({ type: "deep_dive", generated_at: "2026-03-30T09:30:00.000Z", report_id: "r1" }),
    "deep_dive/2026-03-30/r1.json",
  );
  assertEquals(
    artifactKeyFor({ generated_at: "2026-03-21T12:00:00.000Z", report_id: "p1" }),
    "market_pulse/2026-03-21/p1.json",
  );
});

Deno.test(
  "storageArtifactReader reads from the bucket with the service role key",
  withEnv(async () => {
    const seen: Array<{ url: string; auth: string | null }> = [];
    const reader = storageArtifactReader((url, init) => {
      seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
      if (url.endsWith("/missing.json")) return Promise.resolve(new Response("{}", { status: 404 }));
      if (url.endsWith("/old-missing.json")) {
        return Promise.resolve(
          new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', {
            status: 400,
          }),
        );
      }
      if (url.endsWith("/broken.json")) return Promise.resolve(new Response("oops", { status: 500 }));
      return Promise.resolve(new Response('{"report_id":"r1"}', { status: 200 }));
    });
    assertEquals(await reader("deep_dive/2026-03-30/r1.json"), { report_id: "r1" });
    assertEquals(
      seen[0].url,
      "https://proj.supabase.co/storage/v1/object/report-artifacts/deep_dive/2026-03-30/r1.json",
    );
    assertEquals(seen[0].auth, "Bearer service-key-for-test");
    assertEquals(await reader("deep_dive/x/missing.json"), undefined);
    assertEquals(await reader("deep_dive/x/old-missing.json"), undefined);
    await assertRejects(() => reader("deep_dive/x/broken.json"));
  }),
);

Deno.test(
  "writeArtifact upserts the body and returns the key",
  withEnv(async () => {
    Deno.env.set("REPORT_ARTIFACT_BUCKET", "other-bucket");
    let method = "";
    let upsert: string | null = null;
    let target = "";
    const key = await writeArtifact(
      { type: "deep_dive", generated_at: "2026-03-30T09:30:00.000Z", report_id: "r1" },
      (url, init) => {
        target = url;
        method = init?.method ?? "";
        upsert = new Headers(init?.headers).get("x-upsert");
        return Promise.resolve(new Response("{}", { status: 200 }));
      },
    );
    Deno.env.delete("REPORT_ARTIFACT_BUCKET");
    assertEquals(key, "deep_dive/2026-03-30/r1.json");
    assertEquals(
      target,
      "https://proj.supabase.co/storage/v1/object/other-bucket/deep_dive/2026-03-30/r1.json",
    );
    assertEquals(method, "POST");
    assertEquals(upsert, "true");
  }),
);
