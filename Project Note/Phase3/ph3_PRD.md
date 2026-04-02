# Thesis - Phase 3 PRD

**Version:** 1.0  
**Status:** Active  
**Owner:** Product Lead  
**Last Revised:** 2026-04

> This document defines the product requirements for Phase 3.  
> Phase 1 and Phase 2 PRDs remain in force unless Phase 3 explicitly extends or sharpens them.

---

## 1. Product Vision Evolution

Phase 1 proved that Thesis could generate structured financial research.
Phase 2 proved that Thesis could package that research into a richer paid product.

Phase 3 must prove something harder:

**that users will trust it, return to it, pay for it, and keep using it after novelty wears off.**

The product is no longer judged only by feature presence.
It is judged by:

- trust
- recurrence
- premium justification
- operational confidence
- learning speed after beta and launch

---

## 2. Product Requirements

### 2.1 Trust Layer For Deep Dive (M1)

Every serious Deep Dive must make its limits and evidence visible.

Required behaviors:

- every report shows generated time, source freshness, and explicit stale/missing indicators where relevant
- every report shows evidence depth in plain language, not just internal IDs
- every management quote is traceable to transcript period/source
- every valuation section states its assumptions and is omitted when inputs are insufficient
- every report with prior comparable output includes a "what changed since last thesis" summary
- every report surfaces conflict/contradiction when the evidence points in different directions

**Product rule:** A polished report with weak accountability is unacceptable.

### 2.2 Position Monitoring And Today Loop (M2)

Thesis must behave like a position-intelligence product over time, not just an on-demand report generator.

Required behaviors:

- onboarding asks the user what names matter to them
- Today explains why the current Pulse matters to the user's followed names
- followed names show state such as intact / improved / weakened / unresolved when sufficient evidence exists
- pre-earnings and post-earnings entry points exist for followed names
- weekly summaries are personalized to the user's names and recent report history

**Product rule:** The app must answer "why should I open this today?" without making the user work for it.

**Locked implementation decision:**

- followed-name state is a persisted server-side product model owned by `product-api`
- the persisted model is `thesis_monitor_snapshots`, keyed by `user_id + ticker`
- the state is computed from:
  - the latest completed comparable Deep Dive
  - the prior comparable Deep Dive when available
  - trust metadata emitted by M1, including contradiction and freshness state
  - earnings proximity and most recent material catalyst metadata when available
- scheduler recomputes monitor state once per weekday pre-market cycle
- product-api also recomputes monitor state when a new completed Deep Dive is stored for a followed name
- state meanings are locked as:
  - `intact`: latest evidence is broadly consistent with the prior thesis and no material contradiction is open
  - `improved`: latest evidence improves conviction versus the prior thesis
  - `weakened`: latest evidence materially weakens the prior thesis
  - `unresolved`: evidence is stale, insufficient, or materially conflicting
- M2 does not add sector-following as a stored feature

### 2.3 Notification Intelligence (M2)

Notifications must earn trust.

Required behaviors:

- every notification has a clear reason tied to a name, event, or thesis shift
- duplicate or low-signal notifications are throttled
- users can control categories without disabling everything
- notification taps always land on the exact relevant context
- notification quality is measurable through open, dismiss, mute, and disable events

**Product rule:** A notification that cannot explain itself should not be sent.

### 2.4 Premium Conversion System (M3)

Phase 3 monetization is not just gating. It is value communication.

Required behaviors:

- free and Pro are separated by ongoing value, not only volume limits
- premium messaging explains why continued monitoring is worth paying for
- paywalls appear at meaningful moments, not random interruptions
- upgrade, restore, cancel, and downgrade flows are instrumented and understandable
- cancellation and downgrade reasons are captured

**Product rule:** Billing without clear premium desire is failure, even if purchases technically work.

### 2.5 Feedback And Learning System (M3, M5)

Thesis must learn from usage and mistrust quickly.

Required behaviors:

- users can flag a report as confusing, generic, stale, or useful
- users can submit cancellation reasons and product feedback in-app
- support-relevant user signals are routed into a reviewable queue
- weekly beta review uses both quantitative and qualitative evidence

**Locked implementation decision:**

- the reviewable queue is a durable Postgres queue owned by `product-api`
- the queue table stores user feedback, trust complaints, monetization reasons, route status, and triage status
- this queue is the operational source of truth; it is not PostHog-only and it is not Linear-only
- support or product ops triage the queue into Linear when a bug, product gap, or launch blocker requires tracked follow-up
- queue entries must be queryable by:
  - type
  - severity
  - source surface
  - user tier
  - report or ticker reference when present

### 2.6 Launch And Beta Discipline (M4, M5)

Launch is a gated operating process.

Required behaviors:

- repeated release-candidate smoke passes on physical Android hardware
- implemented e2e and load test coverage for core flows
- release build has no known dev-only configuration leaks
- incident, rollback, and support response paths are documented and rehearsed
- launch/no-launch decision uses explicit metrics and blocker thresholds

---

## 3. Business Rules

1. **No fake confidence.** If the report has insufficient evidence, it must say so explicitly.
2. **No generic premium promise.** Pro value must be tied to ongoing monitoring, deeper intelligence, or stronger workflow utility.
3. **No silent notification spam.** Every notification family must have quality instrumentation and throttling.
4. **No launch with known critical placeholders.** Real release hosts, pins, storage posture, and smoke proof are mandatory.
5. **No analytics vanity.** Events, dashboards, and funnels exist only if the product team will use them in real decisions.

---

## 4. Non-Functional Requirements

### Product Quality

| Metric | Target |
|---|---|
| Deep Dive trust metadata completeness | 100% of Phase 3-generated reports |
| Report quality evaluation pack | Defined and passing for at least 20 representative tickers before M1 close |
| Notification deep-link success | 100% in smoke; >= 99% in production telemetry target |
| First-value time for a new user | Under 5 minutes from successful sign-in to seeing personalized Today value |

### Growth And Monetization

| Metric | Target |
|---|---|
| Activation funnel visibility | 100% of core steps instrumented with named owners |
| Paywall event coverage | Exposure, CTA, purchase start, purchase success/fail, restore, cancel, downgrade all tracked |
| Feedback capture coverage | Report feedback and subscription-exit feedback both implemented |

### Reliability

| Metric | Target |
|---|---|
| Release-candidate smoke stability | 5 consecutive full physical-device passes before M4 close |
| E2E suite | Core user path implemented and green in CI |
| Load test coverage | Core API job path and notification path exercised in repeatable load suite |
| Crash-free session target for beta | >= 99.5% |

---

## 5. Edge Cases

### Trust Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Historical data exists but quote provenance is partial | Report cites partial transcript/quote evidence and marks limitation clearly |
| Valuation inputs are incomplete | Valuation section is omitted or degraded with reason; no placeholder fair value |
| Evidence is conflicting | Report shows the conflict and avoids overconfident synthesis |
| Prior thesis exists but current run cannot compare safely | Show "change summary unavailable" rather than fabricated drift language |

### Daily Loop Edge Cases

| Scenario | Expected Behavior |
|---|---|
| User has no followed names | Today gives a guided setup path and a strong default market view |
| User follows names with no fresh catalysts | Today still explains whether there is nothing material and why |
| User disables one notification family | Other enabled families still work; settings state is respected everywhere |

### Monetization Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Free user hits premium monitoring surface | Paywall explains ongoing value clearly and preserves context |
| User downgrades | Premium-only artifacts remain readable per policy, but premium actions/generation are gated |
| Purchase succeeds but event tracking partially fails | Entitlement remains correct; missing analytics are logged for investigation |

### Launch Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Release candidate passes locally but fails repeated device smoke | Launch blocked until repeated proof is green |
| Core API path degrades under load | Alert fires; launch blocked if thresholds are exceeded |
| Beta feedback shows trust complaints rising | Launch review must explicitly address it; no silent proceed |
