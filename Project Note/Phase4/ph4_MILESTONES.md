# Thesis - Phase 4 Milestone Briefs

**Version:** 1.0  
**Status:** Closed (M1-M4 complete)
**Last Revised:** 2026-04-17
**Related Documents:** ph4_ROADMAP.md, ph4_BLUEBOOK.md, ph4_PRD.md

---

## How To Read This Document

Phase 4 milestones are structure and routing milestones.

Each milestone defines:

- what ambiguity it removes
- what must be built
- what proof is required
- what earlier behavior must keep working

**A milestone is not closed unless every acceptance criterion is checked off.**

**Closeout normalization note (2026-04-17):** Phase 4 is fully closed. Broader quiet-category and frequency-tuning ideas remain optional future expansion only and are not open Phase 4 acceptance gaps.

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M1 | Phase 4 Baseline, Docs, and Interface Lock | Canonical docs, screen map, ADR, and named interface changes |
| M2 | Inbox and Notification Ledger Backend | Durable alert ledger persistence and typed Product API endpoints |
| M3 | Mobile IA V2 and Design-System Preservation | 5-tab Android app with preserved Thesis styling and centralized IA-level copy |
| M4 | Deep Links, Smoke, Quality, and Evidence | Updated route landing, telemetry, local smoke proof, and device-evidence lane |

---

# M1 - Phase 4 Baseline, Docs, and Interface Lock

## Goal

Make Phase 4 a governed workstream before implementation spreads.

## Deliverables

| Deliverable | Description |
|---|---|
| Phase 4 root docs | Root governance, roadmap, milestones, PRD, and bluebook in Phase 3-compatible format |
| Mobile IA ADR | ADR-007 locking the 5-tab doctrine and Inbox ownership |
| Canonical screen map | Written ownership map for `Today / Names / Research / Inbox / You` |
| Milestone-local guides | AGENTS and smoke-plan docs for M1-M4 |
| Named interface list | Alert-ledger and route-target public interfaces named before broader rollout |

## Acceptance Criteria

- [ ] `Project Note/Phase4/` exists in the same document shape as prior phases
- [ ] A canonical screen-mapping document exists for `Today / Names / Research / Inbox / You`
- [ ] `ADR-007-mobile-ia-v2.md` exists and locks the root navigation doctrine
- [ ] Phase 4 milestone-local AGENTS and smoke-plan files are created before closeout
- [ ] New alert-ledger public interface names are defined before implementation begins

## Smoke Test

```text
Step 1: Confirm Phase4 root docs exist
Step 2: Confirm milestone-local docs exist for M1-M4
Step 3: Confirm ADR-007 exists and matches the 5-tab doctrine
Step 4: Confirm PH4 screen mapping explicitly supersedes the old 3-tab assumption for future work
```

## Success

Phase 4 now has a formal written operating frame. Future code work can point to one locked navigation map and one locked ownership doctrine.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Phase 4 docs are thinner than prior phases | Doc audit | Governance drift |
| Old and new tab maps coexist without one winner | ADR/screen-map conflict | Navigation confusion and scope creep |
| Interface names are invented during implementation | Contract diff review | Alert-ledger rollout becomes inconsistent |

## Rollback

Remove Phase 4 docs only if the workstream is formally abandoned and the prior 3-tab canon is restored by owner decision.

## Dependencies

- Phase 3 docs remain the current baseline

## Owner

Product Lead + Engineering Lead

---

# M2 - Inbox and Notification Ledger Backend

## Goal

Make Inbox real by giving alerts a durable Product API-owned history.

## Deliverables

| Deliverable | Description |
|---|---|
| Alert-ledger contracts | Typed alert history and feedback payloads |
| Durable persistence | `alert_ledger` table and Product API-owned storage path |
| Alert endpoints | List/detail/filter/feedback/mute endpoints |
| Dispatch recording | Supported notifications create auditable ledger rows |
| Compatibility proof | Existing notification preferences still work |

## Acceptance Criteria

- [ ] `packages/contracts` contains typed alert-ledger contracts
- [ ] `product-api` persists alert-ledger rows server-side
- [ ] list/filter/feedback/mute endpoints exist
- [ ] notification dispatch writes alert-ledger history with reason text and route
- [ ] existing notification-preferences endpoints still work
- [ ] integration tests cover alert list/filter/actions

## Smoke Test

```text
Step 1: Register and verify a user
Step 2: Register a device token and add a followed ticker
Step 3: Trigger earnings-preview and contrarian notification flows
Step 4: Confirm `/v1/user/alerts` returns durable rows
Step 5: Confirm category filter narrows the list correctly
Step 6: Confirm alert feedback and mute endpoints update the stored row
Step 7: Confirm notification preferences still read and update correctly
```

## Success

Inbox becomes a real product surface because alert history is durable, queryable, and tied back to routes and reason text.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Inbox history exists only on mobile | API/migration audit | Alert history becomes incomplete and unauditable |
| Notification preferences regress | Integration smoke | Existing user controls lose trust |
| Stored alerts lack route or reason text | API payload review | Inbox rows become opaque |

## Rollback

Remove alert-ledger consumers and producers together and leave existing notification-preference behavior intact.

## Dependencies

- M1 complete

## Owner

Product API Engineer + Contracts Owner

---

# M3 - Mobile IA V2 and Design-System Preservation

## Goal

Ship the new 5-tab IA without breaking the Thesis look and tone.

## Deliverables

| Deliverable | Description |
|---|---|
| 5-tab shell | Root Android navigation updated to `Today / Names / Research / Inbox / You` |
| Names board | First-class per-name monitoring surface |
| Inbox UI | Alert-history screen backed by the alert ledger |
| You controls surface | Settings, trust guidance, biometric, and subscription controls under one tab |
| Copy layer | Centralized Phase 4 IA-level labels and headlines |

## Acceptance Criteria

- [ ] Android root navigation is `Today / Names / Research / Inbox / You`
- [ ] Today still loads and remains the command-center surface
- [ ] Names exists as a first-class board for followed tickers
- [ ] Research remains the canonical workbench for Deep Dive and history
- [ ] Inbox renders server-backed alert history and alert actions
- [ ] You renders controls without replacing the existing visual language
- [ ] IA-level navigation and headline copy are centralized
- [ ] Android compiles after the refactor

## Smoke Test

```text
Step 1: Compile the Android app
Step 2: Confirm five tabs render in code and route through the app shell
Step 3: Confirm Names consumes monitor snapshots plus alert-ledger context
Step 4: Confirm Inbox consumes alert-ledger history and can trigger feedback/mute plus the current quiet-family control path
Step 5: Confirm You still exposes notifications, biometric lock, subscription, and trust guidance
```

## Success

The app becomes easier to operate because the user can tell where to go for action, evidence, alerts, and controls without losing the familiar Thesis language.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| New tabs render but ownership is still muddled | UX smoke and product review | Navigation churn without clarity gain |
| Theme language drifts | Visual review | Thesis loses product identity |
| Inbox and Names depend on hidden fallback paths | Code/path review or device smoke | Users hit weak or confusing states |

## Rollback

Restore the prior 3-tab shell and keep the alert-ledger backend dormant but intact if needed.

## Dependencies

- M2 complete

## Owner

Mobile Engineer

---

# M4 - Deep Links, Smoke, Quality, and Evidence

## Goal

Make the navigation overhaul operationally believable.

## Deliverables

| Deliverable | Description |
|---|---|
| Route-target handling | Launch and push code aligned to the Phase 4 tab map |
| Local quality proof | Workspace, Product API, and Android local checks recorded |
| Evidence artifacts | Per-milestone Phase 4 evidence files written |
| Device lane | Maestro/device proof path prepared for final closeout |

## Acceptance Criteria

- [ ] push/deep-link handling supports the Phase 4 tab map locally
- [ ] local quality checks pass for touched services
- [ ] milestone evidence folders contain local proof
- [ ] Maestro/device evidence is captured once ADB hardware is attached

## Smoke Test

```text
Step 1: Run workspace typecheck
Step 2: Run Product API integration tests including alert-ledger coverage
Step 3: Compile Android with the local Android Studio JDK
Step 4: Confirm push routing code supports Today/Names/Research/Inbox/You
Step 5: Record the remaining device/Maestro lane as pending until hardware is attached
```

## Success

Phase 4 is not just implemented in code; it is locally proven and ready for the final device lane.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Push routes point to dead ends | Local smoke or device smoke | Notification trust degrades fast |
| Evidence folders are empty or incomplete | Closeout audit | Milestone theater instead of proof |
| Device proof is skipped silently | M4 closeout review | Real-world routing risk remains unknown |

## Rollback

Revert Phase 4 routing changes and restore the prior notification landing map if the new destinations prove unstable.

## Dependencies

- M3 complete
- Device lane available for final Maestro proof

## Owner

Mobile Engineer + QA Lead
