# Smoke Tests

`m2_data_plane_smoke.py` is the committed helper for the M2 data-plane smoke checklist.
`m0_historical_loader_smoke.py` is the committed helper for M0 deterministic mapper + fixture sanity checks.
`m5_ticker_registry_delta_smoke.py` is the committed helper for the M5 ticker-registry full+delta smoke path.
`m5_dexter_deep_dive_smoke.py` is the committed helper for the M5 Dexter deep-dive smoke path.
`m5_company_deep_dive_smoke.py` is the committed helper for the full M5 company deep-dive smoke path (ticker search -> job -> report -> failure path -> SLA loop).

Usage:

```bash
python tests/smoke/m0_historical_loader_smoke.py
python tests/smoke/m2_data_plane_smoke.py
```

Expected local defaults:

- `data-openbb` at `http://127.0.0.1:3003`
- `news-ingest` at `http://127.0.0.1:3004`

The helper validates the documented endpoint shapes and highlights the manual outage step that still needs an operator-triggered source block during smoke execution.

M0 helper usage:

```bash
python tests/smoke/m0_historical_loader_smoke.py
```

The helper checks M0 migration files, the checked-in universe + XBRL mapping artifacts, and deterministic fixture mapping behavior for the SEC parser path.

M5 helper usage:

```bash
python tests/smoke/m5_ticker_registry_delta_smoke.py
```

Expected local defaults:

- `product-api` at `http://127.0.0.1:3001`
- Local Postgres reachable at `postgres://postgres:postgres@127.0.0.1:5432/thesis`

The helper runs a controlled full ticker sync and daily delta sync using committed fixtures, then verifies ticker search reflects add/delete/symbol-change outcomes.

M5 Dexter helper usage:

```bash
python tests/smoke/m5_dexter_deep_dive_smoke.py
```

Expected local defaults:

- `dexter-worker` at `http://127.0.0.1:3002`

The helper checks the PRD-aligned Deep Dive section split, nonblank section bodies, report statuses, signal evidence threshold, and disclaimer presence for the fixture path. The live LangSmith trace check remains a manual smoke step.

Full M5 helper usage:

```bash
python tests/smoke/m5_company_deep_dive_smoke.py
```

Expected local defaults:

- `product-api` at `http://127.0.0.1:3001`
- local Postgres at `postgres://postgres:postgres@127.0.0.1:5432/thesis`
- local Redis at `redis://127.0.0.1:6379/0`
- `dexter-worker` queue consumer running and connected to product-api

The helper executes the documented M5 flow including delta validation, deep-dive report checks for AAPL/MSFT/TSLA, a forced-failure path check (`FAILME`), and a 20-run SLA loop.
