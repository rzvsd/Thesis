# Deep Report Overhaul Acceptance

Status: Implemented
Last Revised: 2026-04-18

## Scope Delivered

- Added additive Deep Report presentation blocks to `AnalysisReport`:
  - `story_header`
  - `change_summary`
  - `visual_panels`
  - `explainers`
  - `watch_items`
  - `coverage_truth`
- Kept legacy `sections` as the proof layer and export/source-of-truth base.
- Added Product API and Dexter runtime validation for the new additive blocks.
- Added Dexter report shaping so fixture/live-compatible reports now produce story-first presentation data from deterministic context.
- Refactored Android Deep Dive rendering into a layered story surface:
  - Read This First
  - See The Story
  - Understand It
  - Check The Proof
- Preserved Thesis visual language:
  - dark/gold palette
  - serif editorial headings
  - monospace metadata labels
  - thin-border cards
  - no decorative/synthetic imagery
- Preserved old report readability when presentation fields are missing.
- Preserved offline-cache round trip for new presentation fields.

## Acceptance Criteria

- Non-technical reader can understand the core thesis before opening proof modules: Passed.
- Serious reader can still reach raw proof sections and evidence: Passed.
- Report feels company-specific through headline, why-now, what-changed, and watch items: Passed for deterministic fixture path.
- Missing inputs remain explicit through explainers and coverage truth: Passed.
- No visual panel is generated from fake data: Passed by deterministic panel generation and degraded omission behavior.
- Existing report payloads without new fields still deserialize and render: Passed.
- Mobile keeps same Thesis colors, typography, tone, and component style: Passed by reusing existing theme tokens and card language.

## Quality Evidence

- `corepack pnpm lint`: Passed.
- `corepack pnpm --filter @thesis/dexter-worker test`: Passed, 18 tests.
- `corepack pnpm --filter @thesis/product-api test`: Passed, 82 tests.
- Android unit/compile check with bundled Android Studio JBR:
  - `$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat :app:testDebugUnitTest --tests "com.thesis.mobile.model.ReportViewMapperTest" --tests "com.thesis.mobile.offline.OfflineJsonCodecTest"`
  - Passed.
- Device smoke:
  - `C:\Users\razva\AppData\Local\Android\Sdk\platform-tools\adb.exe devices`
  - Device visible: `R3CXA03J3LH`.
  - Debug app rebuilt/installed with local API base URL over USB reverse.
  - Seeded completed `AAPL` Deep Dive via `qa/maestro/scripts/seed-deepdive-story.mjs`.
  - `C:\Users\razva\.maestro\bin\maestro.bat test qa\maestro\flows\deepdive_story_seeded_history_e2e.yaml`: Passed.
  - Verified on phone: login, Research, History, seeded report open, `Read This First`, `See The Story`, `Understand It`, and `Check The Proof`.

## Notes

- The first implementation is presentation-aware through deterministic report shaping. Live LLM prompt wording can be upgraded next via LangSmith without changing the mobile contract.
- The current PDF export still uses the legacy export path. The in-app Deep Report is now story-led; premium 5-7 page PDF export remains a focused follow-up if we want the downloaded artifact to match the new reading experience.
- Real-device Maestro smoke passed against a seeded completed report. The generated `.maestro.env` contains temporary QA credentials and must remain uncommitted.
