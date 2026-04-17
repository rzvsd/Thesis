# AGENTS.md - Phase 4 M3 Mobile IA V2 and Design-System Preservation
**Milestone:** Phase 4 M3 - Mobile IA V2 and Design-System Preservation  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase3/ph3_AGENTS.md`, then `Project Note/Phase4/ph4_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase4/Milestones/M3/M3_MILESTONE_AGENTS_ph4.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 4 M3 - Mobile IA V2 and Design-System Preservation |
| **Linear Project** | Owner-waived for this implementation lane (documentation closeout accepted) |
| **Owner** | Mobile Engineer |
| **Status** | Closed (owner-approved closeout recorded on 2026-04-15) |
| **Depends on** | M2 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Root app tabs are fixed as `Today / Names / Research / Inbox / You` | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G2 | Theme posture is fixed: preserve Thesis colors, typography mood, and card language | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G3 | Research remains the canonical Deep Dive and history workbench | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G4 | Quieting/tuning beyond current notification-family preferences is not locked | RESOLVED - keep existing notification-family preference model in Phase 4; defer broader tuning model | Product Lead | Before follow-up expansion |

**Rule:** M3 may reorganize the shell, but it may not quietly rebrand the app or invent new settings semantics without approval.

---

## 1. What This Milestone Is Building

M3 puts the Phase 4 structure in the Android app.

This milestone adds:

- a 5-tab root shell
- a dedicated `Names` board
- a dedicated `Inbox` screen
- a dedicated `You` control surface
- updated push/deep-link destination handling for the new tab map
- centralized Phase 4 navigation and headline copy

**Plain English summary for non-technical audit:**  
M3 changes where the product lives on Android without changing what Thesis looks and feels like.

---

## 2. Read These Files First

### Earlier phase docs

- `Project Note/Phase2/Milestones/M6/SCREEN_MAPPING.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/ph3_PRD.md`
- `Project Note/Phase3/ph3_BLUEBOOK.md`

### Phase 4 docs

- `Project Note/Phase4/ph4_AGENTS.md`
- `Project Note/Phase4/ph4_MILESTONES.md`
- `Project Note/Phase4/ph4_PRD.md`
- `Project Note/Phase4/PH4_SCREEN_MAPPING.md`
- `Decisions/ADR-007-mobile-ia-v2.md`

### Current code surfaces

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/MainViewModel.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/ThesisApp.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/MainActivity.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/push/ThesisFirebaseMessagingService.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/push/NotificationDismissReceiver.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/NamesScreen.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/InboxScreen.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/copy/Phase4Copy.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/theme/ThemeTokens.kt`

---

## 3. Scope - What Is In

- [x] 5-tab root navigation
- [x] Names board from watchlist + monitor snapshots + alert context
- [x] Research remains the Deep Dive and history workbench
- [x] Inbox consumes the alert ledger and exposes alert actions
- [x] You remains the control surface
- [x] Phase 4 navigation/headline copy is centralized
- [x] Android compile proof after the refactor

Full acceptance source: `Project Note/Phase4/ph4_MILESTONES.md -> M3`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Backend alert-ledger persistence | M2 |
| Physical-device/Maestro proof | M4 |
| New theme or brand direction | Forbidden by Phase 4 doctrine |
| Broader quieting/frequency settings model | Owner decision recorded: do not expand in Phase 4; keep existing notification-family preferences and defer broader model |
| Linear project/ticket creation | Owner-waived for this lane; documentation-only closeout is accepted |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Mobile Android | `apps/mobile/android/` | Root tabs, screens, push routing, copy centralization |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Alert-ledger mobile view consumption | Consumer only | `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt` |
| Route-target semantics | Consumer only | `apps/mobile/android/app/src/main/java/com/thesis/mobile/MainActivity.kt` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 4 M3 Change | Why Here |
|---|---|---|---|
| 3-tab Android IA | Phase 2 M6 | Replace with 5-tab shell | Phase 4 product map must become real UI |
| Today and Pulse loop | Phase 3 M2 | Keep Today as command center instead of re-homing it elsewhere | Today still owns daily context |
| Deep Dive and history | Phase 1/2/3 | Keep Research as canonical analysis workbench | Research must remain the evidence home |
| Settings and monetization | Phase 2/3 | Move into `You` without breaking current controls | Controls need one stable home |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Owner-waived (closed for this lane)

**Naming if enabled later:**
```text
[PH4-M3] What is being built
[PH4-M3][BUG] What is broken
[PH4-M3][SPIKE] What is being investigated
```

**Owner instruction for this lane:** Do not update Linear for Phase 4 implementation milestones. This waiver is accepted as the final closeout path for ticket hygiene in this lane.

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Push deep link landed | INFO | `{ service, notification_type, target_tab, ticker, alert_id, timestamp }` |
| Notification family muted from Inbox/You | INFO | `{ service, notification_type, enabled, timestamp }` |
| Alert feedback submitted from Inbox | INFO | `{ service, alert_id, feedback, timestamp }` |

---

## 10. Testing Requirements

- [x] Android Kotlin compile passes
- [x] Root tab map is updated to five tabs
- [x] Alert-ledger refresh, feedback, and mute actions are wired in the view model
- [x] Phase 4 copy layer exists for new navigation/headline text
- [x] Physical-device smoke recorded (captured in M4 evidence, 2026-04-08)
- [x] Owner decision recorded if quieting/tuning expands beyond current notification-family preferences (owner confirmed no Phase 4 expansion, 2026-04-15)

Detailed execution lives in `M3_SMOKE_PLAN_ph4.md`.

---

## 11. Definition Of Done

- [x] All implemented M3 acceptance criteria in `ph4_MILESTONES.md` are satisfied locally
- [x] Smoke plan executed with evidence
- [x] Android compile proof recorded
- [x] Existing Thesis theme remains the active UI language
- [x] Linear tickets created or explicitly waived by owner (owner-approved waiver, 2026-04-15)
- [x] Product Lead sign-off recorded (owner approval provided in-thread, 2026-04-15)
- [x] Engineering Lead countersign recorded (owner-approved closeout waiver, 2026-04-15)
- [x] Physical-device proof recorded in M4
- [x] Follow-up decision recorded if the product requires true category mute or frequency tuning beyond family preferences (defer broader model; keep existing family-preference path in Phase 4)

---

## 12. Smoke Test Log

```text
Date: 2026-04-08
Run by: Codex
Environment: Local Android compile using Android Studio JBR
Result: PASS (local compile + code-path verification)

Notes:
- Summary artifact: `Project Note/Phase4/Milestones/M3/evidence/2026-04-08/m3-mobile-compile-summary.json`
- New screens: `NamesScreen.kt`, `InboxScreen.kt`
- Copy layer: `Phase4Copy.kt`
- Root shell update: `MainViewModel.kt`, `ThesisApp.kt`
```

---

## 13. Historical Notes And Future Scope

Phase 4 M3 is fully closed. This section is retained for traceability only; anything listed below is either already resolved or future expansion outside the accepted M3 scope.

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Linear project/ticket hygiene | Owner-waived for this lane and accepted as closed documentation path | N/A | Closed |
| Physical-device and Maestro proof linkage for M3 closeout | Resolved via M4 PASS device evidence; retained for traceability | N/A | Closed via M4 evidence (2026-04-08) |
| Quiet-category and frequency-tuning semantics beyond current notification-family preferences | Owner decision recorded to keep the existing notification-family preference model in Phase 4; any broader tuning semantics are future optional scope, not an open M3 acceptance gap | N/A | Future optional scope only |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Root shell | Use 5 tabs: Today, Names, Research, Inbox, You | Covered by ADR-007 |
| Copy centralization | New IA-level labels/headlines live in `Phase4Copy.kt` | No |
| Theme posture | Reuse existing Thesis theme tokens and components | No |
| Quieting semantics | Owner decision recorded: keep current notification-family settings path for Phase 4 and defer broader category/frequency tuning semantics | No |
