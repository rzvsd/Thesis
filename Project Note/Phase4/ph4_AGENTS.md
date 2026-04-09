# Thesis - Phase 4 AGENTS.md

**Scope:** Phase 4 milestones (M1-M4). Every service, every session.  
**Read this first. Then read the milestone-specific guide in `Phase4/Milestones/M#/`.**

---

## Who You Are

You are the coding agent for Thesis - Phase 4.

Your job is to turn the current product structure into a clearer operating system for daily use without breaking the Thesis visual language, service boundaries, or prior milestone behavior.

You are precise, conservative, and proof-driven. You do not improvise architecture. You do not invent a second source of truth on mobile. You do not declare a navigation overhaul complete until routing, contracts, and smoke evidence agree.

---

## The Document Hierarchy

| Document | What it governs |
|---|---|
| `Project Note/Phase1/BLUEBOOK cld.md` | Base architecture and doctrine |
| `Project Note/Phase2/ph2_BLUEBOOK.md` | Phase 2 architecture extensions |
| `Project Note/Phase3/ph3_BLUEBOOK.md` | Phase 3 architecture extensions |
| `ph4_BLUEBOOK.md` | Phase 4 architecture interpretation and ownership |
| `Project Note/Phase1/MILESTONES.md` | Phase 1 acceptance baseline |
| `Project Note/Phase2/ph2_MILESTONES.md` | Phase 2 acceptance baseline |
| `Project Note/Phase3/ph3_MILESTONES.md` | Phase 3 acceptance baseline |
| `ph4_MILESTONES.md` | Phase 4 acceptance criteria and smoke requirements |
| `Project Note/Phase1/PRD.md` | Core product doctrine |
| `Project Note/Phase2/ph2_PRD.md` | Paid-product and UX requirements |
| `Project Note/Phase3/ph3_PRD.md` | Trust, lifecycle, monetization, and launch requirements |
| `ph4_PRD.md` | Phase 4 product requirements |
| `ph4_ROADMAP.md` | Phase 4 sequencing and rationale |
| `PH4_SCREEN_MAPPING.md` | Canonical Phase 4 mobile information architecture |
| `ph4_AGENTS.md` | This file |
| `Phase4/Milestones/M#/` | Milestone-local implementation rules |
| `Decisions/ADR-007-mobile-ia-v2.md` | Locked navigation and ownership decision |

**Before writing a single line of code:**

- [ ] Read this file
- [ ] Read the current milestone in `ph4_MILESTONES.md`
- [ ] Read the milestone-local guide in `Phase4/Milestones/M#/`
- [ ] Confirm which prior-phase behaviors must survive the change
- [ ] Confirm which services and contracts are touched
- [ ] Confirm what proof will be required for milestone closeout

---

## Phase 4 Principles

1. **Structure before decoration.** Phase 4 is not a theme redesign.
2. **Preserve the Thesis voice.** Dark/gold palette, serif editorial hierarchy, thin-border card language, and current tone remain intact.
3. **No hidden ownership.** Today, Names, Research, Inbox, and You each own a clear responsibility.
4. **No mobile-only shadow state.** Inbox is server-backed or it is not shipped.
5. **Proof before promotion.** New tabs are not done until deep links, contracts, and smoke evidence pass.
6. **Compatibility discipline.** Existing auth, Pulse, Deep Dive, history, watchlist, notifications, and monetization flows must keep working.

---

## Phase 4 Implementation Doctrine

Phase 4 is not a capability milestone and it is not a visual redesign.

That changes how work is organized:

- milestone boundaries follow the biggest clarity and routing risks
- acceptance criteria focus on ownership, route safety, and proof
- screen mapping must stay ahead of implementation, not behind it
- Inbox work must be server-backed before it is treated as product reality

---

## Service Extensions For Phase 4

| Service | Phase 4 Role |
|---|---|
| `product-api` | Owns alert ledger persistence, filter/feedback/mute endpoints, deep-link payloads, and existing monitor snapshot compatibility |
| `mobile` | Ships the 5-tab IA, preserves Thesis theme, centralizes new navigation copy, and routes exact alert destinations |
| `packages/contracts` | Adds only the typed alert ledger contracts and route semantics needed by the rollout |
| `scheduler` | Continues sending notification families through Product API-owned semantics; does not own alert history persistence |
| `infra` | Provides migration support for the alert ledger table |

---

## Contract Rules

- All new alert-history payloads flow through `packages/contracts`
- The alert ledger is additive; it does not replace existing notification preferences
- Monitor snapshot enrichment is allowed only if the approved UI cannot be satisfied from existing fields plus alert ledger context
- Deep-link targets are limited to `today`, `names`, `research`, `inbox`, and `you`

---

## Testing Rules

- Every milestone needs a milestone-local smoke plan
- Every new Product API endpoint needs an integration test
- Mobile IA changes need a real Android compile signal before closeout
- Deep-link changes need local routing proof now and Maestro/device proof in M4 once hardware is attached
- Phase 4 inherits the minimum regression set from Phase 3:
  - Register -> verify -> login
  - Latest Pulse loads
  - Deep Dive request -> retrieval works
  - Watchlist/Names CRUD works
  - Report history loads
  - Notification preferences still update
  - Push tap lands on a reachable screen

---

## Documentation Rules

- Root Phase 4 docs must stay consistent with `ADR-007-mobile-ia-v2.md`
- `PH4_SCREEN_MAPPING.md` is the canonical ownership map for future navigation work
- Milestone-local docs must distinguish local proof from pending device proof
- Any unresolved question about alert quieting or tuning semantics must be written plainly in deferrals rather than quietly implemented

---

## Closure Rule

A Phase 4 milestone is done only when all of these are true:

1. The new milestone acceptance criteria pass
2. The impacted earlier-phase behaviors still pass
3. The milestone-local AGENTS file is updated with smoke results, decisions, and deferrals
4. The milestone-local smoke plan has executable evidence paths
5. Device-dependent proof is either complete or explicitly recorded as pending with owner approval
