# Integration Tests

`test_m2_data_plane_endpoints.py` is the M2 cross-service integration check.

It starts `data-openbb` and `news-ingest` on ephemeral local ports and verifies:

- the finance endpoint returns a valid service envelope for `AAPL`
- the news endpoint returns approved-source normalized articles for `2026-03-13`

This test is included in the root `python tests/integration/test_m2_data_plane_endpoints.py` path that runs from `pnpm test`.
