# Thesis - Phase 5 Bluebook

**Version:** 1.0  
**Status:** Living Document  
**Last Revised:** 2026-04-10
**Owner:** Platform Architect + Product Lead

> This document extends `BLUEBOOK cld.md`, `ph2_BLUEBOOK.md`, `ph3_BLUEBOOK.md`, and `ph4_BLUEBOOK.md`.

---

## Table of Contents

1. [Phase 5 Mission](#1-phase-5-mission)
2. [Phase 5 Product Doctrine](#2-phase-5-product-doctrine)
3. [Architecture Interpretation](#3-architecture-interpretation)
4. [Phase 5 Intelligence Systems](#4-phase-5-intelligence-systems)
5. [Service Ownership Extensions](#5-service-ownership-extensions)
6. [Contract Guidance](#6-contract-guidance)
7. [Compatibility Guardrails](#7-compatibility-guardrails)
8. [Operational Risk Register](#8-operational-risk-register)
9. [Final Standard](#9-final-standard)

---

## 1. Phase 5 Mission

Phase 5 exists to make Thesis continuously useful even in quiet market periods.

The mission:

- monitor thesis fragility continuously
- surface only meaningful exceptions
- make conviction freshness explicit
- connect signals across related names
- transform user history into better future decisions

---

## 2. Phase 5 Product Doctrine

Earlier doctrines still apply:

- no fabricated data
- no mobile bypass of service boundaries
- no opaque output without explainable evidence

Phase 5 adds five non-negotiables:

1. **Exception-first output:** noise is failure.
2. **Thesis-native reasoning:** generic market facts without thesis relevance are insufficient.
3. **Decay visibility:** stale conviction must be explicit and actionable.
4. **Cross-name propagation:** relationship-aware alerts are core behavior, not optional.
5. **Learning accountability:** conviction timelines and retrospection are product primitives.
6. **No visual drift:** keep the same Thesis colors, typography, tone, and component style.

---

## 3. Architecture Interpretation

The three-plane architecture remains unchanged.

**No new services are introduced in Phase 5.**

Phase 5 extends behavior inside existing services:

- `product-api` for persistence and typed API surfaces
- `scheduler` for recurrent and event-window evaluation
- `dexter-worker` for extraction/synthesis prompts
- `news-ingest` and existing signal sources for event inputs
- `mobile` for user-facing command surfaces

---

## 4. Phase 5 Intelligence Systems

| System | Purpose | Primary Owners |
|---|---|---|
| Kill-Switch Rules System | Persist and evaluate thesis break conditions | `product-api`, `scheduler`, `dexter-worker` |
| Freshness and Decay System | Compute confidence freshness and review urgency | `product-api`, `scheduler`, `mobile` |
| Exception Briefing System | Personalized morning exceptions with explicit no-change outputs | `product-api`, `scheduler`, `mobile` |
| Earnings War Room System | Pre/live/post event operational intelligence | `product-api`, `scheduler`, `dexter-worker`, `mobile` |
| Cross-Name Propagation System | Relationship graph plus second-order signal alerts | `product-api`, `scheduler`, `dexter-worker` |
| Conviction Intelligence System | Journaling, coherence analysis, opposite-case workflow | `product-api`, `scheduler`, `dexter-worker`, `mobile` |
| Scenario Stress System | Portfolio-wide scenario evaluation and recommendations | `product-api`, `dexter-worker`, `mobile` |

---

## 5. Service Ownership Extensions

| Service | Phase 5 Must Own | Phase 5 Must Not Own |
|---|---|---|
| `product-api` | New durable models and typed endpoints for rules, freshness, relationships, journal, and scenarios | Prompt design internals that belong to Dexter |
| `scheduler` | Daily, monthly, and event-window evaluation orchestration, propagation cycles, retrospective cycles, and idempotent retries | Durable user state beyond job status and telemetry |
| `dexter-worker` | Rule extraction, relationship extraction, opposite-case and scenario reasoning prompts | Final user-preference authority or mutable control truth |
| `mobile` | Exception-first surfaces preserving Thesis visual language | Server-source-of-truth logic or fabricated local reconstructions |
| `packages/contracts` | Typed additive contracts for Phase 5 APIs and payloads | Feature logic |

---

## 6. Contract Guidance

Likely additive contract families:

- kill-switch rules and evaluations
- freshness states and decay metadata
- personalized exception briefing payloads
- War Room payloads
- name-relationship records
- conviction journal and coherence records
- opposite-case records linked to source reports
- scenario stress card outputs

Rules:

1. Contracts are additive and typed.
2. Existing alert-ledger and notification preference semantics remain compatible.
3. Missing signal inputs are explicit in payloads.
4. Every alert and recommendation has a resolvable reason path.

---

## 7. Compatibility Guardrails

1. Phase 4 tab ownership remains valid and stable.
2. Existing report, watchlist, and notification flows keep working while Phase 5 expands intelligence.
3. Push taps must always land on reachable context.
4. Rule evaluation degradation must remain truthful when data is missing.
5. Phase 5 cannot silently reframe subscription policy without explicit product decision.

---

## 8. Operational Risk Register

| Risk | Why It Matters | Required Control |
|---|---|---|
| Over-alerting from low-quality matching | Retention drops quickly if users are spammed | Exception gating, cooldowns, and usefulness feedback loops |
| Prompt drift in condition extraction | Rule quality degrades silently | LangSmith prompt versioning and replay checks |
| Ambiguous cross-name relationships | False propagation harms trust | Confidence thresholds and reason transparency |
| Stale scheduler jobs | Freshness and briefing credibility collapses | Job observability, retries, and idempotent writes |
| Hidden model uncertainty | Users over-trust weak inferences | Explicit confidence and missing-data fields |

---

## 9. Final Standard

Phase 5 is successful only if users can rely on Thesis to:

- tell them when something changed that matters
- reassure them when nothing material changed
- show how conviction quality is aging
- connect events across names with clear reason chains
- help them improve decision quality over time
