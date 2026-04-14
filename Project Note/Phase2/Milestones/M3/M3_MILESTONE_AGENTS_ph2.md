# AGENTS.md - Phase 2 M3 Fear & Greed Index Engine
**Milestone:** Phase 2 M3 - Fear & Greed Index Engine  
**Status:** Closed (PASS)  
**Location:** `Project Note/Phase2/Milestones/M3/M3_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M3 - Fear & Greed Index Engine |
| **Linear Project** | Phase 2 M3 - Fear & Greed Index Engine |
| **Primary Owner** | Data Engineer |
| **Support** | Product Lead + Backend Engineer |
| **Architecture Source** | `Project Note/Phase2/ph2_BLUEBOOK.md` section 6 |
| **Acceptance Source** | `Project Note/Phase2/ph2_MILESTONES.md` -> M3 |

---

## Gated Pre-Conditions

All M3 gates are resolved and coding may proceed.

| # | Decision | Resolution | Status |
|---|---|---|---|
| G1 | Approved input list | Exactly 6 signals: VIX, S&P momentum, breadth, safe-haven demand, junk-bond spread, yield curve | RESOLVED |
| G2 | Weighting doctrine | Equal weighting (1/6 each) over available signals | RESOLVED |
| G3 | Data providers | yfinance for market price series; FRED for macro/credit series | RESOLVED |
| G4 | Degradation policy | Skip missing inputs and re-weight available inputs; require minimum 3 available inputs to publish a score | RESOLVED |
| G5 | Historical bootstrap | No blocking backfill requirement for M3 closeout; history accumulates from first run onward | RESOLVED |

**Explicit deferrals (not M3):** put/call ratio, social sentiment, news-sentiment factors.

---

## 1. What This Milestone Is Building

A deterministic, reproducible market-sentiment engine that calculates a daily 0-100 Fear & Greed score from six approved free-data signals, stores each trading-day snapshot in Postgres, and serves current + historical series via Product API sentiment endpoints.

---

## 2. Read These Files First

- `Project Note/Phase2/ph2_BLUEBOOK.md`
- `Project Note/Phase2/ph2_MILESTONES.md`
- `Project Note/Phase2/ph2_PRD.md`
- `Project Note/Phase2/ph2_AGENTS.md`
- `Project Note/Phase2/Decisions/ph2_ADR-002-fear-greed-engine.md` (if present)

---

## 3. Scope - What Is In

- [x] `FearGreedSnapshot` contract in `packages/contracts`
- [x] `fear_greed_daily` persistence model + migration wiring
- [x] Six deterministic input fetchers (yfinance + FRED)
- [x] Equal-weight composite scoring engine (1/6 each)
- [x] Degradation logic (skip/re-weight, min 3 signals)
- [x] Scheduler cron at 18:00 America/New_York (DST-aware)
- [x] Product API endpoints:
  - `GET /v1/sentiment/current`
  - `GET /v1/sentiment/history?days=90`
- [x] Phase 1 regression checks for Market Pulse and scheduler

---

## 4. Scope - What Is Out

| Out of Scope | Why |
|---|---|
| Put/call ratio integration | Explicitly deferred from M3 |
| Social/news sentiment scoring | Explicitly deferred from M3 |
| Fear & Greed mobile UI, charting, dashboard | M8 scope |
| Deep Dive enrichment with Fear & Greed | Future milestone |
| Market Pulse architecture rewrite | Not part of M3 |

---

## 5. Services You Are Working In

| Service | Path | Responsibility |
|---|---|---|
| Contracts | `packages/contracts/src/` | FearGreedSnapshot type/schema |
| Fear & Greed engine | `packages/fear-greed-engine/` | Deterministic score calculation |
| Product API | `apps/product-api/src/` | Persistence queries + sentiment routes |
| Scheduler | `apps/scheduler/src/` | Daily trigger orchestration |
| Data fetch path | `apps/data-openbb/` or dedicated module | Provider integrations for six signals |
| Migrations | `infra/migrations/` | Create/drop `fear_greed_daily` |

---

## 6. Contracts You Are Touching

### `FearGreedSnapshot`

Required fields:
- `id`
- `market_date`
- `score` (0-100)
- `label`
- `sub_scores[]`
- `missing_inputs[]`
- `calculated_at`

Contract rules:
- No fabricated values
- `missing_inputs` always present (empty array when none)
- Contract remains deterministic and auditable

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M3 - Fear & Greed Index Engine

Ticket prefixes:
- `[PH2-M3] ...`
- `[PH2-M3][BUG] ...`
- `[PH2-M3][SPIKE] ...`

Minimum ticket set:

| Ticket | Acceptance criteria mapped |
|---|---|
| `[PH2-M3] Contract - FearGreedSnapshot` | Contract compile + schema validity |
| `[PH2-M3] Migration - fear_greed_daily` | Table/index/unique creation |
| `[PH2-M3] Fetchers - yfinance inputs` | VIX, momentum, breadth, safe-haven data collection |
| `[PH2-M3] Fetchers - FRED inputs` | Junk-bond spread + yield curve collection |
| `[PH2-M3] Scoring engine` | Deterministic normalized composite |
| `[PH2-M3] Degradation policy` | skip/re-weight with minimum 3 inputs |
| `[PH2-M3] Scheduler cron` | 18:00 NY trading-day execution |
| `[PH2-M3] API current` | `/v1/sentiment/current` |
| `[PH2-M3] API history` | `/v1/sentiment/history?days=90` |
| `[PH2-M3] Regression check` | Phase 1 Pulse + scheduler unaffected |
| `[PH2-M3] Closeout` | Smoke + DoD + sign-off |

---

## 8. Financial and Cost Considerations

M3 is designed to run on free sources.

| Source | Signals | Expected Cost |
|---|---|---|
| yfinance | VIX, S&P momentum, breadth, safe-haven demand | $0 |
| FRED | Junk-bond spread, yield curve | $0 (free API key) |

Estimated daily collection pattern:
- yfinance: batched pull for required symbols and breadth universe
- FRED: 2 series pulls

No paid provider dependency is required for M3.

---

## 9. Logging for This Milestone

Structured logs only:
- `fear_greed.run.started`
- `fear_greed.fetch.completed`
- `fear_greed.fetch.missing_input`
- `fear_greed.score.computed`
- `fear_greed.snapshot.written`
- `fear_greed.run.failed`

Never log secrets, provider keys, or personal data.

---

## 10. Error Handling for This Milestone

| Scenario | Expected behavior |
|---|---|
| One provider input fails | Mark input missing, continue if >=3 inputs remain |
| Fewer than 3 inputs available | Fail run, do not write snapshot |
| Provider auth/rate error | Retry policy then degrade/fail per rules |
| Invalid normalized range | Reject run, capture error, no write |
| Scheduler trigger error | Capture in Sentry + structured ERROR log |

---

## 11. Testing Requirements for This Milestone

- [x] Contract compile test passes
- [x] Migration up/down tests pass
- [x] Fetcher unit tests for all 6 inputs pass
- [x] Normalization tests keep all sub-scores in [0,100]
- [x] Determinism/golden fixture test passes
- [x] Degradation test (missing inputs) passes
- [x] Idempotency test (same market_date twice) passes
- [x] API current endpoint test passes
- [x] API history endpoint test passes
- [x] Empty-state API test returns `{"data": []}`
- [x] Phase 1 regression tests pass

---

## 12. Data Validation Criteria

- Composite score equals weighted mean of available sub-scores
- Label mapping is correct on boundaries (20/40/60/80)
- Stored `sub_scores` and `missing_inputs` match runtime fetch results
- Duplicate runs on same `market_date` do not create additional rows

---

## 13. Rollback Plan

1. Disable M3 scheduler job
2. Remove M3 sentiment endpoints from Product API
3. Run migration down for `fear_greed_daily`
4. Remove M3 contract export and scoring package wiring
5. Re-run Phase 1 smoke to confirm no regressions

---

## 14. Definition of Done

M3 is done only when all are true:
- [x] All M3 acceptance criteria in `ph2_MILESTONES.md` checked
- [x] All required M3 tests passing in CI
- [x] Full M3 smoke run logged in section 15
- [x] Phase 1 regression checks pass
- [x] All M3 Linear tickets closed or explicitly deferred with owner approval
- [x] Decisions and deferrals recorded in sections 16-17

---

## 15. Smoke Test Log

```
Step 1  - Run migrations; confirm fear_greed_daily exists with expected indexes: PASS (`ph2m3_008_fear_greed_daily` up/down added and registered in product-api migrations)
Step 2  - Trigger one M3 run for trading date: PASS (`apps/product-api/tests/sentiment.test.ts` dispatches 2026-03-20)
Step 3  - Confirm all six input fetches and normalization: PASS (mock Yahoo + FRED fetch paths exercised in `sentiment.test.ts`)
Step 4  - Confirm score in [0,100] and label mapping correct: PASS (`sentiment.test.ts` score bounds + `packages/fear-greed-engine/tests/index.test.ts` label boundaries)
Step 5  - Confirm snapshot write to fear_greed_daily: PASS (`upsertFearGreedSnapshot` persisted path covered in product-api tests)
Step 6  - Re-run same market_date; confirm idempotent upsert: PASS (`sentiment.test.ts` re-dispatch same market_date and keeps single history row)
Step 7  - GET /v1/sentiment/current returns latest snapshot: PASS (`sentiment.test.ts`)
Step 8  - GET /v1/sentiment/history?days=90 returns array history: PASS (`sentiment.test.ts`)
Step 9  - Empty-state history returns {"data": []}: PASS (`sentiment.test.ts`)
Step 10 - Confirm cron schedule at 18:00 ET and trading-day skip: PASS (`apps/scheduler/src/server.ts` + health payload + internal skip behavior in `sentiment.test.ts`)
Step 11 - Phase 1 regression (Pulse + scheduler) still passes: PASS (`apps/product-api/tests/market-pulse.test.ts` + `apps/scheduler/tests/health.test.ts`)
```

---

## 16. Known Issues and Deferrals

| Item | Reason | Owner | Target |
|---|---|---|---|
| Put/call ratio signal | Explicitly deferred from M3 | Product Lead | Future milestone |
| Social/news sentiment | Explicitly deferred from M3 | Product Lead | Future milestone |
| 3-consecutive trading-day staging soak evidence | Replaced by deterministic test harness for this closeout pass | Product Lead | Re-run in staging hardening window |

---

## 17. Decisions Made During This Milestone

| Decision | Outcome | ADR required |
|---|---|---|
| Input set | Locked 6-signal deterministic model | No |
| Providers | yfinance + FRED | No |
| Weighting | Equal weights (1/6 each) | No |
| Degradation | Skip missing + re-weight, min 3 required | No |
| Bootstrap | Not blocking for M3 closeout | No |
