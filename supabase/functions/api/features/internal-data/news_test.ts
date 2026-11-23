// News store routes: ingest, the window read the Pulse job uses, and the source status list.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { clipHeadline } from "../../../_lib/evaluators/news.ts";
import { headlineItemsFromApprovedNews } from "../../../_lib/evaluators/pulse/macro_news.ts";
import { call, get, NOW, post, setup } from "./test_support.ts";

const id = (n: number) => n.toString(16).padStart(64, "0");

function article(n: number, extra: Record<string, unknown> = {}) {
  return {
    article_id: id(n),
    source: "Federal Reserve",
    source_key: "fed-press",
    rights: "official_public",
    url: `https://www.federalreserve.gov/newsevents/pressreleases/item${n}.htm`,
    title: `Federal Reserve statement ${n}`,
    published_at: "2026-11-20T13:00:00Z",
    retrieved_at: "2026-11-20T14:00:00Z",
    body_text: "Text that must not be stored.",
    tickers_mentioned: [],
    is_approved_source: true,
    ...extra,
  };
}

Deno.test("news routes need the internal token", async () => {
  setup();
  assertEquals((await call("POST", "/internal/news/ingest", { items: [] }, null)).status, 401);
  assertEquals((await call("GET", "/internal/news?since=2026-11-19T00:00:00Z", undefined, null)).status, 401);
  assertEquals((await call("GET", "/internal/news/sources", undefined, null)).status, 401);
});

Deno.test("news ingest stores headlines only, counts what it cannot store, and a rerun is an upsert", async () => {
  const { store } = setup();
  const body = {
    items: [
      article(1, { tickers_mentioned: ["aapl", "AAPL", "not a ticker", "MSFT"] }),
      article(1, { title: "Same link again in one request" }),
      article(2, { url: "javascript:alert(1)" }),
      article(3, { article_id: "short" }),
      article(4, { rights: "full_text" }),
      article(5, { is_approved_source: false }),
      article(6, { published_at: "soon" }),
      "not an object",
    ],
    sources: [
      { source: "fed-press", ok: true, article_count: 1, newest_item_at: "2026-11-20T13:00:00Z" },
      { source: "wsj-markets", ok: false, article_count: 0, error_code: "PROVIDER_OUTAGE" },
      { source: "Not A Key", ok: true, article_count: 0 },
    ],
  };
  const res = await post("/internal/news/ingest", body);
  assertEquals(res.body, { status: "ok", stored: 1, invalid: 6, sources_ok: 1, sources_failed: 1 });
  assertEquals(store.news.length, 1);
  const row = store.news[0];
  assertEquals(row.title, "Federal Reserve statement 1");
  assertEquals(row.tickers, ["AAPL", "MSFT"]);
  assertEquals(row.seenAt, NOW.toISOString());
  // No article text anywhere in the stored row.
  assert(!JSON.stringify(store.news).includes("must not be stored"));

  await post("/internal/news/ingest", {
    items: [article(1, { title: "Federal Reserve statement 1, corrected" })],
  });
  assertEquals(store.news.length, 1);
  assertEquals(store.news[0].title, "Federal Reserve statement 1, corrected");
  assertEquals(store.audit.filter((a) => a.eventType === "news.ingested").length, 2);
});

Deno.test("a publisher headline is cut to 120 characters on the way in", async () => {
  const { store } = setup();
  const long = "Example publisher headline " + "that keeps going ".repeat(12);
  await post("/internal/news/ingest", {
    items: [
      article(7, { source: "WSJ", source_key: "wsj-markets", rights: "headline_link_only", title: long }),
      article(8, { title: long }),
    ],
  });
  const publisher = store.news.find((n) => n.sourceKey === "wsj-markets")!;
  const official = store.news.find((n) => n.sourceKey === "fed-press")!;
  assert(publisher.title.length <= 120 && publisher.title.endsWith("…"));
  assertEquals(official.title, long.trim());
  assertEquals(clipHeadline("x".repeat(300)).length, 120);
  assertEquals(clipHeadline("Short one"), "Short one");
});

Deno.test("news ingest refuses a body that is not a list, or is too long", async () => {
  setup();
  assertEquals((await post("/internal/news/ingest", {})).status, 422);
  assertEquals((await post("/internal/news/ingest", { items: [], sources: "none" })).status, 422);
  const tooMany = Array.from({ length: 2001 }, (_, n) => article(n + 10));
  assertEquals((await post("/internal/news/ingest", { items: tooMany })).status, 422);
});

Deno.test("news list returns the window newest first, in the shape the Pulse reads", async () => {
  setup();
  await post("/internal/news/ingest", {
    items: [
      article(1, { published_at: "2026-11-18T09:00:00Z" }),
      article(2, { published_at: "2026-11-19T15:00:00Z", tickers_mentioned: ["AAPL"] }),
      article(3, { published_at: "2026-11-20T09:00:00Z" }),
      article(4, { published_at: "2026-11-20T16:00:00Z" }),
    ],
  });
  const res = await get("/internal/news?since=2026-11-19T11:30:00.000Z&until=2026-11-20T11:30:00.000Z");
  assertEquals(res.status, 200);
  const items = res.body.items as Array<Record<string, unknown>>;
  assertEquals(items.map((i) => i.article_id), [id(3), id(2)]);
  assertEquals(items[1].tickers_mentioned, ["AAPL"]);
  assertEquals(items[0].body_text, items[0].title);
  // The Pulse's own reader accepts the stored shape.
  const headlines = headlineItemsFromApprovedNews(items);
  assertEquals(headlines.map((h) => h.source_name), ["Federal Reserve", "Federal Reserve"]);
  assertEquals(headlines[0].source_url, "https://www.federalreserve.gov/newsevents/pressreleases/item3.htm");

  // "until" defaults to now; limit is honoured.
  const open = await get("/internal/news?since=2026-11-18T00:00:00Z&limit=1");
  assertEquals((open.body.items as unknown[]).length, 1);
  assertEquals((await get("/internal/news")).status, 422);
  assertEquals(
    (await get("/internal/news?since=2026-11-21T00:00:00Z&until=2026-11-20T00:00:00Z")).status,
    422,
  );
});

Deno.test("news sources shows failures in a row and a feed that went stale", async () => {
  setup();
  const down = { source: "wsj-markets", ok: false, article_count: 0, error_code: "PROVIDER_OUTAGE" };
  await post("/internal/news/ingest", {
    items: [],
    sources: [
      { source: "fed-press", ok: true, article_count: 3, newest_item_at: "2026-11-19T20:00:00Z" },
      { source: "bea-news", ok: true, article_count: 0, newest_item_at: "2026-10-01T12:30:00Z" },
      down,
    ],
  });
  await post("/internal/news/ingest", { items: [], sources: [down] });
  const res = await get("/internal/news/sources");
  const sources = res.body.sources as Array<Record<string, unknown>>;
  assertEquals(sources.map((s) => [s.source, s.consecutive_failures, s.stale, s.last_error_code]), [
    ["bea-news", 0, true, null],
    ["fed-press", 0, false, null],
    ["wsj-markets", 2, false, "PROVIDER_OUTAGE"],
  ]);
  assertEquals(sources[2].last_ok_at, null);
  assertEquals(sources[1].last_ok_at, NOW.toISOString());

  // A source that comes back clears its failure count and error.
  await post("/internal/news/ingest", {
    items: [],
    sources: [{ source: "wsj-markets", ok: true, article_count: 2 }],
  });
  const after = (await get("/internal/news/sources")).body.sources as Array<Record<string, unknown>>;
  assertEquals([after[2].consecutive_failures, after[2].last_error_code], [0, null]);
});
