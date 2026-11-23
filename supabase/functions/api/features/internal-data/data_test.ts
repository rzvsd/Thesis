// Ingest, macro, calendar, prices and feedback routes.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { addUser, call, get, post, price, rule, setup } from "./test_support.ts";

const rights = {
  rights_class: "first_party_public",
  display_mode: "excerpt_only",
  source_rank: "first_party",
  source_type: "investor_relations",
  can_store_full_text: false,
  can_display_excerpt: true,
  can_display_link: true,
  policy_reason: "Company IR page.",
  reviewed_at: "2026-11-01T00:00:00Z",
};

const canonical = {
  id: "ce-1",
  family: "filing_posted",
  subject_type: "ticker",
  subject_id: "AAPL",
  title: "10-Q filed",
  occurred_at: "2026-11-18T12:00:00Z",
  source_state: "official",
  source: { source: { name: "SEC" } },
  retrieved_at: "2026-11-18T13:00:00Z",
  missing_fields: [],
  metadata: {},
};

const observations = [
  { registry_id: "TREASURY_DAILY_10Y", value: 4.9, category: "rates" },
  { registry_id: "TREASURY_DAILY_2Y", value: 4.6, category: "rates" },
  { registry_id: "BLS_CPI_U_ALL_ITEMS", value: 3.4, category: "inflation" },
  { registry_id: "BLS_UNEMPLOYMENT_RATE", value: 4.1, category: "labor" },
  { registry_id: "EIA_WTI_SPOT", value: 80, category: "energy" },
];

Deno.test("internal routes need the internal token", async () => {
  setup();
  assertEquals((await call("GET", "/internal/data/price-tickers", undefined, null)).status, 401);
  assertEquals((await call("GET", "/internal/data/price-tickers", undefined, "wrong")).status, 401);
});

Deno.test("bad JSON is 400, a non-object body is 422, an empty body is {}", async () => {
  setup();
  assertEquals((await post("/internal/calendar/sync", "{nope")).status, 400);
  assertEquals((await post("/internal/calendar/sync", "[1]")).status, 422);
  // Empty body: no events, so the route's own 422.
  const empty = await post("/internal/calendar/sync", "");
  assertEquals(empty.status, 422);
  assertEquals(empty.body.error, "validation_failed");
});

Deno.test("canonical events: ingest, list, rerun keeps one row, 422 on bad input", async () => {
  const { store } = setup();
  const first = await post("/internal/canonical-events/ingest", { events: [canonical] });
  assertEquals(first.status, 200);
  assertEquals(first.body, { status: "accepted", upserted: 1, event_count: 1 });
  await post("/internal/canonical-events/ingest", { events: [canonical] });
  assertEquals(store.canonicalEvents.size, 1);

  const listed = await get("/internal/canonical-events?subject_type=ticker&subject_id=AAPL");
  assertEquals(listed.status, 200);
  assertEquals((listed.body.data as unknown[]).length, 1);

  assertEquals((await post("/internal/canonical-events/ingest", { events: [] })).status, 422);
  assertEquals((await post("/internal/canonical-events/ingest", { events: [{ id: "x" }] })).status, 422);
  assertEquals((await get("/internal/canonical-events?subject_type=planet")).status, 422);
  assertEquals((await get("/internal/canonical-events?limit=0")).status, 422);
});

Deno.test("first-party context: ingest, list, rerun keeps one row, 422 on bad input", async () => {
  const { store } = setup();
  const item = {
    context_id: "ctx-1",
    ticker: "aapl",
    registry_entry_id: "reg-1",
    source_url: "https://investor.example.com/q4",
    source_domain: "investor.example.com",
    page_type: "earnings_release",
    title: "Q4 results",
    summary: "Results summary.",
    retrieved_at: "2026-11-18T13:00:00Z",
    content_hash: "abc",
    fetch_state: "fetched",
    rights,
    artifact_ids: [],
    metadata: {},
  };
  const artifact = {
    artifact_id: "art-1",
    ticker: "AAPL",
    artifact_type: "transcript",
    title: "Q4 call",
    source_url: "https://investor.example.com/call",
    source_domain: "investor.example.com",
    retrieved_at: "2026-11-18T13:00:00Z",
    completeness_state: "complete",
    rights,
    metadata: {},
  };
  const res = await post("/internal/first-party/context/ingest", {
    context_items: [item],
    call_artifacts: [artifact],
  });
  assertEquals(res.status, 200);
  assertEquals(res.body, { status: "accepted", context_upserted: 1, artifact_upserted: 1 });
  await post("/internal/first-party/context/ingest", { context_items: [item], call_artifacts: [artifact] });
  assertEquals(store.contextItems.size, 1);
  assertEquals(store.callArtifacts.size, 1);

  const listed = await get("/internal/first-party/context?ticker=AAPL");
  const data = listed.body.data as { context_items: unknown[]; call_artifacts: unknown[] };
  assertEquals([data.context_items.length, data.call_artifacts.length], [1, 1]);

  assertEquals((await post("/internal/first-party/context/ingest", {})).status, 422);
  assertEquals(
    (await post("/internal/first-party/context/ingest", { context_items: [{ ...item, rights: {} }] })).status,
    422,
  );
});

Deno.test("name relationships: upsert with stable ids, 422 and 404", async () => {
  const { store } = setup();
  addUser(store, "u1");
  store.reports.push({
    id: "r1",
    jobId: "j1",
    type: "deep_dive",
    ticker: "NVDA",
    schemaVersion: "1",
    artifactKey: "k",
    createdAt: "2026-11-18T00:00:00Z",
    userId: "u1",
  });
  const body = {
    user_id: "u1",
    report_id: "r1",
    relationships: [{
      source_ticker: "TSM",
      target_ticker: "NVDA",
      relationship_type: "supplier",
      confidence: 0.9,
      evidence_text: "TSM makes NVDA chips.",
      rationale: "Supply chain.",
    }],
  };
  const res = await post("/internal/name-relationships/ingest", body);
  assertEquals(res.status, 200);
  assertEquals(res.body, { status: "ok", upserted: 1 });
  await post("/internal/name-relationships/ingest", body);
  assertEquals(store.relationships.size, 1);

  assertEquals((await post("/internal/name-relationships/ingest", { user_id: "u1" })).status, 422);
  assertEquals(
    (await post("/internal/name-relationships/ingest", { ...body, report_id: "nope" })).status,
    404,
  );
});

Deno.test("macro stress: stores the snapshot, rerun updates, skips weekends, 422 and 503", async () => {
  const { store } = setup();
  const macro = { ok: true, data: { observations } };
  const first = await post("/internal/macro-stress/dispatch", { market_date: "2026-11-19", macro });
  assertEquals(first.status, 200);
  assertEquals(first.body.status, "created");
  assertEquals(first.body.market_date, "2026-11-19");
  const again = await post("/internal/sentiment/dispatch", { market_date: "2026-11-19", macro });
  assertEquals(again.body.status, "updated");
  assertEquals(store.fearGreed.size, 1);

  const weekend = await post("/internal/macro-stress/dispatch", { market_date: "2026-11-21", macro });
  assertEquals(weekend.body, { status: "skipped", market_date: "2026-11-21", reason: "non_trading_day" });

  assertEquals((await post("/internal/macro-stress/dispatch", { market_date: "2026-11-19" })).status, 422);
  assertEquals(
    (await post("/internal/macro-stress/dispatch", { market_date: "11/19/2026", macro })).status,
    422,
  );
  const down = await post("/internal/macro-stress/dispatch", {
    market_date: "2026-11-19",
    macro: { ok: false, error_message: "upstream" },
  });
  assertEquals(down.status, 503);
  assertEquals(down.body.error, "macro_stress_unavailable");
});

Deno.test("calendar sync: keeps covered tickers, rerun keeps ids, 422 on bad range", async () => {
  const { store } = setup();
  store.coverage.push("AAPL");
  const events = [
    { ticker: "aapl", event_date: "2026-11-24", timing_state: "confirmed", provider: "nasdaq" },
    { ticker: "ZZZZ", event_date: "2026-11-24" },
    { ticker: "AAPL", event_date: "bad" },
  ];
  const res = await post("/internal/calendar/sync", {
    start_date: "2026-11-20",
    end_date: "2026-12-04",
    events,
  });
  assertEquals(res.status, 200);
  assertEquals(res.body.source_rows, 2);
  assertEquals(res.body.supported_rows, 1);
  assertEquals(res.body.events_upserted, 1);
  const id = store.calendar[0].id;
  await post("/internal/calendar/sync", { start_date: "2026-11-20", end_date: "2026-12-04", events });
  assertEquals(store.calendar.length, 1);
  assertEquals(store.calendar[0].id, id);

  assertEquals(
    (await post("/internal/calendar/sync", { start_date: "2026-12-04", end_date: "2026-11-20", events }))
      .status,
    422,
  );
});

Deno.test("prices: ticker list, ingest stores available closes, rerun is an upsert, 422", async () => {
  const { store } = setup();
  addUser(store, "u1", { tickers: ["MSFT"] });
  store.rules.push(rule("r1", "u1", "AAPL"));
  store.anchors.push({
    id: "a1",
    userId: "u1",
    ticker: "TSLA",
    signalValue: "positive",
    anchorPrice: 200,
    anchoredAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-12-31T00:00:00Z",
    isActive: true,
  });
  const tickers = await get("/internal/data/price-tickers");
  assertEquals(tickers.body, { tickers: ["AAPL", "MSFT", "TSLA"] });

  const body = {
    market_date: "2026-11-19",
    prices: [
      { ticker: "AAPL", available: true, close: 190.5 },
      { ticker: "MSFT", available: false, reason: "no_data" },
      { ticker: "bad ticker!", available: true, close: 1 },
    ],
  };
  const res = await post("/internal/data/prices/ingest", body);
  assertEquals(res.body, { status: "ok", market_date: "2026-11-19", stored: 1, unavailable: 1, invalid: 1 });
  await post("/internal/data/prices/ingest", body);
  assertEquals(store.prices.length, 1);

  assertEquals((await post("/internal/data/prices/ingest", { prices: [] })).status, 422);
  assertEquals((await post("/internal/data/prices/ingest", { market_date: "2026-11-19" })).status, 422);
});

Deno.test("prices older than five days count as no price", async () => {
  const { store, deps } = setup();
  store.prices.push(price("AAPL", 100, "2026-11-10"), price("MSFT", 300, "2026-11-17"));
  const { latestPrices } = await import("../../../_lib/evaluators/prices.ts");
  const got = await latestPrices(deps, ["AAPL", "MSFT"], "2026-11-19");
  assertEquals([...got.entries()], [["MSFT", 300]]);
});

Deno.test("feedback queue: filters and 422s", async () => {
  const { store } = setup();
  store.feedback.push({
    id: "f1",
    userId: "u1",
    feedbackType: "report",
    code: "wrong_data",
    severity: "medium",
    sourceSurface: "deep_dive",
    userTier: "PRO",
    message: "Numbers look off.",
    metadata: {},
    triageStatus: "new",
    routeStatus: "pending",
    createdAt: "2026-11-19T00:00:00Z",
    updatedAt: "2026-11-19T00:00:00Z",
  });
  const res = await get("/internal/feedback/queue?feedback_type=report&user_tier=pro&triage_status=new");
  assertEquals(res.status, 200);
  const rows = res.body.data as Array<Record<string, unknown>>;
  assertEquals(rows.length, 1);
  assertEquals(rows[0].report_id, null);
  assertEquals(rows[0].user_tier, "PRO");
  assertEquals(
    (await get("/internal/feedback/queue?feedback_type=report&source_surface=pulse")).body.data,
    [],
  );
  for (const q of ["limit=0", "limit=501", "feedback_type=x", "triage_status=x", "user_tier=GOLD"]) {
    assertEquals((await get(`/internal/feedback/queue?${q}`)).status, 422, q);
  }
});
