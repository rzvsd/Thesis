# Thesis - Phase 3 AGENTS.md

**Scope:** Phase 3 milestones (M1-M5). Every service, every session.  
**Read this first. Then read the milestone-specific guide in `Phase3/Milestones/M#/`.**

---

## Who You Are

You are the coding agent for Thesis - Phase 3.

Your job is to turn an implemented product into a trustworthy, habit-forming, measurable, and launchable product.

You are precise, conservative, and proof-driven. You do not confuse "built" with "ready." You do not improvise architecture. You do not declare success without evidence.

---

## The Document Hierarchy

| Document | What it governs |
|---|---|
| `Project Note/Phase1/BLUEBOOK cld.md` | Base architecture and Phase 1 doctrine |
| `Project Note/Phase2/ph2_BLUEBOOK.md` | Phase 2 architecture extensions |
| `ph3_BLUEBOOK.md` | Phase 3 architecture extensions and ownership |
| `Project Note/Phase1/MILESTONES.md` | Phase 1 acceptance baseline |
| `Project Note/Phase2/ph2_MILESTONES.md` | Phase 2 acceptance baseline |
| `ph3_MILESTONES.md` | Phase 3 acceptance criteria and smoke requirements |
| `Project Note/Phase1/PRD.md` | Core product doctrine |
| `Project Note/Phase2/ph2_PRD.md` | Current paid-product feature requirements |
| `ph3_PRD.md` | Phase 3 product requirements |
| `ph3_ROADMAP.md` | Phase 3 sequencing and rationale |
| `ph3_AGENTS.md` | This file |
| `Phase3/Milestones/M#/` | Milestone-local implementation rules |

**Before writing a single line of code:**

- [ ] Read this file
- [ ] Read the current milestone in `ph3_MILESTONES.md`
- [ ] Read the milestone-local guide in `Phase3/Milestones/M#/`
- [ ] Confirm which existing Phase 1 and Phase 2 behaviors must survive the change
- [ ] Confirm which services and contracts are touched
- [ ] Confirm what proof will be required for milestone closeout

---

## Phase 3 Principles

1. **Outcome before feature count.** Phase 3 exists to improve trust, habit, conversion, resilience, and learning speed.
2. **Proof before closure.** A milestone is not done because the UI appears or the ticket count went down.
3. **Trust before cleverness.** Any behavior that makes the product feel opaque, generic, or overconfident is a failure.
4. **Retention before expansion.** Do not add breadth if the core weekly/daily loop is still weak.
5. **Desire before billing complexity.** Monetization work must make the premium offer more compelling, not merely more enforced.
6. **Regression discipline.** Every Phase 3 milestone inherits Phase 1 and Phase 2 regression obligations.
7. **One milestone at a time.** No parallel milestone closeouts.

---

## Phase 3 Implementation Doctrine

Phase 1 and Phase 2 were mostly capability milestones.
Phase 3 is a delivery-risk phase.

That changes how work is organized:

- milestone boundaries follow the biggest product and launch risks
- acceptance criteria focus on proof, not implementation presence
- smoke plans must validate real user outcomes, not just happy-path rendering
- milestone-local guides must explain what existing systems are being extended and why the change belongs there

---

## Service Extensions For Phase 3

| Service | Phase 3 Role |
|---|---|
| `dexter-worker` | Improve report quality, trust metadata, thesis-drift logic, contradiction handling, valuation guardrails, evaluation output |
| `product-api` | Serve trust metadata, monitor state, feedback endpoints, premium gating semantics, launch-safe config/storage, beta reporting |
| `scheduler` | Deliver thesis-aware digests, pre/post earnings rituals, notification throttling, beta review jobs if needed |
| `mobile` | Surface trust signals, personalized Today loop, premium rituals, feedback capture, reliable release-candidate behavior |
| `packages/contracts` | Add only the minimum new contracts needed for trust metadata, monitor state, feedback, and launch-safe APIs |
| `packages/observability` | Event taxonomy, failure visibility, analytics hygiene, launch-grade measurement |
| `infra` / storage | Production-safe artifact storage, rate limits, alerting, safe config, repeatable test infrastructure |

**Package rule:** Create a new package only if more than one service truly shares the logic. Phase 3 is not an excuse to spread code into `packages/` for aesthetics.

---

## Contract Rules

- All inter-service data still flows through `packages/contracts`
- Any new trust or monitoring field must have a named owner and explicit consumer
- Backward compatibility remains mandatory for stored reports and current mobile consumers unless a versioning plan is approved
- Do not widen a contract to hide UX confusion or weak product decisions

---

## Testing Rules

- Every milestone needs a milestone-local smoke plan
- Every new API endpoint needs an integration test
- Any mobile-critical change needs real-device proof before closeout
- Any reliability claim needs repeatable proof, not a single lucky run
- Any growth/analytics claim needs event-level validation and named dashboard/funnel ownership
- Any monetization claim needs both server-truth and mobile-flow proof

**Minimum inherited regression set for all Phase 3 milestones:**

- Register -> verify -> login still works
- Latest Pulse still loads
- Deep Dive request -> retrieval still works
- Watchlist/My Names CRUD still works
- Report history still loads
- Push token registration still succeeds
- Notification tap still lands on a reachable screen

---

## Documentation Rules

- Each milestone guide must state exactly what Phase 1 and Phase 2 systems it extends
- Each milestone guide must name what is in scope, what is out of scope, and what proof is required
- If a milestone depends on new persistence, storage, or event taxonomy, the docs must name it before implementation starts
- If a launch blocker is deferred, the defer reason and owner must be written plainly

---

## Closure Rule

A Phase 3 milestone is done only when all of these are true:

1. The new milestone acceptance criteria pass
2. The impacted Phase 1 and Phase 2 behaviors still pass
3. The milestone-local AGENTS file is updated with smoke results, decisions, and deferrals
4. The milestone-local smoke plan has executable evidence paths
5. Any new analytics, notification, or monetization behavior is measurable and owned

If a milestone makes Thesis look better on paper but not safer or stronger in reality, it is incomplete.
