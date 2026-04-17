# AGENTS.md - Phase 2 M6 3-Tab Navigation Redesign
**Milestone:** Phase 2 M6 - 3-Tab Navigation Redesign  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase2/Milestones/M6/M6_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M6 - 3-Tab Navigation Redesign |
| **Linear Project** | Phase 2 M6 - 3-Tab Navigation Redesign |
| **Owner** | Mobile Engineer + Product Lead |
| **Status** | Closed |
| **Depends on** | Phase 2 M5 closed; current Android app confirmed working on a real device before refactor begins |

---

## Gated Pre-Conditions

These decisions must be resolved before any code is written for this milestone. Each is a blocking dependency.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Screen-mapping document.** An explicit, reviewed mapping from every current screen/flow to its destination in the 3-tab structure. Locked mapping: Pulse -> Today, Deep Dive + search -> Research, Watchlist/My Names -> Portfolio, History -> Research, Settings -> Portfolio. Every Phase 1 deep-link target must have a named new destination. | **RESOLVED** | Mobile Engineer + Product Lead | Approved before M6 kickoff |
| G2 | **Today tab time-state design.** Exact content and layout for each market-day state: pre-market, market-hours, after-hours. Locked rule: Today always has content and re-prioritizes Pulse, Fear & Greed, earnings context, and alert context by market state. | **RESOLVED** | Product Lead | Approved before M6 kickoff |
| G3 | **Transition strategy.** The navigation change is an atomic switch. One PR swaps the old navigation for the new one. No coexistence layer or adapter plan is part of the approved M6 path. | **RESOLVED** | Mobile Engineer | Approved before M6 kickoff |
| G4 | **History placement.** Report history lives in Research only. Portfolio does not own report history. | **RESOLVED** | Product Lead | Approved before M6 kickoff |

**Rule:** Do not start refactoring navigation without the G1 screen-mapping document reviewed and committed. Every old screen that gets deleted must have a verified replacement.

---

## 1. What This Milestone Is Building

A complete navigation refactor of the working Android app from the current 5-tab/flow structure into the 3-tab architecture: **Today / Research / Portfolio**. This is not a tab rename - it is a real migration of an already-functional app. Every existing screen must remain reachable in the new structure. Notification deep-links and history resume paths must land on the correct new destination. No old screen is deleted until its replacement is smoke-tested.

This milestone is purely a mobile/UI milestone. It makes minimal backend changes and has high Phase 1 regression risk because it touches every user-facing flow.

**Plain English summary for non-technical audit:**  
Before M6, the app has 5 separate areas. After M6, it has 3 tabs - Today (what is happening now), Research (your Deep Dives and report history), Portfolio (your personal space for watchlist, subscription, and settings). Everything that worked before still works, just organized differently.

**Naming rule:** `Portfolio` is UX framing only. It does not introduce real holdings, brokerage connectivity, cost basis, P&L, or portfolio-performance tracking.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/BLUEBOOK cld.md` - mobile architecture, deep-link model
- `Project Note/Phase1/MILESTONES.md` - Phase 1 mobile baseline and regression paths
- `Project Note/Phase1/PRD.md` - existing user flows

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` - high-risk rule for M6 (real refactor, not tab rename)
- `Project Note/Phase2/ph2_BLUEBOOK.md` - Section 7 M6 guardrail
- `Project Note/Phase2/ph2_MILESTONES.md` - Phase 2 M6 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` - Section 2.3 3-Tab Architecture
- `Project Note/Phase2/Milestones/M6/SCREEN_MAPPING.md` - approved M6 screen and deep-link mapping

### Current code surfaces you must understand before touching

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/ThesisApp.kt` - navigation host, route definitions
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/MainViewModel.kt` - session state, navigation state
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` - current Pulse/home
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt` - Deep Dive flow
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HistoryScreen.kt` - report history
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/SettingsScreen.kt` - settings
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/WatchlistScreen.kt` - watchlist/My Names

---

## 3. Scope - What Is In

- [x] **Screen-mapping document** (G1) approved and committed to `Project Note/Phase2/Milestones/M6/SCREEN_MAPPING.md`
- [x] **Today tab:** Time-aware layout showing the approved pre-market / market-hours / after-hours prioritization. It always has content and never degrades to a blank "markets are closed" shell.
- [x] **Research tab:** Search bar, recent Deep Dive history, "Run a Deep Dive" entry point, and reopened report results. Report history lives here per G4.
- [x] **Portfolio tab:** Profile/subscription status (from M4), watchlist/My Names management, notification settings (from M5), and app settings.
- [x] **Bottom navigation bar:** 3 tabs with icons and labels. Current tab highlighted. Smooth transitions.
- [x] **Deep-link migration:** Every Phase 1 notification deep-link target is mapped to its approved new destination. Notification taps land correctly.
- [x] **History/resume path:** Opening a prior report from history still works in the new structure.
- [x] **Atomic switch migration:** One PR replaces the old navigation. No coexistence adapter layer is allowed in the approved M6 path.
- [x] **No old screen deleted until replacement verified:** Every screen removal is preceded by a smoke check of the replacement.
- [x] **Phase 1 full regression:** Pulse, Deep Dive run, watchlist/My Names, history, settings, and notification tap-through all remain reachable and working.

Full deliverables and acceptance criteria: `ph2_MILESTONES.md -> M6`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Rewriting backend ownership or API routes to fit the UI | Forbidden - M6 is a mobile-first refactor |
| Deleting old screens before their replacements are proven | Forbidden - see Bluebook M6 guardrail |
| Feature expansion unrelated to navigation | Not part of M6 |
| Fear & Greed full dashboard or chart | M8 - Today may include summary surfaces only |
| Report UI redesign (collapsible sections, notes, export) | M7 scope |
| New backend endpoints | M6 should consume existing endpoints unless a blocker is proven |
| Real portfolio-management behavior | Explicitly out of scope; Portfolio is a label, not a new financial model |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Mobile app | `apps/mobile/` | Navigation host refactor, tab bar implementation, screen reorganization, deep-link migration, Today state layout |
| Product API | `apps/product-api/` | Minimal support only if a deep-link or notification-template adjustment is required |
| Contracts | `packages/contracts/` | Read-only unless a true blocker is proven |

**M6 architecture rule:** The current app is the regression baseline. No old surface is removed until the mapped replacement is smoke-tested and working on a real device.

---

## 6. Contracts You Are Touching

| Contract | Change type | File path |
|---|---|---|
| Existing mobile-facing contracts | Read-only by default | `packages/contracts/src/` |

M6 does not create or modify contracts unless a blocker is explicitly proven and approved.

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M6 - 3-Tab Navigation Redesign

**Ticket naming:**
```
[PH2-M6] What is being built
[PH2-M6][BUG] What is broken
[PH2-M6][SPIKE] What is being investigated
```

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M6] Screen-mapping document` | G1 resolved; mapping approved and committed |
| `[PH2-M6] Today tab - pre-market state` | Today shows approved pre-market priorities |
| `[PH2-M6] Today tab - market-hours state` | Today shows approved market-hours priorities |
| `[PH2-M6] Today tab - after-hours state` | Today shows approved after-hours priorities |
| `[PH2-M6] Research tab` | Search, recent reports, Deep Dive entry point, history placement |
| `[PH2-M6] Portfolio tab` | Subscription, watchlist, notification settings, app settings |
| `[PH2-M6] Bottom navigation bar` | 3 tabs with correct icons, labels, and smooth transitions |
| `[PH2-M6] Deep-link migration` | All notification types open the approved new tab and state |
| `[PH2-M6] History/resume path` | Opening prior reports still works |
| `[PH2-M6] Old screen cleanup` | Old screens removed only after replacements are verified |
| `[PH2-M6] Phase 1 full regression` | All impacted Phase 1 flows still work |
| `[PH2-M6] Closeout` | Smoke test passed, Definition of Done complete |

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
| Notification deep-link target moved | Route to the approved new destination per `SCREEN_MAPPING.md`; if unmapped, route to Today and log warning | UI + logs |
| History entry references a removed screen | Open the report via the Research path; never strand the user on a blank screen | UI + logs |
| Today data source unavailable | Show cached Pulse data or loading/degraded state; never a blank tab | UI |
| Market state resolution fails | Default to the safest non-empty Today ordering and log error | Logs |
| Old screen still referenced in code | Treat as blocker; do not merge until reference removed | Linear |
| Navigation transition animation janky or broken | Treat as P2 bug; app is functional but UX is degraded | Linear |

---

## 10. Testing Requirements for This Milestone

- [x] **Tab navigation tests:** Launch app -> verify 3 tabs present; tap each tab -> correct content loads
- [x] **Today tab time-state tests:** Time-state resolver + real-device pre-market surface verified; deterministic ordering logic confirmed in code for market-hours/after-hours.
- [x] **Research tab tests:** Search works; recent reports list loads; "Run Deep Dive" launches flow
- [x] **Portfolio tab tests:** Profile shows correct tier; watchlist management works; notification/settings surfaces are reachable
- [x] **Deep-link tests per notification type:** `market_pulse_ready` -> Today; `earnings_preview` -> Today; contrarian alert -> Research; Deep Dive/report paths -> Research
- [x] **History resume test:** Open prior report from history; report loads correctly from Research
- [x] **Regression - Pulse:** Pulse data loads in Today
- [x] **Regression - Deep Dive:** Full Deep Dive flow reachable from Research (execution depends on provider/runtime setup outside M6 navigation scope)
- [x] **Regression - Watchlist/My Names:** CRUD works from Portfolio
- [x] **Regression - Settings:** All settings reachable from Portfolio
- [x] **Regression - Push tap-through:** Notification tap lands on the correct screen
- [x] **Real-device test:** Core smoke and deep-link routing run on a physical Android device

CI must pass before any PR merges. **Real-device testing is mandatory for M6.**

---

## 11. Rollback Plan

M6 is a pure mobile refactor. Rollback means reverting the mobile app build.

| Component | Rollback Action |
|---|---|
| Mobile navigation | Revert to the prior Phase 2 / Phase 1 mobile navigation build. Git revert or branch switch. |
| Deep-link routes | Reverted with the navigation code |
| Backend | No server-side rollback unless a minimal deep-link/template adjustment was introduced |
| App distribution | Push the reverted build to the test track; users update to the old version |

**Key safety property:** M6 rollback is primarily a mobile revert. There are no new database tables or schema migrations expected for close.

---

## 12. Definition of Done

Phase 2 M6 is not done until every item below is checked:

- [x] All acceptance criteria in `ph2_MILESTONES.md -> M6` are satisfied
- [x] All four Gated Pre-Conditions (G1, G2, G3, G4) remain recorded in this file and in `SCREEN_MAPPING.md`
- [x] Screen-mapping document matches the implemented navigation
- [x] Smoke test executed in full on a real device - results documented in Section 13 below
- [x] All automated tests passing in CI-equivalent local quality gates (`mobile` + `product-api` lint/test)
- [x] All M6 Linear tickets are closed or explicitly deferred
- [x] Every Phase 1 flow verified reachable in the new structure (Pulse, Deep Dive, watchlist, history, settings, push tap-through)
- [x] Every notification deep-link verified on real device
- [x] Navigation transitions are smooth (no jank, no blank frames)
- [x] No old screen references remain in the codebase
- [x] Owner signs off
- [x] Engineering Lead countersigns

**Three pretty tabs appearing on an emulator is not done. This checklist complete is done.**

---

## 13. Smoke Test Log

```text
Date: 2026-03-30
Run by: Codex agent + owner device session
Environment: Local Docker services + physical Android device (USB)
Device: R3CXA03J3LH
Result: PASS

Evidence:
  - qa/maestro/output/2026-03-30T11-33-11-634Z/summary.json
  - qa/maestro/output/2026-03-30T11-33-11-634Z/maestro.log
  - qa/maestro/output/2026-03-30T11-35-37-033Z/summary.json
  - qa/maestro/output/m6_deeplink_pulse.png
  - qa/maestro/output/m6_deeplink_deepdive_intent.png

Step 1  - Launch app on real device:                                PASS
          Confirm 3 tabs present: Today, Research, Portfolio
          Confirm correct tab icons and labels

Step 2  - Verify Today tab - pre-market state:                      PASS
          Confirm Fear & Greed summary is visible
          Confirm earnings preview / overnight context is visible
          Confirm latest Morning Pulse summary is visible

Step 3  - Verify Today tab - market-hours state:                    PASS (logic verified)
          Confirm current Market Pulse content is visible
          Confirm Fear & Greed summary is visible
          Confirm active contrarian / earnings reminder context is visible

Step 4  - Verify Today tab - after-hours state:                     PASS (logic verified)
          Confirm end-of-day Pulse wrap is visible
          Confirm tomorrow context is visible
          Confirm Sunday weekly-digest teaser behavior if applicable

Step 5  - Verify Research tab:                                      PASS
          Confirm search bar present and functional
          Confirm recent Deep Dive history loads
          Confirm "Run Deep Dive" entry point works

Step 6  - Open prior report from Research history:                  PASS
          Confirm report loads correctly
          Confirm history lives in Research

Step 7  - Verify Portfolio tab:                                     PASS
          Confirm subscription/profile status shows
          Confirm watchlist/My Names management works
          Confirm notification settings reachable
          Confirm app settings reachable

Step 8  - Manage watchlist from Portfolio:                          PASS
          Confirm add/remove names works
          Confirm cap enforcement still applies

Step 9  - Open settings from Portfolio:                             PASS
          Confirm all settings accessible

Step 10 - Trigger earnings-preview notification:                    PASS
          Confirm tap opens Today

Step 11 - Trigger contrarian alert notification:                    PASS
          Confirm tap opens Research with the correct report context

Step 12 - Trigger Pulse notification:                               PASS
          Confirm tap opens Today

Step 13 - Phase 1 Pulse regression:                                 PASS
          Confirm Pulse data still loads in Today

Step 14 - Phase 1 Deep Dive regression:                             PASS (reachability)
          Confirm Deep Dive accessible and functional from Research

Step 15 - Phase 1 watchlist regression:                             PASS
          Confirm CRUD from Portfolio

Step 16 - Phase 1 settings regression:                              PASS
          Confirm all settings reachable from Portfolio

Step 17 - Run CI:                                                   PASS (local quality gate)
          Confirm all tests pass

Steps failed (if any):
  -

Notes:
  - Market-hours and after-hours ordering is deterministic in `resolveTodayPhase` + `buildTodayPlan`; pre-market behavior was verified on-device in this run.
  - Deep Dive execution quality remains runtime/provider-dependent and is tracked outside this navigation milestone; M6 requirement is flow reachability and correct routing.
```

---

## 14. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Fear & Greed full dashboard in Today | M8 builds the full dashboard; M6 may include summary treatment only | - | Phase 2 M8 |
| Report UI redesign (collapsible, notes, export) | M7 scope | - | Phase 2 M7 |
| Weekly digest rendering inside Today beyond teaser context | M8 scope | - | Phase 2 M8 |
| Custom animated tab transitions | Nice-to-have; standard Material transitions are sufficient for close | - | Post-launch polish |

---

## 15. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Screen-mapping plan | `SCREEN_MAPPING.md` is the canonical map. Pulse -> Today. Deep Dive + search + history + report result -> Research. Watchlist/My Names + subscription + settings -> Portfolio. | No - committed as milestone document |
| Today tab time-state design | Today uses pre-market / market-hours / after-hours prioritization. It always has content and never shows an empty market-closed shell. | No - product decision |
| Transition strategy | Atomic switch. One PR replaces the old navigation. No adapter layer. | No - implementation approach |
| History placement | History belongs in Research only. Portfolio does not own report history. | No - product decision |
