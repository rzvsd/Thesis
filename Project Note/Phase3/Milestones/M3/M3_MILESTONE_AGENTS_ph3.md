# AGENTS.md - Phase 3 M3 Monetization, Growth Instrumentation and Feedback
**Milestone:** Phase 3 M3 - Monetization, Growth Instrumentation and Feedback  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase2/ph2_AGENTS.md`, then `Project Note/Phase3/ph3_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase3/Milestones/M3/M3_MILESTONE_AGENTS_ph3.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 3 M3 - Monetization, Growth Instrumentation and Feedback |
| **Linear Project** | Phase 3 M3 - Monetization, Growth Instrumentation and Feedback |
| **Owner** | Product Lead + Product API Engineer + Mobile Engineer + Analytics Owner |
| **Status** | Planned |
| **Depends on** | Phase 3 M2 closed; existing RevenueCat/server-truth monetization path operational |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Free vs Pro boundary is fixed: Free includes Market Pulse, Fear & Greed, up to 5 names, and 1 Deep Dive/day; Pro adds up to 20 names, ongoing thesis monitoring, thesis-aware alerts, personalized weekly summary, and export/notes/scenarios | RESOLVED | Product Lead | Milestone start |
| G2 | Core growth event taxonomy is fixed: activation, first_value, report_read_depth, notification_engagement, paywall_exposure, purchase_flow, cancel_reason, and trust_feedback | RESOLVED | Analytics Owner + Product Lead | Milestone start |
| G3 | Feedback taxonomy is fixed: `useful`, `confusing`, `generic`, `stale`, `bug_report`, `cancel_price`, `cancel_low_value`, `cancel_too_noisy`, `cancel_other` | RESOLVED | Product Lead | Milestone start |
| G4 | Experiment framework scope is fixed: copy, paywall placement, CTA ordering, and summary framing may vary; entitlement truth and free-tier limits may not vary client-side | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G5 | Reviewable queue sink is fixed: Product API-owned Postgres `user_feedback_queue`; human triage to Linear happens after persistence, not instead of persistence | RESOLVED | Product API Engineer + Support Owner | Milestone start |

**Rule:** M3 is not allowed to produce billing complexity without better value communication, measurement, and a durable feedback sink.

---

## 1. What This Milestone Is Building

M3 makes Thesis commercially legible and measurable.

This milestone upgrades:

- premium value communication
- paywall relevance
- conversion analytics
- churn/feedback capture
- experiment readiness

**Plain English summary for non-technical audit:**  
M3 makes sure the app can explain why users should pay, and lets the team learn why they do or do not.

---

## 2. Read These Files First

### Phase 2 docs

- `Project Note/Phase2/ph2_PRD.md` (subscription tiers, business rules)
- `Project Note/Phase2/ph2_MILESTONES.md` (M4, M9)
- `Project Note/Phase2/Milestones/M4/M4_MILESTONE_AGENTS_ph2.md`
- `Project Note/Phase2/Milestones/M9/M9_MILESTONE_AGENTS_ph2.md`

### Phase 3 docs

- `Project Note/Phase3/ph3_AGENTS.md`
- `Project Note/Phase3/ph3_PRD.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/Milestones/M3/M3_SMOKE_PLAN_ph3.md`

### Current code surfaces

- `apps/product-api/src/server.ts`
- `apps/product-api/src/store.ts`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/billing/`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/observability/`
- `packages/observability/`

---

## 3. Scope - What Is In

- [ ] Premium ladder revision in product copy and server enforcement
- [ ] Contextual paywall improvements
- [ ] Growth event taxonomy and named dashboard/funnel ownership
- [ ] In-app report feedback and cancellation/downgrade capture
- [ ] Experiment-ready path for premium messaging or flow variants

Full acceptance source: `Project Note/Phase3/ph3_MILESTONES.md -> M3`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| New release hardening or certificate work | M4 |
| Beta support operations | M5 |
| New report trust fields | M1 |
| New Today-loop personalization rules | M2 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Product API | `apps/product-api/` | Entitlement-safe paywall/context endpoints, `user_feedback_queue` ingestion, analytics event support |
| Mobile | `apps/mobile/` | Paywall UI/copy, feedback capture flows, growth instrumentation |
| Observability | `packages/observability/` | Event taxonomy, dashboard/funnel contract, validation |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Profile/paywall context payloads | Additive | `packages/contracts/src/` |
| Feedback submission payloads | New or additive | `packages/contracts/src/` |

**Rule:** Entitlement remains server-authoritative. M3 may improve messaging and measurement, but it does not move authority to the client.

---

## 7. Phase 1 and 2 Wiring Obligations

| Existing System | Built In | Phase 3 M3 Change | Why Here |
|---|---|---|---|
| Free/Pro entitlement model | Phase 2 M4 | Clarify value and measure conversion | Billing exists already; now it must become useful for product learning |
| Launch dashboards/funnels scaffold | Phase 2 M9 | Replace partial proof with owned decision metrics | Analytics must become decision-grade |
| Existing auth/profile flows | Phase 1 M4, Phase 2 M4 | Preserve auth and entitlement correctness | Monetization changes cannot destabilize account state |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 3 M3 - Monetization, Growth Instrumentation and Feedback

**Naming:**
```
[PH3-M3] What is being built
[PH3-M3][BUG] What is broken
[PH3-M3][SPIKE] What is being investigated
```

| Ticket | Acceptance Mapping |
|---|---|
| `[PH3-M3] Premium ladder and paywall revision` | Premium/value acceptance criteria |
| `[PH3-M3] Growth event taxonomy and dashboards` | Analytics/funnel acceptance criteria |
| `[PH3-M3] In-app report feedback` | Feedback acceptance criteria |
| `[PH3-M3] Cancellation and downgrade reasons` | Churn insight acceptance criteria |
| `[PH3-M3] Monetization regression closeout` | Existing entitlement path preservation |

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Paywall shown | INFO | `{ service, surface, trigger, user_tier, timestamp }` |
| Purchase started | INFO | `{ service, surface, product_id, timestamp }` |
| Purchase completed | INFO | `{ service, product_id, result, timestamp }` |
| Report feedback submitted | INFO | `{ service, report_id, feedback_type, timestamp }` |
| Cancel/downgrade reason submitted | INFO | `{ service, reason_code, timestamp }` |
| Event taxonomy mismatch | ERROR | `{ service, event_name, reason, timestamp }` |

---

## 10. Testing Requirements

- [ ] Integration tests for feedback ingestion and paywall context endpoints
- [ ] Staging validation for upgrade/restore server truth
- [ ] Dashboard/funnel validation from smoke-generated events
- [ ] Auth/profile/entitlement regression smoke re-run

Detailed execution lives in `M3_SMOKE_PLAN_ph3.md`.

---

## 11. Definition Of Done

- [ ] All M3 acceptance criteria in `ph3_MILESTONES.md` are satisfied
- [ ] Smoke plan executed with evidence
- [ ] Dashboards and funnels have named owners
- [ ] Existing entitlement regressions still pass
- [ ] Linear tickets closed or explicitly deferred
- [ ] Product Lead sign-off recorded
- [ ] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date:
Run by:
Environment:
Result:

Notes:
- 
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
| Free vs Pro boundary | Free keeps Market Pulse, Fear & Greed, up to 5 names, and 1 Deep Dive/day; Pro adds up to 20 names, ongoing monitoring, thesis-aware alerts, personalized weekly summary, and export/notes/scenarios | No |
| Growth event taxonomy | Activation, first_value, report_read_depth, notification_engagement, paywall_exposure, purchase_flow, cancel_reason, and trust_feedback are required event families | No |
| Feedback taxonomy | `useful`, `confusing`, `generic`, `stale`, `bug_report`, `cancel_price`, `cancel_low_value`, `cancel_too_noisy`, and `cancel_other` | No |
| Experiment scope | Copy, paywall placement, CTA ordering, and summary framing may vary; entitlement truth and free-tier limits may not vary client-side | No |
| Reviewable queue sink | Persist feedback first into Product API-owned Postgres `user_feedback_queue`; create Linear issues only after human triage | No |
