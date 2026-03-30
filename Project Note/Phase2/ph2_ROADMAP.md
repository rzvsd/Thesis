# Thesis - Phase 2 Roadmap

**Version:** 1.2  
**Status:** Active  
**Last Revised:** 2026-03  
**Related Documents:** ph2_BLUEBOOK.md, ph2_MILESTONES.md, ph2_PRD.md, new_PRODUCT_ROADMAP.md, UX_ARCHITECTURE.md

> This document is the map for Phase 2. It shows what we build and in what order.  
> For acceptance criteria per milestone, see [ph2_MILESTONES.md](./ph2_MILESTONES.md).  
> For the full feature backlog and rationale, see [new_PRODUCT_ROADMAP.md](../../../new_PRODUCT_ROADMAP.md).  
> For the target UX vision, see [UX_ARCHITECTURE.md](../../../UX_ARCHITECTURE.md).

---

## Context

Phase 1 (M1-M9) delivered the technical foundation and Android MVP:

- Monorepo, contracts, CI (M1)
- Data plane with OpenBB + news-ingest (M2)
- Dexter Deep Dive engine (M3)
- Product API + auth + jobs (M4)
- Company Deep Dive v1 (M5)
- Market Pulse daily briefing (M6)
- Android MVP (M7)
- UX refinement (M8)
- Production hardening (M9)

Phase 2 evolves the product from "working MVP" to "product people pay for and return to daily."

---

## Sequence

```text
M0 Open-Source Data Foundation -> M1 Historical Data Pipeline -> M2 Report Quality -> M3 Fear & Greed Engine
                                                                                              |
M9 Launch Hardening <- M8 F&G UI + Digest <- M7 Report UI <- M6 3-Tab Redesign <- M5 Calendar + Notifications <- M4 Monetization
```

No milestone begins until the previous one is closed. Closed means the `ph2_MILESTONES.md` sign-off and regression checklist are complete. **M0 must close before M1.**

---

## Milestones

| # | Name | One-Line Outcome | Source |
|---|---|---|---|
| M0 | Open-Source Data Foundation | Postgres historical tables bulk-loaded from SEC EDGAR + HuggingFace transcripts ($0 backfill path) | ph2_ADR-001 |
| M1 | Historical Data Pipeline | Contracts, `/v1/historical/*` APIs, migration registration, nightly SEC-aligned delta on M0 corpus | Roadmap A2 |
| M2 | Report Quality Engine | Deep Dives read like analyst-grade reports with QoQ, YoY, segments, and a Thesis Statement | Roadmap A1 |
| M3 | Fear & Greed Index Engine | Deterministic 6-signal market-data composite index calculated nightly | Idea 2 (backend) |
| M4 | Monetization & Subscription | RevenueCat with server-authoritative Free/Pro tiers enforced across all gated features | Roadmap A3 |
| M5 | Calendar & Smart Notifications | Earnings calendar, personalized FCM, contrarian alerts, weekly intelligence digest | Roadmap B3 + B4 + B5 + Idea 1 |
| M6 | 3-Tab Navigation Redesign | Today / Research / Portfolio architecture with explicit migration from the current 5-tab app | UX Architecture |
| M7 | Report UI & Interactive Features | Richer Deep Dive UX backed by contract/model expansion, not mock-only UI | Roadmap A5 + C3 |
| M8 | Fear & Greed UI & Weekly Digest | Fear & Greed dashboard with charts + weekly intelligence digest email | Idea 1 + Idea 2 (UI) |
| M9 | Offline, Security & Launch Prep | Room caching, cert pinning, ProGuard, PostHog dashboards | Roadmap A6 + A8 + C8 |

---

## Implementation Bridge From Phase 1

Phase 2 is only safe if the team treats certain milestones as explicit extension work on the current app, not as isolated feature drops.

### M4 - Monetization

- This milestone extends Phase 1 auth and user state.
- Required first: Postgres tier fields, webhook handling, server-side gating, and a profile read model.
- Mobile SDK purchase flow is not sufficient proof on its own.

### M5 - Calendar & Notifications

- This milestone extends scheduler, push, and user state.
- Contrarian alerts require a persisted server-side thesis anchor record. They must not be inferred from app memory or from "last opened report."

### M6 - 3-Tab Navigation

- This milestone refactors a working 5-tab Android app.
- Before UI implementation begins, the team must map the current Pulse / Deep Dive / Watchlist / History / Settings flows into Today / Research / Portfolio.
- `Portfolio` is a user-facing navigation label only. It does not introduce real holdings or portfolio-management scope.
- Deep links, push opens, history resume, and settings access must remain reachable throughout the refactor.

### M7 - Report UX

- This milestone depends on the current report contract and mobile parser being expanded deliberately.
- Export, notes, scenarios, and community sentiment are not pure UI work. Each needs a named owner, named storage or endpoint, and regression checks for existing `/reports/:id` consumers.

---

## Rules

1. A milestone is not closed until the `ph2_MILESTONES.md` sign-off and regression checklist are complete.
2. Technical/backend milestones must complete before their corresponding UI milestones.
3. Scope added mid-milestone is logged and deferred unless it is a hard blocker.
4. No code is touched in Phase 1 services unless the Phase 2 milestone explicitly requires it.
5. Any milestone that changes existing Phase 1 behavior must re-run the impacted Phase 1 smoke path before close.

---

## Deferred to Phase 3 (Maybe)

| Item | Why Deferred |
|---|---|
| Prediction tracking / "Were You Right?" | Risk of surfacing bad AI accuracy - reputational liability |
| Thesis score / gamification | Does not fit serious business audience - undermines credibility |
| Streak system | Same as above - toy-like for the target user |
| Leaderboard | Requires critical mass of users to be meaningful |
| iOS app | Wait for Android PMF first |
| Community sentiment layer beyond simple aggregate | Needs user base before it is useful |
| Referral program | Needs monetization running first |
| Personalized intelligence (ML) | Needs usage data to train on |
