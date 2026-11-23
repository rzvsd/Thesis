# Data scripts (M3)

These scripts run the old `data-openbb` fetch logic inside a GitHub Actions run.
Each one builds a payload and sends it to an internal route of the `api` function.
They never hold the database password. They only know `THESIS_API_URL` and `THESIS_INTERNAL_TOKEN`.

## Scripts

- `run_macro.py` builds the body the old `GET /v1/official/macro?scope=daily` returned, for the
  previous US trading day in New York. It posts `{market_date, macro}` to `/internal/macro-stress/dispatch`.
- `run_calendar.py` builds the earnings calendar for today through 14 days ahead (New York dates).
  It posts `{start_date, end_date, events}` to `/internal/calendar/sync`.
- `run_prices.py` asks `/internal/data/price-tickers` which tickers need a price. It builds end-of-day
  closes with the `PRICE_PROVIDER` adapter and posts `{market_date, prices}` to `/internal/data/prices/ingest`,
  50 tickers per call. The default provider `none` reports every ticker unavailable, as before.
- `run_official_refresh.py` (weekly) fetches official company truth for each ticker in
  `SCHEDULER_OFFICIAL_SOURCE_TICKERS` and the official daily macro, and posts their canonical events
  to `/internal/canonical-events/ingest`. It is a port of the old scheduler's `/internal/official/refresh`.

- `run_pulse.py` builds the inputs of one Market Pulse issue, exactly what the old product-api fetched from
  data-openbb (market tape, official macro, structural context, official company truth per ticker, the earnings
  calendar for the next 7 days) and news-ingest (approved headlines, first-party context). It posts
  `{cycle_start, cycle_end, inputs}` to `/internal/pulse/dispatch`, with the window from
  `jobs/daily/daily_steps.py` (`pulse_cycle_window`). The api builds and stores the issue inside the request.
  A failed source is sent as an error envelope, so the issue shows it as unavailable. A failed job exits 1.
  Sources: `market_tape.py`, `structural.py`, `news_ingest.py`, `first_party.py` (copies of the old services).

The evaluator steps (war room, kill switch, digest and so on) are in `jobs/daily/run_step.py`.
It calls one route by name and follows `next_cursor` pages: when an answer has a `next_cursor`,
it sends the same body again with `cursor` set, up to 50 pages.

## Modules

`api_client.py` sends requests with retries. `retry.py` has the backoff and the in-process rate limiter
that replaces Redis. `market_time.py` has New York time and US trading days. `official.py`,
`earnings_calendar.py`, `eod_prices.py` and `schema_check.py` are copies of the old service logic.
`fixtures/` and `schemas/` are copies of the old golden files and contract schemas.

## Environment

| Name | Needed | Meaning |
| --- | --- | --- |
| `THESIS_API_URL` | yes | Base URL of the `api` function. https only (http only for localhost). |
| `THESIS_INTERNAL_TOKEN` | yes | Sent as `x-internal-token`. Never logged. |
| `DATA_OPENBB_FIXTURE_MODE` | no | Fixture data unless this is `false`, `0` or `no`. In the workflows, the repository variable `THESIS_DATA_LIVE=true` turns live mode on. |
| `PRICE_PROVIDER` | no | Price adapter. Default `none`. |
| `SEC_USER_AGENT` | live only | Name and contact email for SEC requests. |
| `SCHEDULER_OFFICIAL_SOURCE_TICKERS` | no | Comma list for the weekly refresh. Default `AAPL,MSFT,TSLA`. |
| `MARKET_PULSE_TICKERS` | no | Comma list of Pulse tickers. Default `AAPL,MSFT,TSLA`. Must match the api's setting of the same name. |
| `STEP_TIMEOUT_SECONDS` | no | Time budget for one step, retries included. Default 600. |
| `FINBASE_READ_TOKEN` | no | Read token for the private OpenBB fork. The workflows install the fork only in live mode when it is set. No script needs it today. |

The scripts log one JSON line per event: route path, status code and counts. They do not log the token,
the base URL, response bodies or emails.

## Run locally in fixture mode

Fixture mode needs only the Python 3.11 standard library.

```
python -m pip install -r jobs/data/requirements-dev.txt
python -m pytest jobs
THESIS_API_URL=http://localhost:54321/functions/v1/api THESIS_INTERNAL_TOKEN=<local token> python jobs/data/run_macro.py
THESIS_API_URL=... THESIS_INTERNAL_TOKEN=... python jobs/daily/run_step.py monitor-recompute
python jobs/daily/guard.py
```

Exit codes: 0 done or skipped, 1 failed, 2 missing or bad settings.
