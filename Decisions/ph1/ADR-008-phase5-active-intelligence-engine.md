# ADR-008: Phase 5 Active Intelligence Engine

**Status:** Accepted  
**Date:** 2026-04-08  
**Owners:** Product Lead, Engineering Lead  
**Supersedes:** None  
**Depends On:** ADR-007 (Mobile IA V2)

---

## Context

Phase 4 delivered:

- stable 5-tab IA ownership
- server-backed alert ledger
- route-safe push/deep-link handling

The next product risk is weak recurrence outside event spikes. Users can still experience Thesis as periodic research rather than continuous intelligence.

---

## Decision

Phase 5 is established as an **Active Intelligence Engine** phase with seven ordered milestones:

1. M1 Kill-Switch Engine
2. M2 Thesis Freshness and Decay
3. M3 Morning Exception Briefing
4. M4 Earnings War Room
5. M5 Cross-Name Intelligence
6. M6 Conviction Intelligence
7. M7 Scenario Stress Cards

Locked doctrines:

- Exception-first output is mandatory.
- Every output must map to thesis context.
- Decay and staleness must be explicit product states.
- Cross-name propagation is a required intelligence behavior.
- No new services are introduced in this phase.
- UI/UX changes must preserve the same Thesis colors, typography, tone, and component style.

---

## Service Boundary Decision

Phase 5 uses existing services only:

- `product-api`
- `scheduler`
- `dexter-worker`
- `news-ingest`
- `packages/contracts`
- `apps/mobile/android`

No new standalone intelligence service is approved for this phase.

---

## Contract Direction

Contract additions are additive and typed.  
Existing notification preference and alert-ledger compatibility must be preserved.

---

## Operational Defaults (Locked)

- Earnings War Room live cycle runs at `15 min` by default.
- War Room live cycle may auto-fallback to `30 min` during degradation or queue-pressure conditions.
- Cross-name propagation requires minimum confidence `0.70` for alert emission by default.
- Relationship edges below `0.70` remain stored/queryable but do not emit propagated alerts by default.

---

## Consequences

Positive:

- faster delivery using existing operational surfaces
- lower integration risk from no service sprawl
- stronger explainability via persistent rule and event records

Negative:

- higher orchestration load in existing services
- stronger test and observability requirements to avoid hidden drift

---

## Follow-Up ADR Expectations

The following may require dedicated ADRs if scope expands:

- per-category and per-name alert policy model evolution
- scenario-template governance and customization policy
- conviction intelligence scoring policy for premium gating
