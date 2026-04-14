# Thesis - Phase 5 Milestone Briefs

**Version:** 1.0  
**Status:** Closed (M1-M7 closed; explicit TBD items retained where external proof is unavailable)  
**Last Revised:** 2026-04-14
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

Status: Closed (PASS) on 2026-04-09.

## Deliverables

| Deliverable | Description |
|---|---|
| Personal briefing contract | Typed payload for per-user exception output |
| Relevance matcher | User-name, rule, and macro sensitivity relevance layer |
| Morning briefing generator | Scheduler path producing either exceptions or explicit no-change statement |
| Briefing persistence | Briefing entries recorded in alert ledger |
| Today/Inbox rendering | Mobile surfaces consume personalized briefing output |

## Acceptance Criteria

- [x] Personalized briefing payload exists and is typed
- [x] Morning cycle produces per-user output, not generic global output
- [x] "Nothing changed for your names" is valid and delivered output
- [x] Exceptions include linked reason context and route targets
- [x] Briefing output persists into alert ledger for auditability
- [x] Mobile Today and Inbox surfaces render briefing output coherently
- [x] Integration tests cover both no-change and multi-exception paths

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

Status: Closed (PASS) on 2026-04-09; ADB device smoke complete and owner approval recorded.

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

War Room audit storage lock (M4):

- Durable header record per user+ticker+earnings event: `war_room_id`, `user_id`, `ticker`, `earnings_event_id`, `state`, `current_cadence_min`, `prepared_at`, `closed_at`
- Durable timeline record per transition/update: `war_room_event_id`, `war_room_id`, `phase` (`pre`/`live`/`post`), `event_type`, `reason_text`, `source_refs`, `created_at`, optional `alert_ledger_id`, optional `report_id`
- Any user-facing War Room notification must write both alert-ledger row and timeline row with shared linkage (`alert_ledger_id`)

## Acceptance Criteria

- [x] Upcoming events trigger pre-event War Room preparation
- [x] Pre-event playbook includes thesis-linked watch items and active rules
- [x] Live window updates use default `15 min` cadence and deterministic `30 min` fallback rules (`2` consecutive failures/timeouts, or `2` consecutive lag breaches `>= 20 min`, or `2` consecutive runtime breaches `> 12 min`)
- [x] Live-window recovery from `30 min` back to `15 min` requires `3` consecutive healthy cycles (`success`, lag `<= 10 min`, runtime `<= 8 min`)
- [x] War Room push/deep-link contract is locked to route-safe payloads with `open_tab=research`, `notification_type=earnings_war_room`, `war_room_id`, and `ticker`
- [x] War Room entitlement is enforced: Pro receives War Room payloads, Free remains on existing `earnings_preview` path
- [x] Post-event path auto-queues Deep Dive and records thesis delta
- [x] Freshness reset and rule re-evaluation occur post event
- [x] War Room output writes auditable pre/live/post history records with linkage to alert ledger entries where user-facing notifications are emitted
- [x] Cutover policy is explicit and verified: `earnings_preview` and War Room coexist in M4 by entitlement and degraded fallback; no hard replacement
- [x] Integration and device smoke cover pre/live/post transitions (integration proves transition logic; connected-device ADB smoke proves War Room launch/rendering and fallback Inbox behavior)

## Smoke Test

```text
Step 1: Seed upcoming earnings event for followed name
Step 2: Confirm pre-event War Room build at T-48h window
Step 3: Simulate live event updates and verify deterministic fallback triggers (`2` consecutive failures OR `2` consecutive lag breaches OR `2` consecutive runtime breaches)
Step 4: Simulate recovery and verify return from `30 min` to `15 min` only after `3` consecutive healthy cycles
Step 5: Confirm post-event Deep Dive auto-queue and thesis delta generation
Step 6: Confirm rule re-evaluation and freshness reset
Step 7: Confirm War Room surface loads from push and in-app entry paths using payload with `war_room_id`
Step 8: Confirm Pro receives War Room and Free receives legacy `earnings_preview`; verify degraded fallback uses legacy path for Pro when War Room preparation fails
```

## Success

Earnings days become the strongest and most actionable Thesis workflow moments.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Playbook missing key thesis context | Pre-event payload review | Users prepare poorly |
| Live updates drift or stall | Scheduler telemetry and latency alerts | Event trust collapses |
| Cadence fallback logic fails | Cadence transition tests and scheduler logs | Live experience becomes unstable or delayed |
| Deep-link payload missing `war_room_id` or wrong target | Push-route contract tests and device launch checks | Dead-end launch or wrong screen |
| Entitlement leak between Free and Pro | Tier-gating integration tests and push payload audits | Monetization regression and policy violation |
| Post-event closure not triggered | Job audit and queue checks | Broken follow-through loop |

## Rollback

Disable War Room entry points and keep existing earnings-preview path active.

## Dependencies

- M1 rules, M2 freshness, M3 briefing pipeline available

## Owner

Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer

---

# M5 - Cross-Name Intelligence

Status: Closed (PASS) on 2026-04-10; LangSmith relationship prompt registration carried as TBD because `LANGSMITH_API_KEY` is not available in this environment.

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
| M5 interface contract | `name-relationship` contracts plus ingestion, query, and propagation endpoints |

M5 storage and interface lock:

- Relationship table: `name_relationships`
- Required fields: `relationship_id`, `user_id`, `source_ticker`, `target_ticker`, `relationship_type`, `confidence`, `state`, `source_report_id`, `prompt_version`, `evidence_text`, `rationale`, `created_at`, `updated_at`, optional `suppressed_at`
- Relationship types: `supplier`, `competitor`, `partner`, `sector`
- Relationship states: `active`, `suppressed`, `inactive`
- Confidence threshold: store every valid edge, emit propagated alerts only at `>= 0.70` by default unless a stricter override is supplied
- Macro handling: macro is an event/signal category that can propagate through qualifying `sector` edges; `macro` is not a relationship type
- Contract file: `packages/contracts/src/name-relationship.ts`
- Internal ingestion endpoint: `POST /internal/name-relationships/ingest`
- Internal propagation endpoint: `POST /internal/notifications/cross-name/evaluate`
- User query endpoint: `GET /v1/names/relationships`
- Alert notification type: `cross_name_propagation`
- Mobile scope: no new top-level screen; reuse existing Names and Inbox surfaces and preserve the same Thesis colors, typography, tone, and component style

## Acceptance Criteria

- [x] Structured relationship records persist from Deep Dive output
- [x] Relationship confidence and provenance are stored and queryable
- [x] Material events on source names evaluate propagation candidates
- [x] Propagated alerts include clear "why this affects your thesis" context
- [x] Low-confidence edges are suppressible using default threshold `0.70` (and configurable stricter overrides)
- [x] Cross-name propagation alerts are Pro-only; Free users do not receive propagated alerts
- [x] Macro-origin events propagate only through qualifying `sector` relationships and never introduce `macro` as a relationship type
- [x] Integration tests cover supplier, competitor, and macro propagation paths
- [x] Alert-ledger and route behavior remain backward-compatible

TBD after closeout: LangSmith relationship prompt registration is not proven because `LANGSMITH_API_KEY` is not available in this environment. The local prompt manifest and sync hook are implemented.

## Smoke Test

```text
Step 1: Seed relationship graph from Deep Dive extraction fixtures
Step 2: Trigger event on source name and run propagation evaluator
Step 3: Confirm related followed names receive propagated exceptions
Step 4: Confirm alert reason text includes relationship type and source context
Step 5: Validate suppression behavior at default `0.70`, then at stricter threshold override
Step 6: Confirm no propagation for unrelated names
Step 7: Confirm Free users receive no propagated alerts while Pro users do
Step 8: Confirm macro-origin propagation uses sector relationships only
```

## Success

Users receive second-order intelligence that single-name tools miss.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Over-broad relationship extraction | Propagation precision checks | Too many irrelevant alerts |
| Missing provenance on relationships | API payload audit | Low explainability |
| Threshold misconfiguration | QA sweeps with fixture distributions | Either silence or spam |
| Entitlement leak to Free users | Pro/Free propagation tests | Monetization regression |
| Macro treated as a relationship type | Contract enum tests | Relationship graph pollution |

## Rollback

Disable propagation evaluator while keeping stored relationship graph for future tuning.

## Dependencies

- M1 rule infrastructure stable

## Owner

Dexter Engineer + Scheduler Engineer + Product API Engineer

---

# M6 - Conviction Intelligence

Status: Closed (PASS) on 2026-04-10; LangSmith remote prompt registration carried as TBD because `LANGSMITH_API_KEY` is not available in this environment.

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
| M6 interface contract | `conviction-intelligence` contracts plus timeline, insight, opposite-case, and internal coherence endpoints |

M6 storage and interface lock:

- Journal table: `conviction_journal_entries`
- Journal required fields: `journal_entry_id`, `user_id`, `ticker`, `event_type`, `source_type`, `source_id`, `event_at`, `title`, `summary`, `thesis_snapshot`, `evidence_refs`, `created_at`, `updated_at`
- Journal optional linkage fields: `report_id`, `alert_ledger_id`, `war_room_id`, `monitor_snapshot_key`, `opposite_case_id`
- Journal event types: `deep_dive_generated`, `kill_switch_alert_fired`, `freshness_decay_alert_fired`, `earnings_war_room_closed`, `cross_name_alert_fired`, `alert_feedback_recorded`, `opposite_case_generated`
- Journal dedupe key: `user_id + event_type + source_type + source_id`
- Insight table: `conviction_insight_cards`
- Insight type: `monthly_coherence`
- Insight finding types: `overlap`, `contradiction`, `mismatch`
- Opposite-case table: `opposite_case_reports`
- Contract file: `packages/contracts/src/conviction-intelligence.ts`
- Timeline endpoint: `GET /v1/conviction/timeline?ticker=&limit=`
- Insight endpoint: `GET /v1/conviction/insights?limit=`
- Opposite-case create endpoint: `POST /v1/reports/{report_id}/opposite-case`
- Opposite-case read endpoint: `GET /v1/reports/{report_id}/opposite-case`
- Internal coherence endpoint: `POST /internal/conviction/coherence/evaluate`
- Monthly coherence period: previous calendar month
- Monthly coherence scheduler trigger: first scheduler cycle on or after the first calendar day of the month, `America/New_York`
- Opposite-case prompt identifier: `thesis-m6-opposite-case`
- Coherence analyzer prompt identifier: `thesis-m6-coherence-analyzer`
- LangSmith remote prompt registration proof may be carried as TBD if `LANGSMITH_API_KEY` is unavailable; local prompt manifest, sync hook, and regression fixtures remain required
- Entitlement: conviction system outputs are Pro-only; existing Free report notes and feedback are unchanged
- Mobile scope: no new top-level screen; Research owns opposite-case/timeline, You owns monthly coherence/profile cards, and all surfaces preserve the same Thesis colors, typography, tone, and component style

## Acceptance Criteria

- [x] Decision events persist for Deep Dive, kill-switch, freshness, and earnings moments
- [x] Cross-name propagated exception moments and alert-feedback responses can be journaled without duplicate entries
- [x] Conviction timeline is queryable per user and per ticker
- [x] Coherence analysis identifies overlap and contradiction patterns with explainable reasoning
- [x] Opposite-case output is generated from same evidence set and linked to source report
- [x] Monthly coherence card is generated and stored as an auditable insight artifact
- [x] Conviction system outputs are Pro-only while existing Free report notes/feedback remain unaffected
- [x] Integration tests cover journal write paths and coherence-output stability
- [x] Mobile renders conviction insights without breaking existing Research flows

TBD after closeout: LangSmith remote prompt registration proof is not available because `LANGSMITH_API_KEY` is not available in this environment. The local prompt manifest, sync hook, and regression fixtures are implemented.

## Smoke Test

```text
Step 1: Seed conviction events for Deep Dive, kill-switch, freshness, earnings, cross-name, and alert-feedback moments
Step 2: Confirm timeline retrieval includes ordered thesis snapshots and deduped source links
Step 3: Run coherence analysis across multi-name portfolio fixture
Step 4: Verify contradiction/overlap/mismatch outputs are explainable
Step 5: Trigger opposite-case generation and validate linkage to original report and same-evidence reuse
Step 6: Confirm monthly insight card appears in You and report-level opposite-case/timeline appears in Research
Step 7: Confirm Free users are gated from conviction outputs without regressing report notes/feedback
```

## Success

Thesis helps users improve behavior, not only consume data.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Missing journal writes at key moments | Event-to-journal audit | Incomplete conviction history |
| Coherence outputs are vague | QA rubric on explainability | Low actionability |
| Opposite-case drifts from evidence | Prompt regression fixtures | Low trust in reasoning output |
| Conviction cards become noisy alerts | Surface audit and notification preference audit | Trust erosion |
| Free users receive Pro conviction outputs | Entitlement tests | Monetization regression |

## Rollback

Disable coherence card emission and opposite-case endpoint while preserving journal writes.

## Dependencies

- M1-M5 outputs available as journal event sources

## Owner

Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer

---

# M7 - Scenario Stress Cards

## Goal

Deliver one-tap portfolio-wide scenario analysis with actionable thesis impact summaries.

Status: Closed (PASS) on 2026-04-11; scheduler-owned scenario automation remains deferred by lock.

## Deliverables

| Deliverable | Description |
|---|---|
| Scenario template framework | Built-in scenario definitions and optional parameterization |
| Scenario evaluator | Batch reasoning over active theses and rule context |
| Stress-card contracts | Typed portfolio and per-name stress output payloads |
| Suggested rule additions | Recommendations for new kill-switch rules from scenario results |
| Mobile scenario surface | User-triggered scenario run and result exploration |
| Entitlement and route contract | Pro-only stress-card access with route-safe scenario drill-down |

M7 storage and interface lock:

- Contract file: `packages/contracts/src/scenario-stress.ts`
- Template table: `scenario_stress_templates`
- Run table: `scenario_stress_runs`
- Per-name impact table: `scenario_stress_impacts`
- Rule suggestion table: `scenario_stress_rule_suggestions`
- Template list endpoint: `GET /v1/scenarios/templates`
- Scenario run endpoint: `POST /v1/scenarios/runs`
- Scenario run read endpoint: `GET /v1/scenarios/runs/{scenario_run_id}`
- Scenario route tuple (M7 lock): `open_tab=research`, `scenario_id`, `scenario_run_id`
- Optional route keys: `ticker`, `rule_id`
- M7 run mode: user-triggered only (optional scheduled cycle deferred beyond Phase 5)
- M7 entitlement: stress cards are Pro-only
- M7 template IDs (v1): `rates_higher_for_longer`, `recession_in_6m`, `usd_up_10`, `ai_hype_burst`, `oil_120_spike`

## Acceptance Criteria

- [x] Scenario templates are defined, versioned, and queryable with locked v1 template IDs
- [x] Evaluator returns per-name exposure and thesis-break likelihood rationale
- [x] Stress cards identify impacted names and reasoning chain
- [x] Suggested kill-switch additions are generated as review-only recommendations
- [x] Scenario runs are auditable via durable run and per-name impact records
- [x] Integration tests cover deterministic execution envelope:
- [x] impacted ticker set exact match for repeated runs on the same snapshot
- [x] per-ticker `impact_level` and `thesis_break_likelihood` exact enum match
- [x] suggested rule set by `ticker + signal_type + direction` exact match
- [x] numeric score variance within `+/-0.02`
- [x] Pro users can run/read stress cards and Free users are blocked
- [x] Mobile scenario workflow supports run, inspect, and route to affected names through the locked route tuple
- [x] Mobile scenario surfaces preserve existing Thesis colors, typography, tone, and component style
- [x] M7 implementation does not introduce optional scheduled scenario runs

## Smoke Test

```text
Step 1: User triggers baseline scenario template run via `POST /v1/scenarios/runs` over seeded portfolio
Step 2: Confirm per-name impact outputs with reasoned explanations
Step 3: Confirm impacted-thesis summary and suggested rule additions
Step 4: Re-run same template and verify deterministic envelope (ticker set and enums exact, numeric scores within +/-0.02)
Step 5: Confirm Pro users can run/read stress cards and Free users are blocked
Step 6: Confirm scenario card routes to affected name contexts using `open_tab=research`, `scenario_id`, `scenario_run_id`
Step 7: Confirm no-impact scenarios produce explicit no-critical-impact output
Step 8: Confirm no scheduler-owned scenario job/push path exists and no run is created without user-triggered request
Step 9: Confirm scenario surfaces preserve existing Thesis visual language on device smoke
```

## Success

Users gain proactive portfolio stress intelligence even in quiet periods.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Scenario outputs are generic and non-actionable | QA rubric and user feedback loop | Low retention impact |
| Non-deterministic scenario results | Repeat-run variance tests | Loss of trust |
| Suggested rules are noisy | Rule suggestion acceptance-rate tracking | Alert quality degradation |
| Free users receive stress-card outputs | Entitlement integration tests | Monetization regression |
| Scenario routes fail to restore context | Device route smoke and deep-link tests | Dead-end UX and lower trust |

## Rollback

Disable scenario execution endpoints while keeping template definitions intact.

## Dependencies

- M1 rule semantics and M6 conviction context available

## Owner

Product API Engineer + Dexter Engineer + Mobile Engineer
