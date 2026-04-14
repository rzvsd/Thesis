# AGENTS.md - Phase 3 M2 Daily Loop, Position Monitoring and Re-engagement
**Milestone:** Phase 3 M2 - Daily Loop, Position Monitoring and Re-engagement  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase2/ph2_AGENTS.md`, then `Project Note/Phase3/ph3_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase3/Milestones/M2/M2_MILESTONE_AGENTS_ph3.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 3 M2 - Daily Loop, Position Monitoring and Re-engagement |
| **Linear Project** | Phase 3 M2 - Daily Loop, Position Monitoring and Re-engagement |
| **Owner** | Mobile Engineer + Scheduler Engineer + Product API Engineer + Product Lead |
| **Status** | In Progress |
| **Depends on** | Phase 3 M1 closed; current Today/Pulse/notification paths operational |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Personalization priority rule is fixed: no-names users see market context + add-names CTA; users with 1-10 names see the top 3 relevant name changes; users with 10+ names see the top 5 ranked items plus summary counts | RESOLVED | Product Lead | Milestone start |
| G2 | Notification throttle rule is fixed: `earnings_preview` max 1 per ticker per event, `post_earnings` max 1 per ticker per event, `thesis_shift` max 1 per ticker per 24h, `weekly_summary` max 1 per week | RESOLVED | Product Lead + Scheduler Engineer | Milestone start |
| G3 | Pre/post earnings ritual scope is fixed: no new report type; M2 reuses Today + existing Deep Dive entry with explicit "before earnings" and "what changed after earnings" states | RESOLVED | Product Lead | Milestone start |
| G4 | Personalized weekly summary inputs are fixed: followed names, prior 7-day alerts, recent comparable Deep Dive drift, and latest Pulse context | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G5 | Position-state model is fixed: Product API-owned `thesis_monitor_snapshots`, recomputed on new completed comparable Deep Dive and weekday pre-market scheduler cycle | RESOLVED | Product API Engineer + Scheduler Engineer | Milestone start |

**Rule:** M2 does not ship generic recap dressed as personalization. Relevance, cadence, and persistence are already locked above and must not be re-decided in code.

---

## 1. What This Milestone Is Building

M2 turns Thesis into an app that feels alive around the user's names.

This milestone upgrades:

- onboarding into a faster path to value
- Today into a personalized monitor surface
- notifications into explanation-first prompts
- weekly summary into a user-specific ritual

**Plain English summary for non-technical audit:**  
M2 makes Thesis answer "why should I care today?" without forcing the user to piece the story together manually.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/PRD.md`
- `Project Note/Phase1/MILESTONES.md` (M6, M7, M8, M9)

### Phase 2 docs

- `Project Note/Phase2/ph2_PRD.md` (notifications, 3-tab UX, weekly digest)
- `Project Note/Phase2/ph2_MILESTONES.md` (M5, M6, M8, M9)
- `Project Note/Phase2/Milestones/M5/M5_MILESTONE_AGENTS_ph2.md`
- `Project Note/Phase2/Milestones/M6/M6_MILESTONE_AGENTS_ph2.md`
- `Project Note/Phase2/Milestones/M8/M8_MILESTONE_AGENTS_ph2.md`

### Phase 3 docs

- `Project Note/Phase3/ph3_AGENTS.md`
- `Project Note/Phase3/ph3_PRD.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/Milestones/M2/M2_SMOKE_PLAN_ph3.md`

### Current code surfaces

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/`
- `apps/scheduler/src/`
- `apps/product-api/src/server.ts`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/notifications/`

---

## 3. Scope - What Is In

- [ ] Personalized Today prioritization
- [ ] Faster onboarding to a valuable Today state
- [ ] Thesis-aware notifications with reason and landing context
- [ ] Notification throttling and category controls
- [ ] Pre-earnings and post-earnings rituals for followed names
- [ ] Personalized weekly summary

Full acceptance source: `Project Note/Phase3/ph3_MILESTONES.md -> M2`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Premium/paywall redesign | M3 |
| Release hardening, load, e2e, pinning | M4 |
| Beta support ops | M5 |
| New community/social surfaces | Out of Phase 3 scope |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Mobile | `apps/mobile/` | Today personalization, onboarding, settings controls, weekly summary rendering |
| Scheduler | `apps/scheduler/` | Notification cadence, throttling, pre/post earnings timing, monitor refresh cadence |
| Product API | `apps/product-api/` | Personalized Today composition, notification context, user controls persistence, `thesis_monitor_snapshots` persistence |
| Observability | `packages/observability/` | Notification quality and Today-loop event taxonomy |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Today/summary or monitoring payloads | Additive or new | `packages/contracts/src/` |
| Notification decision/deep-link payloads | Additive or new | `packages/contracts/src/` |

**Rule:** New payloads must explain relevance. Do not emit opaque ranking without user-visible meaning.

---

## 7. Phase 1 and 2 Wiring Obligations

| Existing System | Built In | Phase 3 M2 Change | Why Here |
|---|---|---|---|
| Market Pulse morning briefing | Phase 1 M6 | Reprioritize around user names | Pulse must become personally relevant |
| Smart notifications and digest | Phase 2 M5/M8 | Add explanation, throttling, and personalization | Existing notification scaffolding lives here |
| Today / Research / Portfolio navigation | Phase 2 M6 | Preserve reachability while making Today more valuable | M2 must build on current UX, not replace it blindly |
| Product quality / state handling | Phase 1 M8, Phase 2 M9 | Preserve graceful empty/offline/degraded states | Personalization must not reduce resilience |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 3 M2 - Daily Loop, Position Monitoring and Re-engagement

**Naming:**
```
[PH3-M2] What is being built
[PH3-M2][BUG] What is broken
[PH3-M2][SPIKE] What is being investigated
```

| Ticket | Acceptance Mapping |
|---|---|
| `[PH3-M2] Personalized Today prioritization` | Today relevance criteria |
| `[PH3-M2] Thesis-aware notifications` | Notification reason/deep-link criteria |
| `[PH3-M2] Notification throttling and controls` | Notification quality criteria |
| `[PH3-M2] Earnings ritual flows` | Pre/post earnings criteria |
| `[PH3-M2] Personalized weekly summary` | Weekly summary criteria |
| `[PH3-M2] Regression closeout` | Existing Pulse/history/push behavior preservation |

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Today personalized | INFO | `{ service, user_state, prioritized_item_count, timestamp }` |
| Notification sent | INFO | `{ service, family, reason_code, ticker, timestamp }` |
| Notification throttled | INFO | `{ service, family, reason, timestamp }` |
| Notification dismissed | INFO | `{ notification_type, open_tab, ticker }` |
| Notification muted or disabled | INFO | `{ service, family, state, timestamp }` |
| Notification deep-link mismatch | ERROR | `{ service, family, target, timestamp }` |

---

## 10. Testing Requirements

- [ ] Integration tests for personalized Today composition
- [ ] Notification flow tests for reason payload and deep link
- [ ] Real-device verification for notification landing and settings behavior
- [ ] Pulse/history/watchlist/push regression smoke re-run
- [ ] Analytics event validation for notification quality metrics

Detailed execution lives in `M2_SMOKE_PLAN_ph3.md`.

---

## 11. Definition Of Done

- [ ] All M2 acceptance criteria in `ph3_MILESTONES.md` are satisfied
- [ ] Smoke plan executed with evidence
- [ ] Notification quality events are visible in analytics
- [ ] Existing Today/Pulse/history/push regressions still pass
- [ ] Linear tickets closed or explicitly deferred
- [ ] Product Lead sign-off recorded
- [ ] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date: 2026-04-04
Run by: Codex
Environment: Local dev (memory-store tests + Android debug compile)
Result: In progress - backend and scheduler automation green; physical-device smoke pending

Notes:
- Implemented `thesis_monitor_snapshots` persistence and `/v1/user/monitor-snapshots` endpoint.
- Added internal recompute route and scheduler-triggered pre-market recompute dispatch.
- Added automated regression proof: `apps/product-api/tests/m2-monitoring.test.ts`.
- Android build compiles with monitor payload wiring in Today + Weekly Digest surfaces.
- Added Android `push_dismissed` instrumentation via notification delete-intent receiver.
- Device smoke progression:
  - Mute-path verification passed (`attempted=1` before mute, `attempted=0` after mute).
  - Earnings-preview deep-link intent landing now routes to Deep Dive (`ORCL`, `Run Deep Dive`) after cold-start.
  - Owner-confirmed live push receipt and tap-through for ORCL on physical device after backend FCM mode re-enable.
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| None yet | - | - | - |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Today prioritization rule | No-names users see market context plus add-names CTA; 1-10 names shows top 3 relevant changes; 10+ names shows top 5 plus summary counts | No |
| Notification throttling policy | `earnings_preview` and `post_earnings` max 1 per ticker/event; `thesis_shift` max 1 per ticker per 24h; `weekly_summary` max 1 per week | No |
| Earnings ritual scope | Reuse Today plus existing Deep Dive entry with explicit before/after earnings states; no new report type | No |
| Weekly summary personalization inputs | Followed names, prior 7-day alerts, recent comparable Deep Dive drift, and latest Pulse context | No |
| Position-state model | Persist `thesis_monitor_snapshots` in Product API; recompute on weekday pre-market scheduler cycle and new completed comparable Deep Dive | No |
