# ADR-006: Transcript Policy and Call-Artifacts Preference Order

**Date:** 2026-04  
**Status:** Accepted  
**Deciders:** Product Lead, Platform Architect, Legal Review Placeholder

## Context

Transcript text is useful, but open or scraped transcript corpora do not provide a clean default commercial posture for Thesis.

## Decision

Phase 6 treats transcripts as optional and rights-gated. The preferred evidence order for earnings workflows is: filed releases and exhibits, first-party slides, first-party call references, and only then transcript text if the provenance is acceptable.

## Rationale

This preserves product usefulness without making transcript rights the blocker for core value.

## Consequences

### Easier

- safer War Room and Deep Dive evidence packs
- less dependency on large transcript stores

### Harder

- some management-commentary richness may be thinner where transcript rights are absent

## Revisit Condition

Revisit if Thesis secures a rights-clean transcript source with a commercial posture aligned to the product.
