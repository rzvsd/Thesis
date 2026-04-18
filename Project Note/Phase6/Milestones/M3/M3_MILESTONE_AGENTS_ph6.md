# AGENTS.md - Phase 6 M3 Morning Exception Briefing & Macro Stress
**Milestone:** M3 - Morning Exception Briefing & Macro Stress  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M3/M3_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M3 - Morning Exception Briefing & Macro Stress |
| **Linear Project** | PH6 M3 - Morning Exception Briefing & Macro Stress |
| **Owner** | Scheduler Owner + Product Lead |
| **Status** | Closed locally - owner approved; GitHub CI closeout pending on push |
| **Depends on** | M2 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Rebuild Pulse around official macro, canonical events, and bounded context; replace fear/greed.

---

## 2. Scope - What Is In

- [x] morning exception briefing pipeline
- [x] Macro Stress snapshot
- [x] no-material-change output
- [x] My Names relevance via event/context logic
- [x] updated pulse smoke coverage

---

## 3. Scope - What Is Out

- [ ] quote-board re-creation
- [ ] licensed intraday market data
- [ ] earnings War Room behavior beyond what Pulse needs

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `scheduler` | briefing generation and macro stress cadence |
| `product-api` | briefing storage and delivery |
| `mobile` | truthful presentation of no-change and omission states |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `MacroStressSnapshot` | official-only stress state |
| `AnalysisReport / pulse payloads` | Phase 6-compatible pulse sections |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M3 - Morning Exception Briefing & Macro Stress

Ticket naming:

```text
[PH6-M3] What is being built
[PH6-M3][BUG] What is broken
[PH6-M3][SPIKE] What is being investigated
```

Every ticket must include:

- service touched
- contract touched (if any)
- `ph6_MILESTONES.md` acceptance criterion it satisfies
- whether the work removes or audits a deprecated dependency assumption

Never close a ticket without the relevant smoke proof or test evidence.

---

## 7. Logging For This Milestone

Phase 6 logs remain structured JSON.

Minimum additional requirement for this milestone:

- if a path degrades because of source coverage, rights state, or deprecated dependency fallback pressure, that reason must be visible in the log context

Never log secrets, tokens, or unreviewed full text.

---

## 8. Error Handling For This Milestone

- No empty catch blocks
- Every failed job or fetch must surface the responsible service and failure reason
- Rights violations are treated as real failures, not silent warnings
- Deprecated-provider fallback is not an acceptable hidden recovery path

---

## 9. Testing Requirements For This Milestone

- milestone-specific contract validation where applicable
- smoke proof against the Phase 6 ruleset
- deprecated dependency guard passing for affected paths
- golden fixtures or deterministic test data where appropriate

---

## 10. Definition of Done

- [x] Acceptance criteria in `ph6_MILESTONES.md` for this milestone are satisfied locally
- [x] Smoke test executed in full and recorded below
- [x] CI-equivalent local quality checks pass
- [x] Deprecated dependency check passes
- [x] Rollback path confirmed
- [x] Owner signs off
- [x] Engineering Lead countersigns

---

## 11. Smoke Test Log

Run the milestone smoke test from `ph6_MILESTONES.md` and record the result here.

```text
Date: 2026-04-18
Run by: Codex
Environment: local Windows workspace, in-memory Product API test store, scheduler test harness, Android debug assemble with local Android Studio JBR
Result: PASS

Step 1: Trigger Morning Exception Briefing in test mode
Result: PASS - `market-pulse.test.ts` dispatch stored a valid report and `/pulse/2026-03-21` returned the rebuilt Macro Stress / canonical events / bounded context shape.
Step 2: Confirm a valid briefing is stored
Result: PASS - Product API full suite passed, including pulse retrieval, latest retrieval, and personalized watchlist overlay behavior.
Step 3: Confirm Macro Stress validates
Result: PASS - `sentiment.test.ts` passed against `/internal/macro-stress/dispatch`, `/v1/macro-stress/current`, and `/v1/macro-stress/history`.
Step 4: Run no-material-change fixture and confirm explicit output
Result: PASS - `ph5-m3-morning-briefing.test.ts` passed with explicit Pro no-change handling and exception-path delivery.
Step 5: Confirm no deprecated provider path is needed
Result: PASS - `corepack pnpm run phase6:m0:guard` passed with `0 new protected-path finding(s)`.

Steps failed (if any): None.
Notes: Evidence captured in `evidence/2026-04-18_m3-morning-briefing-macro-stress-smoke.md`. Android `app:assembleDebug` passed after setting `JAVA_HOME` to the local Android Studio JBR.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Macro Stress cutover | Morning briefing now treats `macro_stress`, `official_macro_pressure`, `canonical_events`, and `bounded_context` as the canonical Phase 6 sections while legacy sentiment/Fear & Greed paths remain compatibility aliases only | No, covered by `PH6_DECISION_LOCKS.md` and ADR-004 |
| No-change behavior | Quiet cycles produce an explicit no-material-change outcome instead of filler content or quote-board theater | No, covered by ADR-006 |
| Relevance rule | My Names relevance is driven by explicit ticker mention across canonical events and bounded first-party context, then surfaced as a personalized overlay | No, covered by ADR-004 |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| GitHub CI closeout | Local lint/typecheck/test/assemble/guard proof is complete; hosted CI closeout happens on push | N/A per owner Linear skip pattern | M3 closeout |

---

## 14. Closeout Sign-Off

| Role | Status | Evidence |
|---|---|---|
| Owner | Accepted | Owner approval message on 2026-04-18 |
| Engineering Lead | Accepted by owner delegation | Owner approval message on 2026-04-18 |
