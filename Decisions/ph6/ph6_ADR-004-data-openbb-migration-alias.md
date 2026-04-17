# ADR-004: Retain `data-openbb` as a Migration Alias

**Date:** 2026-04  
**Status:** Accepted  
**Deciders:** Engineering Lead, Platform Architect

## Context

The repo and earlier docs heavily reference the `data-openbb` service name, but Phase 6 repurposes that boundary away from provider-backed truth.

## Decision

The service/folder name `data-openbb` may remain during Phase 6 for migration continuity, but its production meaning changes to an official/public-source adapter boundary.

## Rationale

This reduces migration churn while preventing the naming decision from blocking the architecture cutover.

## Consequences

### Easier

- fewer refactors and fewer broken paths during the cutover

### Harder

- naming can confuse new contributors unless docs stay explicit

## Revisit Condition

Revisit after Phase 6 if the confusion cost becomes larger than the rename cost.
