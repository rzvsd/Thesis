# Phase 6 Global Overrides for Existing Thesis Docs

**Purpose:** This note lists the repo-wide document changes required so the existing documentation no longer contradicts Phase 6.

This is not a replacement for `ph6_BLUEBOOK.md`. It is the implementation checklist for harmonizing older docs that still assume OpenBB, paid market-data providers, quote-first Pulse behavior, or rights-ambiguous transcript/news paths.

---

## 1. `BLUEBOOK cld.md`

### Must change

1. **System Planes / Core Stack / Service Catalog**
   - Replace `data-openbb` description from “OpenBB / provider abstraction” to “official/public-source adapter boundary.”
   - Keep the service boundary if needed for migration continuity, but remove wording that treats OpenBB as production truth.

2. **Product Surfaces → Market Pulse**
   - Replace quote-led wording such as “market and index moves (via OpenBB)” with a public-source-first definition:
     - official macro releases
     - watched-name disclosure changes
     - first-party company context
     - bounded allowlisted headlines / summaries / links
   - If quote-derived sections remain in contract form, make them optional and explicitly degradable.

3. **Source-of-Truth Hierarchy**
   - Replace “structured market/macro data from the governed OpenBB path” with official macro truth + canonical disclosure events + bounded context.

4. **Dependency Risk Register**
   - Remove OpenBB provider-risk framing as the expected long-term path.
   - Add risks for:
     - rights-aware text storage
     - IR-site parser drift
     - earnings-state ambiguity
     - macro-revision handling

5. **Contract examples**
   - Remove examples that imply production provider values such as `fmp` and `polygon` as defaults.
   - Make provider values public-source compatible.

### Optional rename later

- Keep `apps/data-openbb/` temporarily if repo churn is not worth it now.
- When migration is complete, optional rename to `apps/data-public/`.

---

## 2. `README.md`

### Must change

1. **Architecture in One Paragraph**
   - Remove “OpenBB provides market and macro data for Market Pulse.”
   - Replace with official/public-source data plane language.

2. **Core Stack table**
   - Remove OpenBB as a named core dependency.
   - Replace with either:
     - `data-openbb` (temporary service name) — official/public-source adapter boundary, or
     - `data-public` if the rename has been completed.

3. **Milestone descriptions**
   - Any line that still says “OpenBB + news-ingest-powered” should be marked legacy or updated to the Phase 6 interpretation.

---

## 3. `PRD.md`

### Must change

1. **Legal and Compliance Boundaries → Data sourcing**
   - Remove the implication that Market Pulse depends on regulated providers via OpenBB as a permanent product requirement.
   - Replace with official macro + first-party company context + allowlisted bounded context.

2. **Market Pulse description**
   - Shift from “what moved” in a quote-board sense toward “what changed that matters” through macro, disclosure, and watched-name context.
   - Keep the user value intact; change the substrate.

3. **Edge cases**
   - Add explicit truth state for missing quote-derived inputs.
   - Add explicit truth state for estimated vs confirmed earnings timing.

4. **Non-functional requirements**
   - Remove any implied real-time or near-real-time quote expectation not supported by licensed data.

---

## 4. `AGENTS.md`

### Must change

1. **Pinned dependency record — OpenBB**
   - Mark as deprecated / migration-out path.
   - Replace the current language that says OpenBB is the primary Market Pulse source.

2. **System boundaries**
   - Replace references to OpenBB with the public-source adapter boundary.

3. **When to stop and flag**
   - Add a Phase 6-era flag rule: any introduction of a paid market-data API, personal-use data source, or broad transcript/news corpus requires explicit ADR review.

---

## 5. `MILESTONES.md`

### Must change

1. **M2 Data Plane**
   - Rewrite the milestone as a public-source data plane milestone rather than `data-openbb` + provider-key milestone.
   - Remove acceptance criteria that depend on provider API keys.
   - Replace with SEC / official macro / allowlisted context fixtures.

2. **M6 Market Pulse**
   - Rewrite the inputs from “OpenBB + news-ingest” to:
     - official macro release inputs
     - canonical disclosure events
     - first-party context inputs
     - bounded allowlisted context items

3. **M9 Hardening**
   - Replace “block data-openbb outbound connections” with outage tests appropriate to the new official/public-source adapters and first-party ingest paths.

### Important note

Older milestone text can remain archived for historical accuracy, but it must be labeled as superseded if retained.

---

## 6. `ROADMAP.md`

### Must change

- If the roadmap is still the active planning map, add a Phase 6 note that the architecture is being finalized around official/public sources and migration away from provider-backed market-data assumptions.
- If Phase 6 is truly the last phase, state that clearly.

---

## 7. `ph2_BLUEBOOK.md`

### Must change

1. **Deterministic DCF**
   - Remove beta-from-`data-openbb` as a required input.
   - Replace with a thesis-native discount-rate framework using official rates + explicit internal risk surcharges.

2. **Historical / transcript strategy**
   - Remove any assumption that transcript corpora are a stable commercial default.
   - Replace with first-party `call_artifacts` framing, transcript optional.

3. **Fear & Greed architecture**
   - Remove yfinance-dependent inputs.
   - Either deprecate the feature or replace it with official-only Macro Stress.

4. **Calendar data**
   - Replace provider-backed calendar assumptions with a three-state earnings-event model: `estimated`, `confirmed`, `actual`.

---

## 8. `ph3_BLUEBOOK.md`, `ph4_BLUEBOOK.md`, `ph5_BLUEBOOK.md`

### Mostly compatible

These phases are directionally compatible and should largely remain.

### Must still update references where needed

- Any reference to “existing signal sources” should exclude deprecated paid/provider assumptions.
- Any feature that implicitly needs quote precision should be relabeled, degraded, or redefined.
- War Room, Exception Briefing, Freshness, Cross-Name, and Scenario flows should inherit Phase 6 substrate rules.

---

## 9. Naming rule for migration

Until the repository rename is worth the churn:

- **folder/service name may remain:** `data-openbb`
- **production meaning must become:** official/public-source adapter boundary

Do not let the migration stall because of naming perfection.

---

## 10. Minimum governance rule

After Phase 6, no document may casually reintroduce:

- OpenBB as a production dependency
- FMP, Polygon, Alpha Vantage, or similar as default truth
- yfinance as a product dependency
- unlicensed transcript corpora as core product substrate
- full-text publisher warehousing without explicit rights review

Any exception requires a new ADR.
