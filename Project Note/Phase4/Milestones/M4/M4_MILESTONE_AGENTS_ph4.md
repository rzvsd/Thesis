# AGENTS.md - Phase 4 M4 Deep Links, Smoke, Quality, and Evidence
**Milestone:** Phase 4 M4 - Deep Links, Smoke, Quality, and Evidence  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase3/ph3_AGENTS.md`, then `Project Note/Phase4/ph4_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase4/Milestones/M4/M4_MILESTONE_AGENTS_ph4.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 4 M4 - Deep Links, Smoke, Quality, and Evidence |
| **Linear Project** | Deferred by owner instruction for this implementation lane |
| **Owner** | Mobile Engineer + QA Lead |
| **Status** | Closed (PASS; local + device proof complete) |
| **Depends on** | M3 complete; Android device/ADB lane complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Push routes are fixed to the Phase 4 tab map and remain backward-safe for older payloads | RESOLVED | Mobile Engineer + Product API Engineer | Milestone start |
| G2 | Local quality checks required for touched backend and mobile surfaces are fixed | RESOLVED | Engineering Lead | Milestone start |
| G3 | Canonical final device proof runner is Maestro once hardware is attached | RESOLVED | QA Lead | Before milestone closeout |
| G4 | Quieting/tuning semantics beyond current notification-family preferences remain unlocked | RESOLVED - implementation path selected | Product Lead delegate | Before any follow-up expansion |

**Rule:** M4 cannot be declared closed until the device/Maestro lane is run. Local proof is necessary but not sufficient.

---

## 1. What This Milestone Is Building

M4 connects the new IA to real routing proof.

This milestone adds:

- updated push/deep-link landing for the Phase 4 tab map
- alert identifiers carried through delivery/open/dismiss paths
- local quality-check evidence for workspace, Product API, and Android
- milestone evidence artifacts for closeout
- completed hardware lane proof for final Maestro/device validation

**Plain English summary for non-technical audit:**  
M4 proves the new navigation is actually connected, not just drawn.

---

## 2. Read These Files First

### Earlier phase docs

- `Project Note/Phase3/Milestones/M4/M4_MILESTONE_AGENTS_ph3.md`
- `Project Note/Phase3/Milestones/M4/M4_SMOKE_PLAN_ph3.md`

### Phase 4 docs

- `Project Note/Phase4/ph4_AGENTS.md`
- `Project Note/Phase4/ph4_MILESTONES.md`
- `Project Note/Phase4/PH4_SCREEN_MAPPING.md`
- `Project Note/Phase4/Milestones/M4/M4_SMOKE_PLAN_ph4.md`

### Current code surfaces

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/MainActivity.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/push/ThesisFirebaseMessagingService.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/push/NotificationDismissReceiver.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/MainViewModel.kt`
- `apps/product-api/src/server.ts`

---

## 3. Scope - What Is In

- [x] Phase 4 route-target handling in Android launch/push code
- [x] Alert identifiers propagated through delivery/open/dismiss telemetry
- [x] Local typecheck/test/compile proof for touched services
- [x] Milestone evidence artifact creation
- [x] Maestro/device proof after Android hardware is attached

Full acceptance source: `Project Note/Phase4/ph4_MILESTONES.md -> M4`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| New backend contract areas beyond the alert ledger | M2 already defines the contract work |
| New visual system work | Forbidden by Phase 4 doctrine |
| Linear project/ticket creation | Explicitly skipped by owner instruction in this lane |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Mobile Android | `apps/mobile/android/` | Launch routing, push handling, local compile proof |
| Product API | `apps/product-api/` | Local test proof for alert-ledger and route payload support |
| Docs/evidence | `Project Note/Phase4/` | Smoke records and evidence artifacts |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Route-target semantics | Consumer/producer alignment only | `packages/contracts/src/alert-ledger.ts` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 4 M4 Change | Why Here |
|---|---|---|---|
| Notification tap-through safety | Phase 1-3 | Route old and new payloads to reachable screens | No dead-end push routes allowed |
| Phase 3 proof discipline | Phase 3 M4 | Reuse quality/evidence posture for Phase 4 closeout | Navigation changes also need proof |
| Notification settings | Phase 3 M2 | Keep settings compatible while new Inbox actions arrive | Routing work must not break control truth |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Deferred by owner instruction

**Naming if enabled later:**
```text
[PH4-M4] What is being built
[PH4-M4][BUG] What is broken
[PH4-M4][SPIKE] What is being investigated
```

**Owner instruction for this lane:** Do not update Linear. Capture pending hardware proof in docs instead.

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Push delivered | INFO | `{ service, notification_type, target_tab, alert_id, timestamp }` |
| Push opened | INFO | `{ service, notification_type, target_tab, alert_id, timestamp }` |
| Push dismissed | INFO | `{ service, notification_type, target_tab, alert_id, timestamp }` |
| Push deep link landed | INFO | `{ service, notification_type, target_tab, ticker, alert_id, timestamp }` |

---

## 10. Testing Requirements

- [x] Workspace typecheck passes
- [x] Product API integration coverage passes
- [x] Android Kotlin compile passes
- [x] Local route-map proof exists in the touched code paths
- [x] Maestro/device proof recorded once hardware is attached
- [x] Quieting/tuning follow-up path selected for implementation

Detailed execution lives in `M4_SMOKE_PLAN_ph4.md`.

---

## 11. Definition Of Done

- [x] All implemented M4 acceptance criteria in `ph4_MILESTONES.md` are satisfied locally
- [x] Smoke plan executed with evidence
- [x] Local quality checks are recorded
- [x] Maestro/device evidence captured
- [x] Linear tickets created or explicitly waived by owner
- [x] Product Lead sign-off recorded
- [x] QA Lead sign-off recorded
- [x] Quieting/tuning follow-up decision recorded for the existing notification-family model

---

## 12. Smoke Test Log

```text
Date: 2026-04-08
Run by: Codex
Environment: Local repo workspace + local Android Studio JBR + owner-attached Android device over ADB
Result: PASS

Notes:
- Summary artifacts:
  - `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-local-smoke-summary.json`
  - `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-device-smoke-summary.json`
  - `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-quieting-proof-summary.json`
- Workspace typecheck: PASS
- Product API typecheck + tests: PASS
- Android `:app:compileDebugKotlin`: PASS
- Maestro/device proof: PASS on Android device `R3CXA03J3LH`
- Maestro artifact summary: `qa/maestro/output/2026-04-08T16-37-10-744Z/summary.json`
- Focused quieting proof: PASS via `qa/maestro/flows/ph4_m4_quieting.yaml`
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Linear project and ticket hygiene not created | Owner instruction explicitly said to skip Linear in this lane | N/A | Follow owner direction |
| Quieting/tuning semantics are implemented through the existing notification-family settings model | Chosen to preserve server-owned settings truth and avoid a premature second preference system in Phase 4 | N/A | Follow-up hardening only if product scope expands |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Route-target map | Support `today`, `names`, `research`, `inbox`, and `you`, while remaining backward-safe for older payloads | No |
| Alert identifier propagation | Carry `alert_id` through delivery/open/dismiss/landing paths | No |
| Final proof posture | Local proof plus physical-device Maestro proof are both required for closeout, and both are now recorded | No |
| Quieting semantics | Use the existing server-owned notification-family preference model as the single mute/tuning source in Phase 4; align Inbox behavior and copy to that truth rather than introducing a second preference layer prematurely | No |
