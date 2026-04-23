# AGENTS.md - Phase 6 M2 Rights & First-Party Context
**Milestone:** M2 - Rights & First-Party Context  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M2/M2_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M2 - Rights & First-Party Context |
| **Linear Project** | PH6 M2 - Rights & First-Party Context |
| **Owner** | Backend Engineer + Platform Architect |
| **Status** | Closed - owner approved; Engineering Lead accepted by owner delegation on 2026-04-23 |
| **Depends on** | M1 complete + initial allowlist |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Add rights-safe evidence handling and event-driven first-party context ingestion.

---

## 2. Scope - What Is In

- [x] evidence rights metadata
- [x] first-party source registry
- [x] call artifact model
- [x] event-driven bounded fetches
- [x] rights-safe storage/display enforcement

---

## 3. Scope - What Is Out

- [ ] macro stress generation
- [ ] earnings scheduler semantics
- [ ] broad crawling or publisher full-text storage

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `news-ingest` | first-party and allowlisted context only |
| `product-api` | rights-aware persistence |
| `packages/contracts` | rights and call artifact contracts |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `EvidenceRightsMetadata` | rights metadata |
| `CallArtifact` | first-party or rights-clean materials |
| `FirstPartyContextItem` | bounded context payload |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M2 - Rights & First-Party Context

Ticket naming:

```text
[PH6-M2] What is being built
[PH6-M2][BUG] What is broken
[PH6-M2][SPIKE] What is being investigated
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
Date: 2026-04-17
Run by: Codex
Environment: local Windows workspace, deterministic fixtures, in-memory Product API test store
Result: PASS

Step 1: Trigger a first-party fetch for a supported event
Result: PASS - news-ingest fixture fetch returned AAPL and MSFT first-party context items.
Step 2: Confirm the item carries rights_class and display_mode
Result: PASS - context items carry rights_class=first_party_public and display_mode=excerpt_only.
Step 3: Attempt an unapproved-domain ingest in test mode
Result: PASS - https://example.com/aapl-earnings rejected with SOURCE_REJECTED.
Step 4: Confirm it is rejected safely
Result: PASS - rejected source did not produce user-facing context or artifacts.
Step 5: Confirm excerpt-only or link-only behavior is enforced
Result: PASS - Product API rejects missing rights metadata and persists full_text_stored=false with excerpt_only policy.

Steps failed (if any): None.
Notes: Evidence captured in `evidence/2026-04-17_m2-rights-first-party-smoke.md`.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Seed first-party registry | AAPL, MSFT, and TSLA first-party domains and path scopes are locked in `PH6_DECISION_LOCKS.md`; unknown domains reject by default | No, covered by Phase 6 decision locks and ADR-003 |
| Storage mode | Seed sources use `excerpt_only`, `full_text_stored=false`, and link-safe metadata by default | No, covered by ADR-003 |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Hosted GitHub CI run | Final hosted CI proof will occur on the next push; owner approved local closeout without treating hosted CI as a blocker | N/A per owner instruction to skip Linear unless asked | Post-closeout hygiene |
