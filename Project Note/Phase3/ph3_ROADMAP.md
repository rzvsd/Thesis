# Thesis - Phase 3 Roadmap

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04  
**Related Documents:** ph3_BLUEBOOK.md, ph3_MILESTONES.md, ph3_PRD.md

> This document is the map for Phase 3.  
> For acceptance criteria and smoke tests, see [ph3_MILESTONES.md](./ph3_MILESTONES.md).

---

## Context

Phase 1 delivered the platform and Android MVP.
Phase 2 added richer intelligence, monetization plumbing, a redesigned UX, and launch hardening scaffolding.

Phase 3 exists because a product can be implemented and still fail:

- reports can still feel generic
- daily value can still feel passive
- subscriptions can still feel unjustified
- notifications can still feel noisy
- telemetry can still be too weak for real product decisions
- hardening can still be incomplete in the places launch-week pain actually appears

Phase 3 is the phase that answers one question:

**Can Thesis be trusted, revisited, paid for, and launched responsibly?**

---

## Sequence

```text
M1 Intelligence Trust -> M2 Daily Loop -> M3 Monetization + Growth -> M4 Reliability + Ops -> M5 Controlled Beta + Launch Gate
```

No milestone begins until the previous one is closed.

Closed means:

- `ph3_MILESTONES.md` acceptance criteria complete
- milestone smoke plan executed
- impacted Phase 1 and Phase 2 regressions re-run
- milestone-local AGENTS file updated with smoke results, decisions, and deferrals

---

## Milestones

| # | Name | One-Line Outcome | Why It Exists |
|---|---|---|---|
| M1 | Intelligence Trust and Deep Dive Credibility | Deep Dive stops looking merely intelligent and starts behaving like a trustworthy research product | Without this, growth amplifies distrust |
| M2 | Daily Loop, Position Monitoring and Re-engagement | Thesis becomes a recurring "what changed for my names?" product, not just a report reader | Without this, retention collapses after novelty |
| M3 | Monetization, Growth Instrumentation and Feedback | The product can explain, measure, and improve conversion instead of just charging people | Without this, billing exists but revenue learning does not |
| M4 | Mobile Reliability, Security and Operational Readiness | The Android app and backend behave like a real release candidate under realistic conditions | Without this, launch breaks trust fast |
| M5 | Controlled Beta and Launch Decision | Launch becomes a gated operating process with explicit no-go rules and post-launch learning loops | Without this, launch becomes milestone theater |

---

## Implementation Bridge From Phase 1 and 2

Phase 3 must be wired into existing systems, not bolted on as a separate product.

### M1 - Intelligence Trust

- Extends Phase 1 M5 Deep Dive and Phase 2 M2/M7 report logic
- Touches `dexter-worker`, `product-api`, `packages/contracts`, and mobile report rendering
- Preserves Phase 2 reuse behavior and report delivery while improving trust metadata and quality proof

### M2 - Daily Loop

- Extends Phase 1 M6 Market Pulse and Phase 2 M5/M6/M8 Today, digest, and notification paths
- Touches `scheduler`, `product-api`, `mobile`, and PostHog instrumentation
- Must preserve current Pulse retrieval, history, and push tap-through while making the loop more personalized and useful

### M3 - Monetization and Growth

- Extends Phase 2 M4 monetization and M9 analytics proof
- Touches `product-api`, `mobile`, RevenueCat wiring, PostHog events, and feedback endpoints
- Must preserve existing auth, entitlement truth, and current gating while making premium value legible and measurable

### M4 - Reliability and Ops

- Extends Phase 1 M9 and Phase 2 M9 hardening with the gaps that still matter in practice
- Touches `mobile`, `product-api`, `scheduler`, storage/infra, push model, security config, e2e/load suites, and alerting
- Must remove launch blockers instead of documenting around them

### M5 - Controlled Beta

- Consumes the outputs of M1-M4
- Touches product ops, QA, support, analytics review, release checklist, and launch sign-off
- Exists to force evidence-based launch judgment instead of milestone-status optimism

---

## Rules

1. Phase 3 is proof-first. Screenshots and doc wording do not close milestones.
2. Each milestone must name the exact Phase 1 and Phase 2 paths it extends and the regressions it must preserve.
3. New work is allowed only if it sharpens trust, habit, conversion, resilience, or learning speed.
4. Any item that is really a launch blocker must be pulled forward, not hidden in a later bucket.
5. If a milestone produces new events, dashboards, or funnels, event semantics and owners must be documented before closeout.

---

## Explicitly Deferred Beyond Phase 3

| Item | Why Deferred |
|---|---|
| Social/community features | Not required to prove trust, retention, or monetization discipline |
| iOS app | Android launch proof comes first |
| Brokerage links, holdings sync, cost basis | Outside current product doctrine |
| Real-time trading or intraday terminal behavior | Out of scope for research-first Thesis |
| Broad referral program | Only after core conversion and retention are proven |
