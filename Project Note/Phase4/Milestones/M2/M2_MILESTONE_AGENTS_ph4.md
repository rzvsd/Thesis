# AGENTS.md - Phase 4 M2 Inbox and Notification Ledger Backend
**Milestone:** Phase 4 M2 - Inbox and Notification Ledger Backend  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase3/ph3_AGENTS.md`, then `Project Note/Phase4/ph4_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase4/Milestones/M2/M2_MILESTONE_AGENTS_ph4.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 4 M2 - Inbox and Notification Ledger Backend |
| **Linear Project** | Deferred by owner instruction for this implementation lane |
| **Owner** | Product API Engineer + Contracts Owner |
| **Status** | Closed (PASS; owner waiver and closeout sign-offs recorded) |
| **Depends on** | M1 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Alert history persistence is owned by `product-api` | RESOLVED | Product API Engineer | Milestone start |
| G2 | Public alert-ledger contracts are additive and typed | RESOLVED | Contracts Owner | Milestone start |
| G3 | Existing notification preferences remain the server truth for family enable/disable state | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G4 | Alert quieting/tuning granularity beyond current notification-family preferences is not locked | RESOLVED - extend the existing notification-family preference model with `quiet_until` | Product Lead delegate | Before any follow-up expansion |

**Rule:** M2 may add durable alert history and extend the existing notification-family preference model. It may not invent a second mute/tuning model.

---

## 1. What This Milestone Is Building

M2 makes Inbox real.

This milestone adds:

- typed alert-ledger contracts
- a durable `alert_ledger` persistence model
- list/detail/filter/feedback/mute Product API endpoints
- notification dispatch recording with reason text and exact route targets
- integration tests proving the new API surface without breaking existing notification preferences

**Plain English summary for non-technical audit:**  
M2 creates the server-backed alert history that lets Inbox explain what fired and where it should open.

---

## 2. Read These Files First

### Earlier phase docs

- `Project Note/Phase3/ph3_BLUEBOOK.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/ph3_PRD.md`

### Phase 4 docs

- `Project Note/Phase4/ph4_AGENTS.md`
- `Project Note/Phase4/ph4_BLUEBOOK.md`
- `Project Note/Phase4/ph4_MILESTONES.md`
- `Project Note/Phase4/ph4_PRD.md`
- `Project Note/Phase4/PH4_SCREEN_MAPPING.md`
- `Decisions/ADR-007-mobile-ia-v2.md`

### Current code surfaces

- `packages/contracts/src/alert-ledger.ts`
- `packages/contracts/src/index.ts`
- `apps/product-api/src/server.ts`
- `apps/product-api/src/store.ts`
- `apps/product-api/src/types.ts`
- `apps/product-api/src/migrations.ts`
- `infra/migrations/ph4m2_017_alert_ledger.up.sql`
- `infra/migrations/ph4m2_017_alert_ledger.down.sql`
- `apps/product-api/tests/ph4-m2-alert-ledger.test.ts`

---

## 3. Scope - What Is In

- [x] Typed alert-ledger contracts
- [x] Durable `alert_ledger` persistence
- [x] Alert list/detail/filter/feedback/mute endpoints
- [x] Notification dispatch writes alert-ledger rows with reason text and routes
- [x] Existing notification preferences remain compatible
- [x] Integration-test coverage for the new API surface

Full acceptance source: `Project Note/Phase4/ph4_MILESTONES.md -> M2`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Android UI integration | M3 |
| Physical-device proof | M4 |
| New cross-family category mute or broader frequency-tuning model | Deliberately deferred; M2 now uses `quiet_until` on the existing notification-family preference model |
| Linear project/ticket creation | Explicitly skipped by owner instruction in this lane |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Contracts | `packages/contracts/` | Alert-ledger contracts, route-target exports, notification quieting shape |
| Product API | `apps/product-api/` | Persistence, endpoints, dispatch recording, telemetry, notification quieting enforcement |
| Infra | `infra/migrations/` | Alert-ledger migration pair and notification-preference quieting migration |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| `AlertLedgerItem` | New | `packages/contracts/src/alert-ledger.ts` |
| `AlertLedgerListResponse` | New | `packages/contracts/src/alert-ledger.ts` |
| `AlertLedgerFilter` | New | `packages/contracts/src/alert-ledger.ts` |
| `AlertFeedbackSubmission` | New | `packages/contracts/src/alert-ledger.ts` |
| `AlertRouteTarget` | New | `packages/contracts/src/alert-ledger.ts` |
| `NotificationPreferenceItem.quiet_until` | Additive | `packages/contracts/src/notification-preference.ts` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 4 M2 Change | Why Here |
|---|---|---|---|
| Notification families and preferences | Phase 3 M2 | Add durable alert-history recording and temporary quieting without breaking preference truth | Inbox depends on history, but settings truth must survive |
| Product API persistence doctrine | Phase 3 | Add `alert_ledger` as a queryable Product API-owned table | Alert history must not live only in analytics or mobile |
| Push deep-link semantics | Phase 1-3 | Add exact route/alert identifiers to push payloads | Inbox and downstream routing need the same identifiers |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Deferred by owner instruction

**Naming if enabled later:**
```text
[PH4-M2] What is being built
[PH4-M2][BUG] What is broken
[PH4-M2][SPIKE] What is being investigated
```

**Owner instruction for this lane:** Do not update Linear. Record any follow-up requirement in deferrals instead.

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Alert ledger item recorded | INFO | `{ service, user_id_hash, notification_type, route, alert_id, timestamp }` |
| Alert list retrieved | INFO | `{ service, user_id_hash, limit, category, timestamp }` |
| Alert feedback submitted | INFO | `{ service, user_id_hash, alert_id, feedback, timestamp }` |
| Alert muted | INFO | `{ service, user_id_hash, alert_id, notification_type, quiet_until, timestamp }` |

---

## 10. Testing Requirements

- [x] Product API typecheck passes
- [x] Alert-ledger integration test passes
- [x] Existing notification-preference test path still passes
- [x] Quieting implementation is documented without introducing a second preference model

Detailed execution lives in `M2_SMOKE_PLAN_ph4.md`.

---

## 11. Definition Of Done

- [x] All implemented M2 acceptance criteria in `ph4_MILESTONES.md` are satisfied locally
- [x] Smoke plan executed with evidence
- [x] Migration pair exists for the alert ledger table
- [x] Additive migration exists for notification-preference quieting
- [x] Existing notification-preference compatibility verified
- [x] Linear tickets created or explicitly waived by owner
- [x] Product Lead sign-off recorded
- [x] Engineering Lead countersign recorded
- [x] Quieting decision recorded for the existing notification-family model

---

## 12. Smoke Test Log

```text
Date: 2026-04-08
Run by: Codex
Environment: Local Product API test suite
Result: PASS

Notes:
- Summary artifact: `Project Note/Phase4/Milestones/M2/evidence/2026-04-08/m2-api-smoke-summary.json`
- Integration coverage: `apps/product-api/tests/ph4-m2-alert-ledger.test.ts`
- Contracts: `packages/contracts/src/alert-ledger.ts`
- Migrations:
  - `infra/migrations/ph4m2_017_alert_ledger.up.sql`
  - `infra/migrations/ph4m2_017_alert_ledger.down.sql`
  - `infra/migrations/ph4m2_018_notification_preference_quieting.up.sql`
  - `infra/migrations/ph4m2_018_notification_preference_quieting.down.sql`
- Quieting semantics: `quiet_until` extends the existing notification-family preference model and is enforced during delivery selection
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Linear project and ticket hygiene not created | Owner instruction explicitly said to skip Linear in this lane | N/A | Follow owner direction |
| Cross-family category mute and broader frequency tuning are still deferred | M2 now supports temporary quieting through `quiet_until`, but it does not create a second category-level preference system | N/A | Explicit follow-up scope only |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Alert ledger persistence owner | `product-api` owns durable `alert_ledger` storage | No |
| Public contract surface | New additive alert-ledger contracts under `packages/contracts` | No |
| Existing preferences compatibility | Keep notification-family preferences as the existing server truth | No |
| Temporary quieting semantics | Extend the existing notification-family preference model with `quiet_until` and use the alert mute endpoint as a 24-hour quieting adapter | No |
| Future tuning semantics | Do not add broader category-level mute or frequency policies without explicit follow-up scope | No |
