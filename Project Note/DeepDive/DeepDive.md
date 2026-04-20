# Deep Report Overhaul Plan

## Summary
Redesign the Deep Dive into a layered, story-led research surface that is visually rich, easy to read for non-technical users, and still rigorous enough for Thesis. The report will keep the current Thesis visual language, but shift from “accordion sections + raw blocks” to a three-layer reading model:

1. `Read This First`: thesis, why now, what changed, and the one-screen takeaway  
2. `See The Story`: data-native visuals, stat cards, timelines, ranges, and change panels  
3. `Check The Proof`: existing detailed modules, evidence, notes, scenario, and exports

This is a Deep Report-only overhaul. We keep the current Research entrypoint and report pipeline, but add presentation-ready report blocks so the mobile app no longer has to infer the story from generic sections.

## Key Changes
### 1. Report generation becomes presentation-aware
Add additive Deep Report presentation blocks to the `AnalysisReport` contract and populate them in `dexter-worker` and `product-api` without removing existing `sections`.

New additive report blocks:
- `story_header`
  - `headline`
  - `thesis_summary`
  - `why_now`
  - `reader_takeaway`
  - `stance_label`
- `change_summary`
  - `previous_view`
  - `current_view`
  - `top_changes[]` with `title`, `direction`, `impact_level`, `why_it_changed`, `why_it_matters`
- `visual_panels[]`
  - ordered list of typed panels for mobile rendering
  - supported types locked to:
    - `metric_delta`
    - `timeline`
    - `range_band`
    - `trust_scorecard`
    - `evidence_ladder`
    - `valuation_bridge`
    - `scenario_compare`
- `explainers`
  - plain-language text for `signal`, `confidence`, `freshness`, `valuation`, and `omissions`
- `watch_items[]`
  - short “what to monitor next” bullets
- `coverage_truth`
  - explicit explanation of what is covered, what is missing, and why

Rules:
- These blocks are additive and backward-compatible.
- Existing `sections` remain the canonical proof layer and export source.
- No decorative or synthetic imagery is introduced.
- All visuals must be derived from real report data already present or deterministically computed.
- Missing inputs produce explicit omission panels, never fake visuals.

### 2. Dexter writing is upgraded from “assembled” to “authored”
Change Deep Report prompting/output shaping so the LLM produces a stronger editorial spine instead of only section bodies.

Locked writing behavior:
- Open with one sharp company-specific thesis, not a generic summary.
- Make `what changed since last thesis` the central narrative engine.
- Use plain-English prose with financial meaning explained for non-experts.
- Keep explanation density “balanced”: all core blocks explain themselves, lower proof modules stay concise.
- Core narrative blocks must answer:
  - what this is
  - what changed
  - why it matters
  - what is missing or uncertain
- Avoid repeated template phrasing across companies.
- Use evidence-backed storytelling, not speculative flourishes.

Deterministic logic stays deterministic:
- signal gating
- freshness
- valuation math
- omission detection
- scenario math

The LLM narrates those outputs; it does not decide them.

### 3. Mobile Deep Dive becomes a layered story screen
Refactor `DeepDiveScreen.kt`, `ReportViewMapper.kt`, and `Models.kt` so the report renders in this exact order:

1. Hero header
- ticker
- stance badge
- headline
- one-sentence thesis summary
- “why now” line

2. Read This First
- reader takeaway card
- top 3 changes card stack
- what to watch next

3. See The Story
- trust/freshness scorecard
- change visuals
- valuation range / bridge
- evidence ladder
- scenario compare panel when available
- timeline when prior thesis / historical comparison exists

4. Understand It
- plain-language explainer cards:
  - signal
  - confidence
  - valuation
  - freshness
  - omissions

5. Check The Proof
- current section accordions retained, but visually demoted below the story layer
- evidence list stays here
- notes / scenario inputs / feedback / export remain below proof

Rendering rules:
- Use same Thesis colors, borders, serif headings, and writing tone.
- Remove the current feeling of “random cards + accordions.”
- Keep the screen as one continuous scroll, not a tab explosion.
- Use data-native visual cards that feel editorial, not dashboard-noisy.
- Favor readable cards, deltas, bands, and timelines over dense charts.
- If a visual cannot be honestly rendered, replace it with a compact omission/explanation card.

### 4. Presentation component system
Create a small Deep Report presentation layer in mobile, not one-off screen code.

New component families:
- `StoryHeaderCard`
- `TopChangeCard`
- `TrustScorecard`
- `MetricDeltaPanel`
- `TimelinePanel`
- `RangeBandPanel`
- `EvidenceLadderPanel`
- `ValuationBridgePanel`
- `ExplainerCard`
- `CoverageTruthCard`

Component policy:
- Reuse current theme tokens and card language.
- Centralize Deep Report copy labels in resources/constants instead of inline strings where practical.
- Do not introduce a second visual language just for Deep Dive.

## Public Interfaces / Type Changes
Additive contract changes in [analysis-report.ts](</C:/BOTS/Thesis/fintech/packages/contracts/src/analysis-report.ts>) or a tightly related additive companion contract:
- `story_header`
- `change_summary`
- `visual_panels`
- `explainers`
- `watch_items`
- `coverage_truth`

Mobile type additions in [Models.kt](</C:/BOTS/Thesis/fintech/apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt>):
- presentation view models matching those additive blocks
- typed visual panel variants instead of generic map-like parsing

Mapper changes in [ReportViewMapper.kt](</C:/BOTS/Thesis/fintech/apps/mobile/android/app/src/main/java/com/thesis/mobile/model/ReportViewMapper.kt>):
- parse new additive fields
- preserve legacy fallback behavior when new fields are absent
- continue mapping legacy `sections`

Pipeline changes in [pipeline.ts](</C:/BOTS/Thesis/fintech/apps/dexter-worker/src/pipeline.ts>):
- generate story-first report blocks from existing deterministic context
- rank top changes and evidence
- produce plain-language explainers and coverage truth

Screen changes in [DeepDiveScreen.kt](</C:/BOTS/Thesis/fintech/apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt>):
- replace current top-of-report composition with the layered story layout
- move accordions into the proof layer

## Test Plan
### Contract / backend
- Validate new `AnalysisReport` additive fields with schema tests.
- Verify old reports without new fields still deserialize and render.
- Verify `change_summary` and `visual_panels` are populated for:
  - full-data report
  - partial-data report
  - no-comparable-thesis report
  - valuation-degraded report
- Verify `coverage_truth` and omissions are explicit when data is sparse.

### Dexter / generation
- Snapshot tests for company-specific story blocks on at least `AAPL`, `MSFT`, `TSLA`.
- Assert thesis headline, why-now summary, and top-changes are non-empty and non-generic.
- Assert no visual panel is emitted without sufficient underlying data.
- Assert degraded live mode still produces honest omission/explainer blocks instead of fake presentation.

### Mobile
- Mapper unit tests for new presentation blocks and legacy fallback.
- UI tests for:
  - full story render
  - sparse/degraded report render
  - legacy report render
  - valuation omission render
- Real-device / Maestro smoke:
  - login
  - Research -> Deep Dive
  - run report
  - verify hero header, top changes, at least one visual panel, and proof section all render

### Acceptance scenarios
- A non-technical user can understand the report without opening accordions.
- A serious user can still reach raw evidence and proof modules below.
- The report feels company-specific, not template-cloned.
- No visual suggests precision unsupported by the underlying data.
- The design remains recognizably Thesis.

## Assumptions and Defaults
- Keep the redesign inside the current Deep Dive screen; no new top-level navigation is introduced.
- Keep existing `sections` as the durable proof layer and export base.
- “Image showing things” is implemented as in-app data-native visual panels, not decorative AI art, logos, or scraped publisher images.
- Same Thesis colors, typography, tone, and component style are preserved.
- No new external data provider is required for this overhaul.
- Balanced explanation means: full explainers for core story blocks, lighter copy for lower proof modules.
