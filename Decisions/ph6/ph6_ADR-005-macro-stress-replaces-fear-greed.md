# ADR-005: Macro Stress Replaces Fear & Greed

**Date:** 2026-04  
**Status:** Accepted  
**Deciders:** Product Lead, Platform Architect

## Context

Earlier phases described a fear-and-greed-style signal that depended on quote-heavy or rights-ambiguous inputs.

## Decision

Phase 6 deprecates Fear & Greed and replaces it with Macro Stress built only from approved official inputs.

## Rationale

Macro Stress is more legally defensible, easier to explain, and more compatible with the official-source-first Thesis architecture.

## Consequences

### Easier

- lower dependency risk
- clearer provenance

### Harder

- product copy and user expectation need to shift away from terminal-style sentiment framing

## Revisit Condition

Revisit only if a licensed input set or a different product doctrine makes a sentiment-style index necessary again.
