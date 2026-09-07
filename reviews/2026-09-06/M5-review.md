# Phase 7 M5 review

## Scope and supersession

Reviewed the Phase 7 M5 brief, roadmap, M5 evidence, current UserResearchState contracts and validation, research-state refresh/holding routes, InMemoryStore and PostgresStore persistence, Pulse personalization, and the focused Product API and contract tests. M5 remains a current foundational data path: later M6-M12 milestones changed Pulse writing/rendering and Deep Dive presentation, but did not remove typed user research state, manual holdings, or authenticated Pulse overlay. M13 is the active later milestone, so later benchmark/value-lens work is outside this review.

## Findings

### P2 — Historical refresh can use a future Deep Dive

**Location:** `apps/product-api/src/research-state.ts:192-197, 308-310, 324`

**Trigger:** Run `POST /internal/research-state/refresh` with an `as_of` date earlier than a user's most recently completed Deep Dive (for example, rebuild a historical state after a later Deep Dive has been completed). The refresh loads all user Deep Dive metadata, sorts it by `createdAt`, and `latestReadableReport` selects the first matching ticker without constraining the report to `as_of`.

**Impact:** The historical state receives a later report ID, generated timestamp, thesis summary, evidence, and `daily_delta` decisions that did not exist at the requested date. This breaks replay-safe omission-forward assembly and can make a historical Pulse personalization claim knowledge from the future. The M5 evidence specifically proves date-bounded Pulse selection, but does not prove date-bounded Deep Dive selection; the same bound is missing on this sibling input.

**Evidence:** Direct code path above. `latestPulse` does call `getReportByTypeAndDate(..., asOf)` at `research-state.ts:235-240`, while the Deep Dive path has no equivalent date filter.

### P2 — Malformed holding fields can raise a server error instead of validation

**Location:** `apps/product-api/src/routes/research-state-routes.ts:65-67, 149, 186-187`

**Trigger:** Send a malformed JSON holding request such as `{ "ticker": 17 }`, `{ "ticker": "AAPL", "label": 17 }`, or `{ "ticker": "AAPL", "notes": {} }` to `POST /v1/user/holdings`. `normalizeTicker` calls `.trim()` on a non-string value, and the optional label/notes expressions call `.trim()` on any non-nullish value.

**Impact:** The request throws before the route's 422 validation response. Depending on the server's top-level error handling, clients receive a 500 or an aborted request rather than a deterministic validation error. This is a trust-boundary failure for the M5 CRUD API and is not covered by the current focused test.

**Evidence:** The body is parsed from untrusted JSON at `research-state-routes.ts:142-148`; only TypeScript types constrain it at compile time. `ticker` is read before any runtime type guard, and label/notes are trimmed without `typeof value === "string"` checks.

## P1/P3 review

No P1 or P3 defect was established from the reviewed implementation and evidence. I did not treat later-superseded Pulse renderer behavior as an M5 defect. I also did not report the documented legacy Yahoo/Alpha Vantage configuration strings: the M5 evidence identifies them as pre-existing and outside the M5 runtime path.

## Validation reviewed/run

Reviewed `Project Note/Phase7/Milestones/M5/evidence/2026-04-27_m5_user_research_state_verification.md` and `2026-04-27_m5_test_output.log`: Product API build passed; all 17 contract tests passed; the focused Market Pulse personalization test passed; and the monitoring regression test passed. The evidence also records the runtime scan showing no `withWatchlistOverlay` path and the generated personalized JSON/HTML/PDF artifacts. The current test source confirms coverage for a valid manual AAPL holding, refresh, personalized Pulse overlay, omission behavior, and private cache headers.

I did not add or modify tests and did not rerun the suites; this task was a review-only report. Existing proof does not include a historical refresh with a later Deep Dive present, malformed holding JSON field cases, a direct Postgres migration/runtime run, or a dedicated research-state route test suite.

## Verdict

**M5 is conditionally validated but not fully correct in the current working tree.** The core typed state, manual holding persistence, internal refresh, omission-forward construction, and authenticated Pulse overlay are present and evidenced. The two P2 defects should be fixed before treating the refresh/API boundary as production-complete, with regression coverage for date-bounded Deep Dive selection and malformed holding fields.
