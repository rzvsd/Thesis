# Phase 6 M1 Readiness Review

**Date:** 2026-04-17  
**Milestone:** M1 - Official Truth Data Plane  
**Result:** Ready to begin implementation after M1 prep normalization  
**Reviewer:** Codex  

---

## Review Summary

M1 is directionally clear and aligned with the Phase 6 architecture. The milestone now has a locked seed scope, exact additive contract names, endpoint names, smoke tickers, and a small official macro registry.

No owner product decision is required before implementation starts.

---

## What M1 Builds

M1 builds the official truth layer that later milestones depend on:

- SEC-backed company truth for `AAPL`, `MSFT`, and `TSLA`
- official macro truth from Treasury, BLS, BEA, and EIA seed series
- retrieval metadata and missing-field truth contracts
- canonical filing and macro event records
- deterministic fixtures so CI does not depend on live network freshness
- smoke proof that the path does not require deprecated market-data provider keys

---

## Prepared Decisions

| Area | Prepared decision |
|---|---|
| Company smoke scope | `AAPL`, `MSFT`, `TSLA` |
| Macro smoke scope | Treasury 10Y/2Y, BLS CPI/unemployment, BEA real GDP, EIA WTI |
| Contract files | `official-source.ts` and `canonical-event.ts` |
| Data adapter endpoints | `GET /v1/official/company`, `GET /v1/official/macro` |
| Product persistence endpoint | `POST /internal/canonical-events/ingest` |
| Scheduler ownership | official refresh orchestration only; no broad crawling |

---

## Implementation Notes

- Keep existing legacy endpoints compatible during M1.
- Add official-source endpoints instead of rewriting all consumers at once.
- Use committed fixtures for automated tests.
- Live official-source pulls may be used for manual smoke evidence, but CI must remain deterministic.
- Missing data is acceptable only when represented explicitly by `OfficialMissingFieldState`.

---

## Readiness Risks

| Risk | Status | Mitigation |
|---|---|---|
| Exact macro scope was too vague | Closed by prep | Seed registry locked in `PH6_DECISION_LOCKS.md` and `ph6_MILESTONES.md` |
| Contract names existed only in doctrine | Closed by prep | M1 now lists exact files and public names |
| Endpoint ownership was implicit | Closed by prep | M1 now lists data adapter, product ingest, and scheduler refresh endpoints |
| CI could depend on live official sources | Guarded | M1 requires fixture-backed deterministic tests |

---

## Evidence Expectation For Closeout

M1 cannot close until implementation evidence shows:

- contract/typecheck pass
- data-openbb official adapter tests pass
- product-api canonical event persistence tests pass
- Phase 6 dependency guard passes
- smoke without deprecated provider keys passes
- rollback path is recorded

