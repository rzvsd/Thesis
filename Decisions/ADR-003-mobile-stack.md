# ADR-003: Mobile Stack Selection

**Date:** 2026-03  
**Status:** Decided — Kotlin (Native Android)  
**Needed before:** M7 (decide before M3 to avoid API design drift)  
**Deciders:** Engineering Lead, Founder

---

## Context

The product is Android-first in v1. The stack choice affects API payload design, release cadence, and future iOS expansion. Three options were evaluated:

| Option | Pros | Cons |
|---|---|---|
| **Kotlin Native** | Full Android platform access, best performance, official Google support | Android-only, separate iOS codebase later |
| **React Native** | Code sharing if iOS added, large ecosystem | Performance overhead, bridge complexity for financial data rendering |
| **Flutter** | Cross-platform, strong UI consistency | Dart ecosystem smaller, less mature financial UI libraries |

## Decision

**Kotlin Native Android.**

## Rationale

- Android-first is the explicit v1 commitment — no cross-platform overhead needed yet
- Financial data rendering (tables, charts, dense report text) performs best with native views
- Kotlin is the standard for new Android development — hiring and tooling are well-established
- When iOS is added (post-launch), a separate Swift codebase is acceptable given the product's complexity

## Consequences

- `apps/mobile/` is a Kotlin Android project
- Minimum supported Android version: **Android 8.0 (API level 26)** — covers ~95% of active Android devices
- API payloads must be designed for mobile consumption — no over-fetching
- iOS expansion requires a separate codebase — shared logic stays in `packages/` as REST contracts

## Revisit When

- iOS expansion is prioritized and cross-platform code sharing becomes a material cost concern
