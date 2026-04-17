# Phase 6 M1 Official Truth Smoke Evidence

**Date:** 2026-04-17  
**Milestone:** M1 - Official Truth Data Plane  
**Environment:** Local Windows workspace  
**Result:** PASS  

---

## What Was Implemented

- Added Phase 6 official-source contracts:
  - `OfficialSourceReference`
  - `OfficialRetrievalMetadata`
  - `OfficialMissingFieldState`
  - `CanonicalEvent`
  - `CanonicalEventFamily`
  - `CanonicalEventSourceState`
- Added fixture-backed official data adapter endpoints:
  - `GET /v1/official/company?ticker=AAPL`
  - `GET /v1/official/macro?scope=daily`
- Added golden official-source fixtures for:
  - `AAPL`
  - `MSFT`
  - `TSLA`
  - locked daily macro seed registry
- Added Product API canonical event persistence:
  - `canonical_events` migration
  - `POST /internal/canonical-events/ingest`
  - `GET /internal/canonical-events`
- Added Scheduler official refresh trigger:
  - `POST /internal/official/refresh`
- Hardened the Phase 6 dependency guard so old baseline findings do not become false positives when line numbers shift.

---

## Acceptance Evidence

| Acceptance criterion | Evidence |
|---|---|
| SEC-backed company truth is returned for at least 3 supported tickers | `data-openbb` tests validate official payloads for `AAPL`, `MSFT`, and `TSLA` |
| Official macro truth is returned for approved daily scope without deprecated provider keys | `/v1/official/macro?scope=daily` test validates locked Treasury/BLS/BEA/EIA seed scope |
| Every official-source response includes retrieval metadata and missing-field state | Schemas and endpoint tests validate retrieval metadata and missing-field arrays |
| Canonical filing and macro event records are generated | Data adapter emits `filing_posted` and `macro_release_published`; Product API ingests them |
| Golden fixtures are committed and validated | Fixtures live under `data/golden/data-openbb/official/` and pass data-openbb tests |
| No core smoke step requires old provider keys | Official path tests pass without provider-key requirements; Phase 6 guard passes |

---

## Commands Run

```text
corepack pnpm --filter @thesis/contracts typecheck
Result: PASS
```

```text
corepack pnpm --filter @thesis/product-api typecheck
Result: PASS
```

```text
corepack pnpm --filter @thesis/scheduler typecheck
Result: PASS
```

```text
$env:PYTHONPATH='apps/data-openbb'; python -m unittest discover -s apps/data-openbb/tests -p 'test_*.py'
Result: PASS - 28 tests
```

```text
corepack pnpm --filter @thesis/product-api test
Result: PASS - 76 tests
```

```text
corepack pnpm --filter @thesis/scheduler test
Result: PASS - 11 tests
```

```text
corepack pnpm run typecheck
Result: PASS
```

```text
corepack pnpm run lint
Result: PASS
```

```text
corepack pnpm run security:audit
Result: PASS - no known vulnerabilities
```

```text
corepack pnpm run security:sast
Result: PASS - no high-confidence findings
```

```text
corepack pnpm run phase6:m0:guard
Result: PASS - 70 known baseline findings, 0 new protected-path findings
```

```text
corepack pnpm run test
Result: PASS
```

---

## Test Note

`python -m pytest apps/data-openbb/tests` was attempted earlier but this shell does not have `pytest` installed. The repo-owned `@thesis/data-openbb` test script uses `unittest`, and the full root test command passed.

---

## Rollback

Rollback is executable by reverting the additive M1 changes:

- remove official-source endpoints from `data-openbb`
- remove `canonical_events` migration from the migration list and apply `ph6m1_028_canonical_events.down.sql` where needed
- remove Product API canonical event ingest/list routes
- remove scheduler official refresh route
- remove M1 fixtures and contract exports

Rollback must not silently route official-source callers back to deprecated providers.

---

## Sign-Off

Owner sign-off: accepted by owner message approval on 2026-04-17  
Engineering Lead countersign: accepted by owner delegation on 2026-04-17
