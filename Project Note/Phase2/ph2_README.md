# Thesis - Phase 2

**"Every position needs one."**

Phase 2 evolves Thesis from a working MVP into a paid product with institutional-grade intelligence, a Fear & Greed index, a redesigned 3-tab UX, and monetization.

---

## What Phase 2 Adds

| Capability | Description |
|---|---|
| **Analyst-Grade Reports** | Deep Dives with QoQ comparisons, segment breakdowns, management commentary, and a one-line Thesis Statement |
| **5+ Years Historical Data** | Quarterly financials, annual data, earnings transcripts for S&P 500 tickers |
| **Fear & Greed Index** | Deterministic 6-signal composite sentiment gauge (market-data only) with charts and historical trends |
| **Monetization** | Free/Pro tiers with RevenueCat, gating premium features |
| **Smart Notifications** | Personalized FCM: earnings previews, contrarian alerts, weekly intelligence digest |
| **3-Tab UX** | Today (time-aware) / Research (Deep Dive engine) / You (profile + watchlist + settings) |
| **Export & Share** | PDF reports, branded share cards, investment memo format, user notes on reports |
| **What-If Scenarios** | Scenario analysis on Deep Dive reports |
| **Offline Mode** | Room caching + WorkManager prefetch for subway-friendly experience |

---

## What Phase 2 Is Not

Phase 2 is not a greenfield rebuild.

The current Phase 1 Android app, Product API, contracts, push flow, and report retrieval already work. Phase 2 adds new capability on top of that baseline. The plan is only safe if implementers preserve the working Phase 1 paths while extending them.

The highest-risk milestones are:

- **M4 Monetization**: real auth and schema work, not just SDK wiring
- **M5 Calendar & Notifications**: real persistence for contrarian alerts, not app-memory logic
- **M6 3-Tab UX**: real navigation refactor, not a tab rename
- **M7 Report UI**: real contract/model expansion, not mock-first visual polish

---

## Phase 2 Milestones

| # | Name | Type |
|---|---|---|
| M1 | Historical Data Pipeline | Backend / Data |
| M2 | Report Quality Engine | Backend / AI |
| M3 | Fear & Greed Index Engine | Backend / Data |
| M4 | Monetization & Subscription | Backend / Infrastructure |
| M5 | Calendar & Smart Notifications | Backend / Services |
| M6 | 3-Tab Navigation Redesign | Mobile / UX |
| M7 | Report UI & Interactive Features | Mobile / UX |
| M8 | Fear & Greed UI & Weekly Digest | Mobile / UX + Email |
| M9 | Offline, Security & Launch Prep | Infrastructure / Hardening |

---

## Implementation Reality Notes

Before starting the milestone sequence below, implementers should internalize these rules:

1. M4 must extend Phase 1 auth and user state without breaking register, verify, login, logout, Pulse, watchlist, push registration, or history.
2. M5 contrarian alerts need a server-side persisted alert anchor. They cannot be computed from whichever report the user last opened on device.
3. M6 must begin with a screen-mapping plan from the existing Pulse / Deep Dive / Watchlist / History / Settings model into Today / Research / You.
4. M7 must define the report contract or adapter plan before the new screen is built. Export, notes, scenarios, and votes each need explicit storage or endpoint ownership.

---

## Key Documents

| Document | Purpose |
|---|---|
| [ph2_ROADMAP.md](./ph2_ROADMAP.md) | Milestone sequence and delivery plan |
| [ph2_MILESTONES.md](./ph2_MILESTONES.md) | Acceptance criteria per milestone |
| [ph2_BLUEBOOK.md](./ph2_BLUEBOOK.md) | Architecture extensions |
| [ph2_PRD.md](./ph2_PRD.md) | Product requirements |
| [ph2_AGENTS.md](./ph2_AGENTS.md) | Operating rules |
| [new_PRODUCT_ROADMAP.md](../../../new_PRODUCT_ROADMAP.md) | Full feature backlog |
| [UX_ARCHITECTURE.md](../../../UX_ARCHITECTURE.md) | Target UX vision |

---

## Phase 1 Reference

Phase 1 docs (M1-M9: baseline through production hardening) live in `Phase1/` and remain the source of truth for existing architecture and current working app behavior.
