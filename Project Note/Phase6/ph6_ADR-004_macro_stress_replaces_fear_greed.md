# Phase 6 ADR-004 - Macro Stress Replaces Fear & Greed

**Status:** Accepted  
**Date:** 2026-04-17  
**Milestone:** M0  

---

## Context

The old Fear & Greed surface implied quote-led market sentiment and provider-backed completeness. That no longer matches Phase 6 doctrine.

The app still needs a daily market-pressure explanation, but it must be honest about source quality and official inputs.

---

## Decision

Phase 6 replaces active Fear & Greed behavior with Macro Stress.

Macro Stress uses official macro inputs only and explains pressure through source-backed macro dimensions. Existing Fear & Greed history may remain readable only as clearly labeled archived history.

---

## Consequences

- Today can still show market context, but the first-class active surface becomes Macro Stress.
- Any old quote-led Fear & Greed dashboard must be removed, archived, or explicitly marked unsupported before M3 closes.
- Mobile copy must use Thesis language around official macro pressure, what changed, what matters to names, and no material change.

---

## Evidence Required

- M3 Macro Stress snapshot contract and tests.
- M3 mobile/API smoke proving active Fear & Greed is no longer first-class provider-dependent behavior.
- M3 briefing output showing official macro provenance and omissions.
