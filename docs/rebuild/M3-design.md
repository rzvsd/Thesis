# M3 design notes

Owner: M3. These notes fix the seams between the M3 parts so they can be built in parallel.
Read `M3-scheduled-data.md` first.

## What changes from the old system

The old `scheduler` called `product-api`, and `product-api` fetched from the `data-openbb` and `news-ingest`
servers. Those servers do not exist in the rebuild. Now:

- **Python scripts in `jobs/data/`** run the old fetch logic inside the daily or weekly workflow.
- They **send the fetched payload** to an internal route of the `api` function (internal token).
- The `api` function **stores and evaluates**. It never calls a data server.
- No script holds the database password. Scripts only know `THESIS_API_URL` and `THESIS_INTERNAL_TOKEN`.

## Phases

1. **Phase A (this PR set):** research and alerts read routes, evaluators and internal-data routes,
   Python data scripts, daily and weekly workflows, prices table.
2. **Phase B (after M1 and M2 merge):** Pulse issue dispatch and per-user brief (needs M2's report storage and
   M1's `_lib/pulse`), Deep Dive precompute (needs M2's queue), historical sync of filings and transcripts.

## Internal routes the scripts call

All are `auth: "internal"` (header `x-internal-token`), in feature `internal-data`. All are safe to run twice for
one market date (upserts keyed by date or ticker). Error shape is `{ error, error_message }`.

| Route | Body the script sends | Stores |
| --- | --- | --- |
| `POST /internal/macro-stress/dispatch` (alias `/internal/sentiment/dispatch`) | `{ market_date?, macro }`. `macro` is the exact JSON body the old `GET /v1/official/macro?scope=daily` returned. Missing `macro` is 422. `macro.ok !== true` is 503 as before. Non-trading day is 200 `skipped`. | `fear_greed_daily` |
| `POST /internal/calendar/sync` | `{ start_date?, end_date?, events }`. `events` is the `data.events` array the old `POST /internal/calendar/earnings` returned. Missing `events` is 422. | `calendar_events` |
| `GET /internal/data/price-tickers` | none | returns `{ tickers: string[] }`: tickers with kill-switch price rules, active contrarian anchors and watchlist names, sorted, max 500 |
| `POST /internal/data/prices/ingest` | `{ market_date, prices }`. `prices` is the `data.prices` array of the old `GET /v1/market/eod-prices` (`{ ticker, available, close?, reason? }`). Unavailable entries are counted, not stored. | `market_prices_daily` (new, M3) |
| `POST /internal/canonical-events/ingest` | `{ events }`, as in `contract.md`. The weekly official-source refresh builds them in Python from the official company payload, like the old scheduler did. | `canonical_events` |

Evaluator routes (`/internal/notifications/*`, `/internal/conviction/coherence/evaluate`, `/internal/monitor/recompute`,
`/internal/research-state/refresh`) keep the bodies in `contract.md`. Where the old code called
`fetchLatestClosePrices` against data-openbb, the new code reads the latest close per ticker from
`market_prices_daily` (no older than 5 days). Missing prices mean "no price", exactly like the old default provider `none`.

## Push and email

Push sending and email are M4. Evaluators call a `PushSender` port in `_lib/evaluators/push_port.ts`.
The default sender is "disabled": it delivers nothing and reports every target as skipped. M4 plugs in the real sender.
The alert inbox (`alert_ledger`) must still fill when push is disabled, so the in-app inbox works before M4.

## Prices table (migration `20261126*_m3_market_prices.sql`)

`app.market_prices_daily (ticker text, market_date date, close numeric, provider text, retrieved_at timestamptz,
primary key (ticker, market_date))`, RLS on, no grants to `anon` or `authenticated`.

## Schedules (daylight saving, N6)

The daily workflow has two UTC crons: `30 10 * * 1-5` and `30 11 * * 1-5` (06:30 New York in summer and in winter).
A first step lets a scheduled run go ahead only when its own cron (`github.event.schedule`) matches the current
New York season (10:30 UTC in daylight time, 11:30 UTC in standard time) and it starts between 06:00 and 08:59
New York. So exactly one of the two runs does work. The manual run button skips that check. The macro step uses the previous US trading day
as `market_date` (the old schedule ran it at 18:00 New York the day before).

Weekly: Sunday `0 23 * * 0` UTC (Sunday evening New York in both seasons).
