# ADR-002: Rights-Aware Evidence and Bounded Text Storage

**Date:** 2026-04  
**Status:** Accepted  
**Deciders:** Platform Architect, Product Lead, Legal Review Placeholder

## Context

Phase 6 depends more heavily on first-party materials and bounded context items. The repo previously lacked a mandatory evidence-rights posture for all stored or displayed text.

## Decision

All evidence-bearing items must carry a rights class and display mode. Unknown-rights items are not production-safe evidence.

## Rationale

This prevents accidental redistribution or display behavior that exceeds the product's allowed posture.

## Consequences

### Easier

- clearer legal posture
- safer evidence rendering rules
- auditable source behavior

### Harder

- some legacy contracts need versioned evolution
- some convenient body-text storage patterns must be removed

## Revisit Condition

Revisit if Thesis signs a new content license with materially different display rights.
