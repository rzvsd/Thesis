# Thesis - Current State

**Last revised:** 2026-11-22 (base: `main` at `79c01f9`, after PRs #69 and #70)
**Owner:** Razvan

This is the one document that says what is true now. It replaces the phase packs in
[`Project Note/`](../Project%20Note/README.md) as the current source of truth. The phase
packs stay as history. When this file and a phase file disagree, this file wins. When this
file and the code disagree, the code wins and this file must be fixed.

Update this file in the same PR that changes what it describes.

## Status words

| Word | Meaning |
|---|---|
| **Built** | Code exists on `main` and its tests pass. Nothing more is claimed. |
| **Validated** | Built, and evidence files (fixture runs, renders, test logs) exist under a milestone folder. It does **not** mean live data, real users or production. All Phase 7 milestones marked "Validated" are at this level. |
| **Done** | Validated, **plus** a recorded production run on live data, **plus** owner sign-off. No milestone has reached Done yet. |

Do not mark anything Done on fixture evidence.

## What the product is

Thesis is a research and conviction-support app for self-directed investors. It is not a
trading terminal and it has no brokerage connection. It has two core outputs:

- **Pulse**: a daily market brief, personalised by the names the user follows.
- **Deep Dive**: a filing-based memo on one company (what changed in the filing, financial
  indicators, a value lens, plain-English education).

### Services (`apps/`)

| Service | Language | Role |
|---|---|---|
| `product-api` | TypeScript | Public API for the app: auth, accounts, names, reports, alerts, subscriptions, Pulse dispatch. |
| `dexter-worker` | TypeScript | Builds Deep Dive and Pulse content. Deterministic facts first, optional guarded LLM copy editing after. |
| `data-openbb` | Python | Data service: SEC filings and company facts, FRED macro data, market tape. |
| `news-ingest` | Python | Headline metadata from approved sources. No article-body scraping. |
| `scheduler` | TypeScript | Timed jobs: official-source refresh, Pulse runs, alert checks. |
| `mobile` | TypeScript | A small health stub only. The real app is `apps/mobile/android`. |

Shared code is in `packages/` (contracts, scoring engine, shared types, observability and
others). Postgres and Redis run beside the services in `docker-compose.yml`.

### App surfaces

One Android app (Kotlin, Jetpack Compose). Five tabs: Today, Names, Research, Inbox, You.
There is no iOS app, no web app and no landing page.

### Data sources

| Source | Used for | State |
|---|---|---|
| SEC EDGAR (free, public) | Filings, company facts, Deep Dive | Live path exists. Default live tickers: AAPL, MSFT, TSLA only (`SCHEDULER_OFFICIAL_SOURCE_TICKERS`). |
| FRED (free, public) | Pulse market tape, Macro Stress | Live path exists. |
| Approved headline feeds | Pulse headlines (metadata only) | Live path exists; fixture by default. |
| Price data (end of day) | Pulse name rows, contrarian alerts, valuation ratios, DCF versus spot | **No approved provider.** Price-based outputs hide when no price exists. Owner decision open. |
| LLM providers | Optional copy editing of Pulse and Deep Dive text | Configurable provider order. Cost per Deep Dive is not measured. |

### Live versus fixture

Every data service defaults to fixture mode in `docker-compose.yml`
(`DEXTER_FIXTURE_MODE`, `DATA_OPENBB_FIXTURE_MODE`, `NEWS_INGEST_FIXTURE_MODE` all default
to `true`; push defaults to `stub`). In production the services refuse fixture mode unless
`THESIS_ALLOW_PRODUCTION_FIXTURES=true` is set for a proof job.

No recorded production run on live data exists in the repo. Deployment is a manual GitHub
Actions workflow (`deploy-production.yml`) that deploys Docker Compose over SSH.

## Honest status by surface

| Surface | Status | What limits it |
|---|---|---|
| Pulse morning brief | Validated | Followed-name prices have no source. Macro and geopolitical headlines do not reach the live dispatch path until PR #71 merges. Best quality is in the HTML/PDF export, not the native screen. |
| Deep Dive memo | Validated | Live SEC data for three tickers by default. Filing text is not connected until PR #71 merges. Price-based ratios hide without a price. About 90 seconds on first request. |
| Names (watchlist, freshness, drift) | Built | Useful only after a Deep Dive exists for the name. |
| Inbox and alerts | Built | Contrarian alerts need prices. Push only, no email. No filing-change alert on `main`. |
| War Room, Scenario Stress, What-If, Opposite Case, Conviction timeline, Monthly coherence | Built, Pro-gated | Nobody can buy Pro yet. |
| Fear & Greed screen and routes | Leftover | Replaced by Macro Stress (Phase 6 ADR-005). Still present. |
| Subscriptions (RevenueCat) | Built | Not configured: no RevenueCat project, no Play product IDs. Free = 1 Deep Dive per day, 5 names. Pro = unlimited Deep Dives, 20 names. |
| Accounts | Built | Email with verification, Google sign-in, biometric lock. No password reset, no account deletion on `main`. |
| Legal | Missing on `main` | No privacy policy or terms. The "not financial advice" notice exists in onboarding. |
| Developer surface | Present | A "CONFIGURE API" field shows on login and settings with no debug guard on `main`. |
| CI | Red on `main` until PR #71 merges | PRs #69 and #70 are merged. |
| Production | Not proven | See launch checklist. |

## Open owner decisions

These are not made. Code must stay behind config with a safe default until Razvan decides.

| Decision | Options in play | Blocks |
|---|---|---|
| Price data provider | Any licensed end-of-day provider whose licence allows display in a paid consumer app. | Pulse name rows, contrarian alerts, valuation ratios, DCF versus spot. |
| Launch market | US first or EU first. | Legal review, store listing, how the signal ("Positive 7/10") is read by regulators. |
| LLM budget per Deep Dive | A cap per report, or no cap but measured. | Pricing of Pro, "unlimited" claims, pre-compute cost. |
| Hosting target | The deploy workflow uses SSH to a Docker Compose host. The old ADR-004 says Fly.io. PR #75 records the as-built choice; the owner must confirm the real target. | Production proof, runbooks. |

## Launch checklist

Built from the launch blockers in the 2026-11-22 strategic product audit. Tick an item only
when it is true on `main` **and** proven in production where the item says so.

- [ ] **Review blockers fixed.** The seven P1 blockers from the 2026-09-06 review are fixed on `main` (PR #71) and CI is green.
- [ ] **Licensed price source.** One provider, chosen by the owner, serves all four price consumers through the data service.
- [ ] **Coverage matches the promise.** Live SEC coverage for the S&P 500 universe, with pre-computed Deep Dives; the app says which companies are covered.
- [ ] **Account lifecycle.** Password reset, and account deletion in the app and on the web (Google Play requirement).
- [ ] **Legal pages.** Privacy policy and terms, reviewed by a lawyer for the chosen launch market, linked at sign-up and in the You tab.
- [ ] **Honest copy.** No "any US company", "alternative data" or wrong watchlist limits in the app.
- [ ] **No developer surface.** The API URL field is debug-only.
- [ ] **Billing live.** RevenueCat project and keys, Play product IDs, gated-feature list decided; one real purchase, renewal and cancellation on the Play test track.
- [ ] **One proven production run.** One environment, live mode, real data, CI green, `/health` shows live mode, proof recorded in the repo, owner sign-off. This is the first "Done".

After launch blockers, the audit ranks next: filing-change alerts end to end, the new
paywall, three-tab navigation with a native Deep Dive memo, and a closed test with 20 to 50
investors.

## In-flight audit PRs

> **Prune this section as PRs land.** When a PR merges, delete its line and update the
> sections above to match. When the list is empty, delete the section.

| PR | Title | What changes when it lands |
|---|---|---|
| #71 | Fix the seven P1 blockers from the 2026-09-06 review | Review blockers fixed; CI can go green; macro headlines and filing text reach the live path. |
| #72 | mobile: honest product copy, debug-only API URL field | Ticks "Honest copy" and "No developer surface". |
| #73 | Provider-agnostic EOD price interface; route all price consumers through data service | Price interface ready; provider stays an owner decision. |
| #74 | S&P 500 coverage with pre-computed Deep Dives | Coverage widens from three tickers to the S&P 500 universe. |
| #75 | Launch proof: mode in /health, proof script, runbook, as-built hosting ADR | Tooling for the production proof; ADR-004 reflects the SSH deploy. |
| #76 | Legal drafts: privacy policy and terms (US + EU), public /legal pages, in-app links | Draft legal pages; still need legal review. |
| #77 | Closed test: funnel events and test plan (audit item 9) | Funnel events and plan for the closed test. |
| #78 | Filing-change alerts: push + email when a covered ticker files a new 10-Q/10-K | First end-to-end filing-change alert. |
| #79 | Holdings by CSV import (manual only) | Manual holdings without a broker link. |
| #80 | Billing tiers (Free 3 / Pro 50), Pro-only alert detail, one paywall screen | New tier limits and paywall; store setup still open. |
| #81 | Pulse by email and a public web reader for shared Deep Dives (stacks on #78) | Email channel and web reader. |
| #82 | Account lifecycle: password reset, account deletion (app + web), send verification email | Ticks "Account lifecycle" once merged. |

## Where to look next

- Strategic product audit (2026-11-22) and technical audit: links are held by the owner.
- Review blockers: [`reviews/2026-09-06/`](../reviews/2026-09-06/)
- Runbooks: [`docs/runbooks/INDEX.md`](./runbooks/INDEX.md)
- Testing rules: [`docs/testing-doctrine.md`](./testing-doctrine.md)
- Decision records: [`Decisions/`](../Decisions/README.md)
- History: [`Project Note/`](../Project%20Note/README.md)
- Design: Android tokens in `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/theme/`; report exports in [`docs/pulse-report/DESIGN.md`](./pulse-report/DESIGN.md).
