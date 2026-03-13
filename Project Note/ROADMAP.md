# Finance Intelligence Platform — Roadmap

Name of the app : "Thesis" 
Marketing for the app : "Every position needs one"

****Thesis — every position needs one****


**Version:** 1.1  
**Status:** Active  
**Last Revised:** 2026-03  
**Related Documents:** BLUEBOOK cld.md, MILESTONES.md

> This document is the map. It shows what we are building and in what order.  
> For acceptance criteria, smoke tests, failure modes, and owners — see [MILESTONES.md](./MILESTONES.md).

---

## Sequence

```
M1 Baseline ──► M2 Data Plane ──► M3 Dexter Foundation ──► M4 Product API
                                                                    │
                                               M8 Hardening ◄── M7 Android MVP ◄── M6 Market Pulse ◄── M5 Deep Dive
```

No milestone begins until the previous one is closed. Closed means MILESTONES.md sign-off checklist complete — not just demos passing.

---

## Milestones

| # | Name | One-Line Outcome |
|---|---|---|
| M1 | Baseline | Monorepo, contracts, CI, and local environment are all operational |
| M2 | Data Plane | Financial data and news flow through validated contracts |
| M3 | Dexter Foundation | Reasoning pipeline runs end-to-end and produces schema-valid output |
| M4 | Product API + Job System | Auth, job queue, and report retrieval work end-to-end |
| M5 | Company Deep Dive v1 | A user can request a Deep Dive and receive a complete report within 90 seconds |
| M6 | Market Pulse | Scheduled morning briefing is generated, stored, and delivered daily |
| M7 | Android MVP | Both surfaces work on a real Android device |
| M8 | Production Hardening | System is observable, resilient under failure, and operationally ready |

---

## Post-Launch Backlog

These are not scheduled. Each has a trigger condition that must be true before it enters planning.

| Item | Trigger to Schedule |
|---|---|
| iOS app | Android retention exceeds target threshold |
| Web app | User research confirms demand |
| Cloudflare WAF | Abuse signals detected post-launch |
| Multi-timezone Market Pulse | User base spans multiple active markets |
| Per-user report history UI | User feedback volume warrants it |
| Watchlist alerts | User feedback volume warrants it |
| Additional data providers | Coverage gaps identified in production |
| Multi-model Dexter strategy | Cost or quality signals warrant it |
| Social login | Auth friction identified as a drop-off cause |

---

## Rules

1. A milestone is not closed until the MILESTONES.md sign-off checklist is complete.
2. Scope added mid-milestone is logged and deferred to the next milestone unless it is a hard blocker.
3. Post-launch items do not enter planning without a documented trigger condition being met.
