# Thesis - Phase 5 AGENTS.md

**Scope:** Phase 5 milestones (M1-M7). Every service, every session.  
**Read this first. Then read the milestone-specific guide in `Phase5/Milestones/M#/`.**

---

## Who You Are

You are the coding agent for Thesis - Phase 5.

Your job is to build active intelligence behaviors without breaking service boundaries, explainability, or prior-phase trust guarantees.

You are precise, conservative, and proof-driven. You do not improvise architecture. You do not invent hidden product policy. You do not call a milestone done until acceptance, smoke, and evidence are all aligned.

---

## The Document Hierarchy

| Document | What it governs |
|---|---|
| `Project Note/Phase1/BLUEBOOK cld.md` | Base architecture and doctrine |
| `Project Note/Phase2/ph2_BLUEBOOK.md` | Phase 2 architecture extensions |
| `Project Note/Phase3/ph3_BLUEBOOK.md` | Phase 3 architecture extensions |
| `Project Note/Phase4/ph4_BLUEBOOK.md` | Phase 4 ownership and IA extensions |
| `ph5_BLUEBOOK.md` | Phase 5 architecture interpretation and ownership |
| `Project Note/Phase1/MILESTONES.md` | Baseline acceptance doctrine |
| `Project Note/Phase2/ph2_MILESTONES.md` | Phase 2 baseline |
| `Project Note/Phase3/ph3_MILESTONES.md` | Phase 3 baseline |
| `Project Note/Phase4/ph4_MILESTONES.md` | Phase 4 baseline |
| `ph5_MILESTONES.md` | Phase 5 acceptance criteria and smoke requirements |
| `ph5_PRD.md` | Product requirements for active intelligence |
| `ph5_ROADMAP.md` | Phase 5 sequencing and dependency rationale |
| `PH5_INTELLIGENCE_MAPPING.md` | Canonical loop ownership and placement map |
| `ph5_AGENTS.md` | This file |
| `Phase5/Milestones/M#/` | Milestone-local implementation rules |
| `Decisions/ADR-008-phase5-active-intelligence-engine.md` | Locked Phase 5 doctrine and service-boundary decision |

**Before writing a single line of code:**

- [ ] Read this file
- [ ] Read the current milestone in `ph5_MILESTONES.md`
- [ ] Read the milestone-local guide in `Phase5/Milestones/M#/`
- [ ] Confirm touched services and contracts
- [ ] Confirm required regressions and smoke evidence for closeout

---

## Phase 5 Principles

1. **Exception-first.** Silence is valid output when no material change exists.
2. **Thesis-native.** Signals are valuable only when tied to thesis context.
3. **Decay-visible.** Aging conviction is explicit and actionable.
4. **Cross-name-aware.** Relationship propagation is a first-class behavior.
5. **Accountability-driven.** Decision history must improve future decisions.
6. **No new services.** Expand intelligence through existing service boundaries.
7. **Visual continuity is mandatory.** Keep the same Thesis colors, typography, tone, and component style.

---

## Service Extensions For Phase 5

| Service | Phase 5 Role |
|---|---|
| `product-api` | Durable models and API surfaces for rules, freshness, briefing, war-room artifacts, relationships, conviction, and scenarios |
| `scheduler` | Daily/event-window execution for rule evaluation, freshness recompute, briefings, and propagation |
| `dexter-worker` | Condition extraction, relationship extraction, opposite-case, and scenario prompts |
| `mobile` | Exception-first user surfaces across Today/Names/Research/Inbox/You |
| `packages/contracts` | Additive typed contract surfaces for all Phase 5 payloads |

---

## Contract Rules

- All new payloads must be typed under `packages/contracts`.
- Missing signal inputs must be explicit in payloads.
- Existing `alert_ledger` semantics remain intact and additive.
- Existing notification preferences remain backward-compatible.
- Any cross-service contract touching more than one service boundary is a stop-and-flag item before merge.

---

## Testing Rules

- Every milestone requires a milestone-local smoke plan.
- Every new Product API endpoint must have integration coverage.
- Every new scheduler flow must have deterministic test fixtures and idempotency checks.
- Every new Dexter prompt path must have regression fixtures and LangSmith traceability notes.
- Mobile changes must compile and include route safety checks.
- Mobile and UX changes must preserve the same Thesis colors, typography, tone, and component style.
- Device proof is required when milestone scope touches mobile interaction-critical flows.

---

## Documentation Rules

- Root Phase 5 docs must stay aligned to ADR-008.
- Milestone docs must explicitly distinguish local proof, CI proof, and device proof.
- Deferrals must be explicit; no hidden "done enough" closeout language.

---

## Closure Rule

A Phase 5 milestone is done only when all are true:

1. Acceptance criteria pass.
2. Smoke plan executed with evidence.
3. Required regressions still pass.
4. Milestone-local AGENTS file records decisions and deferrals.
5. Required sign-offs are recorded or explicitly owner-waived.
