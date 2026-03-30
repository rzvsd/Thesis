# Phase 2 - AGENTS.md (Root Rulebook)

**Scope:** Phase 2 milestones (M0-M9). Every service, every session.  
**Read this first. Then read the milestone-specific guide in `Phase2/Milestones/M#/`.**

---

## Who You Are

You are the coding agent for the Thesis Finance Intelligence Platform - Phase 2. Your job is to evolve the working MVP into a paid product with richer intelligence, new data surfaces, and a redesigned UX.

You are precise, honest, and conservative. You follow documents. You never improvise architecture. When something needs a decision - you flag it. When data is missing - you declare it.

---

## The Document Hierarchy

| Document | What it governs |
|---|---|
| `ph2_BLUEBOOK.md` | Architecture extensions, new services, new contracts |
| `ph2_MILESTONES.md` | Acceptance criteria per Phase 2 milestone |
| `ph2_ROADMAP.md` | Milestone sequence - the map |
| `ph2_PRD.md` | Product requirements for Phase 2 features |
| `ph2_AGENTS.md` (this file) | Your global operating rules for Phase 2 |
| `Phase2/Milestones/M#/` | Milestone-specific implementation guides |
| `Decisions/ph2_ADR-*.md` | Architecture decisions for Phase 2 |
| `new_PRODUCT_ROADMAP.md` | Full feature backlog and rationale |
| `UX_ARCHITECTURE.md` | Target 3-tab UX vision |

**Phase 1 documents remain the source of truth for existing architecture.** Phase 2 extends - never contradicts - Phase 1 decisions.

**Before writing a single line of code:**
- [ ] Read this file
- [ ] Read the current milestone in `ph2_MILESTONES.md`
- [ ] Read any milestone-specific guide in `Phase2/Milestones/M#/`
- [ ] Confirm which service you are in
- [ ] Confirm which contracts you are touching
- [ ] Check if any `ph2_ADR-*` applies
- [ ] Identify the Phase 1 behavior that must keep working after the change

---

## Phase 2 Principles

1. **Technical first, UI second.** Backend milestones (M0-M5) must complete before their UI milestones (M6-M8).
2. **No gamification.** No streaks, scores, or leaderboards. The product targets serious investors and entrepreneurs - credibility over engagement tricks.
3. **Config/data before presentation.** A new feature's data pipeline and storage must exist before any Compose UI is built.
4. **Respect Phase 1 architecture.** The existing monorepo structure, contract system, and service boundaries are not renegotiated. Extend, do not freestyle.
5. **One milestone at a time.** No parallel milestone work. Each milestone is confirmed closed before the next begins.
6. **The working Phase 1 app is the regression baseline.** If Phase 2 touches login, push, Pulse, History, Watchlist, Deep Dive, or Settings, those paths must be re-tested.

---

## Phase 2 High-Risk Implementation Rules

These are not optional interpretations. They are the safe implementation path.

### M4 - Monetization is a real auth/schema change

- Do not treat M4 as "mobile SDK first."
- The server is the source of truth for entitlement.
- `product-api` must gain durable user tier storage, webhook processing, server-side gating, and a read model such as `GET /v1/user/profile` before mobile gating is considered done.
- Existing Phase 1 auth flows must still work: register, verify, login, refresh, logout, watchlist CRUD, Pulse retrieval, push token registration.

### M5 - Contrarian alerts require a persisted thesis anchor

- Do not derive contrarian alerts from transient mobile state, last screen visited, or ad-hoc notification memory.
- A server-side persisted anchor record must exist for any alert the scheduler evaluates.
- The anchor must reference the user, ticker, source report or signal, anchored signal value, `anchor_price`, and timestamps needed to decide whether the alert window is still valid.

### M6 - 3-tab navigation is a real refactor

- Do not treat M6 as a tab rename.
- The current Phase 1 Android app already has working Pulse, Deep Dive, Watchlist, History, and Settings flows.
- M6 must begin with a screen-mapping plan from the current navigation model to `Today / Research / Portfolio`.
- `Portfolio` is UX framing only. It does not authorize holdings, P&L, brokerage, or real portfolio-tracking scope.
- No old screen is deleted until the mapped destination is reachable and smoke-tested.

### M7 - Report UX requires contract/model expansion

- Do not build the new Deep Dive UI against mocks only.
- Before a richer report UI is considered implementation-ready, the team must define either:
  - a versioned contract change in `packages/contracts`, or
  - a deliberate adapter layer from the current contract to the new mobile view model.
- Export, notes, scenarios, and community sentiment are not "just UI"; each requires explicit storage, endpoint, or artifact ownership.

---

## Service Extensions for Phase 2

| Service | Phase 2 Role |
|---|---|
| `product-api` | New endpoints: subscription management, Fear & Greed index, calendar events, export |
| `data-openbb` | Extended: Fear & Greed input signals; **live** quotes and price history for beta (M2). Historical **Postgres** corpus is M0/M1 (`product-api`), not a new `data-openbb` bulk backfill |
| `news-ingest` | Extended: weekly digest aggregation |
| `scheduler` | Extended: nightly Fear & Greed calculation, earnings calendar sync, weekly digest cron |
| `dexter-worker` | Extended: new report template with historical QoQ context |
| `mobile` | Major: 3-tab redesign, new report layout, Fear & Greed dashboard, subscription UI |

**New packages (potential):**

| Package | Purpose |
|---|---|
| `packages/fear-greed-engine` | Composite sentiment scoring logic |
| `packages/historical-data` | Financial snapshot normalization and retrieval support |

**Package rule:** Create a new package only if it is a true shared boundary. Do not move single-service code into `packages/` just for tidiness.

---

## Contract Rules (Same as Phase 1)

- All inter-service data flows through `packages/contracts`
- A new contract must be drafted, typed, and reviewed before any service uses it
- No service may bypass contracts by passing raw data directly
- If Phase 2 extends an existing Phase 1 contract, the change must include a compatibility plan for current consumers

---

## Database and Migration Rules

- Any milestone that adds persistent behavior must name the table(s), key fields, and owning service before implementation starts
- Schema work is not hidden inside "later cleanup"
- If a milestone depends on new persistence, the migration lands before or with the first feature code that needs it
- Product API migration registration must stay current with actual SQL files

---

## Testing Rules

- Every new feature has a smoke test
- Every new API endpoint has an integration test
- Mobile changes must be tested on a physical device before milestone close
- No milestone is closed without all milestone tests passing
- If a Phase 2 change touches a working Phase 1 flow, the smoke test must include the impacted Phase 1 path

**Minimum regression set when M4-M7 are touched:**
- Register -> verify -> login still works
- Latest Pulse still loads
- Watchlist/My Names CRUD still works
- History still loads prior reports
- Push token registration still succeeds
- Notification tap still lands on the correct screen

---

## Documentation Rules

- Phase 2 docs must describe how new work preserves the current working app
- If a milestone is really a refactor, say so plainly
- If a milestone needs schema or contract expansion, say so plainly
- If a feature depends on a persisted model that does not exist yet, the docs must name that gap before coding starts

---

## Closure Rule

A Phase 2 milestone is not done when the new feature appears once on screen. It is done when:

1. The new milestone acceptance criteria pass
2. The impacted Phase 1 behaviors still pass
3. The milestone-specific guide is updated with smoke results, decisions, and deferrals
4. No hidden schema/contract/persistence gap remains undocumented
