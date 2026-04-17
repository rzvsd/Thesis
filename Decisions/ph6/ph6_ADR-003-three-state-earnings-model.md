# ADR-003: Three-State Earnings Model

**Date:** 2026-04  
**Status:** Accepted  
**Deciders:** Product Lead, Platform Architect, Scheduler Owner

## Context

Without a paid earnings-calendar provider, Thesis must still support useful earnings workflows without pretending timing certainty it does not have.

## Decision

Earnings timing is modeled as `estimated`, `confirmed`, or `actual`, each with source and timestamp.

## Rationale

This allows the product to stay honest while still enabling War Room, alerts, and event windows.

## Consequences

### Easier

- clearer user-facing truth states
- compatible War Room and alert logic

### Harder

- UI and contracts must explicitly surface uncertainty
- cadence-based estimation logic needs documented rules

## Revisit Condition

Revisit only if Thesis later adds a rights-clean earnings calendar source that materially changes certainty semantics.
