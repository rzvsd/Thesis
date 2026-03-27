# AGENTS.md — Phase 2 M3 Fear & Greed Index Engine
**Milestone:** Phase 2 M3 — Fear & Greed Index Engine  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M3/M3_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M3 — Fear & Greed Index Engine |
| **Linear Project** | Phase 2 M3 — Fear & Greed Index Engine |
| **Owner** | Data Engineer + Product API Engineer |
| **Status** | Planned |
| **Depends on** | Phase 2 M1 closed; approved input list; weighting doctrine agreed; data provider credentials for all inputs provisioned |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency. If any is still open when implementation is scheduled to begin, the milestone start date slips.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Approved input list.** Exact list of market indicators that feed the composite index. The Bluebook lists candidates (VIX, put/call ratios, moving-average breadth, new highs/lows, sector momentum, credit spreads, ETF flows, social sentiment). Which ones are in scope for M3? Which are deferred? Each input needs a named data source and API endpoint. | **OPEN** | Product Lead + Data Engineer | Before M3 kickoff |
| G2 | **Weighting doctrine.** The formula that converts N normalized inputs into a single 0–100 score. Equal weighting? Empirically tuned? ML-derived? The scoring engine cannot be implemented until the weights are defined. | **OPEN** | Product Lead + Data Engineer | Before M3 kickoff |
| G3 | **Data providers per input.** Which API provides each approved input? (e.g., CBOE for VIX, provider X for put/call ratios, provider Y for ETF flows). What are the rate limits, pricing tiers, and authentication methods for each? Some inputs may share a provider; others may require separate credentials. | **OPEN** | Data Engineer | Before M3 kickoff |
| G4 | **Degradation policy for missing inputs.** If one input provider is unavailable on a given night, should the engine: (a) skip that input and re-weight, (b) use the previous day's value, or (c) fail the entire calculation? This must be decided before the scoring engine is coded. | **OPEN** | Product Lead + Data Engineer | Before M3 kickoff |
| G5 | **Historical bootstrap range.** ADR-002 specifies a 90-day historical window for the chart. Should M3 backfill 90 days of Fear & Greed scores at launch (requiring 90 days of historical input data), or start from day zero and accumulate? | **OPEN** | Product Lead | Before M3 kickoff |

**Rule:** Do not begin coding with placeholder weights, ad-hoc input lists, or assumed providers. The scoring engine, input collection, rate-limit configuration, and cost estimates all depend on concrete answers.

---

## 1. What This Milestone Is Building

A deterministic, reproducible market-sentiment engine that calculates a daily 0–100 composite Fear & Greed score from approved market indicators, stores each day's snapshot in PostgreSQL, and serves the current score plus historical series through a Product API endpoint. The engine runs once per day after market close via the scheduler. It is completely separate from the existing Phase 1 Market Pulse and Deep Dive ownership model.

This milestone is **additive only**. It must not weaken, slow, or break the current Phase 1 Market Pulse, Deep Dive, or scheduler paths.

**Plain English summary for non-technical audit:**  
Before M3, the app has no market-level mood indicator. After M3, the platform calculates a daily Fear & Greed score — like a market thermometer — from real data, stores it every night, and makes 90 days of history available for later charting. The score is a number from 0 (Extreme Fear) to 100 (Extreme Greed), and it never makes up a number when data is missing.

---

## 2. Read These Files First

### Phase 1 docs (still govern existing architecture)

- `Project Note/Phase1/BLUEBOOK cld.md` — service boundaries, data model, scheduler patterns
- `Project Note/Phase1/MILESTONES.md` — Phase 1 acceptance criteria (regression baseline)

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` — Phase 2 operating rules
- `Project Note/Phase2/ph2_BLUEBOOK.md` — Fear & Greed architecture (§6), data model (`fear_greed_snapshots` in §8), scale assumptions (§10)
- `Project Note/Phase2/ph2_MILESTONES.md` — Phase 2 M3 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` — Fear & Greed product requirements (§2.4)
- `Decisions/ph2_ADR-002-fear-greed-engine.md` — the engine architecture decision (deterministic, nightly, snapshot-based)

### Current code surfaces you must understand before touching

- `apps/data-openbb/src/` — existing Python data service; M3 may add input fetchers here or in a parallel path
- `apps/product-api/src/server.ts` — API routes and middleware; M3 adds a new route
- `apps/product-api/src/store.ts` — Postgres query layer; M3 adds query functions for `fear_greed_snapshots`
- `apps/product-api/src/migrations.ts` — migration registration
- `apps/scheduler/src/scheduling.ts` — cron and cycle-window logic; M3 adds a new cron entry
- `apps/scheduler/src/server.ts` — scheduler service entry point
- `infra/migrations/` — existing migration files (naming convention: `m{milestone}_{seq}_{name}.{up|down}.sql`)
- `packages/contracts/src/` — all canonical schemas

---

## 3. Scope — What Is In

The following and only the following is in scope for Phase 2 M3:

- [ ] `FearGreedSnapshot` contract defined in `packages/contracts/src/fear-greed-snapshot.ts`
- [ ] Contract exported from `packages/contracts/src/index.ts`
- [ ] Migration `infra/migrations/ph2m3_006_fear_greed_snapshots.up.sql` and `.down.sql` — creates `fear_greed_snapshots` table with indexes
- [ ] Migration registered in `apps/product-api/src/migrations.ts`
- [ ] Input collection module: for each approved input (G1), a fetcher function that retrieves the raw value from the provider (G3) and normalizes it to a 0–100 sub-score
- [ ] Scoring engine: a pure function in `packages/fear-greed-engine/src/` that takes N normalized sub-scores, applies the weighting doctrine (G2), and produces a composite 0–100 score plus a label (`extreme_fear`, `fear`, `neutral`, `greed`, `extreme_greed`)
- [ ] Label thresholds: 0–20 Extreme Fear, 21–40 Fear, 41–60 Neutral, 61–80 Greed, 81–100 Extreme Greed
- [ ] Snapshot writer: after scoring, writes a row to `fear_greed_snapshots` with the composite score, label, sub-scores, and market date
- [ ] Scheduler cron registration: nightly calculation at 17:00 America/New_York (after market close), matching the existing `computeNextScheduledRun` pattern in `apps/scheduler/src/scheduling.ts`
- [ ] Historical bootstrap: if G5 decides to backfill, a one-time script that calculates and stores 90 days of historical scores from historical input data
- [ ] Product API endpoint: `GET /v1/market/fear-greed` returning the latest score and the last 90 snapshots inside the standard `{"data": ...}` envelope
- [ ] Product API endpoint: `GET /v1/market/fear-greed/latest` returning only the most recent snapshot (for the Today-tab card in M8)
- [ ] Graceful degradation: if one or more inputs are unavailable, behavior per G4 decision (re-weight, use prior, or fail); no fabricated scores
- [ ] Idempotency: running the nightly calculation twice for the same `market_date` produces no duplicate rows (upsert on `market_date` UNIQUE constraint)
- [ ] Phase 1 regression: Market Pulse, Deep Dive, and scheduler paths still complete after M3 changes

Full deliverables and acceptance criteria: `ph2_MILESTONES.md → M3`

---

## 4. Scope — What Is Out

Do not touch the following during Phase 2 M3. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| Fear & Greed UI / dashboard / gauge visualization | M8 — Fear & Greed UI & Weekly Digest |
| Today-tab Fear & Greed summary card | M8 |
| Historical line chart rendering | M8 |
| Rewriting Market Pulse around Fear & Greed | Not part of M3; Market Pulse is an independent product surface |
| Mobile app changes of any kind | M8+ |
| Dexter prompt changes or report enrichment with Fear & Greed data | Future milestone if desired |
| Monetization or tier-gating of Fear & Greed data | Fear & Greed is free for all users per PRD §2.4 |
| Modifying existing Phase 1 scheduler cron entries | M3 is additive; existing cron triggers are untouched |
| Social sentiment analysis beyond basic provider API | Scope creep; only fetch the approved input signal |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Contracts | `packages/contracts/src/` | Add `fear-greed-snapshot.ts`; update `index.ts` exports |
| Fear & Greed Engine | `packages/fear-greed-engine/src/` | Implement the pure scoring function with weighting and label logic |
| Data-OpenBB (or dedicated fetcher) | `apps/data-openbb/src/` | Add input fetcher functions for each approved market indicator |
| Product API | `apps/product-api/src/` | Register migration in `migrations.ts`; add Fear & Greed routes in `server.ts`; add query functions in `store.ts` |
| Scheduler | `apps/scheduler/src/` | Add nightly Fear & Greed cron trigger at 17:00 ET in `server.ts`; orchestrate input collection → scoring → snapshot write |
| Infra | `infra/migrations/` | Add `ph2m3_006_fear_greed_snapshots.{up,down}.sql` |
| Integration tests | `tests/integration/` | Add M3-specific tests |
| Smoke tests | `tests/smoke/` | Add M3 smoke test runner |

**M3 architecture rule:** Fear & Greed is a new, independent data product. It does not modify or depend on Market Pulse, Deep Dive, or any Phase 1 data path. Every existing endpoint, migration, cron entry, and contract must remain untouched and working.

---

## 6. Contracts You Are Touching

### `FearGreedSnapshot` — NEW

File: `packages/contracts/src/fear-greed-snapshot.ts`

```typescript
{
  id: string                      // deterministic: hash of market_date
  score: number                   // 0.00 to 100.00 (composite)
  label: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed"
  sub_scores: {
    input_name: string            // e.g. "vix", "put_call_ratio", "market_breadth"
    raw_value: number             // original provider value before normalization
    normalized_score: number      // 0-100 contribution
    weight: number                // weight applied in composite
    provider: string              // data source that provided this input
    available: boolean            // false if this input was unavailable and degraded
  }[]
  missing_inputs: string[]        // explicitly declared; empty if all inputs present
  calculated_at: string           // ISO 8601 timestamp of calculation
  market_date: string             // ISO 8601 date of the trading day this represents (UNIQUE)
  created_at: string              // ISO 8601 timestamp
}
```

**Rules:**
- Contract follows the existing pattern: export an interface AND a JSON schema constant
- Exported from `packages/contracts/src/index.ts`
- `pnpm typecheck` must pass after the contract addition
- `missing_inputs` is mandatory and is an explicit array — never omitted
- `id` is deterministic (hash of `market_date`) so nightly calculation is idempotent (upsert on conflict)
- `sub_scores` array preserves the full audit trail — any consumer can verify how the composite was derived
- `available: false` in a sub-score means the input was degraded per the G4 policy

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M3 — Fear & Greed Index Engine

**Ticket naming:**
```
[PH2-M3] What is being built
[PH2-M3][BUG] What is broken
[PH2-M3][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M3] FearGreedSnapshot contract` | Contract compiles with zero TypeScript errors |
| `[PH2-M3] fear_greed_snapshots migration` | Table created with indexes and UNIQUE constraint on market_date |
| `[PH2-M3] Input fetcher — [input_name]` | One ticket per approved input; fetcher retrieves and normalizes the value |
| `[PH2-M3] Scoring engine` | Pure function produces valid 0–100 score with correct labels and sub-scores |
| `[PH2-M3] Snapshot writer` | Calculated score is written to `fear_greed_snapshots` with full sub-score audit trail |
| `[PH2-M3] Scheduler cron registration` | Nightly cron runs at 17:00 ET without error |
| `[PH2-M3] Historical bootstrap` | If G5 is yes: 90 days of historical scores backfilled |
| `[PH2-M3] Product API — /v1/market/fear-greed` | Returns latest + 90-day history within latency target |
| `[PH2-M3] Product API — /v1/market/fear-greed/latest` | Returns only the most recent snapshot |
| `[PH2-M3] Graceful degradation` | Missing input handled per G4 policy; no fabricated scores |
| `[PH2-M3] Idempotency` | Running calculation twice for same market_date produces no duplicates |
| `[PH2-M3] Phase 1 regression check` | Market Pulse and scheduler paths still work |
| `[PH2-M3] Closeout` | Smoke test passed, Definition of Done checklist complete |

**Required on every ticket:**
- Service/folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `ph2_MILESTONES.md`
- Link to this file

**Required on every bug ticket:**
- Exact input provider or pipeline stage that failed
- Expected vs actual behavior
- Repro steps (exact commands or API calls)
- Error logs or Sentry link
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run.

---

## 8. Financial and Cost Considerations

This section must be filled in once the Gated Pre-Conditions (G1, G3, G5) are resolved.

### Daily Input Collection Cost

```
Number of approved inputs:           [G1] inputs
Providers required:                  [G3] distinct providers
API calls per nightly run:           [G1] (one per input, possibly more for pagination)

Provider costs:
  - [Provider A]: $__/month for [input_1, input_2]
  - [Provider B]: $__/month for [input_3]
  - [Provider C]: Free tier / included in M1 provider plan
  - ...

Total monthly provider cost for M3:  $__
```

### Example with 8 inputs across 3 providers

```
VIX (CBOE via data provider):       Phase 1 OpenBB / agreed macro provider (see G3); not tied to M0/M1 SEC corpus
Put/Call ratio:                      Included in M1 plan or ~$10-30/month separate
Market breadth (adv/dec, highs/lows): Free from market data provider
Sector momentum (ETF returns):      Free from public APIs
Credit spreads:                      May require FRED (free) or bond data provider
ETF flows:                           $20-50/month for reliable source
Social sentiment:                    $0-100/month depending on source

Estimated total:                     $30-180/month additional
```

### Historical Bootstrap Cost (if G5 = backfill)

```
If backfilling 90 days:
  API calls per day:                 [G1] inputs × 1 call each = [G1]
  Total backfill calls:              [G1] × 90 = ___
  Rate limit impact:                 Depends on provider; may require multi-day backfill
  One-time cost:                     Typically negligible (< 10,000 calls total)
```

### Storage Cost

```
fear_greed_snapshots:                1 row/day × ~2KB/row × 365 days/year ≈ 730 KB/year
                                     Negligible at any scale
```

### Decision This Section Drives

If multiple paid providers are needed (G3), the total monthly cost may exceed expectations. Options:
1. Reduce the input list to inputs available from existing providers
2. Use free/public data sources as primary, with paid sources for higher-quality inputs
3. Defer certain inputs to a future milestone

---

## 9. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| Fear & Greed calculation started | INFO | `{ level, service, message: "F&G calculation started", market_date, timestamp }` |
| Input fetched successfully | INFO | `{ level, service, message: "Input fetched", input_name, provider, raw_value, normalized_score, latency_ms, timestamp }` |
| Input fetch failed — degrading | WARN | `{ level, service, message: "Input fetch failed, applying degradation policy", input_name, provider, error_message, degradation_action, timestamp }` |
| All inputs collected | INFO | `{ level, service, message: "All inputs collected", total_inputs, available_count, missing_count, timestamp }` |
| Composite score calculated | INFO | `{ level, service, message: "Score calculated", market_date, score, label, sub_score_count, timestamp }` |
| Snapshot written to database | INFO | `{ level, service, message: "Snapshot stored", market_date, score, label, timestamp }` |
| Duplicate snapshot — upsert applied | INFO | `{ level, service, message: "Duplicate market_date, upsert applied", market_date, timestamp }` |
| Calculation failed — no snapshot stored | ERROR | `{ level, service, message: "F&G calculation failed", market_date, error_message, timestamp }` |
| Provider rate limit hit | WARN | `{ level, service, message: "Rate limit reached, backing off", provider, input_name, retry_after_ms, timestamp }` |
| API endpoint served | INFO | `{ level, service, message: "F&G endpoint served", endpoint, snapshot_count, latency_ms, timestamp }` |
| Bootstrap started | INFO | `{ level, service, message: "Historical bootstrap started", target_days, timestamp }` |
| Bootstrap completed | INFO | `{ level, service, message: "Historical bootstrap complete", days_backfilled, total_snapshots, duration_ms, timestamp }` |

Format: `{ level, service, message, ...fields, timestamp }`  
Never log API keys, secrets, or provider credentials.

---

## 10. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Single input provider is unavailable | Apply G4 degradation policy (re-weight, use prior day, or fail explicitly). If degraded, `missing_inputs` array includes the input name and `available: false` in sub-score. | Logs (WARN) + Sentry |
| Multiple input providers are unavailable | If too many inputs are missing to produce a meaningful score (threshold TBD per G4), fail the entire calculation for that day. No fabricated score. | Logs (ERROR) + Sentry |
| Provider rate limit exceeded | Backoff and retry with exponential delay; if still fails after retries, treat as unavailable input per G4 policy | Logs (WARN) |
| Provider returns unexpected data format | Normalization rejects invalid value; input treated as unavailable; log the raw response shape | Logs (ERROR) + Sentry |
| Scoring engine produces a score outside 0–100 | Validation rejects; calculation fails for that day; no snapshot stored | Logs (ERROR) + Sentry |
| Label threshold logic produces invalid label | Validation rejects; calculation fails | Logs (ERROR) |
| Nightly cron does not fire | Detected by absence of snapshot for the expected market_date; Sentry alert for stale data | Sentry |
| Nightly cron runs on a non-trading day (weekend/holiday) | Cron should check if today is a trading day before executing; skip with INFO log if not | Logs (INFO) |
| Duplicate calculation for same market_date | Upsert on conflict — idempotent, no error, latest values overwrite | Logs (INFO) |
| `fear_greed_snapshots` migration fails | Postgres rejects DDL; no partial schema state; fix SQL and re-run | Logs (ERROR) |
| API endpoint returns stale data (no snapshot for today) | Response includes the most recent available snapshot with `calculated_at` timestamp; consumer can detect staleness | API response |
| Bootstrap backfill interrupted | Resume from last successful date; upsert prevents duplicates | Logs (INFO on resume) |

**Rule:** No empty catch blocks. Every error path logs, surfaces to the appropriate channel, and either retries safely or fails explicitly.

---

## 11. Testing Requirements for This Milestone

- [ ] **Contract compilation test:** `FearGreedSnapshot` compiles; `pnpm typecheck` passes
- [ ] **Migration test:** `ph2m3_006` applies cleanly on a fresh database; `.down.sql` drops the table cleanly
- [ ] **Input fetcher unit tests:** Each approved input fetcher correctly normalizes provider response to a 0–100 sub-score (one test per input)
- [ ] **Input fetcher failure test:** Each fetcher handles provider outage gracefully (returns error, does not crash)
- [ ] **Scoring engine unit test — normal case:** All inputs present → composite score within 0–100, correct label
- [ ] **Scoring engine unit test — known values:** Fixed inputs produce a deterministic, known score (golden test)
- [ ] **Scoring engine unit test — edge cases:** Score exactly 0, exactly 100, on label boundaries (20, 40, 60, 80)
- [ ] **Scoring engine degradation test:** Missing inputs handled per G4 policy; `missing_inputs` array populated correctly
- [ ] **Snapshot writer integration test:** Calculated score is persisted to `fear_greed_snapshots` with correct fields
- [ ] **Idempotency test:** Running the calculation twice for the same market_date produces no duplicate rows
- [ ] **Scheduler integration test:** Cron fires at expected time; orchestrates input → score → write
- [ ] **Trading day check test:** Cron skips execution on weekends and known US holidays
- [ ] **API endpoint integration test:** `GET /v1/market/fear-greed` returns contract-valid response within 100ms
- [ ] **API endpoint — empty state test:** `GET /v1/market/fear-greed` returns `{"data": []}` when no snapshots exist (no crash)
- [ ] **Phase 1 Market Pulse regression test:** Market Pulse trigger completes after M3 changes
- [ ] **Phase 1 scheduler regression test:** Existing cron entries still fire correctly after M3 changes

Test file locations:
- Contract compilation: existing CI `pnpm typecheck`
- Migration tests: `tests/integration/` or inline in CI migration step
- Scoring engine tests: `packages/fear-greed-engine/tests/`
- Input fetcher tests: `apps/data-openbb/tests/`
- API endpoint tests: `apps/product-api/tests/`
- Scheduler tests: `apps/scheduler/tests/`
- Regression tests: `tests/smoke/`

CI must pass before any PR merges.

---

## 12. Data Validation Criteria

Passing tests and smoke steps is necessary but not sufficient. The Fear & Greed scores must be **correct and reproducible**. These checks confirm data integrity.

### Score Accuracy Spot-Check (Manual, 3 Days)

After the engine has run for 3+ days, manually verify:

| Check | Method |
|---|---|
| Composite score matches hand calculation | Take the sub-scores from one snapshot, apply the weighting formula manually, confirm the composite matches |
| Sub-score normalization is correct | For one input (e.g., VIX), take the raw provider value and confirm the normalized 0–100 score is mathematically correct per the normalization formula |
| Label matches threshold ranges | Confirm that a score of 35 has label `fear`, not `neutral` |
| `missing_inputs` is accurate | If a known provider was down, confirm the array lists the correct input |

### Determinism Check (Automated)

| Check | Expected |
|---|---|
| Same inputs produce same score | Run scoring engine twice with identical input fixture; scores must be bit-identical |
| Historical bootstrap scores are reproducible | If bootstrap was run, re-run for one date and confirm identical output |

### Completeness Check (After 7+ days of operation)

| Check | Expected |
|---|---|
| Row count in `fear_greed_snapshots` | ≥ number of trading days since launch (or 90 if bootstrapped) |
| Every row has a non-empty `sub_scores` array | `SELECT COUNT(*) FROM fear_greed_snapshots WHERE sub_scores = '[]'` returns 0 |
| Every row has a valid `label` | `SELECT COUNT(*) FROM fear_greed_snapshots WHERE label NOT IN ('extreme_fear','fear','neutral','greed','extreme_greed')` returns 0 |
| No duplicate `market_date` values | UNIQUE constraint enforces this; verify with `SELECT market_date, COUNT(*) FROM fear_greed_snapshots GROUP BY market_date HAVING COUNT(*) > 1` returns 0 rows |

---

## 13. Rollback Plan

M3 is a backend/data milestone with no user-facing changes and no mobile modifications.

| Component | Rollback Action |
|---|---|
| Migration | Run `ph2m3_006_fear_greed_snapshots.down.sql` — drops the table; no Phase 1 data affected |
| Snapshot data | Dropped with the table; no user data at risk |
| Nightly cron | Disable the Fear & Greed cron entry in scheduler; no effect on existing crons |
| API endpoints | Remove the new `/v1/market/fear-greed` and `/v1/market/fear-greed/latest` routes from `product-api`; no existing routes affected |
| Contract | Remove `fear-greed-snapshot.ts` from `packages/contracts/src/` and update `index.ts`; no existing contracts affected |
| Scoring engine package | Remove `packages/fear-greed-engine/` entirely; no other package depends on it |
| Input fetchers | Remove new fetcher functions from `data-openbb`; existing finance and macro fetchers untouched |

**Key safety property:** M3 rollback has zero impact on Phase 1 functionality because M3 is purely additive — new table, new contract, new endpoints, new cron, new package. Nothing existing is modified.

**Rollback test:** Before milestone close, confirm that running the `.down.sql` file drops the table cleanly and that `pnpm typecheck` still passes without `fear-greed-snapshot.ts`.

---

## 14. Definition of Done

Phase 2 M3 is not done until every item below is checked:

- [ ] All acceptance criteria in `ph2_MILESTONES.md → M3` are satisfied
- [ ] All five Gated Pre-Conditions (G1, G2, G3, G4, G5) are resolved and recorded in §17
- [ ] Financial and Cost Considerations (§8) are filled in with real provider costs
- [ ] Smoke test executed in full — results documented in §15 below
- [ ] Data validation checks (§12) all pass
- [ ] All automated tests passing in CI on main branch
- [ ] All Linear tickets for PH2-M3 are closed or explicitly deferred
- [ ] Deferred items logged as Linear tickets assigned to the next milestone
- [ ] Scoring engine produces deterministic, reproducible results (golden test passing)
- [ ] Phase 1 Market Pulse regression confirmed passing
- [ ] Phase 1 scheduler regression confirmed (existing crons unaffected)
- [ ] Rollback confirmed: `.down.sql` migration executes cleanly
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

**A single score appearing in the database is not done. This checklist complete is done.**

---

## 15. Smoke Test Log

Run the smoke test from `ph2_MILESTONES.md → M3` exactly as written. Record results here.

```
Date:
Run by:
Environment:
Result:

Step 1  — Apply migration ph2m3_006:                                ___
          Confirm fear_greed_snapshots table exists
          Confirm UNIQUE constraint on market_date
          Confirm indexes exist on (market_date), (calculated_at)

Step 2  — Run input collection for all approved inputs:             ___
          Confirm each input returns a valid raw value
          Confirm each input normalizes to a 0-100 sub-score
          Log any inputs that failed (and degradation action taken)

Step 3  — Run scoring engine with collected inputs:                 ___
          Confirm composite score is between 0 and 100
          Confirm label matches the score's threshold range
          Confirm sub_scores array has one entry per approved input

Step 4  — Verify determinism:                                       ___
          Run scoring engine again with same inputs
          Confirm identical composite score (bit-identical)

Step 5  — Write snapshot to database:                               ___
          Confirm row exists in fear_greed_snapshots
          Confirm all fields populated (score, label, sub_scores, market_date, calculated_at)
          Confirm missing_inputs is present (empty array if all inputs succeeded)

Step 6  — Run snapshot write again for same market_date:            ___
          Confirm idempotent — no duplicate rows, no errors
          Row count unchanged

Step 7  — Spot-check composite score:                               ___
          Take sub-scores from the stored snapshot
          Apply weighting formula manually
          Confirm composite matches (within floating-point tolerance)

Step 8  — GET /v1/market/fear-greed:                                ___
          Confirm HTTP 200
          Confirm response matches FearGreedSnapshot[] schema
          Confirm response includes the snapshot from Step 5
          Confirm response within 100ms latency

Step 9  — GET /v1/market/fear-greed/latest:                         ___
          Confirm HTTP 200
          Confirm response is a single FearGreedSnapshot
          Confirm score and label match Step 5

Step 10 — GET /v1/market/fear-greed with no data (fresh DB):        ___
          Confirm HTTP 200
          Confirm response is {"data": []}
          Confirm no crash, no 500 error

Step 11 — Verify nightly cron registration:                         ___
          Confirm cron entry exists at 17:00 ET
          Confirm it does not interfere with existing Phase 1 crons
          If testable: trigger cron manually and confirm end-to-end execution

Step 12 — Verify trading day check:                                 ___
          Simulate a Saturday date
          Confirm cron skips execution with INFO log

Step 13 — Phase 1 Market Pulse regression:                          ___
          Trigger a Market Pulse run
          Confirm it completes successfully
          Confirm M3 changes did not affect the result

Step 14 — Phase 1 scheduler regression:                             ___
          Confirm all existing cron entries still fire at expected times

Step 15 — Run CI:                                                   ___
          Confirm all tests pass

Steps failed (if any):
  -

Notes:
  -
```

---

## 16. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Fear & Greed dashboard UI (gauge, chart, labels) | UI work belongs to M8 | — | Phase 2 M8 |
| Today-tab Fear & Greed summary card | UI work belongs to M8 | — | Phase 2 M8 |
| Historical line chart with range selector | UI work belongs to M8 | — | Phase 2 M8 |
| Weekly digest inclusion of Fear & Greed trend | Digest is M5/M8 scope | — | Phase 2 M5/M8 |
| Integration of Fear & Greed into Deep Dive reports | Dexter enrichment is a future consideration | — | Future |
| Mobile app changes for Fear & Greed | No mobile work in M3 | — | Phase 2 M8 |
| Intraday Fear & Greed updates | ADR-002 specifies daily-only calculation; acceptable for a sentiment gauge | — | Post-launch / future ADR |

---

## 17. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Approved input list | [To be recorded when G1 is resolved] | No — product decision; update ph2_ADR-002 if input list differs from candidates listed there |
| Weighting doctrine | [To be recorded when G2 is resolved] | No — implementation detail within the scoring engine |
| Data providers per input | [To be recorded when G3 is resolved] | No — operational decision; document in this section |
| Degradation policy | [To be recorded when G4 is resolved] | No — operational decision |
| Historical bootstrap | [To be recorded when G5 is resolved] | No — operational decision |
| Migration sequence number | `006` continuing from Phase 2 M1's `005` | No |
| Label threshold ranges | 0–20 / 21–40 / 41–60 / 61–80 / 81–100 | No — product decision |
