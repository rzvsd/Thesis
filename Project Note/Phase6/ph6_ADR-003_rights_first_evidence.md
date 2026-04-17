# Phase 6 ADR-003 - Rights-First Evidence And First-Party Context

**Status:** Accepted  
**Date:** 2026-04-17  
**Milestone:** M0  

---

## Context

Thesis needs better context than raw filings alone, but news articles, transcripts, and broad crawls carry rights and redistribution risk.

The product should become more trustworthy without storing unsafe full text.

---

## Decision

Every Phase 6 evidence or context item must carry explicit rights and provenance metadata before it can become user-facing.

First-party context starts from allowlisted issuer domains and page types. Unknown domains default to reject. Broad crawling is not allowed.

Transcript text is optional and rights-gated. Release artifacts, slides, filings, and webcast references come first.

---

## Consequences

- Evidence may display as summary, excerpt, link-only, or blocked according to rights state.
- Context ingestion becomes narrower but safer.
- War Room and Deep Dive must remain useful even when transcript text is unavailable.

---

## Evidence Required

- M2 source registry.
- M2 rights contract validation.
- M2 disallowed-domain rejection proof.
- M4 call artifact completeness proof.
