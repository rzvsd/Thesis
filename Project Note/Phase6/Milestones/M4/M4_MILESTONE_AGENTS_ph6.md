# AGENTS.md - Phase 6 M4 Earnings State & War Room Substrate
**Milestone:** M4 - Earnings State & War Room Substrate  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M4/M4_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M4 - Earnings State & War Room Substrate |
| **Linear Project** | PH6 M4 - Earnings State & War Room Substrate |
| **Owner** | Product API Owner + AI/Reasoning Engineer |
| **Status** | Implemented locally - smoke and quality gates passed; awaiting owner closeout + GitHub CI run |
| **Depends on** | M3 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Use estimated/confirmed/actual state and first-party artifacts to power earnings workflows.

---

## 2. Scope - What Is In

- [x] three-state earnings model
- [x] event-window triggers
- [x] War Room evidence pack
- [x] earnings alert reason paths
- [x] transcript-optional workflow support

---

## 3. Scope - What Is Out

- [ ] new paid earnings calendar vendor
- [ ] transcript-as-required-core-path
- [ ] market-price-heavy event windows

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `product-api` | earnings state and War Room APIs |
| `scheduler` | event-window orchestration |
| `dexter-worker` | follow-up questions and contradiction summaries |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `EarningsEventState` | estimated/confirmed/actual |
| `CallArtifact` | earnings materials |
| `alert payloads` | reason path compatibility |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M4 - Earnings State & War Room Substrate

Ticket naming:

```text
[PH6-M4] What is being built
[PH6-M4][BUG] What is broken
[PH6-M4][SPIKE] What is being investigated
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
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

---

## 11. Smoke Test Log

Run the milestone smoke test from `ph6_MILESTONES.md` and record the result here.

```text
Date: 2026-04-18
Run by: Codex
Environment: local Windows workspace, in-memory Product API test store, internal OpenBB mock, root monorepo quality gates
Result: PASS

Step 1: Seed estimated and confirmed events in test mode
Result: PASS - `ph6-m4-earnings-state.test.ts` seeds calendar events through `/internal/calendar/sync`.
Step 2: Confirm the API distinguishes the states
Result: PASS - `/v1/research/earnings/state` returns typed state with conflict surfacing and source state.
Step 3: Trigger a results artifact and confirm actual state
Result: PASS - ingesting `earnings_release` artifact promotes state to `actual`.
Step 4: Open War Room payload and confirm transcript is optional
Result: PASS - `/v1/research/war-room/:id` includes `evidence_pack`, transcript present as `available=false` when absent.
Step 5: Confirm alert reason paths are present
Result: PASS - `earnings_war_room` alerts include `reason_code`, `reason_text`, timing/source/evidence state, and conflict flags.

Steps failed (if any): None.
Notes: Evidence captured in `evidence/2026-04-18_m4-earnings-state-war-room-smoke.md`.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Confirmed timing source policy | `confirmed` timing is valid only when source is `official` or `first_party`; other source states downgrade to `estimated` with explicit reason text | No, covered by ADR-005 + M4 acceptance |
| Actual promotion rule | `actual` is promoted by release artifact evidence (`earnings_release`, `presentation`, `sec_exhibit`, or supplemental material), not by price behavior | No, covered by ADR-005 |
| War Room evidence posture | War Room payload exposes `evidence_pack` and `reason_path`, while transcript remains optional and explicit when missing | No, covered by ADR-005 |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| GitHub CI closeout | Local lint/typecheck/test/guard proof is complete; hosted CI closeout happens after push | N/A per owner Linear skip pattern | M4 closeout |

---

## 14. Closeout Sign-Off

| Role | Status | Evidence |
|---|---|---|
| Owner | Pending | Waiting for owner closeout approval after review |
| Engineering Lead | Pending | To be countersigned after owner closeout |
