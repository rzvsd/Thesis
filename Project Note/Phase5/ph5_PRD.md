# Thesis - Phase 5 PRD

**Version:** 1.0  
**Status:** Active  
**Owner:** Product Lead  
**Last Revised:** 2026-04-09

> This PRD defines the product requirements for Phase 5 Active Intelligence Engine.
> Earlier PRDs remain in force unless Phase 5 explicitly sharpens retention, exception logic, or conviction workflows.

---

## 1. Product Vision Evolution

Thesis moves from periodic research consumption to continuous intelligence support.

The product must now be judged by:

- exception quality over alert volume
- thesis-aware explanation quality
- confidence freshness transparency
- cross-name context quality
- user learning velocity over time

---

## 2. Product Requirements

### 2.1 Kill-Switch Monitoring

Required behavior:

- every completed Deep Dive can produce 3-5 falsifiable kill-switch conditions
- conditions persist as durable rules under user+ticker scope
- scheduler evaluates rule matches on daily and event-triggered cadence
- triggered rules create explainable alert-ledger records and push routes

### 2.2 Thesis Freshness and Decay

Required behavior:

- each followed name has freshness score and freshness state
- freshness considers thesis age, unreviewed material events, and kill-switch proximity
- state set includes `current`, `aging`, `stale`, `triggered`
- "review needed" outputs are explainable and routed to actionable context

### 2.3 Morning Exception Briefing

Required behavior:

- morning briefing is personalized to followed names and thesis relevance
- output can be either exceptions list or explicit "nothing changed"
- briefing references rule matches, freshness changes, and macro relevance as needed
- briefing output is durable in alert ledger

### 2.4 Earnings War Room

Required behavior:

- pre-event playbook exists for event-window names
- live event window supports accelerated signal updates
- live cadence defaults to `15 min` and may fall back to `30 min` under explicit degradation conditions
- War Room routing uses route-safe payloads with `open_tab=research`, `notification_type=earnings_war_room`, and `war_room_id`
- War Room is Pro-tier only in M4; Free tier keeps earnings preview behavior and does not receive War Room payloads
- M4 cutover is coexistence, not hard replacement: legacy `earnings_preview` remains active for Free and serves as degraded fallback for Pro if War Room preparation fails
- post-event flow auto-queues thesis update and drift summary
- kill-switch rules and freshness state are re-evaluated post event
- pre/live/post activity is durable and auditable, with each phase linked to alert history when user-facing notifications are emitted

Cadence degradation doctrine for M4:

| Transition | Deterministic rule |
|---|---|
| `15 -> 30` | Trigger when any one condition occurs for the same `war_room_id`: (a) 2 consecutive cycle failures/timeouts, (b) source freshness lag `>= 20 min` for 2 consecutive cycles, or (c) cycle runtime `> 12 min` for 2 consecutive cycles |
| `30 -> 15` | Recover only after 3 consecutive healthy cycles where status is success, source freshness lag `<= 10 min`, and cycle runtime `<= 8 min` |

### 2.5 Cross-Name Intelligence

Required behavior:

- relationship graph stores supplier, competitor, partner, and sector links
- events on name X can propagate to related names in user watchlist
- propagated alerts include relationship explanation and confidence context
- default propagation threshold is `0.70` confidence; lower-confidence edges remain stored but do not alert by default

### 2.6 Conviction Intelligence

Required behavior:

- decision journal captures thesis snapshots and user responses at key moments
- monthly coherence outputs highlight overlap, contradiction, and mismatch patterns
- opposite-case generation is one tap from a Deep Dive and tied to original report context

### 2.7 Scenario Stress Cards

Required behavior:

- predefined macro scenarios are runnable against user thesis set
- output identifies exposed names, likely thesis breaks, and suggested rule additions
- cards are explainable and actionable without requiring real-time streams

---

## 3. Business Rules

1. **Exception-first:** default output is silence unless meaningful change exists.
2. **Thesis-native:** every output ties back to user thesis and evidence context.
3. **Decay-visible:** stale conviction is surfaced clearly, not hidden.
4. **Cross-name-aware:** related-name propagation is expected, not optional.
5. **Accountability-first:** user conviction history must support retrospection and learning.
6. **Visual continuity:** all new surfaces keep the same Thesis colors, typography, tone, and component style.

---

## 4. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Contracts | New payloads are typed and additive under `packages/contracts` |
| Scheduler | Daily and event-window jobs are idempotent, observable, and fail-safe |
| Dexter | New prompts are LangSmith-registered and traceable |
| Product API | New endpoints are integration-tested with deterministic fixtures |
| Mobile | New surfaces preserve existing Thesis visual language |
| Alerts | Every alert row includes reason text and resolvable target |
| Operational defaults | War Room default/fallback cadence, explicit degradation/recovery thresholds, and propagation confidence threshold are enforced and tested |

---

## 5. Tiering Doctrine (Post-Phase-5)

| Tier | Scope |
|---|---|
| Free | 1 Deep Dive/day, up to 3 names, generic market pulse, no kill-switch, no War Room, no cross-name intelligence, no stress cards |
| Pro | Unlimited Deep Dives, expanded names, kill-switch monitoring, personalized exception briefing, War Room, cross-name intelligence, conviction system, stress cards |

---

## 6. Edge Cases

| Scenario | Expected Behavior |
|---|---|
| No followed names | Briefing confirms no personalized exceptions and offers name-add path |
| Missing upstream signal source | Rule evaluation degrades gracefully and marks missing inputs explicitly |
| Overlapping rule matches | Alert groups preserve explainability per rule and per source |
| User ignores repeated freshness prompts | System keeps decay honest and avoids spam loops |
| Cross-name relationship low confidence | Propagation output includes confidence and can be suppressed by threshold |
