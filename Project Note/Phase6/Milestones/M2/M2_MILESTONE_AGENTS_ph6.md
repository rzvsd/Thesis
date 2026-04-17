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
| **Status** | Planned |
| **Depends on** | M1 complete + initial allowlist |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Add rights-safe evidence handling and event-driven first-party context ingestion.

---

## 2. Scope - What Is In

- [ ] evidence rights metadata
- [ ] first-party source registry
- [ ] call artifact model
- [ ] event-driven bounded fetches
- [ ] rights-safe storage/display enforcement

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
| `EvidenceRights` | rights metadata |
| `CallArtifact` | first-party or rights-clean materials |
| `ContextItem` | bounded context payload |

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

- [ ] Acceptance criteria in `ph6_MILESTONES.md` for this milestone are satisfied
- [ ] Smoke test executed in full and recorded below
- [ ] CI passes
- [ ] Deprecated dependency check passes
- [ ] Rollback path confirmed
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

---

## 11. Smoke Test Log

Run the milestone smoke test from `ph6_MILESTONES.md` and record the result here.

```text
Date:
Run by:
Environment:
Result:

Step 1: Trigger a first-party fetch for a supported event
Step 2: Confirm the item carries rights_class and display_mode
Step 3: Attempt an unapproved-domain ingest in test mode
Step 4: Confirm it is rejected safely
Step 5: Confirm excerpt-only or link-only behavior is enforced

Steps failed (if any):
Notes:
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| - | - | - |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| - | - | - | - |
