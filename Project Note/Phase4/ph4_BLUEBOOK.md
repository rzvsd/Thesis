# Thesis - Phase 4 Bluebook

**Version:** 1.0  
**Status:** Living Document  
**Last Revised:** 2026-04  
**Owner:** Platform Architect + Product Lead

> This document extends - it does not replace - the original `BLUEBOOK cld.md`, `ph2_BLUEBOOK.md`, and `ph3_BLUEBOOK.md`.

---

## Table of Contents

1. [Phase 4 Mission](#1-phase-4-mission)
2. [Phase 4 Product Doctrine](#2-phase-4-product-doctrine)
3. [Architecture Interpretation](#3-architecture-interpretation)
4. [Phase 4 Product Systems](#4-phase-4-product-systems)
5. [Service Ownership Extensions](#5-service-ownership-extensions)
6. [Phase 4 Contract Guidance](#6-phase-4-contract-guidance)
7. [Compatibility Guardrails](#7-compatibility-guardrails)
8. [Operational Risk Register](#8-operational-risk-register)
9. [Final Standard](#9-final-standard)

---

## 1. Phase 4 Mission

Phase 4 exists to make the product map match the product intent.

The mission is to ensure that Thesis:

- makes daily priorities visible
- gives followed names their own monitoring surface
- gives alerts a transparent history
- keeps controls in one predictable place
- preserves the Thesis aesthetic while changing structure

---

## 2. Phase 4 Product Doctrine

Earlier doctrines still apply:

- no fabricated data
- no mobile bypass of internal services
- no opaque output without evidence

Phase 4 adds four non-negotiable doctrines:

1. **No IA theater.** A new tab bar that still hides core behaviors in the wrong place is failure.
2. **No visual drift.** Color, typography mood, and card language stay recognizably Thesis.
3. **No local-only alert history.** Inbox belongs to Product API persistence.
4. **No route ambiguity.** Today, Names, Research, Inbox, and You each own a stable product responsibility.

---

## 3. Architecture Interpretation

The three-plane architecture remains intact.

Phase 4 does not add new services by default.

Instead, it formalizes two cross-cutting product systems:

| System | Purpose | Primary Owners |
|---|---|---|
| **Navigation System** | Keeps top-level ownership, deep links, and exact-screen landing explicit | `mobile`, `product-api` |
| **Alert Ledger System** | Makes alerts durable, inspectable, filterable, and feedback-aware | `product-api`, `mobile`, `packages/contracts` |

---

## 4. Phase 4 Product Systems

### 4.1 Navigation System

The root ownership model is:

- Today -> global market context and current priorities
- Names -> per-ticker monitoring board
- Research -> full thesis and evidence workbench
- Inbox -> alert history and quality loop
- You -> account, controls, trust guidance, and feedback

### 4.2 Alert Ledger System

Alert ledger minimum fields:

- notification family
- category
- destination route
- title and body
- reason code and reason text
- delivery state
- optional feedback state
- optional mute timestamp
- context for ticker/report/date linkage

**Locked storage decision:**

- `product-api` owns the durable `alert_ledger`
- mobile consumes the typed API surface
- existing notification preferences remain the source of truth for category enable/disable state

---

## 5. Service Ownership Extensions

| Service | Phase 4 Must Own | Phase 4 Must Not Own |
|---|---|---|
| `product-api` | Alert ledger persistence, list/filter/feedback/mute endpoints, route payload semantics | Visual IA decisions that belong in mobile |
| `mobile` | Five-tab shell, exact route landing, copy centralization for new IA surfaces, preserved theme | Server-authoritative alert history or category truth |
| `packages/contracts` | Typed alert-ledger contracts and route targets | Mobile-only presentation helpers |
| `scheduler` | Continue invoking notification families through existing flows | Persisting alert history outside Product API |
| `infra` | Migration support for the alert ledger table | User-facing business logic |

---

## 6. Phase 4 Contract Guidance

Likely contract additions for Phase 4:

| Contract Area | Purpose | Producer | Consumer |
|---|---|---|---|
| Alert ledger item | Durable user-visible alert record | `product-api` | `mobile` |
| Alert list/filter response | Inbox list/filter retrieval | `product-api` | `mobile` |
| Alert feedback submission | Quality loop on individual alerts | `mobile` | `product-api` |
| Route targets | Exact landing semantics for alert-driven navigation | `product-api` | `mobile` |

Rules:

- Keep additions additive
- Do not replace notification preferences with alert-ledger state
- Do not add per-name mute semantics without an explicit product decision

---

## 7. Compatibility Guardrails

1. **Notification preferences remain valid.** Phase 4 adds Inbox history; it does not break existing family toggles.
2. **Today stays reachable.** Market Pulse and weekly digest flows remain first-class.
3. **Research stays canonical.** Deep Dive and history remain the evidence workbench.
4. **Watchlist compatibility holds.** Names may change presentation, but underlying watchlist CRUD keeps working.
5. **Push taps stay safe.** Every old and new route must land on a reachable screen.

---

## 8. Operational Risk Register

| Risk | Why It Matters | Phase 4 Expectation |
|---|---|---|
| 5-tab shell without ownership discipline | Users still hunt through the app despite more tabs | Screen mapping and milestone smoke must prove clear ownership |
| Inbox backed only by mobile-local state | Alert history becomes incomplete and unauditable | Product API-owned ledger is mandatory |
| Copy drift across new surfaces | Tone and trust posture become inconsistent | IA-level copy is centralized and reviewed together |
| Push routes diverge from tab ownership | Notification taps strand users or open weak fallback screens | Route targets and landing rules are verified in local proof and device proof |
| Quieting semantics drift | Settings and Inbox controls become misleading | Existing notification-family truth stays authoritative until owner decides on broader tuning |

---

## 9. Final Standard

Phase 4 is successful only if the product is not merely reorganized, but clearer.

The final standard is:

- users can tell where to act now
- users can inspect why an alert fired
- followed names feel actively monitored
- controls live in one stable place
- the product still feels like Thesis when the new structure ships
