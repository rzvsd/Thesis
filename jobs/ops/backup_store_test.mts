import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1.0.13";
import { BACKUP_NAME_RE, type FetchLike, selectForDeletion, storeBackup } from "./backup_store.mts";

const name = (d: string) => `thesis-db-${d}.sql.gz.gpg`;
const BODY = new Uint8Array([1, 2, 3, 4]);

interface Call {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
}

// A tiny fake of the three Storage calls the script makes. `existing` is what the bucket held before the run.
function fakeStorage(existing: string[], opts: { uploadStatus?: number; storedSize?: number; listExtra?: unknown[] } = {}) {
  const calls: Call[] = [];
  const objects = new Map<string, number>(existing.map((n) => [n, 10]));
  const fetchFn: FetchLike = (input, init) => {
    const method = init?.method ?? "GET";
    const url = new URL(input);
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw;
    calls.push({ method, url: url.pathname, headers: new Headers(init?.headers), body });
    if (method === "POST" && url.pathname.startsWith("/storage/v1/object/list/")) {
      const rows = [...objects.entries()].map(([n, size]) => ({ name: n, metadata: { size } }));
      return Promise.resolve(Response.json([...rows, ...(opts.listExtra ?? [])]));
    }
    if (method === "POST") {
      if (opts.uploadStatus && opts.uploadStatus >= 400) {
        return Promise.resolve(new Response("nope", { status: opts.uploadStatus }));
      }
      const key = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      objects.set(key, opts.storedSize ?? (raw as Uint8Array).byteLength);
      return Promise.resolve(Response.json({ Key: key }));
    }
    if (method === "DELETE") {
      for (const n of (body as { prefixes: string[] }).prefixes) objects.delete(n);
      return Promise.resolve(Response.json([]));
    }
    return Promise.resolve(new Response("unexpected", { status: 500 }));
  };
  return { fetchFn, calls, objects };
}

const cfg = (fetchFn: FetchLike, keep = 5) => ({ baseUrl: "https://proj.example.test/", key: "k3y", keep, fetchFn });

Deno.test("backup names must match the dump script's shape", () => {
  assertEquals(BACKUP_NAME_RE.test(name("20261129")), true);
  assertEquals(BACKUP_NAME_RE.test("thesis-db-20261129.sql.gz"), false);
  assertEquals(BACKUP_NAME_RE.test("../thesis-db-20261129.sql.gz.gpg"), false);
  assertEquals(BACKUP_NAME_RE.test("report.json"), false);
});

Deno.test("selectForDeletion keeps the newest files by date", () => {
  const names = ["20261101", "20261122", "20261108", "20261129", "20261115", "20261206", "20261025"].map(name);
  const { kept, deleted } = selectForDeletion(names, 5);
  assertEquals(kept, ["20261206", "20261129", "20261122", "20261115", "20261108"].map(name));
  assertEquals(deleted, ["20261101", "20261025"].map(name));
  assertEquals(selectForDeletion(names.slice(0, 3), 5).deleted, []);
  assertThrows(() => selectForDeletion(names, 0));
});

Deno.test("stores the file with the key in both headers and deletes nothing when few files exist", async () => {
  const s = fakeStorage([name("20261122")]);
  const result = await storeBackup(cfg(s.fetchFn), name("20261129"), BODY);
  assertEquals(result.deleted, []);
  assertEquals(result.kept, [name("20261129"), name("20261122")]);
  const upload = s.calls[0];
  assertEquals(upload.url, `/storage/v1/object/db-backups/${name("20261129")}`);
  assertEquals(upload.headers.get("authorization"), "Bearer k3y");
  assertEquals(upload.headers.get("apikey"), "k3y");
  assertEquals(upload.headers.get("x-upsert"), "true");
  assertEquals(s.calls.some((c) => c.method === "DELETE"), false);
});

Deno.test("keeps five and deletes the older ones after a good upload", async () => {
  const old = ["20261018", "20261025", "20261101", "20261108", "20261115", "20261122"].map(name);
  const s = fakeStorage(old);
  const result = await storeBackup(cfg(s.fetchFn), name("20261129"), BODY);
  assertEquals(result.deleted, [name("20261025"), name("20261018")]);
  assertEquals([...s.objects.keys()].sort(), ["20261101", "20261108", "20261115", "20261122", "20261129"].map(name));
});

Deno.test("files with other names in the bucket are never deleted", async () => {
  const old = ["20261018", "20261025", "20261101", "20261108", "20261115"].map(name);
  const s = fakeStorage(old, { listExtra: [{ name: "notes.txt", metadata: { size: 3 } }, { name: "manual-copy.gpg" }] });
  const result = await storeBackup(cfg(s.fetchFn), name("20261122"), BODY);
  assertEquals(result.deleted, [name("20261018")]);
  const del = s.calls.find((c) => c.method === "DELETE");
  assertEquals((del?.body as { prefixes: string[] }).prefixes, [name("20261018")]);
});

Deno.test("a failed upload deletes nothing", async () => {
  const old = ["20261018", "20261025", "20261101", "20261108", "20261115", "20261122"].map(name);
  const s = fakeStorage(old, { uploadStatus: 500 });
  await assertRejects(() => storeBackup(cfg(s.fetchFn), name("20261129"), BODY), Error, "HTTP 500");
  assertEquals(s.objects.size, 6);
  assertEquals(s.calls.some((c) => c.method === "DELETE"), false);
});

Deno.test("a stored file of the wrong size deletes nothing", async () => {
  const old = ["20261018", "20261025", "20261101", "20261108", "20261115", "20261122"].map(name);
  const s = fakeStorage(old, { storedSize: 1 });
  await assertRejects(() => storeBackup(cfg(s.fetchFn), name("20261129"), BODY), Error, "Nothing was deleted");
  assertEquals(s.calls.some((c) => c.method === "DELETE"), false);
});

Deno.test("an older-dated upload that would not be kept deletes nothing", async () => {
  const old = ["20261101", "20261108", "20261115", "20261122", "20261129"].map(name);
  const s = fakeStorage(old);
  await assertRejects(() => storeBackup(cfg(s.fetchFn), name("20261001"), BODY), Error, "would not be kept");
  assertEquals(s.calls.some((c) => c.method === "DELETE"), false);
});

Deno.test("empty files and odd names are refused before any request", async () => {
  const s = fakeStorage([]);
  await assertRejects(() => storeBackup(cfg(s.fetchFn), name("20261129"), new Uint8Array()), Error, "empty");
  await assertRejects(() => storeBackup(cfg(s.fetchFn), "evil/../x.gpg", BODY), Error, "Unexpected");
  assertEquals(s.calls.length, 0);
});
