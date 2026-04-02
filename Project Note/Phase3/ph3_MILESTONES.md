# Thesis - Phase 3 Milestone Briefs

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04  
**Related Documents:** ph3_ROADMAP.md, ph3_BLUEBOOK.md, ph3_PRD.md

---

## How To Read This Document

Phase 3 milestones are not feature buckets.
They are risk-reduction milestones.

Each milestone defines:

- what risk it removes
- what must be built
- what proof is required
- what existing Phase 1 and Phase 2 behaviors must keep working

**A milestone is not closed unless every acceptance criterion is checked off.**

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M1 | Intelligence Trust and Deep Dive Credibility | Trustworthy Deep Dive output with visible evidence quality, thesis-drift accountability, and quality evaluation proof |
| M2 | Daily Loop, Position Monitoring and Re-engagement | Personalized Today loop, thesis-aware notifications, and recurring user rituals around followed names |
| M3 | Monetization, Growth Instrumentation and Feedback | Clear premium ladder, conversion analytics, churn/feedback capture, and experiment-ready instrumentation |
| M4 | Mobile Reliability, Security and Operational Readiness | Stable release candidate, implemented e2e/load proof, production-safe config/storage, and launch-ready ops hardening |
| M5 | Controlled Beta and Launch Decision | Beta operating loop, support/triage process, KPI gate, and explicit go/no-go launch decision |

---

# M1 - Intelligence Trust and Deep Dive Credibility

## Goal

Make Deep Dive trustworthy enough to survive scrutiny from a serious user.

**Plain English:** The report must stop feeling like a clever artifact and start feeling like accountable research.

## Deliverables

| Deliverable | Description |
|---|---|
| Trust metadata model | Report freshness, evidence depth, contradictions, quote provenance, valuation guardrails, and change-summary fields defined and shipped |
| Thesis-drift summary | When a prior comparable report exists, the new report states what changed materially |
| Deep Dive trust UI | Mobile report surface exposes trust metadata in plain language |
| Quality evaluation pack | Repeatable evaluation dataset and rubric covering representative tickers and failure modes |
| Safe degradation rules | Missing history, conflicting evidence, stale inputs, and insufficient valuation inputs are all surfaced honestly |

## Acceptance Criteria

- [ ] Every new Phase 3 Deep Dive report includes trust metadata covering freshness, evidence depth, and missing-data truth
- [ ] Every management quote shown to the user includes traceable source/provenance metadata
- [ ] Every valuation section states assumptions and is omitted or degraded when inputs are insufficient
- [ ] When a comparable prior report exists, the report includes a thesis-drift or "what changed since last thesis" summary
- [ ] When evidence conflicts materially, the report surfaces a contradiction/conflict state instead of overconfident synthesis
- [ ] Mobile renders the new trust metadata without breaking Phase 2 report reading paths
- [ ] A quality evaluation pack covering at least 20 representative tickers exists, is committed, and has named pass thresholds
- [ ] Evaluation pack explicitly checks for generic synthesis, fabricated quotes, valuation overreach, and missing-data honesty
- [ ] Existing Phase 2 report reuse behavior still works after the trust-layer changes
- [ ] Existing Phase 1/2 Deep Dive request and retrieval smoke paths still pass

## Smoke Test

```
Step 1: Generate a fresh Deep Dive for a full-data ticker
Step 2: Confirm trust metadata is visible in API payload and mobile UI
Step 3: Confirm quote provenance is present for any displayed management quote
Step 4: Confirm valuation assumptions are visible and deterministic fields match module output
Step 5: Re-run a comparable Deep Dive with a prior stored report in place
Step 6: Confirm thesis-drift summary explains what changed since the prior thesis
Step 7: Run a missing-history or partial-data ticker
Step 8: Confirm report degrades honestly without fabricated comparisons or valuation
Step 9: Run the committed quality evaluation pack
Step 10: Re-run inherited Deep Dive regression smoke
```

## Success

Deep Dive feels inspectable, current, and accountable. A skeptical user can see what supports the report and where the limits are.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Trust metadata exists only in docs, not UI | Smoke and report review | Users still experience opaque intelligence |
| Generic synthesis survives | Evaluation pack failure or reviewer audit | Trust erosion |
| Valuation shown when inputs are insufficient | Smoke or eval failure | High reputational risk |
| Backward compatibility breaks | Retrieval/regression smoke fails | Existing report library becomes unstable |

## Rollback

Revert report trust-field consumers and producers together, preserve prior report retrieval behavior, and re-run baseline Deep Dive smoke.

## Dependencies

- Phase 2 M2, M7, and M9 closed
- Existing report reuse path understood and documented
- Named evaluation rubric approved before implementation begins

## Owner

Reasoning Engineer + Product API Engineer + Mobile Engineer + Product Lead

---

# M2 - Daily Loop, Position Monitoring and Re-engagement

## Goal

Turn Thesis into a product users reopen because it tracks what changed for their names.

**Plain English:** Today, Pulse, notifications, and digest must become a living loop, not a static recap.

## Deliverables

| Deliverable | Description |
|---|---|
| Personalized onboarding bridge | New or returning users can tell Thesis what names matter and reach value quickly |
| Position-monitoring Today loop | Today prioritizes why market and company changes matter to followed names |
| Persisted monitor model | User-level `thesis_monitor_snapshots` persisted by `product-api` and refreshed by scheduler and report completion |
| Thesis-aware notifications | Notifications include reason, context, deep link, and throttling |
| Earnings ritual flows | Pre-earnings and post-earnings entry paths for followed names |
| Personalized weekly summary | Weekly digest becomes user-specific, not generic |

## Acceptance Criteria

- [ ] New users with no names see a guided path to set up followed names and reach a useful Today state
- [ ] Users with followed names see Today content prioritized by relevance to those names
- [ ] Followed-name state (`intact`, `improved`, `weakened`, `unresolved`) is computed server-side, persisted, and exposed through a typed payload
- [ ] Monitor state is recomputed on completed comparable Deep Dive and on the weekday pre-market scheduler cycle
- [ ] Notification families include explicit reason text and deep-link to the exact relevant context
- [ ] Notification throttling and category controls are implemented and respected
- [ ] Open, dismiss, mute, disable, and deep-link success are instrumented for notification families
- [ ] Pre-earnings and post-earnings flows exist for relevant followed names
- [ ] Weekly summary is personalized using user names, recent report history, or recent follow activity
- [ ] Existing Pulse history, Deep Dive history, and push tap-through flows remain reachable
- [ ] Existing Phase 1/2 Market Pulse and watchlist/My Names regressions still pass

## Smoke Test

```
Step 1: Sign in as a user with no followed names
Step 2: Confirm Today shows setup guidance and a useful default market view
Step 3: Add followed names and reload Today
Step 4: Confirm Today reprioritizes around those names
Step 5: Confirm persisted monitor state exists for at least one followed name and matches the API payload
Step 6: Trigger a thesis-aware notification in staging
Step 7: Confirm notification reason text, deep link, and landing context are correct
Step 8: Mute one notification family and verify it no longer sends
Step 9: Trigger pre-earnings or post-earnings flow for a followed name
Step 10: Open weekly summary and confirm it is personalized
Step 11: Re-run inherited Pulse/history/watchlist/push regression smoke
```

## Success

Thesis now answers "why should I open this today?" and "why did this alert fire?" in a way users can understand immediately.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Today still feels generic | Personalized smoke and product review | Retention stays weak |
| Notifications remain noisy | Opt-out/mute rates and qualitative feedback | Re-engagement channel degrades |
| Deep links drift from relevance | Smoke failure | Trust and usability damage |
| Weekly summary is still generic recap | Content review and engagement metrics | No habit formation benefit |

## Rollback

Disable new notification families or personalization layers, restore last stable Today prioritization, and confirm inherited Today/Pulse flows still work.

## Dependencies

- M1 closed
- Phase 2 M5, M6, M8, and M9 closed
- Current notification inventory and settings behavior documented

## Owner

Mobile Engineer + Scheduler Engineer + Product API Engineer + Product Lead

---

# M3 - Monetization, Growth Instrumentation and Feedback

## Goal

Make premium value understandable, measurable, and improvable.

**Plain English:** This milestone makes sure Thesis can learn why people convert, why they do not, and why they leave.

## Deliverables

| Deliverable | Description |
|---|---|
| Premium ladder revision | Free vs Pro boundaries are reframed around ongoing monitoring value |
| Paywall and upgrade system | Contextual paywall messaging and tracked purchase paths |
| Growth analytics model | Activation, retention, conversion, churn, and content-value events defined and owned |
| Reviewable feedback queue | Durable `user_feedback_queue` owned by `product-api` and used for human triage |
| Feedback capture | In-app report feedback, confusion feedback, and cancellation/downgrade reason capture |
| Experiment readiness | Feature-flag or experiment path for testing paywall or value-proposition variants |

## Acceptance Criteria

- [ ] Free vs Pro differences are documented and shipped in product copy and server enforcement
- [ ] Paywall surfaces explain premium value in product terms, not just feature inventory
- [ ] Exposure, CTA, purchase start, purchase success/fail, restore, cancel, downgrade, and win-back events are instrumented
- [ ] Activation, retention, notification quality, content quality, monetization, and churn dashboards have named owners
- [ ] At least three core funnels exist: activation, repeat-use/retention proxy, and Pro conversion
- [ ] Users can submit report usefulness/confusion feedback in-app
- [ ] Users can submit cancellation or downgrade reasons in-app
- [ ] Feedback and cancellation signals land in a durable Product API-owned queue before any human triage
- [ ] Queue items are triageable by type, severity, source surface, user tier, and related report/ticker when present
- [ ] Existing entitlement truth remains server-authoritative and Phase 2 monetization regressions still pass
- [ ] Event semantics and properties are documented well enough that dashboards are reproducible

## Smoke Test

```
Step 1: Sign in as a free user and hit a premium boundary
Step 2: Confirm paywall messaging explains why premium matters
Step 3: Trigger upgrade flow in staging and confirm entitlement sync still works
Step 4: Trigger restore flow and confirm server truth remains correct
Step 5: Submit report feedback from a Deep Dive
Step 6: Submit cancellation or downgrade feedback in staging path
Step 7: Confirm both feedback paths land in the durable review queue with expected routing metadata
Step 8: Validate required events land in analytics with expected properties
Step 9: Confirm dashboards and funnels populate from smoke data
Step 10: Re-run inherited auth, profile, and entitlement regression smoke
```

## Success

The team can answer why users convert, why they hesitate, and why they leave. Premium value becomes explicit instead of assumed.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Premium is still vague | Paywall review and conversion metrics | Low conversion |
| Billing works but analytics are weak | Smoke/dashboard audit | No learning loop |
| Feedback capture exists but is not routed | Review loop missing | Qualitative insight gets lost |
| Entitlement regressions occur | Auth/monetization smoke fails | Revenue and trust risk |

## Rollback

Disable new paywall variants or experiment branches, keep server-authoritative entitlement path intact, and revert to prior stable paywall UX if needed.

## Dependencies

- M2 closed
- Phase 2 M4 and M9 closed
- RevenueCat and analytics ownership confirmed

## Owner

Product Lead + Product API Engineer + Mobile Engineer + Analytics Owner

---

# M4 - Mobile Reliability, Security and Operational Readiness

## Goal

Close the gap between "works in our environment" and "safe to launch."

**Plain English:** This milestone removes the embarrassing release-candidate failures that break trust in week one.

## Deliverables

| Deliverable | Description |
|---|---|
| Stable release-candidate smoke suite | Repeatable physical-device smoke evidence for core flows |
| Implemented e2e suite | Canonical CI suite in `tests/e2e/` executed by `pnpm test:e2e` against the repo stack |
| Implemented load suite | Canonical load suite in `tests/load/` executed by `pnpm test:load` with fixed mandatory scenarios |
| Release-safe config and storage | No dev defaults in release path; artifact storage and push model are production-safe |
| Security closeout | Real certificate pinning, release verification, and config hygiene |
| Ops readiness | Alerts, runbooks, queue/storage visibility, rollback proof |

## Acceptance Criteria

- [ ] Five consecutive full physical-device smoke runs pass on the release candidate build
- [ ] `tests/e2e/` contains implemented core-flow coverage and is exercised in CI
- [ ] `tests/load/` contains implemented load scenarios for at least the core report path and notification path
- [ ] Canonical physical-device smoke runner is Maestro under `qa/maestro/`; M4 closeout uses Maestro artifacts as the source of truth for the five-pass requirement
- [ ] Canonical CI e2e runner is the repo `tests/e2e/` suite executed by `pnpm test:e2e`
- [ ] Canonical load runner is the repo `tests/load/` suite executed by `pnpm test:load`
- [ ] Mandatory load scenarios are fixed as:
  - Deep Dive request enqueue and report retrieval path
  - Latest Market Pulse retrieval path
  - Notification fan-out orchestration path
- [ ] Load thresholds are fixed as:
  - API error rate under 1% for mandatory scenarios
  - Deep Dive request enqueue path p95 under 750ms with 25 concurrent virtual users sustained for 5 minutes
  - Latest Pulse retrieval p95 under 300ms with 50 concurrent virtual users sustained for 5 minutes
  - Notification fan-out scenario completes a 1,000-recipient synthetic batch within 5 minutes with under 1% failed deliveries in the staging test harness
- [ ] Release build paths contain no dev base URLs, placeholder pins, or fallback secrets
- [ ] Certificate pinning is implemented with real production values and proven in release behavior
- [ ] Artifact storage is production-safe for multi-instance deployment
- [ ] Push delivery model supports multiple active devices per user or an explicitly approved alternative with proof
- [ ] Core alerts exist for API failures, queue failures, notification failures, and stale scheduled jobs
- [ ] Existing Phase 1 and Phase 2 mobile and backend regression smoke still pass

## Smoke Test

```
Step 1: Build release candidate and install on physical device
Step 2: Run canonical Maestro release-candidate flow
Step 3: Repeat full device smoke until five consecutive passes are recorded
Step 4: Run `pnpm test:e2e` and confirm CI path is green
Step 5: Run `pnpm test:load` mandatory scenarios and record threshold results
Step 6: Verify release config contains real production-safe values and no placeholders
Step 7: Verify certificate pinning behavior in release path
Step 8: Verify multi-device push behavior or approved equivalent
Step 9: Trigger alert-worthy failure paths in staging and confirm observability
Step 10: Re-run inherited Phase 1/2 regression smoke
```

## Success

The product behaves like a real release candidate. Operational surprises are reduced before beta and launch.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Smoke remains flaky | Consecutive-run requirement fails | Launch confidence remains fake |
| E2E/load remain placeholder docs | Repo review and CI audit | No real launch proof |
| Dev-safe defaults leak into release | Config audit | Severe trust and security risk |
| Artifact or push model is not production-safe | Staging/runtime audit | Reliability failures under growth |

## Rollback

Revert the destabilizing release-candidate changes, restore the last stable production-safe config path, and re-run baseline smoke before retrying.

## Dependencies

- M3 closed
- Phase 1 M9 and Phase 2 M9 hardening context understood
- Release-candidate environment available

## Owner

Mobile Engineer + Platform Engineer + Product API Engineer + QA Lead

---

# M5 - Controlled Beta and Launch Decision

## Goal

Replace launch optimism with launch discipline.

**Plain English:** This milestone forces the team to prove that real users are getting value and that the team can respond when they do not.

## Deliverables

| Deliverable | Description |
|---|---|
| Controlled beta plan | Defined cohort, support path, review cadence, and success thresholds |
| Beta issue intake | Tagged support/feedback process tied back to product and engineering owners |
| Launch scorecard | Activation, retention proxy, notification quality, trust complaints, crash-free, conversion, churn, and blocker status |
| Go/no-go checklist | Explicit release gate and rollback criteria |
| Final launch rehearsal | End-to-end beta/launch smoke rehearsal with evidence |

## Acceptance Criteria

- [ ] Beta cohort definition, invite criteria, and support owner are documented
- [ ] Beta feedback intake and triage process is live and assigned
- [ ] Weekly review template exists and is used for beta evidence review
- [ ] Launch scorecard includes activation, repeat-use proxy, crash-free sessions, notification disablement, trust complaints, conversion, and churn indicators
- [ ] Go/no-go checklist exists with explicit blocker thresholds
- [ ] Final launch rehearsal is executed and evidence is recorded
- [ ] Any unresolved launch blockers are either fixed or explicitly cause a no-go decision
- [ ] Product, Engineering, and QA sign-off fields exist and are completed

## Smoke Test

```
Step 1: Walk through beta onboarding and support path end to end
Step 2: Validate beta feedback reaches the correct review surface
Step 3: Review launch scorecard population from live beta data or staged rehearsal data
Step 4: Execute final launch rehearsal using release candidate build and current backend
Step 5: Run go/no-go review against the written checklist
Step 6: Record final sign-off or no-go decision with reasons
```

## Success

The team has enough real evidence to decide whether Thesis should launch, continue in beta, or be blocked.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Beta feedback has no owner | Review loop fails | Problems repeat without response |
| Launch scorecard is incomplete | Launch review audit | No evidence-based decision |
| Rehearsal exposes blockers late | Final smoke failure | Launch delay or bad launch |
| Team launches despite blockers | Checklist ignored | Avoidable trust damage |

## Rollback

No public launch. Continue beta, fix blockers, and rerun M4 and M5 proof before re-approving launch.

## Dependencies

- M4 closed
- Support, Product, Engineering, and QA owners named

## Owner

Product Lead + Engineering Lead + QA Lead + Support Owner
