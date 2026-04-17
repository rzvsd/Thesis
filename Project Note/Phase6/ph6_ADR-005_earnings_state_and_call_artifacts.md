# Phase 6 ADR-005 - Earnings State And Call Artifacts

**Status:** Accepted  
**Date:** 2026-04-17  
**Milestone:** M0  

---

## Context

Earnings workflows previously depended on provider calendar assumptions and transcript availability. That is fragile because event timing can be estimated, confirmed, or actual, and transcript rights may not be clear.

---

## Decision

Phase 6 earnings workflows use a three-state event model:

- estimated,
- confirmed,
- actual.

War Room context is built from official filings, first-party release artifacts, slides, webcast references, and rights-safe summaries. Transcript text is optional and rights-gated.

---

## Consequences

- User-facing event timing must show uncertainty instead of pretending precision.
- War Room can open with incomplete but honest evidence.
- Post-event workflows can update event state and artifact completeness without requiring a licensed transcript provider.

---

## Evidence Required

- M4 earnings-state contract validation.
- M4 pre-event and post-event state transition proof.
- M4 rights-safe call artifact retrieval proof.
