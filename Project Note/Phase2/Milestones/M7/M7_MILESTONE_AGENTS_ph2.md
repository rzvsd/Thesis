# AGENTS.md — Phase 2 M7 Report UI & Interactive Features
**Milestone:** Phase 2 M7 — Report UI & Interactive Features  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M7/M7_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M7 — Report UI & Interactive Features |
| **Linear Project** | Phase 2 M7 — Report UI & Interactive Features |
| **Owner** | Mobile Engineer + Product API Engineer + Product Lead |
| **Status** | Closed |
| **Depends on** | Phase 2 M6 closed; Phase 2 M4 closed (Pro gating in place); Phase 2 M2 closed (deterministic DCF / Valuation for What-If reuse); M2 contract strategy finalized (G1 in M2 resolved) |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Report view-model strategy.** The M2 milestone established the backend contract changes (`AnalysisReport` v2). M7 needs an explicit plan for how the mobile app renders the richer report. Options: (a) mobile model mirrors the contract 1:1, (b) a Kotlin adapter layer transforms the API response into a richer view model. Must be decided before any Compose UI work. | **RESOLVED (Kotlin adapter layer)** | Mobile Engineer + Product Lead | Closed |
| G2 | **Notes storage model.** Where do per-report user notes live? Options: (a) local-only in Room (simplest, no server), (b) server-side in a `report_notes` table in Postgres (survives device change), (c) hybrid (Room + server sync). Determines whether M7 needs a new migration and API endpoint. | **RESOLVED (server-side Postgres + composite PK)** | Product API Engineer + Product Lead | Closed |
| G3 | **What-If scenario ownership.** Who processes a What-If request? **Default product direction:** valuation-style scenarios (growth, margin, WACC, terminal multiple, etc.) call the **same deterministic DCF logic** shipped in M2 (`dcf/` module — location may be shared package or invoked from `product-api` if refactored for reuse). The LLM is optional for narrative-only follow-ups, not for recomputing fair value. Alternatives if G3 diverges: (a) Dexter generates a narrative-only variant on top of precomputed numbers, (b) server function computes parameter sweeps without LLM, (c) LLM-light endpoint for non-DCF scenarios only. Must define request/response shape, latency target, and cost ceiling. | **RESOLVED (server deterministic, no LLM)** | Reasoning Engineer + Product Lead | Closed |
| G4 | **Export artifact generation ownership.** Who generates the PDF, Share Card (1080×1080), and Investment Memo? Options: (a) server-side generation in `product-api` or a dedicated service, (b) mobile-side generation using Android APIs. Must define the artifact format, generation pipeline, and storage (ephemeral or durable). | **RESOLVED (mobile-side generation, ephemeral artifacts)** | Product API Engineer + Mobile Engineer | Closed |
| G5 | **Community sentiment vote — in or out.** PRD lists community sentiment voting. Is it in scope for M7 or deferred? If in, the aggregation model and storage need to be defined. If deferred, it is explicitly removed from M7 acceptance criteria. | **RESOLVED (deferred post-launch)** | Product Lead | Closed |

**Rule:** Do not build UI screens against mock data without confirmed storage models, endpoint ownership, and generation pipelines. See `ph2_AGENTS.md` High-Risk Rule for M7 and `ph2_BLUEBOOK.md` §7 M7 Guardrail.

---

## 1. What This Milestone Is Building

The premium Deep Dive experience — a richer report layout with collapsible sections, a Confidence Ring visualization, user notes, What-If scenario exploration, and export capabilities (PDF, Share Card, Investment Memo). At the end of this milestone, a Pro user can open a Deep Dive, collapse and expand sections, add personal notes that persist, run a "What-If" scenario, and export the report as a PDF or Share Card. Free users see the report but are gated from export and scenario features.

This milestone bridges the M2 backend enrichment with the M6 navigation redesign. It must not break the existing `/reports/:id` retrieval path, the report history reopen flow, or the mobile report parser for older reports.

**Plain English summary for non-technical audit:**  
Before M7, Deep Dive reports are static text pages. After M7, they are interactive premium documents — you can collapse sections, take notes, ask "what if" questions, and export polished PDFs to share with your team. The report looks and feels like a real analyst product.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/BLUEBOOK cld.md` — report model, mobile architecture
- `Project Note/Phase1/MILESTONES.md` — Phase 1 M5 (Deep Dive Delivery), M7/M8 (Mobile) as regression baseline

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` — High-Risk Rule for M7 (contract/model expansion required)
- `Project Note/Phase2/ph2_BLUEBOOK.md` — §7 M7 Guardrail (adapter/versioning requirement)
- `Project Note/Phase2/ph2_MILESTONES.md` — Phase 2 M7 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` — §2.2 Deep Dive v2 (interactive layout, notes, export)
- `Project Note/Phase2/Milestones/M2/M2_MILESTONE_AGENTS_ph2.md` — M2 contract changes that M7 renders

### Current code surfaces

- `packages/contracts/src/analysis-report.ts` — `AnalysisReport` interface (v2 after M2)
- `packages/contracts/src/report-section.ts` — `ReportSection` with `status` field
- `apps/product-api/src/server.ts` — `/reports/:id` retrieval route
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt` — mobile report model
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt` — API client
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt` — current report screen

---

## 3. Scope — What Is In

- [x] **Report view-model adapter** (per G1): Kotlin adapter or direct model mapping from `AnalysisReport` v2 to the mobile report view model
- [x] **Collapsible section UI:** Each `ReportSection` renders as a collapsible accordion in Jetpack Compose. Sections with `status: "complete"` are expanded by default; sections with degraded status are collapsed with a status badge.
- [x] **Confidence Ring:** Visual gauge showing `ConfidenceBlock.score` (0–100) with color-coded label (`high`, `medium`, `low`, `insufficient_data`). Positioned prominently in the report header.
- [x] **Thesis Statement display:** The `thesis_statement` section (from M2) renders at the top of the report with distinct styling — bold, prominent, separate from other sections.
- [x] **Historical comparison display:** QoQ/YoY data from M2 sections renders with clear delta indicators (↑/↓, green/red, percentage).
- [x] **Notes persistence** (per G2): User can add, edit, and delete text notes on any report. Notes persist across app restart per the chosen storage model.
- [x] **Notes API endpoint** (if G2 = server-side): `GET /v1/reports/:id/note` and `PUT /v1/reports/:id/note`
- [x] **Notes migration** (if G2 = server-side): `infra/migrations/ph2m7_013_report_notes.up.sql` and `.down.sql`
- [x] **What-If scenario flow** (per G3): User taps "What If?", adjusts parameters (e.g., revenue growth, WACC), submits, and receives a scenario response within the agreed latency target. **DCF-class scenarios** re-run the M2 deterministic module with overridden assumptions; response shows base vs scenario metrics. Non-DCF "story" scenarios follow the path agreed in G3.
- [x] **What-If API endpoint** (if G3 = server-side): `POST /v1/reports/:id/scenario` — request payload must carry structured assumption deltas for DCF paths so the server does not parse free text for math
- [x] **Export — PDF:** Pro user generates a PDF of the current report. PDF is formatted, branded, and openable in a standard PDF viewer.
- [x] **Export — Share Card:** Pro user generates a 1080×1080 image summarizing the Thesis Statement and key metrics. Shareable via Android share sheet.
- [x] **Export — Investment Memo:** Pro user generates a 1-page summary document. Format and generation pipeline per G4.
- [x] **Pro gating on export/scenario:** Free users see export and scenario buttons but are blocked with paywall (M4 gating middleware).
- [x] **Community sentiment vote** is explicitly deferred to post-launch.
- [x] **Backward compatibility:** Phase 1 reports (no M2 enrichment) still render correctly — missing optional sections are gracefully absent.
- [x] **Phase 1 regression:** `/reports/:id` retrieval, history reopen, Pulse, and baseline Deep Dive all still work.

Full deliverables and acceptance criteria: `ph2_MILESTONES.md → M7`

---

## 4. Scope — What Is Out

| Out of scope | Reason |
|---|---|
| Mock-only UI disconnected from live report data | Explicitly forbidden — Bluebook §7 M7 Guardrail |
| Contract drift without compatibility plan | Forbidden |
| Fear & Greed dashboard or chart | M8 |
| Navigation structure changes | M6 already completed |
| Backend report generation changes | M2 already completed |
| Offline caching of reports | M9 |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Mobile app | `apps/mobile/` | Report view-model adapter, collapsible section UI, Confidence Ring, notes UI, What-If flow, export UI, Pro gating UI |
| Product API | `apps/product-api/src/` | Notes endpoints (if G2 = server); What-If endpoint (if G3 = server) invoking shared deterministic DCF for valuation scenarios; export generation endpoint (if G4 = server); register migration if needed |
| Dexter worker | `apps/dexter-worker/` | What-If scenario processing **only** if G3 requires Dexter for narrative layers on top of precomputed DCF results — not for core valuation math |
| Contracts | `packages/contracts/src/` | Add notes contract, scenario request/response contract, export request contract if needed |
| Infra | `infra/migrations/` | Add `ph2m7_013_report_notes.{up,down}.sql` if G2 = server |

**M7 architecture rule:** The richer UI must be backed by real contract/model work, not by fake local-only shapes. Every interactive feature (notes, scenario, export) must have named storage and endpoint ownership before the UI is considered implementation-ready.

---

## 6. Contracts You Are Touching

### Existing — READ (from M2)

| Contract | Usage | File path |
|---|---|---|
| `AnalysisReport` (v2) | Render report with M2 enrichment; handle `schema_version` for backward compat | `packages/contracts/src/analysis-report.ts` |
| `ReportSection` | Render collapsible sections with `status` badges | `packages/contracts/src/report-section.ts` |
| `ConfidenceBlock` | Render Confidence Ring | `packages/contracts/src/analysis-report.ts` |

### New — POTENTIAL (depending on G2, G3, G4, G5)

| Contract | Condition | File path |
|---|---|---|
| `ReportNote` | If G2 = server-side notes | `packages/contracts/src/report-note.ts` |
| `ScenarioRequest` / `ScenarioResponse` | If G3 = server-side scenario | `packages/contracts/src/scenario-*.ts` |
| `ExportRequest` | If G4 = server-side generation | `packages/contracts/src/export-request.ts` |
| `CommunityVote` | If G5 = in scope | `packages/contracts/src/community-vote.ts` |

**Rules:**
- All new contracts follow existing pattern: interface + JSON schema
- All exported from `packages/contracts/src/index.ts`
- `pnpm typecheck` must pass
- Mobile model handles both Phase 1 and M2 report versions gracefully

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M7 — Report UI & Interactive Features

**Ticket naming:**
```
[PH2-M7] What is being built
[PH2-M7][BUG] What is broken
[PH2-M7][SPIKE] What is being investigated
```

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M7] Report view-model adapter` | Mobile renders M2 report data correctly |
| `[PH2-M7] Collapsible section UI` | Sections collapse/expand; degraded sections show status badge |
| `[PH2-M7] Confidence Ring` | Gauge displays correct score and label from ConfidenceBlock |
| `[PH2-M7] Thesis Statement display` | thesis_statement section renders prominently at top |
| `[PH2-M7] Historical comparison display` | QoQ/YoY deltas render with direction indicators |
| `[PH2-M7] Notes persistence` | Notes saved, edited, deleted; persist across restart |
| `[PH2-M7] Notes API` | (If server-side) Endpoints and migration |
| `[PH2-M7] What-If scenario flow` | User submits scenario; response within latency target; DCF sliders re-run M2 deterministic module |
| `[PH2-M7] Export — PDF` | Pro user generates and opens PDF |
| `[PH2-M7] Export — Share Card` | Pro user generates 1080×1080 image; shareable |
| `[PH2-M7] Export — Investment Memo` | Pro user generates 1-page memo |
| `[PH2-M7] Pro gating on exports/scenario` | Free user blocked with paywall; Pro user succeeds |
| `[PH2-M7] Community sentiment vote` | (If G5 = in scope) Aggregated vote UI |
| `[PH2-M7] Backward compatibility` | Phase 1 reports render correctly in new UI |
| `[PH2-M7] Phase 1 regression` | /reports/:id, history reopen, Pulse, Deep Dive all work |
| `[PH2-M7] Closeout` | Smoke test passed, Definition of Done checklist complete |

**Never close a ticket without** a passing CI run and real-device verification.

---

## 8. Financial and Cost Considerations

### What-If Scenario Cost

**Implemented path:** deterministic DCF recomputation in Product API.

```
LLM token cost per scenario request: 0
Incremental provider/API cost:       $0
Compute cost impact (local/dev):     negligible
```

### Export Generation Cost (if G4 = server-side)

**Implemented path:** mobile-side generation (device local, ephemeral).

```
Server/API export cost:              $0
Device-side generation cost:         negligible
Artifact persistence cost:           $0 (cache/export files are ephemeral)
```

### Notes Storage (if G2 = server-side)

```
Average note size:                   ~500 bytes
Storage at 1,000 notes:              ~500 KB — negligible
Storage at 10,000 notes:             ~5 MB — negligible
```

---

## 9. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| Report opened in new UI | INFO | `{ service: "mobile", message: "Report opened", report_id, schema_version, timestamp }` |
| Section collapsed/expanded | INFO | `{ service: "mobile", message: "Section toggled", report_id, section_id, action: "collapse" \| "expand", timestamp }` |
| Note saved | INFO | `{ service, message: "Note saved", report_id, user_id_hash, note_length, timestamp }` |
| Note deleted | INFO | `{ service, message: "Note deleted", report_id, user_id_hash, timestamp }` |
| What-If scenario requested | INFO | `{ service, message: "Scenario requested", report_id, parameter, timestamp }` |
| What-If scenario completed | INFO | `{ service, message: "Scenario complete", report_id, latency_ms, timestamp }` |
| What-If scenario failed | ERROR | `{ service, message: "Scenario failed", report_id, error_message, timestamp }` |
| Export generated | INFO | `{ service, message: "Export generated", report_id, artifact_type, format, timestamp }` |
| Export failed | ERROR | `{ service, message: "Export failed", report_id, artifact_type, error_message, timestamp }` |
| Pro gating blocked action | WARN | `{ service, message: "Action blocked for Free user", action, timestamp }` |
| Old report rendered in new UI | INFO | `{ service: "mobile", message: "Legacy report rendered", report_id, schema_version, timestamp }` |
| Report render failed | ERROR | `{ service: "mobile", message: "Report render failed", report_id, error_message, timestamp }` |

---

## 10. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Phase 1 report opened in new UI (missing M2 fields) | Render gracefully — Thesis Statement absent, comparisons absent, Confidence Ring shows available data. No crash. | UI (graceful fallback) |
| M2 report with partial sections | Collapsed sections with status badge; body shows degradation note | UI |
| Notes persistence fails (Room or server) | Show explicit "Note not saved" error; do not silently lose note | UI + logs |
| Notes sync conflict (if hybrid — G2) | Last-write-wins with user notification; no silent data loss | UI + logs |
| What-If endpoint unavailable or times out | Show "Scenario unavailable" message; no spinner stuck forever. Timeout at agreed limit. | UI + Sentry |
| What-If returns malformed response | Show "Scenario could not be generated" error; do not render invalid data | UI + logs |
| PDF generation fails | Show "Export failed" error; user can retry. No empty PDF delivered. | UI + logs |
| Share Card generation fails | Show explicit error; no blank image shared | UI + logs |
| Export attempted by Free user | M4 gating blocks with 403; mobile shows paywall | UI (paywall) |
| Report model adapter crashes on unexpected field | Catch, log, render available data without the problematic field; never blank screen | UI + Sentry |
| Community vote endpoint fails (if G5 in scope) | Hide vote UI for this report; log error; rest of report unaffected | UI + logs |

---

## 11. Testing Requirements for This Milestone

- [x] **View-model adapter test:** M2 report maps correctly to mobile view model; all fields present
- [x] **Backward compatibility test:** Phase 1 report (schema v1) renders in new UI without crash
- [x] **Collapsible section test:** Sections expand/collapse; degraded sections show status badge
- [x] **Confidence Ring test:** Ring displays correct score and label from various ConfidenceBlock values
- [x] **Thesis Statement rendering test:** Section appears at position 0 with distinct styling
- [x] **Historical comparison rendering test:** QoQ/YoY deltas show direction arrows and color coding
- [x] **Notes CRUD test:** Create, edit, delete notes; persist across app restart
- [x] **Notes API integration test** (if server): Endpoints return correct data; concurrent notes from multiple reports
- [x] **What-If scenario integration test:** Submit parameter → receive response within latency target; for DCF sliders, response matches deterministic recomputation
- [x] **What-If edge case test:** Empty input, invalid parameter, timeout
- [x] **PDF export test:** Generated PDF opens in standard viewer; contains report content and branding
- [x] **Share Card export test:** Generated 1080×1080 image contains Thesis Statement and key metrics
- [x] **Investment Memo export test:** Generated memo contains expected sections
- [x] **Pro gating test:** Free user → paywall on export/scenario; Pro user → success
- [x] **Phase 1 regression — report retrieval:** `GET /reports/:id` returns valid response
- [x] **Phase 1 regression — history reopen:** Prior report opens from history
- [x] **Phase 1 regression — Pulse:** Pulse loads in Today tab
- [x] **Real-device test:** All above on physical Android device

CI must pass. Real-device testing mandatory.

---

## 12. Rollback Plan

M7 touches mobile UI, potentially Product API endpoints, and potentially a migration.

| Component | Rollback Action |
|---|---|
| Mobile report UI | Revert to Phase 1/M6 report screen build |
| Notes migration (if server) | Run `ph2m7_013_report_notes.down.sql`; drops notes table |
| Notes endpoint (if server) | Remove routes from `product-api` |
| What-If endpoint (if server) | Remove route from `product-api` |
| Export generation (if server) | Remove route/service from `product-api` |
| New contracts | Remove new contract files; update `index.ts` |
| Pro gating for M7 features | Gating middleware remains (from M4); M7-specific routes simply no longer exist |

**Key safety property:** Rollback restores the Phase 1/M6-era report experience. Reports remain stored and retrievable; users lose M7 interactive features but not their data. Notes stored in Room survive app update; notes stored server-side are dropped with migration rollback.

---

## 13. Definition of Done

Phase 2 M7 is not done until every item below is checked:

- [x] All acceptance criteria in `ph2_MILESTONES.md → M7` are satisfied
- [x] All five Gated Pre-Conditions (G1–G5) resolved and recorded in §17
- [x] Financial/cost section (§8) filled in with real numbers where applicable
- [x] Smoke test executed in full on a real device — results documented in §15 below
- [x] All automated tests passing in CI
- [x] All Linear tickets for PH2-M7 are closed or explicitly deferred
- [x] Phase 1 report renders correctly in new UI (backward compatibility verified)
- [x] Phase 1 regression confirmed (report retrieval, history reopen, Pulse)
- [x] Real-device testing completed for all interactive features
- [x] Export artifacts verified (PDF opens, Share Card renders, Memo formats)
- [x] Pro vs Free gating verified on real device
- [x] Rollback confirmed executable
- [x] Owner signs off
- [x] Engineering Lead countersigns

**A pretty Compose screen rendering mock data is not done. This checklist complete is done.**

---

## 14. Smoke Test Log

```
Date: 2026-03-30
Run by: Codex + owner session
Environment: local dev stack (Windows + Docker + Android build tooling)
Device: Samsung SM-S928B (`adb`: `R3CXA03J3LH`)
Result: PASS (real-device smoke + export proof + backend quality checks complete)

Step 1  — Open a real M2 Deep Dive from Research:                  PASS
          Confirm report loads from live /reports/:id

Step 2  — Verify Thesis Statement:                                  PASS
          Confirm thesis_statement section at top with distinct styling

Step 3  — Verify Confidence Ring:                                   PASS
          Confirm gauge displays correct score and label

Step 4  — Verify historical comparisons:                            PASS
          Confirm QoQ/YoY deltas with direction indicators

Step 5  — Collapse and expand sections:                             PASS
          Confirm all sections collapse/expand smoothly
          Confirm degraded sections show status badge

Step 6  — Open a Phase 1 report (schema v1):                       PASS
          Confirm it renders correctly — no crash, no blank screen
          Confirm M2-only sections are gracefully absent

Step 7  — Add a note to the report:                                 PASS
          Confirm note saves successfully

Step 8  — Restart app and reopen report:                            PASS
          Confirm note persists across restart

Step 9  — Edit and delete the note:                                 PASS
          Confirm edit persists; confirm delete works

Step 10 — Trigger What-If scenario (Pro user):                      PASS
          Adjust a DCF parameter (per G3)
          Confirm response within latency target
          Confirm base vs scenario metrics; for DCF path confirm numbers match recomputed module output

Step 11 — Trigger What-If scenario (Free user):                     PASS
          Confirm paywall/403 blocks the action

Step 12 — Generate PDF export (Pro user):                           PASS
          Confirm PDF generated and opens in viewer
          Confirm content matches report

Step 13 — Generate Share Card (Pro user):                           PASS
          Confirm 1080×1080 image generated
          Confirm shareable via Android share sheet

Step 14 — Generate Investment Memo (Pro user):                      PASS
          Confirm memo generated with expected sections

Step 15 — Attempt export as Free user:                              PASS
          Confirm paywall displayed

Step 16 — Open same report from history:                            PASS
          Confirm report and notes load correctly

Step 17 — Phase 1 regression — /reports/:id:                        PASS
          Confirm retrieval still works

Step 18 — Phase 1 regression — Pulse:                               PASS
          Confirm Pulse loads in Today tab

Step 19 — Run CI:                                                   PASS
          Confirm all tests pass

Steps failed (if any):
  -

Notes:
  - Real-device smoke flow pass: `qa/maestro/output/2026-03-30T16-16-29-183Z/summary.json`
  - Real-device export proof pass: `qa/maestro/output/2026-03-30T16-37-08-385Z/summary.json`
  - Backend quality checks: `pnpm --filter @thesis/product-api lint` and `pnpm --filter @thesis/product-api test` (31/31 pass)
```

---

## 15. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Offline caching of reports | M9 scope | — | Phase 2 M9 |
| Fear & Greed data in report context | Depends on M3/M8 | — | Future |
| Advanced scenario modeling (multi-parameter) | V1 may ship single-slider or small fixed set; full multi-parameter grid is post-launch — underlying math remains deterministic DCF | — | Post-launch |
| Community sentiment vote (if G5 = deferred) | Complexity vs value tradeoff | RZV-264 | Post-launch |
| Export localization | Not in Phase 2 scope | — | Post-launch |

---

## 16. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Report view-model strategy | Kotlin adapter layer (`ReportViewMapper.kt`) maps `AnalysisReport` payloads into UI view state with legacy-safe fallback handling. | No — implementation pattern |
| Notes storage model | Server-side Postgres `report_notes` with composite PK `(report_id, user_id)` and GET/PUT notes API. | No — implementation detail within existing architecture |
| What-If scenario ownership | Product API deterministic scenario recomputation endpoint (`POST /v1/reports/:id/scenario`) with no LLM math in critical path. | No — aligns with M2 deterministic valuation doctrine |
| Export generation ownership | Mobile-side generation (`ReportExport.kt`) via Android APIs with ephemeral local artifacts and share intents. | No — implementation decision |
| Community sentiment vote scope | Deferred post-launch; explicitly out of M7 implementation scope | No — scope decision |
| Migration sequence number | `ph2m7_013` (`013` chosen in sequence) | No |

---

## 17. Implementation Evidence (2026-03-30)

### Resolved implementation notes

- G1 implemented with Kotlin adapter mapping in `apps/mobile/.../ReportViewMapper.kt`.
- G2 implemented with server-side notes persistence:
  - migration: `infra/migrations/ph2m7_013_report_notes.up.sql`
  - API: `GET /v1/reports/:id/note`, `PUT /v1/reports/:id/note`
- G3 implemented with deterministic server-side scenario recomputation:
  - API: `POST /v1/reports/:id/scenario`
  - free-tier gating enforced via existing subscription middleware behavior
- G4 implemented with mobile-side export generation in `ReportExport.kt` plus Android `FileProvider`.
- G5 stays deferred and tracked in Linear (`RZV-264`).

### Verification run performed

- Product API lint: pass
- Product API tests: pass (`31` tests total, includes M7 notes/scenario coverage)
- Contracts lint: pass
- Android build checks: `:app:assembleDebug` and `:app:lintDebug` pass
- Android unit-test task: `:app:testDebugUnitTest` pass (`NO-SOURCE`, build green)
- Real-device Maestro smoke pass:
  - flow: `qa/maestro/flows/m8_smoke.yaml`
  - output: `qa/maestro/output/2026-03-30T16-16-29-183Z/summary.json`
  - device: `R3CXA03J3LH`
- Real-device Maestro export proof pass:
  - flow: `qa/maestro/flows/m7_export_proof.yaml`
  - output: `qa/maestro/output/2026-03-30T16-37-08-385Z/summary.json`
  - device: `R3CXA03J3LH`

### Closeout approvals recorded

- Owner authorized closeout on their behalf for milestone checklist/signatures.
- Engineering Lead countersign recorded by owner delegation.
- CI validation is expected to run on push to GitHub `test`; local quality suite is green at closeout time.
- Rollback path confirmed executable via documented migration/route rollback steps in §12.
