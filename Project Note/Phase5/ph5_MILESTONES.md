# Thesis - Phase 5 Milestone Briefs

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04-08  
**Related Documents:** ph5_ROADMAP.md, ph5_BLUEBOOK.md, ph5_PRD.md

---

## How To Read This Document

Phase 5 milestones are intelligence-system milestones.

Each milestone defines:

- what user-value gap it closes
- what must be built
- what proof is required
- what existing behavior must remain stable

**A milestone is not closed unless every acceptance criterion is checked.**

Visual guardrail for all milestones:

- Keep the same Thesis colors, typography, tone, and component style on all new or updated user surfaces.

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M1 | Kill-Switch Engine | Falsifiable rule extraction, durable rule storage, and thesis-level exception alerts |
| M2 | Thesis Freshness and Decay | Freshness scoring and visible staleness state per followed name |
| M3 | Morning Exception Briefing | Personalized morning "what changed for my names" briefing with explicit no-change outputs |
| M4 | Earnings War Room | Pre/live/post earnings intelligence workflow with thesis delta closure |
| M5 | Cross-Name Intelligence | Relationship graph and propagated signal alerts across followed names |
| M6 | Conviction Intelligence | Decision journal, coherence analysis, and opposite-case support |
| M7 | Scenario Stress Cards | Portfolio-wide scenario impact and thesis stress recommendations |

---

# M1 - Kill-Switch Engine

## Goal

Convert Deep Dive thesis output into continuously monitored, falsifiable rule conditions.

## Deliverables

| Deliverable | Description |
|---|---|
| Kill-switch contracts | Typed contracts for rules, evaluations, and alert payload context |
| Durable rule persistence | `kill_switch_rules` and evaluation-history persistence in Product API-owned storage |
| Condition extraction prompt | LangSmith-registered Dexter prompt for 3-5 falsifiable conditions per thesis |
| Signal evaluator jobs | Scheduler cadence for daily and event-triggered matching |
| Alert integration | Rule matches written to alert ledger and delivered through existing push flow |

## Acceptance Criteria

- [x] `packages/contracts` defines typed kill-switch contracts
- [x] `product-api` persists kill-switch rules and evaluation outcomes
- [ ] (TBD) Dexter extractor prompt is registered and versioned in LangSmith (`LANGSMITH_API_KEY` not available in this environment)
- [x] Scheduler rule-evaluator jobs run idempotently on required cadence
- [x] Rule-match alerts are durable in alert ledger with explainable reason text
- [x] Existing contrarian alert behavior remains backward-compatible
- [x] Integration tests cover extraction ingestion, rule storage, evaluation, and alert creation

## Smoke Test

```text
Step 1: Complete a Deep Dive and trigger condition extraction
Step 2: Confirm 3-5 rules persist for user+ticker with typed fields
Step 3: Run evaluator cycle with deterministic fixture events
Step 4: Confirm matched conditions create alert-ledger rows and push payloads
Step 5: Confirm non-matched conditions do not create noise alerts
Step 6: Confirm contrarian legacy path still works
```

## Success

Thesis starts watching user theses continuously with explainable exception logic.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Weak or vague extracted rules | Prompt fixture review and replay tests | High noise or missed thesis breaks |
| Evaluator over-fires on weak matches | Alert-volume regression and usefulness feedback trend | Trust erosion |
| Rule matches lack explainability | API payload checks and Inbox UX review | Users cannot act confidently |

## Rollback

Disable kill-switch evaluator jobs and route generation while preserving stored rules for later reactivation.

## Dependencies

- Phase 4 alert ledger and route-target handling must remain stable

## Owner

Product API Engineer + Scheduler Engineer + Dexter Engineer

---

# M2 - Thesis Freshness and Decay

## Goal

Make thesis staleness explicit via freshness scoring and review-needed signaling.

Status: Closed (PASS) on 2026-04-09.

## Deliverables

| Deliverable | Description |
|---|---|
| Snapshot schema extension | Freshness fields added to monitor snapshot payload and storage |
| Freshness scoring logic | Deterministic freshness function over age, events, and recent matched kill-switch evaluations |
| Daily recompute path | Scheduler integration in existing pre-market monitor cycle |
| Freshness notifications | `freshness_decay` notification family integrated with alert ledger |
| Names UI freshness state | Visual freshness state rendered consistently in Names board |

## Acceptance Criteria

- [x] `thesis_monitor_snapshots` includes freshness fields with typed contracts
- [x] Freshness states `current`, `aging`, `stale`, `triggered` are computed deterministically
- [x] Material-event counting and unreviewed-event tracking are persisted
- [x] Scheduler recompute path updates freshness for followed names daily
- [x] Freshness-decay alerts are explainable and route-safe
- [x] Names board renders freshness states with stable visual semantics
- [x] Integration tests cover freshness transitions and decay notifications

M2 v1 scope note:
- Material events currently count `earnings calendar events + matched kill-switch evaluations` since last Deep Dive.
- `unreviewed_events_count` mirrors this material-event count in M2 v1 (per-event review acknowledgement is deferred).
- Freshness alerts suppress unchanged repeats unless risk worsens or a `72h` cooldown elapses.

## Smoke Test

```text
Step 1: Seed snapshot with fresh Deep Dive baseline
Step 2: Advance event fixtures to age thesis and add unreviewed events
Step 3: Run recompute and verify state transitions current -> aging -> stale
Step 4: Trigger matched kill-switch evaluation and verify triggered state
Step 5: Confirm freshness alerts appear in alert ledger with reason text
Step 6: Confirm Names board renders expected freshness indicators
```

## Success

Users can see when confidence is stale even in quiet price periods.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Freshness lags behind event reality | Snapshot freshness audit | False confidence |
| Over-sensitive decay logic | Alert-volume and dismiss-rate spikes | Alert fatigue |
| Inconsistent UI state mapping | Device smoke and visual checks | Confusion on urgency |

## Rollback

Pause freshness alerts and render fallback state while retaining stored freshness metadata.

## Dependencies

- M1 kill-switch evaluation data available

## Owner

Product API Engineer + Scheduler Engineer + Mobile Engineer

---

# M3 - Morning Exception Briefing

## Goal

Replace generic morning summary with personalized exception briefing tied to user names.

## Deliverables

| Deliverable | Description |
|---|---|
| Personal briefing contract | Typed payload for per-user exception output |
| Relevance matcher | User-name, rule, and macro sensitivity relevance layer |
| Morning briefing generator | Scheduler path producing either exceptions or explicit no-change statement |
| Briefing persistence | Briefing entries recorded in alert ledger |
| Today/Inbox rendering | Mobile surfaces consume personalized briefing output |

## Acceptance Criteria

- [ ] Personalized briefing payload exists and is typed
- [ ] Morning cycle produces per-user output, not generic global output
- [ ] "Nothing changed for your names" is valid and delivered output
- [ ] Exceptions include linked reason context and route targets
- [ ] Briefing output persists into alert ledger for auditability
- [ ] Mobile Today and Inbox surfaces render briefing output coherently
- [ ] Integration tests cover both no-change and multi-exception paths

## Smoke Test

```text
Step 1: Seed user with followed names and active rules
Step 2: Run morning cycle with no relevant events and confirm explicit no-change briefing
Step 3: Run morning cycle with relevant fixtures and confirm exception entries
Step 4: Confirm alert-ledger rows contain reason and route metadata
Step 5: Confirm Today and Inbox render both output modes correctly
Step 6: Confirm no duplicate sends for one morning cycle
```

## Success

Users trust that Thesis checked their names every morning, even when nothing changed.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Generic content leaks into personalized briefing | Payload QA and snapshot diff checks | Low perceived relevance |
| No-change output omitted | Morning run audit | User uncertainty in quiet markets |
| Duplicate or contradictory exceptions | Ledger duplicate checks | Trust erosion |

## Rollback

Fallback to existing pulse path while preserving briefing contracts behind feature flag.

## Dependencies

- M1 and M2 data paths stable

## Owner

Scheduler Engineer + Product API Engineer + Mobile Engineer

---

# M4 - Earnings War Room

## Goal

Create event-window workflow for pre/live/post earnings with thesis-linked context.

## Deliverables

| Deliverable | Description |
|---|---|
| War Room payload contracts | Typed pre/live/post data contracts |
| Pre-event playbook generator | Auto-prepared metrics, expectations, and thesis-linked watch points |
| Live event cycle | Accelerated signal/news evaluation during earnings window |
| Post-event closure flow | Auto-triggered Deep Dive refresh and thesis-delta summary |
| Mobile War Room screen | One-surface workflow for event preparation and follow-through |

## Acceptance Criteria

- [ ] Upcoming events trigger pre-event War Room preparation
- [ ] Pre-event playbook includes thesis-linked watch items and active rules
- [ ] Live window updates use default `15 min` cadence with validated fallback to `30 min` under degradation
- [ ] Post-event path auto-queues Deep Dive and records thesis delta
- [ ] Freshness reset and rule re-evaluation occur post event
- [ ] War Room output writes auditable entries to alert ledger/history
- [ ] Integration and device smoke cover pre/live/post transitions

## Smoke Test

```text
Step 1: Seed upcoming earnings event for followed name
Step 2: Confirm pre-event War Room build at T-48h window
Step 3: Simulate live event updates and verify `15 min` default cadence plus automatic `30 min` fallback behavior
Step 4: Confirm post-event Deep Dive auto-queue and thesis delta generation
Step 5: Confirm rule re-evaluation and freshness reset
Step 6: Confirm War Room surface loads from push and in-app entry paths
```

## Success

Earnings days become the strongest and most actionable Thesis workflow moments.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Playbook missing key thesis context | Pre-event payload review | Users prepare poorly |
| Live updates drift or stall | Scheduler telemetry and latency alerts | Event trust collapses |
| Cadence fallback logic fails | Cadence transition tests and scheduler logs | Live experience becomes unstable or delayed |
| Post-event closure not triggered | Job audit and queue checks | Broken follow-through loop |

## Rollback

Disable War Room entry points and keep existing earnings-preview path active.

## Dependencies

- M1 rules, M2 freshness, M3 briefing pipeline available

## Owner

Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer

---

# M5 - Cross-Name Intelligence

## Goal

Add relationship-aware signal propagation across supplier/competitor/sector connected names.

## Deliverables

| Deliverable | Description |
|---|---|
| Relationship contracts | Typed relationship and propagation payloads |
| Durable graph storage | `name_relationships` persistence with confidence metadata |
| Relationship extractor | Dexter extraction from report content into structured links |
| Propagation evaluator | Scheduler logic for event propagation over graph edges |
| Cross-name alerting | Alert-ledger entries and push delivery with relationship explanation |

## Acceptance Criteria

- [ ] Structured relationship records persist from Deep Dive output
- [ ] Relationship confidence and provenance are stored and queryable
- [ ] Material events on source names evaluate propagation candidates
- [ ] Propagated alerts include clear "why this affects your thesis" context
- [ ] Low-confidence edges are suppressible using default threshold `0.70` (and configurable stricter overrides)
- [ ] Integration tests cover supplier, competitor, and macro propagation paths
- [ ] Alert-ledger and route behavior remain backward-compatible

## Smoke Test

```text
Step 1: Seed relationship graph from Deep Dive extraction fixtures
Step 2: Trigger event on source name and run propagation evaluator
Step 3: Confirm related followed names receive propagated exceptions
Step 4: Confirm alert reason text includes relationship type and source context
Step 5: Validate suppression behavior at default `0.70`, then at stricter threshold override
Step 6: Confirm no propagation for unrelated names
```

## Success

Users receive second-order intelligence that single-name tools miss.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Over-broad relationship extraction | Propagation precision checks | Too many irrelevant alerts |
| Missing provenance on relationships | API payload audit | Low explainability |
| Threshold misconfiguration | QA sweeps with fixture distributions | Either silence or spam |

## Rollback

Disable propagation evaluator while keeping stored relationship graph for future tuning.

## Dependencies

- M1 rule infrastructure stable

## Owner

Dexter Engineer + Scheduler Engineer + Product API Engineer

---

# M6 - Conviction Intelligence

## Goal

Build user-learning loop through decision journaling, coherence checks, and opposite-case reasoning.

## Deliverables

| Deliverable | Description |
|---|---|
| Decision journal model | Durable records of thesis snapshots, alerts, and user responses |
| Coherence analyzer | Monthly overlap, contradiction, and mismatch analysis |
| Opposite-case prompt | Adversarial case generation linked to original Deep Dive |
| Conviction timeline API | Query surfaces for per-name conviction evolution |
| Mobile conviction surfaces | Coherence and timeline visibility in user workflows |

## Acceptance Criteria

- [ ] Decision events persist for Deep Dive, kill-switch, freshness, and earnings moments
- [ ] Conviction timeline is queryable per user and per ticker
- [ ] Coherence analysis identifies overlap and contradiction patterns with explainable reasoning
- [ ] Opposite-case output is generated from same evidence set and linked to source report
- [ ] Monthly coherence card is generated and stored as an auditable insight artifact
- [ ] Integration tests cover journal write paths and coherence-output stability
- [ ] Mobile renders conviction insights without breaking existing Research flows

## Smoke Test

```text
Step 1: Seed at least three conviction events for one ticker
Step 2: Confirm timeline retrieval includes ordered thesis snapshots
Step 3: Run coherence analysis across multi-name portfolio fixture
Step 4: Verify contradiction/overlap outputs are explainable
Step 5: Trigger opposite-case generation and validate linkage to original report
Step 6: Confirm monthly insight card appears in expected surface
```

## Success

Thesis helps users improve behavior, not only consume data.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Missing journal writes at key moments | Event-to-journal audit | Incomplete conviction history |
| Coherence outputs are vague | QA rubric on explainability | Low actionability |
| Opposite-case drifts from evidence | Prompt regression fixtures | Low trust in reasoning output |

## Rollback

Disable coherence card emission and opposite-case endpoint while preserving journal writes.

## Dependencies

- M1-M5 outputs available as journal event sources

## Owner

Product API Engineer + Dexter Engineer + Mobile Engineer

---

# M7 - Scenario Stress Cards

## Goal

Deliver one-tap portfolio-wide scenario analysis with actionable thesis impact summaries.

## Deliverables

| Deliverable | Description |
|---|---|
| Scenario template framework | Built-in scenario definitions and optional parameterization |
| Scenario evaluator | Batch reasoning over active theses and rule context |
| Stress-card contracts | Typed portfolio and per-name stress output payloads |
| Suggested rule additions | Recommendations for new kill-switch rules from scenario results |
| Mobile scenario surface | User-triggered scenario run and result exploration |

## Acceptance Criteria

- [ ] Scenario templates are defined, versioned, and queryable
- [ ] Evaluator returns per-name exposure and thesis-break likelihood rationale
- [ ] Stress cards identify impacted names and reasoning chain
- [ ] Suggested kill-switch additions are generated and reviewable
- [ ] Scenario runs are auditable and linked to user context
- [ ] Integration tests cover template execution determinism
- [ ] Mobile scenario workflow supports run, inspect, and route to affected names

## Smoke Test

```text
Step 1: Execute baseline scenario template over seeded portfolio
Step 2: Confirm per-name impact outputs with reasoned explanations
Step 3: Confirm impacted-thesis summary and suggested rule additions
Step 4: Re-run same template and verify deterministic output envelope
Step 5: Confirm scenario card routes to affected name contexts
Step 6: Confirm no-impact scenarios produce explicit no-critical-impact output
```

## Success

Users gain proactive portfolio stress intelligence even in quiet periods.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Scenario outputs are generic and non-actionable | QA rubric and user feedback loop | Low retention impact |
| Non-deterministic scenario results | Repeat-run variance tests | Loss of trust |
| Suggested rules are noisy | Rule suggestion acceptance-rate tracking | Alert quality degradation |

## Rollback

Disable scenario execution endpoints while keeping template definitions intact.

## Dependencies

- M1 rule semantics and M6 conviction context available

## Owner

Product API Engineer + Dexter Engineer + Mobile Engineer
