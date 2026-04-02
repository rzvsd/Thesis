# Thesis - Phase 3 Bluebook

**Version:** 1.0  
**Status:** Living Document  
**Last Revised:** 2026-04  
**Owner:** Platform Architect + Product Lead

> This document extends - it does not replace - the original `BLUEBOOK cld.md` from Phase 1 and `ph2_BLUEBOOK.md` from Phase 2.

---

## Table of Contents

1. [Phase 3 Mission](#1-phase-3-mission)
2. [Phase 3 Product Doctrine](#2-phase-3-product-doctrine)
3. [Architecture Interpretation](#3-architecture-interpretation)
4. [Phase 3 Product Systems](#4-phase-3-product-systems)
5. [Service Ownership Extensions](#5-service-ownership-extensions)
6. [Phase 3 Contract Guidance](#6-phase-3-contract-guidance)
7. [Phase 1 and 2 Compatibility Guardrails](#7-phase-1-and-2-compatibility-guardrails)
8. [Operational Risk Register](#8-operational-risk-register)
9. [Final Standard](#9-final-standard)

---

## 1. Phase 3 Mission

Phase 3 exists to make Thesis credible and repeatable as a product, not merely complete as a codebase.

The mission is to ensure that Thesis:

- earns trust from serious investors
- creates a recurring daily and weekly ritual
- has a premium tier that feels justified
- can be measured and improved quickly
- can survive a real beta and launch window

---

## 2. Phase 3 Product Doctrine

Phase 1 doctrine still applies:

- no financial advice
- no fabricated data
- no opaque output without evidence
- no mobile bypass of internal services

Phase 3 adds five non-negotiable doctrines:

1. **No trust theater.** Freshness, evidence, contradiction handling, and quality limits must be visible, not implied.
2. **No passive-product trap.** Today, Pulse, and notifications must explain why the user should care now.
3. **No premium without ongoing edge.** Paid value must feel like continuing intelligence, not just unlocked formatting.
4. **No analytics theater.** Dashboards count only if event semantics, owners, and decision use are defined.
5. **No launch by hope.** Launch must be gated by product, reliability, and learning evidence.

---

## 3. Architecture Interpretation

The three-plane architecture remains intact:

- Product Plane
- Reasoning Plane
- Data Plane

Phase 3 does not add a fourth plane.

Instead, it adds four cross-cutting product systems:

| System | Purpose | Primary Owners |
|---|---|---|
| **Trust System** | Makes intelligence outputs inspectable, current, and accountable | `dexter-worker`, `product-api`, `mobile` |
| **Lifecycle System** | Makes the product feel alive over time for the user's names | `scheduler`, `product-api`, `mobile` |
| **Growth System** | Measures activation, retention, conversion, churn, and content quality | `product-api`, `mobile`, `packages/observability` |
| **Launch System** | Makes release safety, support response, and go/no-go decisions explicit | `mobile`, `product-api`, infra, QA, Product Ops |

These are not separate services by default. They are cross-service responsibilities that must be wired through the existing stack.

---

## 4. Phase 3 Product Systems

### 4.1 Trust System

Every serious Deep Dive and derived notification should be able to answer:

- what changed
- what evidence supports that change
- how fresh the evidence is
- what is missing
- what conflicts with the current thesis
- why valuation is shown or omitted

Minimum trust behaviors:

- report freshness metadata
- evidence count and evidence-type visibility
- contradiction or conflict flags
- explicit degradation notes
- quote provenance
- revision or thesis-drift summary where a prior report exists

### 4.2 Lifecycle System

Thesis must evolve from static reading to longitudinal monitoring.

Minimum lifecycle behaviors:

- onboarding anchored around user names
- Today surfaces that prioritize "why this matters to my names"
- thesis-aware notification decisions
- pre-earnings and post-earnings ritual flows
- weekly summary that is personalized, not generic

**Locked ownership decision:**

- `product-api` owns persisted per-user followed-name monitor state
- `scheduler` owns timed recomputation and notification evaluation cadence
- `dexter-worker` does not own user-level monitor persistence
- monitor state is persisted in Postgres as `thesis_monitor_snapshots`
- monitor state is refreshed:
  - on new completed comparable Deep Dive for a followed name
  - on the weekday pre-market scheduler cycle

### 4.3 Growth System

Minimum measurable loops:

- activation
- first-value time
- report completion/read depth
- repeat opens
- notification engagement and disablement
- paywall exposure and conversion
- churn/cancel reasons
- trust complaints and product confusion feedback

**Locked operational decision:**

- support-relevant feedback is persisted first in Postgres through `product-api`
- the durable queue is the operational source of truth for human review
- Linear receives triaged follow-up issues from that queue; it is not the queue itself

### 4.4 Launch System

Minimum launch controls:

- stable real-device smoke evidence
- implemented e2e and load suites
- production-safe config and storage
- alerting on core failure paths
- support intake and issue triage
- go/no-go scorecard with explicit thresholds

---

## 5. Service Ownership Extensions

| Service | Phase 3 Must Own | Phase 3 Must Not Own |
|---|---|---|
| `dexter-worker` | Trust metadata generation, report quality evaluation hooks, thesis-drift logic, contradiction summaries | User entitlements, push delivery, analytics dashboards |
| `product-api` | Trust metadata serving, monitor state, premium gating semantics, feedback collection endpoints, launch-safe storage/config | LLM-authored report synthesis logic |
| `scheduler` | Notification timing, throttling, pre/post earnings rituals, digest generation cadence, monitor refresh scheduling | Deep Dive quality scoring or premium entitlement truth |
| `mobile` | Trust presentation, Today-loop UX, paywall UX, feedback UX, release-candidate behavior | Server-authoritative monetization or notification decision logic |
| `packages/observability` | Shared event naming and failure wiring | Product decision-making without owner review |
| Storage / infra | Durable artifacts, alerting, safe config, repeatable test infrastructure | User-facing business logic |

---

## 6. Phase 3 Contract Guidance

Phase 3 may require a small number of new or expanded contracts. The exact contract list is milestone-scoped, but the likely additions are:

| Contract Area | Purpose | Producer | Consumer |
|---|---|---|---|
| Report trust metadata | Freshness, contradiction, evidence, and valuation-trust fields | `dexter-worker` / `product-api` | `mobile` |
| Thesis monitor snapshot | Current state of followed names and what changed since last review | `product-api` / `scheduler` | `mobile` |
| Notification decision payload | Why a notification fired, what it references, and what screen it targets | `scheduler` / `product-api` | `mobile` |
| Feedback signal | User trust feedback, confusion feedback, cancel reason, report usefulness signal | `mobile` / `product-api` | analytics / Product |

**Locked storage decision:**

- `thesis_monitor_snapshots` and `user_feedback_queue` are Product API-owned Postgres tables
- monitor and feedback state must be queryable by Product, QA, and support workflows without relying on analytics exports

Rules:

- Do not add all of these up front unless the milestone truly needs them
- Version any report contract change deliberately
- Stored Phase 1 and Phase 2 reports must remain readable unless a migration plan is approved

---

## 7. Phase 1 and 2 Compatibility Guardrails

### Guardrail 1 - Deep Dive trust work must preserve Phase 2 reuse

If Phase 3 enriches reports with new trust metadata, shared report reuse and existing `/reports/:id` retrieval must still work.

### Guardrail 2 - Daily-loop work must preserve current Today, history, and push reachability

Phase 3 can reprioritize the experience, but it must not strand users away from current Pulse, Deep Dive, watchlist, or history flows.

### Guardrail 3 - Monetization work must preserve Phase 2 server-authoritative entitlement

No new premium experience may depend only on mobile-local assumptions.

### Guardrail 4 - Hardening work must close real launch gaps, not create more owner-approved placeholders

If a launch blocker remains open, it must be named as a blocker and tracked as such.

---

## 8. Operational Risk Register

| Risk | Why It Matters | Phase 3 Expectation |
|---|---|---|
| Generic report language | Damages trust faster than small bugs | M1 evaluation and trust metadata must catch it |
| Low-signal notifications | Causes opt-outs and habit collapse | M2 must add explanation, throttling, and quality tracking |
| Premium value ambiguity | Reduces conversion and increases churn | M3 must clarify value ladder and measure it |
| Dev-grade config in release path | Creates embarrassing launch failures | M4 must remove it or block release |
| Weak real-device proof | Makes launch-week regressions likely | M4 and M5 must require repeated evidence |
| Dashboard theater | Teams think they are learning when they are not | M3 and M5 must require event owners and review loops |

---

## 9. Final Standard

Phase 3 is successful only if the product is not merely richer, but more believable.

The final standard is:

- a user can tell what changed and why it matters
- a serious user can inspect the product's confidence and limits
- a returning user has a reason to come back tomorrow
- a free user can feel the edge of the premium tier clearly
- the team can see failures, measure behavior, and decide whether to launch with evidence
