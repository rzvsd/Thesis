# AGENTS.md - Phase 4 M1 Baseline, Docs, and Interface Lock
**Milestone:** Phase 4 M1 - Baseline, Docs, and Interface Lock  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase3/ph3_AGENTS.md`, then `Project Note/Phase4/ph4_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase4/Milestones/M1/M1_MILESTONE_AGENTS_ph4.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 4 M1 - Baseline, Docs, and Interface Lock |
| **Linear Project** | Deferred by owner instruction for this implementation lane |
| **Owner** | Product Lead + Engineering Lead |
| **Status** | Implemented locally |
| **Depends on** | Phase 3 baseline docs remain in force |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Root mobile IA is fixed as `Today / Names / Research / Inbox / You` | RESOLVED | Product Lead + Engineering Lead | Milestone start |
| G2 | Inbox is server-backed and not reconstructed locally | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G3 | Visual language is preserved exactly; Phase 4 is not a brand refresh | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G4 | Canonical screen ownership rules must be written before milestone closeout | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

**Rule:** M1 exists to stop implementation drift. If the docs and ADR disagree, M1 is not done.

---

## 1. What This Milestone Is Building

M1 opens Phase 4 as a governed workstream.

This milestone creates:

- the Phase 4 root documentation set
- the canonical 5-tab screen mapping
- the Mobile IA v2 ADR
- the milestone-local AGENTS and smoke-plan scaffold
- the named public interfaces for alert ledger work

**Plain English summary for non-technical audit:**  
M1 locks what Phase 4 is before more code spreads through the repo.

---

## 2. Read These Files First

### Earlier phase docs

- `Project Note/Phase1/BLUEBOOK cld.md`
- `Project Note/Phase2/ph2_BLUEBOOK.md`
- `Project Note/Phase2/Milestones/M6/SCREEN_MAPPING.md`
- `Project Note/Phase3/ph3_AGENTS.md`
- `Project Note/Phase3/ph3_BLUEBOOK.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/ph3_PRD.md`

### Phase 4 docs

- `Project Note/Phase4/ph4_AGENTS.md`
- `Project Note/Phase4/ph4_BLUEBOOK.md`
- `Project Note/Phase4/ph4_MILESTONES.md`
- `Project Note/Phase4/ph4_PRD.md`
- `Project Note/Phase4/ph4_ROADMAP.md`
- `Project Note/Phase4/PH4_SCREEN_MAPPING.md`
- `Decisions/ADR-007-mobile-ia-v2.md`

---

## 3. Scope - What Is In

- [x] Phase 4 root docs in Phase 3-compatible format
- [x] Canonical 5-tab screen mapping
- [x] ADR-007 locking Mobile IA v2
- [x] Milestone-local AGENTS and smoke-plan scaffolding for M1-M4
- [x] Named public interface list for alert-ledger and route-target changes

Full acceptance source: `Project Note/Phase4/ph4_MILESTONES.md -> M1`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Product API implementation of the alert ledger | M2 |
| Android 5-tab implementation | M3 |
| Device/Maestro proof | M4 |
| Linear project/ticket creation | Explicitly skipped by owner instruction in this lane |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Docs | `Project Note/Phase4/` | Phase 4 governance, milestone definitions, screen ownership |
| Decisions | `Decisions/` | Mobile IA v2 ADR |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Alert-ledger public interface naming | Named only in M1; implemented in M2 | `packages/contracts/src/alert-ledger.ts` |
| Route targets | Named only in M1; implemented in M2/M4 | `packages/contracts/src/alert-ledger.ts` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 4 M1 Change | Why Here |
|---|---|---|---|
| 3-tab Android canon | Phase 2 M6 | Superseded by explicit Phase 4 screen map and ADR | Future work needs one new source of truth |
| Phase 3 notification lifecycle | Phase 3 M2 | Extended with Inbox/alert-ledger naming | Phase 4 must not improvise alert history ownership |
| Phase 3 operational proof discipline | Phase 3 M4 | Continued via milestone-local smoke and evidence planning | Documentation must define proof before closeout |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Deferred by owner instruction

**Naming if enabled later:**
```text
[PH4-M1] What is being built
[PH4-M1][BUG] What is broken
[PH4-M1][SPIKE] What is being investigated
```

**Owner instruction for this lane:** Do not update Linear. Record any ticket-hygiene gap in deferrals instead of silently pretending it was done.

---

## 9. Logging And Observability

M1 is document-only. No new runtime observability is introduced here.

---

## 10. Testing Requirements

- [x] Root Phase 4 docs exist
- [x] M1-M4 milestone-local docs exist
- [x] ADR-007 exists
- [x] Phase 4 screen mapping explicitly supersedes Phase 2 M6 for future work

Detailed execution lives in `M1_SMOKE_PLAN_ph4.md`.

---

## 11. Definition Of Done

- [x] All M1 acceptance criteria in `ph4_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] Root Phase 4 docs are committed in the repo structure
- [ ] Linear project/tickets created or explicitly waived by owner
- [ ] Product Lead sign-off recorded
- [ ] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date: 2026-04-08
Run by: Codex
Environment: Local repo workspace
Result: PASS

Notes:
- Root doc summary: `Project Note/Phase4/Milestones/M1/evidence/2026-04-08/m1-docs-summary.json`
- Canonical screen map: `Project Note/Phase4/PH4_SCREEN_MAPPING.md`
- Locked decision record: `Decisions/ADR-007-mobile-ia-v2.md`
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Phase 4 Linear project and ticket hygiene not created | Owner instruction explicitly said to skip Linear in this lane | N/A | Follow owner direction |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Root mobile IA | Locked to `Today / Names / Research / Inbox / You` | Yes - ADR-007 |
| Inbox source of truth | Product API-owned durable alert ledger | Yes - ADR-007 |
| Visual-language posture | Preserve existing Thesis palette, typography mood, and card system | No |
| Screen ownership map | Documented in `PH4_SCREEN_MAPPING.md` and supersedes Phase 2 M6 for future work | No |
