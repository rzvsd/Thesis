import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { deleteArtifactKeys, deleteUserReportFiles } from "./user_files.ts";

Deno.test("deleteUserReportFiles removes the files, then the rows (S7)", async () => {
  const order: string[] = [];
  const n = await deleteUserReportFiles("u1", {
    find: () => Promise.resolve({ reportIds: ["r1", "r2"], artifactKeys: ["deep_dive/2026-11-23/r1.json"] }),
    deleteKeys: (keys) => {
      order.push(`keys:${keys.join(",")}`);
      return Promise.resolve();
    },
    deleteRows: (ids) => {
      order.push(`rows:${ids.join(",")}`);
      return Promise.resolve();
    },
  });
  assertEquals(n, 1);
  assertEquals(order, ["keys:deep_dive/2026-11-23/r1.json", "rows:r1,r2"]);
});

Deno.test("deleteUserReportFiles keeps the rows when Storage fails", async () => {
  let rowsDeleted = false;
  await assertRejects(() =>
    deleteUserReportFiles("u1", {
      find: () => Promise.resolve({ reportIds: ["r1"], artifactKeys: ["k"] }),
      deleteKeys: () => Promise.reject(new Error("storage down")),
      deleteRows: () => {
        rowsDeleted = true;
        return Promise.resolve();
      },
    })
  );
  assertEquals(rowsDeleted, false);
});

Deno.test("deleteArtifactKeys sends one Storage delete per 1,000 keys", async () => {
  Deno.env.set("SUPABASE_URL", "https://p.example");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-value");
  try {
    const calls: { url: string; count: number }[] = [];
    const fetchFn = (url: string, init?: RequestInit) => {
      calls.push({ url, count: JSON.parse(String(init?.body)).prefixes.length });
      return Promise.resolve(new Response("[]", { status: 200 }));
    };
    await deleteArtifactKeys(Array.from({ length: 1500 }, (_, i) => `k${i}`), fetchFn);
    assertEquals(calls.map((c) => c.count), [1000, 500]);
    assertEquals(calls[0].url, "https://p.example/storage/v1/object/report-artifacts");
    await deleteArtifactKeys([], fetchFn);
    assertEquals(calls.length, 2);
  } finally {
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});
