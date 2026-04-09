# Thesis - Phase 4 Roadmap

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04  
**Related Documents:** ph4_BLUEBOOK.md, ph4_MILESTONES.md, ph4_PRD.md

> This document is the map for Phase 4.  
> For acceptance criteria and smoke tests, see [ph4_MILESTONES.md](./ph4_MILESTONES.md).

---

## Context

Phase 3 made Thesis more trustworthy, more recurring, and more launch-aware.

Phase 4 exists because the product can now have the right intelligence and the wrong shape:

- navigation can still hide important flows behind sub-modes
- Portfolio can still overload action and settings responsibilities
- notification history can still feel opaque even when alerts are explainable
- copy can still drift because major IA-level text is not centralized

Phase 4 answers one question:

**Can Thesis expose its daily workflow clearly enough that Today, Names, Research, Inbox, and You each feel deliberate and accountable?**

---

## Sequence

```text
M1 Docs + Interface Lock -> M2 Alert Ledger Backend -> M3 Mobile IA V2 -> M4 Deep Links + Smoke + Evidence
```

No milestone begins until the previous one is implemented and documented.

Closed means:

- `ph4_MILESTONES.md` acceptance criteria complete
- milestone smoke plan executed
- impacted earlier-phase regressions re-run
- milestone-local AGENTS file updated with smoke results, decisions, and deferrals

---

## Milestones

| # | Name | One-Line Outcome | Why It Exists |
|---|---|---|---|
| M1 | Phase 4 Baseline, Docs, and Interface Lock | Phase 4 becomes a formal workstream with a canonical screen map and named contracts before implementation spreads | Without this, the IA rewrite becomes scope drift |
| M2 | Inbox and Notification Ledger Backend | Alert history becomes a durable Product API surface instead of a mobile reconstruction | Without this, Inbox is cosmetic |
| M3 | Mobile IA V2 and Design-System Preservation | The Android app ships the 5-tab structure while preserving the Thesis look and tone | Without this, the new architecture never reaches users |
| M4 | Deep Links, Smoke, Quality, and Evidence | Routing, notification landing, and closeout proof become explicit and repeatable | Without this, the refactor remains partially connected |

---

## Implementation Bridge From Earlier Phases

### M1 - Baseline and Lock

- Extends Phase 2 M6 screen mapping and Phase 3 M2 notification/monitor ownership
- Touches docs, ADRs, and contract naming only
- Exists to prevent implementation from outrunning product/system decisions

### M2 - Alert Ledger Backend

- Extends Phase 3 notification preferences and follow-up lifecycle systems
- Touches `product-api`, `packages/contracts`, and `infra`
- Must preserve existing notification-preference behavior while adding durable alert history

### M3 - Mobile IA V2

- Extends Phase 2 M6 Android IA and Phase 3 M2 monitor/notification surfaces
- Touches `apps/mobile/android`
- Must preserve the existing theme language while promoting the new top-level ownership model

### M4 - Routing and Proof

- Extends Phase 3 M4 operational readiness and Phase 3 M5 notification semantics
- Touches deep-link wiring, telemetry, smoke docs, and evidence folders
- Must leave no dead-end push route behind

---

## Rules

1. Phase 4 does not redesign the brand. It reorganizes the product.
2. Inbox must be server-backed from v1 of this overhaul.
3. Navigation changes must be paired with explicit destination ownership rules.
4. Any route added to push payloads must be verifiable locally and then on-device in Maestro.
5. Any unresolved question about per-name mute semantics or alert-frequency tuning is a product decision, not an implementation shortcut.

---

## Explicitly Deferred Beyond Phase 4

| Item | Why Deferred |
|---|---|
| True cross-family category mute model | Current implementation preserves notification-family preferences; broader semantics need explicit product ownership |
| Frequency tuning beyond current notification-family toggles | Requires product-policy and contract decisions not locked in Phase 4 |
| Per-name mute semantics | Not yet owner-approved and would widen settings complexity |
| Visual redesign or new brand direction | Phase 4 preserves the current Thesis language intentionally |
