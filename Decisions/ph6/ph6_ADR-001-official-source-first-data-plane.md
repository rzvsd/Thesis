# ADR-001: Official-Source-First Data Plane

**Date:** 2026-04  
**Status:** Accepted  
**Deciders:** Platform Architect, Product Lead, Engineering Lead

## Context

Thesis previously carried assumptions that provider-backed market-data paths could serve as the practical data backbone for the product. Phase 6 removes that assumption.

## Decision

The production core path will use official issuer truth, official macro truth, and first-party company context as the default substrate. Paid or rights-ambiguous market-data providers are removed from the production-critical core path.

## Rationale

This aligns legal safety, cost control, explainability, and shipping speed better than continuing to optimize around provider access.

## Consequences

### Easier

- lower recurring data cost
- cleaner source-of-truth hierarchy
- better explainability

### Harder

- some quote-heavy surfaces must be reduced or omitted
- event completeness shifts toward watched-name-first discipline

## Revisit Condition

Revisit only if a specific licensed provider solves a proven product gap that cannot be addressed with the Phase 6 substrate.
