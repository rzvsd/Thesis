# Thesis - Phase 5 Roadmap

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04-08  
**Predecessor:** Phase 4 delivered  
**Related Documents:** ph5_BLUEBOOK.md, ph5_MILESTONES.md, ph5_PRD.md

> This document is the execution map for Phase 5.
> For acceptance criteria and smoke tests, see [ph5_MILESTONES.md](./ph5_MILESTONES.md).

---

## Context

Phase 4 solved structure and transparency.

Phase 5 solves continuous value:

- from periodic report reading to continuous thesis monitoring
- from price-only signals to thesis-level break conditions
- from generic summaries to personalized exception outputs
- from one-off analysis to conviction learning loops

Core phase question:

**Can Thesis run a high-signal daily intelligence loop without becoming noisy, opaque, or operationally brittle?**

---

## Sequence

```text
M1 Kill-Switch Engine
  -> M2 Thesis Freshness and Decay
  -> M3 Morning Exception Briefing
  -> M4 Earnings War Room
  -> M5 Cross-Name Intelligence
  -> M6 Conviction Intelligence
  -> M7 Scenario Stress Cards
```

No milestone begins until predecessor contracts, smoke gates, and doctrine are documented.

Closed means:

- `ph5_MILESTONES.md` acceptance criteria complete
- milestone smoke plan executed
- required regressions re-run
- milestone-local AGENTS file updated with smoke results, decisions, and deferrals

---

## Milestones

| # | Name | One-Line Outcome | Why It Exists |
|---|---|---|---|
| M1 | Kill-Switch Engine | Deep Dive outputs become durable falsifiable rules with signal evaluation and alerting | Exception-first value cannot exist without rule extraction and monitoring |
| M2 | Thesis Freshness and Decay | Thesis staleness becomes measurable and visible via freshness state and decay warnings | Users need value from inaction periods, not only event periods |
| M3 | Morning Exception Briefing | Daily briefing becomes personalized and exception-centric, including explicit "nothing changed" outputs | Daily trust needs proactive reassurance, not generic noise |
| M4 | Earnings War Room | Earnings windows become pre/live/post guided workflows tied to thesis deltas | High-intensity events need one coherent, explainable surface |
| M5 | Cross-Name Intelligence | Signals propagate across supplier/competitor/macro relationships in followed names | Single-name monitoring misses second-order thesis risk |
| M6 | Conviction Intelligence | Decision journal and coherence checks convert history into behavioral insight | Retention depends on users getting smarter over time |
| M7 | Scenario Stress Cards | Users can run portfolio-wide scenario impact cards on demand | Quiet months still need meaningful proactive value |

---

## Dependency Logic

1. M1 provides the falsifiable rule substrate for all later intelligence.
2. M2 consumes M1 proximity and event data to compute freshness.
3. M3 consumes M1 rule state and M2 freshness for daily personalization.
4. M4 consumes M1 rules and M2 freshness in event-window operations.
5. M5 uses M1 rule semantics for propagated cross-name alerts.
6. M6 relies on event streams from M1-M5 for conviction patterning.
7. M7 relies on M1 rule semantics and M6 coherence context for scenario summaries.

---

## Rules

1. Exception-first is mandatory. Silence is valid output.
2. No new services are added in Phase 5.
3. Every intelligence output must map back to user thesis context.
4. Decay and staleness are explicit product states, not hidden internals.
5. Every alert and card must include explainable reason text and resolvable target.
6. UI and UX changes must preserve the same Thesis colors, typography, tone, and component style.

---

## Operational Defaults (Locked)

1. Earnings War Room live cycle runs at a default `15 min` interval.
2. War Room live cycle may automatically fall back to `30 min` when data-source degradation or queue pressure is detected.
3. Cross-name propagation alerts require a minimum relationship confidence of `0.70`.
4. Relationship edges below `0.70` remain persisted for auditability but do not emit propagated alerts by default.

---

## Explicitly Deferred Beyond Phase 5

| Item | Why Deferred |
|---|---|
| Brokerage and holdings sync | High integration complexity not required for thesis-level intelligence |
| Real-time price streaming | Daily or event-window cadence is sufficient for Phase 5 doctrine |
| Social/community features | Would dilute thesis ownership and reasoning accountability |
| iOS expansion | Android-first until intelligence model is proven |
| Model fine-tuning pipelines | Prompt/system improvements via LangSmith are sufficient in this phase |
