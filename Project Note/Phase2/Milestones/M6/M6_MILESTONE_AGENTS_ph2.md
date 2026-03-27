# AGENTS.md — Phase 2 M6 3-Tab Navigation Redesign
**Milestone:** Phase 2 M6 — 3-Tab Navigation Redesign  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M6/M6_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M6 — 3-Tab Navigation Redesign |
| **Linear Project** | Phase 2 M6 — 3-Tab Navigation Redesign |
| **Owner** | Mobile Engineer + Product Lead |
| **Status** | Planned |
| **Depends on** | Phase 2 M5 closed; current Android app confirmed working on a real device before refactor begins |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Screen-mapping document.** An explicit, reviewed mapping from every current screen/flow to its destination in the 3-tab structure. Must cover: Pulse → Today, Deep Dive + search → Research, Watchlist/My Names → You, History → Research or You (choose one), Settings → You. Every Phase 1 deep-link target must have a named new destination. | **OPEN** | Mobile Engineer + Product Lead | Before M6 kickoff |
| G2 | **Today tab time-state design.** Exact content and layout for each market-day state: pre-market, market-hours, after-hours. What data sources drive each state? (Pulse, Fear & Greed card from M3, upcoming earnings from M5, watchlist movers.) | **OPEN** | Product Lead | Before M6 kickoff |
| G3 | **Transition strategy.** Will old and new navigation coexist during development (adapter layer), or will the switch be atomic (one PR swaps everything)? If coexistence, what is the temporary compatibility logic? | **OPEN** | Mobile Engineer | Before M6 kickoff |
| G4 | **History placement.** Report history lives in Research or You — not both. Must be decided before navigation is wired. | **OPEN** | Product Lead | Before M6 kickoff |

**Rule:** Do not start refactoring navigation without the G1 screen-mapping document reviewed and approved. Every old screen that gets deleted must have a verified replacement.

---

## 1. What This Milestone Is Building

A complete navigation refactor of the working Android app from the current 5-tab/flow structure into the 3-tab architecture: **Today / Research / You**. This is not a tab rename — it is a real migration of an already-functional app. Every existing screen must remain reachable in the new structure. Notification deep-links and history resume paths must land on the correct new destination. No old screen is deleted until its replacement is smoke-tested.

This milestone is purely a mobile/UI milestone. It makes minimal backend changes (potentially none) but has the highest Phase 1 regression risk of any milestone because it touches every user-facing flow.

**Plain English summary for non-technical audit:**  
Before M6, the app has 5 separate areas. After M6, it has 3 tabs — Today (what's happening now), Research (your Deep Dives), You (your account and preferences). Everything that worked before still works, just organized differently.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/BLUEBOOK cld.md` — mobile architecture, deep-link model
- `Project Note/Phase1/MILESTONES.md` — Phase 1 M7/M8 (Mobile UI) as regression baseline
- `Project Note/Phase1/PRD.md` — existing user flows

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` — High-Risk Rule for M6 (real refactor, not tab rename)
- `Project Note/Phase2/ph2_BLUEBOOK.md` — §7 M6 Guardrail (screen-mapping requirement, deep-link migration)
- `Project Note/Phase2/ph2_MILESTONES.md` — Phase 2 M6 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` — §2.3 3-Tab Architecture

### Current code surfaces you must understand before touching

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/ThesisApp.kt` — navigation host, route definitions
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/MainViewModel.kt` — session state, navigation state
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` — current Pulse/home
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt` — Deep Dive flow
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HistoryScreen.kt` — report history
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/SettingsScreen.kt` — settings
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/WatchlistScreen.kt` — watchlist/My Names

---

## 3. Scope — What Is In

- [ ] **Screen-mapping document** (G1) approved and committed to `Project Note/Phase2/Milestones/M6/SCREEN_MAPPING.md`
- [ ] **Today tab:** Time-aware layout showing Morning Pulse pre-market, watchlist movers during market hours, recap and tomorrow context after-hours. Includes Fear & Greed summary card placeholder (data from M3, actual card built in M8).
- [ ] **Research tab:** Search bar, recent Deep Dive history, "Run a Deep Dive" entry point. Report history accessible from here (or from You, per G4).
- [ ] **You tab:** Profile/subscription status (from M4), watchlist/My Names management, notification settings (from M5), app settings.
- [ ] **Bottom navigation bar:** 3 tabs with icons and labels. Current tab highlighted. Smooth transitions.
- [ ] **Deep-link migration:** Every Phase 1 notification deep-link target is mapped to its new destination. Notification taps land correctly.
- [ ] **History/resume path:** Opening a prior report from history still works in the new structure.
- [ ] **Transitional adapter layer** if G3 requires coexistence of old and new navigation during development.
- [ ] **No old screen deleted until replacement verified:** Every screen removal is preceded by a smoke check of the replacement.
- [ ] **Phase 1 full regression:** Pulse, Deep Dive run, watchlist/My Names, history, settings, notification tap-through — all reachable and working.

Full deliverables and acceptance criteria: `ph2_MILESTONES.md → M6`

---

## 4. Scope — What Is Out

| Out of scope | Reason |
|---|---|
| Rewriting backend ownership or API routes to fit the UI | Forbidden — M6 is a mobile-only refactor |
| Deleting old screens before their replacements are proven | Forbidden — see Bluebook §7 M6 Guardrail |
| Feature expansion unrelated to navigation (new screens, new data) | Not part of M6 |
| Fear & Greed full dashboard or chart | M8 — Today tab may include a placeholder card only |
| Report UI redesign (collapsible sections, notes, export) | M7 — M6 only reorganizes access to the existing report screen |
| New backend endpoints | M6 consumes existing endpoints in a new tab structure |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Mobile app | `apps/mobile/` | Navigation host refactor, tab bar implementation, screen reorganization, deep-link migration, time-state Today layout |
| Product API | `apps/product-api/` | **Read-only** — M6 consumes existing endpoints; no new endpoints unless a blocker is discovered |
| Contracts | `packages/contracts/` | **Read-only** — M6 does not modify contracts |

**M6 architecture rule:** The current app is the regression baseline. No old surface is removed until the mapped replacement is smoke-tested and working on a real device.

---

## 6. Contracts You Are Touching

| Contract | Change type | File path |
|---|---|---|
| All existing mobile-facing contracts | **Read-only** | `packages/contracts/src/` |

M6 does not create or modify any contracts. It reorganizes how the mobile app presents data from existing endpoints.

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M6 — 3-Tab Navigation Redesign

**Ticket naming:**
```
[PH2-M6] What is being built
[PH2-M6][BUG] What is broken
[PH2-M6][SPIKE] What is being investigated
```

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M6] Screen-mapping document` | G1 resolved; mapping approved and committed |
| `[PH2-M6] Today tab — pre-market state` | Today shows Pulse content pre-market |
| `[PH2-M6] Today tab — market-hours state` | Today shows watchlist movers during market hours |
| `[PH2-M6] Today tab — after-hours state` | Today shows recap and tomorrow context after-hours |
| `[PH2-M6] Research tab` | Search, recent reports, Deep Dive entry point |
| `[PH2-M6] You tab` | Profile, subscription, watchlist, settings |
| `[PH2-M6] History placement` | Report history accessible from agreed location (G4) |
| `[PH2-M6] Bottom navigation bar` | 3 tabs with correct icons, labels, and smooth transitions |
| `[PH2-M6] Deep-link migration` | All notification types open correct new tab and screen |
| `[PH2-M6] History/resume path` | Opening prior report from history still works |
| `[PH2-M6] Old screen cleanup` | Old screens removed only after replacements verified |
| `[PH2-M6] Phase 1 full regression` | All Phase 1 flows reachable and working in new structure |
| `[PH2-M6] Closeout` | Smoke test passed, Definition of Done checklist complete |

**Never close a ticket without** a passing CI run and real-device verification.

---

## 8. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| Tab selected | INFO | `{ service: "mobile", message: "Tab selected", tab, timestamp }` |
| Deep-link routed | INFO | `{ service: "mobile", message: "Deep link routed", source, route_target, resolved_tab, timestamp }` |
| Deep-link fallback used | WARN | `{ service: "mobile", message: "Deep link fallback", original_target, fallback_target, timestamp }` |
| Today tab state resolved | INFO | `{ service: "mobile", message: "Today state resolved", market_state, timestamp }` |
| Screen not found (stale reference) | ERROR | `{ service: "mobile", message: "Screen not found", route_target, timestamp }` |
| History resume failed | ERROR | `{ service: "mobile", message: "History resume failed", report_id, error_message, timestamp }` |
| Old screen accessed during transition | WARN | `{ service: "mobile", message: "Old screen fallback", old_route, new_route, timestamp }` |

Format: structured log entries.  
Never log user PII, auth tokens, or session secrets.

---

## 9. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Notification deep-link target moved | Route to the correct new destination per G1 mapping; if unmapped, route to Today tab and log warning | UI + logs |
| History entry references a removed screen | Open the report via the new Research path; never strand user on a blank screen | UI + logs |
| Today tab data source unavailable | Show cached Pulse data or "Loading" state; never a blank tab | UI |
| Market state resolution fails | Default to the most recently known state; log error | Logs |
| Old screen still referenced in code | Treat as blocker; do not merge until reference removed | Linear |
| Navigation transition animation janky or broken | Treat as P2 bug; app is functional but UX is degraded | Linear |
| Adapter layer (if G3) causes double-render or navigation loop | Treat as blocker; fix before old screens are removed | Linear |

---

## 10. Testing Requirements for This Milestone

- [ ] **Tab navigation tests:** Launch app → verify 3 tabs present; tap each tab → correct content loads
- [ ] **Today tab time-state tests:** Mock pre-market, market-hours, after-hours times → verify correct Today layout per state
- [ ] **Research tab tests:** Search works; recent reports list loads; "Run Deep Dive" launches flow
- [ ] **You tab tests:** Profile shows correct tier; watchlist management works; settings accessible
- [ ] **Deep-link tests per notification type:** Earnings preview → Research/Deep Dive; contrarian alert → correct report; Pulse → Today
- [ ] **History resume test:** Open prior report from history; report loads correctly
- [ ] **Regression — Pulse:** Pulse data loads in Today tab
- [ ] **Regression — Deep Dive:** Full Deep Dive flow accessible from Research tab
- [ ] **Regression — Watchlist/My Names:** CRUD works from You tab
- [ ] **Regression — Settings:** All settings reachable from You tab
- [ ] **Regression — Push tap-through:** Notification tap lands on correct screen
- [ ] **Real-device test:** All above tests run on a physical Android device, not just emulator

CI must pass before any PR merges. **Real-device testing is mandatory for M6.**

---

## 11. Rollback Plan

M6 is a pure mobile refactor. Rollback means reverting the mobile app build.

| Component | Rollback Action |
|---|---|
| Mobile navigation | Revert to the Phase 1 5-tab navigation build. Git revert or branch switch. |
| Deep-link routes | Reverted with the navigation code |
| Backend | **No backend changes to rollback** — M6 does not modify `product-api`, contracts, or migrations |
| App distribution | Push the Phase 1 build to the test track; users update to the old version |

**Key safety property:** M6 rollback is a mobile-only revert. No server-side data, tables, or endpoints are affected. The Phase 1 app build is the rollback target.

**Risk note:** If M6 is already distributed to users and they have the 3-tab app, rolling back requires publishing a new build with the old navigation. There is no server-side toggle.

---

## 12. Definition of Done

Phase 2 M6 is not done until every item below is checked:

- [ ] All acceptance criteria in `ph2_MILESTONES.md → M6` are satisfied
- [ ] All four Gated Pre-Conditions (G1, G2, G3, G4) resolved and recorded in §16
- [ ] Screen-mapping document committed and matches the implemented navigation
- [ ] Smoke test executed in full on a real device — results documented in §14 below
- [ ] All automated tests passing in CI
- [ ] All 13 Linear tickets for PH2-M6 are closed or explicitly deferred
- [ ] Every Phase 1 flow verified reachable in the new structure (Pulse, Deep Dive, watchlist, history, settings, push tap-through)
- [ ] Every notification deep-link verified on real device
- [ ] Navigation transitions are smooth (no jank, no blank frames)
- [ ] No old screen references remain in the codebase (or are explicitly flagged as transitional)
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

**Three pretty tabs appearing on an emulator is not done. This checklist complete is done.**

---

## 13. Smoke Test Log

```
Date:
Run by:
Environment:
Device:
Result:

Step 1  — Launch app on real device:                                ___
          Confirm 3 tabs present: Today, Research, You
          Confirm correct tab icons and labels

Step 2  — Verify Today tab — pre-market state:                     ___
          Mock or wait for pre-market time
          Confirm Morning Pulse content loads
          Confirm Fear & Greed card placeholder visible (if M3 data available)

Step 3  — Verify Today tab — market-hours state:                   ___
          Confirm watchlist movers displayed
          Confirm time-aware header or context

Step 4  — Verify Today tab — after-hours state:                    ___
          Confirm recap and tomorrow context visible

Step 5  — Verify Research tab:                                      ___
          Confirm search bar present and functional
          Confirm recent Deep Dive history loads
          Confirm "Run Deep Dive" entry point works

Step 6  — Run a full Deep Dive from Research:                       ___
          Confirm Deep Dive flow completes end-to-end
          Confirm report appears in history

Step 7  — Open prior report from history:                           ___
          Confirm report loads correctly
          Confirm history is in the G4-agreed location

Step 8  — Verify You tab:                                           ___
          Confirm subscription/profile status shows (from M4)
          Confirm watchlist/My Names management works
          Confirm notification settings reachable (from M5)
          Confirm app settings reachable

Step 9  — Manage watchlist from You:                                ___
          Confirm add/remove names works
          Confirm cap enforcement (from M4) still applies

Step 10 — Open settings from You:                                   ___
          Confirm all settings accessible

Step 11 — Trigger earnings-preview notification:                    ___
          Confirm tap opens correct screen in new structure

Step 12 — Trigger contrarian alert notification:                    ___
          Confirm tap opens correct screen in new structure

Step 13 — Trigger Pulse notification:                               ___
          Confirm tap opens Today tab

Step 14 — Phase 1 Pulse regression:                                 ___
          Confirm Pulse data still loads in Today

Step 15 — Phase 1 Deep Dive regression:                             ___
          Confirm Deep Dive accessible and functional from Research

Step 16 — Phase 1 watchlist regression:                             ___
          Confirm CRUD from You tab

Step 17 — Phase 1 settings regression:                              ___
          Confirm all settings reachable from You tab

Step 18 — Run CI:                                                   ___
          Confirm all tests pass

Steps failed (if any):
  -

Notes:
  -
```

---

## 14. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Fear & Greed full dashboard in Today | M8 builds the dashboard; M6 may include a placeholder card only | — | Phase 2 M8 |
| Report UI redesign (collapsible, notes, export) | M7 scope | — | Phase 2 M7 |
| Weekly digest rendering in Today | M8 scope | — | Phase 2 M8 |
| Animated tab transitions (custom) | Nice-to-have; standard Material transitions sufficient for close | — | Post-launch polish |

---

## 15. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Screen-mapping plan | [To be recorded when G1 is resolved] | No — committed as document |
| Today tab time-state design | [To be recorded when G2 is resolved] | No — product design |
| Transition strategy | [To be recorded when G3 is resolved] | No — implementation approach |
| History placement | [To be recorded when G4 is resolved] | No — product decision |
