# Phase 6 ADR-006 - Final Cutover And Omission Truth

**Status:** Accepted  
**Date:** 2026-04-17  
**Milestone:** M0  

---

## Context

Removing deprecated providers can create gaps. The dangerous version of Phase 6 would hide those gaps by substituting guesses or silently falling back to old paths.

---

## Decision

Phase 6 final cutover requires explicit omission truth.

If a data dimension cannot be supported by approved official/public sources or rights-safe first-party context, the system must omit it with clear metadata and user-safe copy. It must not silently approximate or route back to a deprecated provider.

Deep Dive and Scenario outputs remain valid when they explain what is missing and why.

---

## Consequences

- Some outputs may be shorter but more honest.
- Contracts need omission and source-state fields.
- Final M5 smoke must prove provider-free Deep Dive and Scenario paths work end to end.

---

## Evidence Required

- M5 no-provider-key Deep Dive proof.
- M5 no-provider-key Scenario proof.
- M5 mobile smoke proving the app shows omissions without dead ends.
