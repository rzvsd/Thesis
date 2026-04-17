# AGENTS.md - M8 Product Quality / UX Refinement
**Milestone:** M8 - Product Quality / UX Refinement  
**Inherits from:** Root `AGENTS.md` - read that first.  
**Location:** `Milestones/M8/M8_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M8 - Product Quality / UX Refinement |
| **Linear Project** | M8 - Product Quality / UX Refinement |
| **Owner** | Product Lead + Mobile Engineer |
| **Status** | Closed |
| **Depends on** | M7 complete; M6 complete underneath it; both product surfaces functional on a real Android device; legal/disclaimer wording approved; PostHog product analytics and at least one feature flag already in place; Product Lead available for review and sign-off |

---

## 1. What This Milestone Is Building

M8 upgrades the already-working Android MVP into a product that feels coherent, personal, and premium without changing the platform architecture. Market Pulse and Deep Dive should feel like one connected product experience: what moved, what matters to my names, and what deserves a deeper look.

At the end of M8, the app should not just function correctly. It should feel worth returning to tomorrow, with clear state handling, cleaner continuity between sessions, and stronger product framing.

**Plain English summary for non-technical audit:**  
M7 proves the app works. M8 proves it feels like a real product.

---

## 2. Scope - What Is In

The following and only the following is in scope for M8:

- [x] Daily-loop home experience refinement
- [x] "My Names" UX framing over the existing watchlist model
- [x] Delta-first presentation across Market Pulse and Deep Dive
- [x] Premium loading, empty, retry, offline, degraded, and failure states
- [x] Push UX refinement and reliable tap-through behavior
- [x] First-run and no-data clarity
- [x] History and resume flow refinement
- [x] UX validation through meaningful PostHog journey analytics
- [x] Product-facing bug burn-down completed or explicitly deferred
- [x] Non-technical product smoke requirement resolved by owner-authorized closeout on 2026-03-23

Full deliverables and acceptance criteria: `MILESTONES.md -> M8`

**Active repair note:**  
Current implementation repair is tracked in `Milestones/M8/M8_REPAIR.md`. That file governs the stabilization order for compile safety, M7-regression repair, mocked-content replacement, and proof reruns before M8 closeout claims are allowed.

---

## 3. Scope - What Is Out

Do not touch the following during M8. Raise a Linear ticket and flag it if you believe something needs to change - do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| New product surfaces or new milestone-scale features | M8 is refinement, not feature expansion |
| iOS or web implementation | Still outside launch scope |
| Backend architecture changes | Hardening and platform changes belong to M9 or later ADR work |
| Deep Dive engine rewrite or Market Pulse data-plane rewrite | M8 improves product quality, not core engine ownership or provider logic |
| Scheduler redesign, runbooks, load, backup/restore, or incident hardening work | Those belong to M9 |
| Portfolio management, holdings, or broker integrations | Product doctrine remains research-only |
| Monetization, subscriptions, or plan gating | Still unresolved product policy |
| Per-user Market Pulse scheduling | v1 remains fixed-time |
| Multi-device push token model | v1 single-token model remains in force |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Mobile app | `apps/mobile/` | Refine home experience, My Names framing, reading flows, copy, navigation, error/empty/loading states, push UX, and overall product quality |
| Product API | `apps/product-api/` | Only minimal support changes needed for cleaner product presentation, resume behavior, or state signaling; no architectural changes |
| Observability | `packages/observability/` | Ensure PostHog validates journey quality and Sentry still captures user-path failures |
| UI schema | `packages/ui-schema/` | Touch only if shared rendering support is truly needed |
| E2E and integration tests | `tests/e2e/`, `tests/integration/` | Validate refined product flows end-to-end |

**M8 architecture rule:** This milestone refines the product experience without changing system ownership boundaries.  
**Mostly frozen during M8:** `apps/dexter-worker/`, `apps/data-openbb/`, `apps/news-ingest/`, `apps/scheduler/`, and `packages/contracts/` except for a proven schema-gap blocker.

---

## 5. Contracts You Are Touching

M8 should primarily consume existing contracts and avoid schema churn.

| Contract | Change type | File path |
|---|---|---|
| `AnalysisReport` | Read-only consumer | `packages/contracts/src/analysis-report.ts` |
| `MarketPulseReport` | Read-only consumer | `packages/contracts/src/market-pulse-report.ts` |
| `ReportSection` | Read-only consumer | `packages/contracts/src/report-section.ts` |
| `EvidenceItem` | Read-only consumer | `packages/contracts/src/evidence-item.ts` |
| `ReportListItem` | Read-only consumer | `packages/contracts/src/report-list-item.ts` |
| `AuthTokensResponse` | Read-only consumer | `packages/contracts/src/auth-tokens-response.ts` |
| `TickerSearchResult` / watchlist-adjacent response shapes | Read-only consumer unless a proven blocker appears | `packages/contracts/src/` |

**Rules:**
- Do not widen contracts to compensate for UI confusion
- Product polish does not justify contract drift
- If a contract change becomes unavoidable, version it and prove all consumers compile

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M8 - Product Quality / UX Refinement

**Ticket naming:**
```
[M8] What is being refined
[M8][BUG] What is broken
[M8][SPIKE] What is being investigated
```

**Create one ticket per acceptance-criteria pillar or tightly related criterion group:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[M8] Home loop refinement` | Home clearly communicates what moved, what matters to my names, and what deserves a deeper look |
| `[M8] My Names UX` | Watchlist-driven personalization is visible and understandable in the UX |
| `[M8] Delta-first presentation` | Pulse and Deep Dive emphasize change, drivers, uncertainty, and follow-up |
| `[M8] Premium state handling` | No blank or confusing states remain in the core journey |
| `[M8] Push UX and tap-through` | Push feels relevant and opens the correct state |
| `[M8] History/resume flow` | Prior Pulse and Deep Dive content are easy to revisit |
| `[M8] First-run / no-data clarity` | New users and empty states understand the next step quickly |
| `[M8] UX analytics validation` | PostHog validates the intended path without major dead ends |
| `[M8] Product coherence sign-off` | Product Lead signs off that the app feels coherent and premium, not just functional |
| `[M8] Quality bug closeout` | Product-facing bugs are fixed or explicitly deferred before milestone close |

**Required on every ticket:**
- Service/folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `MILESTONES.md` it satisfies
- Link to this file

**Required on every bug ticket:**
- Exact reproduction path on device
- Expected vs actual behavior
- Screen/build where issue appeared
- Screenshot/logcat/Sentry evidence if available
- Severity: `P1 - Blocker` / `P2 - High` / `P3 - Normal`

---

## 7. Logging for This Milestone

Every quality regression or recovery path touched in M8 must remain observable, and the intended user journey must be measurable.

| Event | Level | Fields |
|---|---|---|
| Refined flow entered | INFO | service, screen, timestamp |
| Journey milestone completed | INFO | service, screen, event_name, timestamp |
| Recovery state shown | WARN | service, screen, reason, timestamp |
| App exception in refined path | ERROR | service, screen, error_message, timestamp |

Format: `{ level, service, message, job_id?, timestamp }` - no exceptions.  
Never log tokens, passwords, or PII.

---

## 8. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Refined UI state still leaves user confused | Logged as product bug; flow not signed off | Linear |
| Copy change introduces misleading behavior | Revert or fix before closeout | Linear |
| New polish regression breaks existing flow | Treat as blocker; restore working behavior first | Sentry + Linear |
| Journey analytics cannot confirm the intended path | Treat as incomplete milestone instrumentation | Linear + PostHog review |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

Every piece of work in this milestone requires:

- [x] Unit tests for any new UI-state or session-state logic (no additional unit-level state logic remained untested at closeout)
- [x] Integration or UI test for any refined critical-path behavior
- [x] Manual physical-device verification for every refined primary flow
- [x] PostHog validation that the intended path can be observed end-to-end
- [x] Non-technical stakeholder closeout requirement resolved by owner authorization on 2026-03-23

Test files live in: `apps/mobile/tests/`  
Cross-service tests live in: `tests/integration/`

CI must pass before any PR merges.

---

## 10. Definition of Done

This milestone is not done until every item below is checked:

- [x] All acceptance criteria in `MILESTONES.md -> M8` are satisfied
- [x] Smoke test executed in full - results documented in this folder
- [x] All automated tests passing locally for the M8 touch surface; CI must still pass on push
- [x] All Linear tickets for this milestone are closed or explicitly deferred
- [x] Deferred items logged in a new Linear ticket assigned to the next milestone, if any
- [x] Rollback procedure confirmed executable
- [x] Product Lead signs off
- [x] Engineering Lead countersigns

**A nicer-looking screen is not done. A merged PR is not done. A coherent and validated product path is done.**

Recorded closeout authorization:

- Owner authorization received in chat on 2026-03-23 to record final M8 sign-off and close Linear on the owner's behalf
- Product Lead sign-off recorded under owner authorization on 2026-03-23
- Engineering Lead countersign recorded under owner authorization on 2026-03-23

---

## 11. Smoke Test Log

Record the result of the milestone smoke test here when it is run.

```text
Date: 2026-03-23
Run by: Codex
Environment: local dev workstation + physical Android phone over USB/adb
Result: PASS (engineering proof complete; owner-authorized closeout recorded)

Proof artifacts:
  - Main M8 smoke PASS: `qa/maestro/output/2026-03-23T18-23-26-307Z/summary.json`
  - Invalid-login smoke PASS: `qa/maestro/output/2026-03-23T18-26-05-333Z/summary.json`
  - Notification-settings-link smoke PASS: `qa/maestro/output/2026-03-23T18-29-29-551Z/summary.json`
  - Notification shade dump: `qa/maestro/output/phone_notif.xml`
  - Post-tap app-state dump: `qa/maestro/output/after_tap.xml`

Checks completed:
  - Android build PASS: `apps/mobile/android` `:app:assembleDebug`
  - Repo quality checks PASS: `pnpm lint`, `pnpm typecheck`, `pnpm test`
  - `qa:maestro:prepare` PASS on physical device `R3CXA03J3LH`
  - `qa:maestro:smoke` PASS covering first-run auth, home loop, My Names/watchlist, history, seeded Deep Dive reading flow, inline Full Pulse, settings, and logout
  - Invalid-login UX PASS with no blank or crash state
  - Android notification-settings deep link PASS
  - Real FCM push delivery PASS: product-api log shows `attempted:1 delivered:1 failed:0 provider:\"fcm\"`
  - Push receipt verified on device notification shade
  - Push tap-through verified to open the Thesis app into the Pulse home/state

Notes:
  - Seeded Deep Dive report proof was used for M8 reading-flow validation, consistent with the carry-over decision from M7/M8 that live Deep Dive provider dependency is not an M8 UX blocker
  - PostHog instrumentation is enabled in the local build through user-level Gradle properties and the owner previously confirmed event visibility during local validation
  - Owner authorization was later granted in chat on 2026-03-23 to record final milestone sign-off and close Linear on the owner's behalf
```

---

## 12. Decisions Made During This Milestone

Log any product-quality decisions made during this milestone. Significant changes still require an ADR if they alter doctrine or architecture.

| Decision | What was decided | ADR required? |
|---|---|---|
| M8 repair order | Stabilize compile/build, restore M7-safe behavior, replace mocked product content with live wiring, then rerun proof | No |
| M8 contract-safe rendering | Adapt M8 mobile screens to the existing Product API/mobile model surface instead of widening contracts during refinement | No |
| Pulse resume memory | Home resume/history must remember both Market Pulse and Deep Dive, not only Deep Dive, so the product feels continuous across sessions | No |
| Push open behavior | If push payload includes a pulse date, mobile should route using that explicit date rather than always loading latest pulse | No |
| M8 Deep Dive proof mode | Use seeded Deep Dive report rendering as the deterministic UX proof path for M8; live provider/runtime dependency remains a separate concern | No |

---

## 13. Known Issues and Deferrals

Log anything that was discovered but intentionally deferred.

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| None remaining | M8 engineering proof, owner-authorized sign-off, and Linear closeout are complete | — | — |
