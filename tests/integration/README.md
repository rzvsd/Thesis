# Integration Tests

`test_m2_data_plane_endpoints.py` is the M2 cross-service integration check.
`test_m6_market_pulse.py` is the M6 cross-service integration check for scheduler-triggered Market Pulse generation/degradation.
`apps/dexter-worker/tests/m5-acceptance.test.ts` is the Dexter-side M5 acceptance coverage for the PRD-aligned Deep Dive path.

It starts `data-openbb` and `news-ingest` on ephemeral local ports and verifies:

- the finance endpoint returns a valid service envelope for `AAPL`
- the news endpoint returns approved-source normalized articles for `2026-03-13`

These tests are included in the root integration chain that runs from `pnpm test`.

M5 deep-dive smoke coverage lives in `tests/smoke/m5_dexter_deep_dive_smoke.py` and is run separately against a locally started `dexter-worker` service.
