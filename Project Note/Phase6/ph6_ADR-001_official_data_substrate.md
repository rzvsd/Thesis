# Phase 6 ADR-001 - Official Data Substrate

**Status:** Accepted  
**Date:** 2026-04-17  
**Milestone:** M0  

---

## Context

Earlier phases used provider-shaped data paths to prove product value quickly. That was useful for learning, but it leaves Phase 6 with cost, rights, fragility, and reproducibility risk.

Phase 6 needs a substrate that can survive without paid market-data keys or personal-use wrappers.

---

## Decision

Thesis core company and macro truth will move to official/public-source data paths.

The initial approved source families are:

- SEC / EDGAR / XBRL / filing exhibits for company truth.
- Federal Reserve / Treasury rates for rates and yield context.
- BLS for inflation and labor context.
- BEA for growth context.
- EIA for energy context where applicable.

Deprecated providers may be mentioned in migration docs and historical evidence, but they must not be required by protected production paths.

---

## Consequences

- Missing fields are explicit omissions, not approximations.
- Official-source retrieval metadata becomes part of the trust model.
- Some quote-led or provider-only widgets may be reduced, replaced, or removed.
- `data-openbb` may keep its folder name during Phase 6, but its production meaning changes to official/public-source adapter boundary.

---

## Evidence Required

- M1 official-source fixtures.
- M1 no-provider-key smoke test.
- M5 final cutover proof that core Deep Dive and Scenario paths do not need deprecated provider keys.
