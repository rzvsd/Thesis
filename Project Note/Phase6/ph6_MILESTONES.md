# Thesis - Phase 6 Milestone Briefs

**Version:** 1.0  
**Status:** Active  
**Owner:** Engineering Lead + Product Lead  
**Last Revised:** 2026-04-18
**Related Documents:** `ph6_BLUEBOOK.md`, `ph6_PRD.md`, `ph6_ROADMAP.md`, `ph6_SECURITY.md`, `PH6_DECISION_LOCKS.md`

---

## How to Read This Document

Each Phase 6 milestone is a self-contained brief. It defines what is being built, what must be true before the milestone can close, how the milestone is smoke tested, and how the work is rolled back if the migration introduces regressions.

Phase 6 has one additional closeout rule compared with earlier phases:

**A milestone is not done if it keeps a deprecated provider dependency alive in the affected production path.**

Each milestone records proof under:

```text
Project Note/Phase6/Milestones/M#/evidence/
```

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M0 | Dependency Audit & Cutover Plan | Migration inventory, CI guardrails, ADRs, and doc pack |
| M1 | Official Truth Data Plane | SEC and official macro adapters become the canonical data substrate |
| M2 | Rights & First-Party Context | Rights-aware evidence and bounded first-party context ingestion |
| M3 | Morning Exception Briefing & Macro Stress | Pulse rebuilt around official macro, disclosure events, and bounded context |
| M4 | Earnings State & War Room Substrate | Estimated/confirmed/actual timing and release-artifact workflows |
| M5 | Deep Dive / Scenario Final Cutover & Hardening | Final provider-free Deep Dive and Scenario path with end-to-end smoke proof |

---

# M0_Dependency Audit & Cutover Plan

## Goal

Make the migration explicit before implementation work fragments across services.

**Plain English:** Before touching the engine room, write down every old provider assumption, decide what replaces it, and make the repo fail loudly if those assumptions creep back in.

## Deliverables

| Deliverable | Description |
|---|---|
| Dependency inventory | Named list of every production path that still references OpenBB, FMP, yfinance, paid/provider-shaped data, or quote-heavy assumptions |
| Doc pack | `ph6_BLUEBOOK.md`, `ph6_PRD.md`, `ph6_ROADMAP.md`, `ph6_AGENTS.md`, `ph6_SECURITY.md`, and milestone docs committed |
| ADR set | `ph6_ADR-001_official_data_substrate.md` through `ph6_ADR-006_final_cutover_and_omission_truth.md` drafted |
| CI guardrail | A failing check if a deprecated dependency is imported or required in a production-critical path |
| Migration matrix | For each affected surface, a replacement path and omission rule |
| Secret cleanup plan | Inventory of old provider keys and environment flags with deprecation status |
| Decision locks | `PH6_DECISION_LOCKS.md` records guard scope, source policy, Fear & Greed transition, evidence format, and exact contract names |

## Acceptance Criteria

- [x] Every production-critical reference to deprecated providers is inventoried by file or service boundary
- [x] The Phase 6 document pack is committed
- [x] ADR-001 through ADR-006 are drafted and linked
- [x] CI fails when a deprecated provider is introduced into the protected path
- [x] A migration matrix exists for Deep Dive, Pulse, War Room, alerts, freshness, and scenarios
- [x] Old provider secrets are marked active / deprecated / archived with an owner
- [x] The dependency guard scope distinguishes protected active paths from archived historical docs and evidence
- [x] Exact Phase 6 contract names and files are locked before implementation begins

## Smoke Test

```text
Step 1: Run the Phase 6 dependency scan locally
Step 2: Confirm - every known OpenBB/FMP/yfinance-style protected production path is reported
Step 3: Add a temporary forbidden import in a protected service
Step 4: Confirm - CI or local guard fails
Step 5: Remove the temporary forbidden import
Step 6: Confirm - guard passes again
Step 7: Confirm archived Phase1-Phase5 docs can mention superseded providers without failing the protected-path guard
Step 8: Open the doc pack and verify all linked files exist
Step 9: Confirm - the migration matrix maps every affected surface to a replacement or omission rule
Step 10: Confirm `PH6_DECISION_LOCKS.md` lists contract names, guard scope, source locks, and evidence standard
```

## Success

The team can migrate without pretending the old architecture is still acceptable.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Hidden provider dependency survives | Dependency scan misses it or smoke path still calls it | Phase 6 becomes theater instead of a cutover |
| CI guard is too weak | Deprecated code can merge silently | Regression risk remains high |
| CI guard is too broad | Historical docs or evidence fail the build even though no runtime path is affected | Phase 6 becomes noisy and slows implementation |
| Docs disagree with implementation target | Review reveals inconsistent directions | Engineering work fragments and rework grows |

## Rollback

M0 is mostly documentation and CI policy. Rollback means reverting the guard or doc changes if they break unrelated delivery, then reissuing them with corrected scope.

## Dependencies

- Phase 5 document set is available
- Current repo path inventory can be inspected

## Owner

Platform Architect + Engineering Lead

---

# M1_Official Truth Data Plane

## Goal

Replace provider-shaped data assumptions with official-company and official-macro truth adapters.

**Plain English:** Build the clean pipes first: SEC for company truth, official agencies for macro truth, and no paid provider keys needed to prove the path works.

## Deliverables

| Deliverable | Description |
|---|---|
| SEC adapter path | Canonical retrieval for submissions, company facts, filings, and exhibits |
| Official macro adapter path | Canonical retrieval for approved official macro series and release metadata |
| Canonical event seeds | Filing and macro events are normalized into typed records |
| Golden fixtures | Official-source fixtures stored for CI and smoke tests |
| Missing-data behavior | Missing or stale fields are explicit, never guessed |
| No-provider-key smoke path | Core tests run without OpenBB/FMP/Polygon/Alpha Vantage/yfinance keys |

## Locked M1 Interface Plan

| Area | Locked shape |
|---|---|
| Official-source contract | `packages/contracts/src/official-source.ts` with `OfficialSourceReference`, `OfficialRetrievalMetadata`, and `OfficialMissingFieldState` |
| Canonical-event contract | `packages/contracts/src/canonical-event.ts` with `CanonicalEvent`, `CanonicalEventFamily`, and `CanonicalEventSourceState` |
| Company truth endpoint | `GET /v1/official/company?ticker=AAPL` on `data-openbb` |
| Macro truth endpoint | `GET /v1/official/macro?scope=daily` on `data-openbb` |
| Product ingestion endpoint | `POST /internal/canonical-events/ingest` on `product-api` |
| Scheduler refresh trigger | `POST /internal/official/refresh` or existing scheduler job registration if already present |

## Locked M1 Seed Scope

Company smoke tickers: `AAPL`, `MSFT`, `TSLA`.

Macro smoke registry:

| Registry key | Official owner | Purpose |
|---|---|---|
| `TREASURY_DAILY_10Y` | U.S. Treasury | Long-rate pressure |
| `TREASURY_DAILY_2Y` | U.S. Treasury | Front-end rate pressure |
| `BLS_CPI_U_ALL_ITEMS` | BLS | Inflation pressure |
| `BLS_UNEMPLOYMENT_RATE` | BLS | Labor pressure |
| `BEA_REAL_GDP` | BEA | Growth pressure |
| `EIA_WTI_SPOT` | EIA | Energy pressure |

## Acceptance Criteria

- [x] SEC-backed company truth is returned for at least 3 supported tickers
- [x] Official macro truth is returned for the approved daily scope without deprecated provider keys
- [x] Every official-source response includes explicit retrieval metadata and missing-field state
- [x] Canonical filing and macro event records are generated from the official adapter outputs
- [x] Golden fixtures are committed and validated in CI
- [x] No core smoke step requires an old market-data provider key

## Smoke Test

```text
Step 1: Start the official-source adapter services locally
Step 2: Request official company truth for AAPL, MSFT, and TSLA
Step 3: Confirm - contract-valid official-source payloads are returned
Step 4: Request the approved daily macro scope
Step 5: Confirm - official macro payload validates and includes retrieval metadata
Step 6: Inspect canonical event output for one filing and one macro release
Step 7: Confirm - typed events are emitted correctly
Step 8: Remove all deprecated provider keys from the local env
Step 9: Re-run the smoke path and confirm it still passes
```

## Success

The core Thesis substrate now works from official public truth rather than provider-shaped truth.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Official adapter is incomplete | Missing fields or invalid payloads in smoke tests | Deep Dive and Pulse cannot trust the substrate |
| Provider dependency still hides in the path | Smoke fails without provider keys | Phase 6 objective not actually met |
| Canonical event mapping is wrong | Event checks fail | Downstream alerts and Pulse narratives become unreliable |

## Rollback

Redeploy the prior adapter version or disable the new endpoints while keeping the migration work behind a flag. Do not silently route back to deprecated providers as a rollback shortcut.

## Dependencies

- M0 complete
- Approved official macro seed registry from `PH6_DECISION_LOCKS.md`

## Owner

Data Platform Engineer

---

# M2_Rights & First-Party Context

## Goal

Make evidence rights explicit and production-safe, and add bounded first-party context ingestion.

**Plain English:** Teach the system the difference between truth it can store, context it can summarize, and pages it may only link to.

## Deliverables

| Deliverable | Description |
|---|---|
| Evidence rights contract | `rights_class`, `display_mode`, `source_rank`, and related metadata added to the right contracts |
| First-party source registry | Allowlisted domains and page types for company-hosted context |
| Call artifact model | Release, slides, webcast page, transcript, and related materials modeled safely |
| Bounded fetch logic | Event-driven first-party fetch path with no broad crawl |
| Rights-safe context storage | Summary/excerpt/link behavior enforced according to source policy |
| Fixtures and tests | Rights and source-state fixture coverage committed |

## Locked M2 Interface And Seed Scope

| Area | Locked shape |
|---|---|
| Evidence rights contract | `packages/contracts/src/evidence-rights.ts` with `EvidenceRightsClass`, `EvidenceDisplayMode`, `EvidenceSourceRank`, and `EvidenceRightsMetadata` |
| First-party context contract | `packages/contracts/src/first-party-context.ts` with `FirstPartySourceRegistryEntry`, `FirstPartyContextFetchState`, and `FirstPartyContextItem` |
| Call artifact contract | `packages/contracts/src/call-artifact.ts` with `CallArtifactType`, `CallArtifactCompletenessState`, and `CallArtifact` |
| News ingest fetch endpoint | `POST /v1/first-party/context` on `news-ingest` |
| Product ingest endpoint | `POST /internal/first-party/context/ingest` on `product-api` |
| Product read endpoint | `GET /internal/first-party/context` on `product-api` |
| Storage tables | `first_party_context_items` and `call_artifacts` via `ph6m2_029_first_party_context` migration |

M2 seed first-party source registry:

| Ticker | Source | Path scope | Display mode |
|---|---|---|---|
| `AAPL` | `investor.apple.com` | `/investor-relations/`, `/` | `excerpt_only` |
| `AAPL` | `www.apple.com` | `/newsroom/` | `excerpt_only` |
| `MSFT` | `www.microsoft.com` | `/en-us/investor/`, `/en-us/Investor/` | `excerpt_only` |
| `MSFT` | `news.microsoft.com` | `/` | `excerpt_only` |
| `TSLA` | `ir.tesla.com` | `/`, `/press-release/` | `excerpt_only` |
| `TSLA` | `assets-ir.tesla.com` | `/` | `excerpt_only` |
| `TSLA` | `digitalassets.tesla.com` | `/` | `excerpt_only` |
| `TSLA` | `www.tesla.com` | `/` | `excerpt_only` |

This is an implementation seed, not broad ticker coverage. Unknown domains reject by default.

## Acceptance Criteria

- [x] Every stored context or evidence item produced in the new path carries a rights posture and display mode
- [x] First-party IR and release retrieval works for at least 2 supported issuers
- [x] Unapproved domains or undefined rights states are rejected safely
- [x] Call artifacts can be stored and retrieved with completeness and provenance fields
- [x] Context storage obeys the configured display mode rules
- [x] Rights and fetch-policy tests pass locally and are ready for CI

## Smoke Test

```text
Step 1: Trigger a first-party fetch for a supported issuer event
Step 2: Confirm - the retrieved item has source, rights_class, display_mode, and retrieved_at
Step 3: Retrieve a call artifact for a recent earnings-related event
Step 4: Confirm - artifact metadata includes artifact_type and completeness state
Step 5: Attempt to ingest a disallowed domain or undefined rights item in test mode
Step 6: Confirm - the item is rejected and does not become user-facing evidence
Step 7: Confirm - excerpt-only or link-only rules are enforced when expected
```

## Success

The product can enrich official truth with company context without quietly creating a redistribution problem.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Rights metadata is missing | Contract validation or smoke check fails | Unsafe text handling risk |
| First-party fetch path becomes a crawler | Review or logs show uncontrolled fetch patterns | Legal and operational risk rises sharply |
| Call artifact completeness is unclear | Artifact contract lacks state or provenance | War Room and Deep Dive lose trust |

## Rollback

Disable the new first-party fetch triggers or rights-enforced storage path while retaining the contract definitions and tests. Do not revert by storing unclassified text.

## Dependencies

- M1 complete
- Initial allowlist approved by Product/Legal

## Owner

Backend Engineer + Platform Architect

---

# M3_Morning Exception Briefing & Macro Stress

## Goal

Rebuild the daily briefing around official macro, disclosure events, and bounded context; replace fear-and-greed style behavior with Macro Stress.

**Plain English:** The morning product survives without a quote terminal by becoming more honest and more useful.

## Deliverables

| Deliverable | Description |
|---|---|
| Morning Exception Briefing pipeline | Daily briefing built from official macro, canonical events, and bounded context |
| Macro Stress snapshot | Official-only daily stress summary |
| Fear & Greed transition | Active Fear & Greed behavior removed, archived, or explicitly replaced by Macro Stress |
| No-material-change behavior | Explicit briefing output when nothing material happened |
| Watchlist / My Names relevance | Followed names remain visible through event relevance, not quote theater |
| Delivery path | Stored and delivered through the existing Product API + mobile path |
| Updated smoke coverage | Pulse smoke tests rewritten for the Phase 6 substrate |

## Acceptance Criteria

- [x] Scheduler generates a valid morning briefing without deprecated provider dependencies
- [x] Briefing sections are sourced from official macro, canonical events, and rights-safe context items
- [x] Macro Stress snapshot is generated from approved official-only inputs
- [x] Active Fear & Greed dashboard behavior is not reachable as a first-class Phase 6 surface unless it is explicitly archived/history-only
- [x] If no material changes occurred, the briefing says so explicitly
- [x] My Names relevance works through event/context matching rather than quote-board assumptions
- [x] Pulse storage and delivery remain operational

## Smoke Test

```text
Step 1: Trigger the morning briefing in test mode
Step 2: Confirm - a new job is created and completes successfully
Step 3: Retrieve the generated briefing
Step 4: Confirm - sections validate and no deprecated provider path was required
Step 5: Retrieve the Macro Stress snapshot used by the briefing
Step 6: Confirm - the snapshot uses approved official inputs only
Step 7: Attempt the old Fear & Greed dashboard path
Step 8: Confirm - it is replaced by Macro Stress, archived/history-only, or explicitly unsupported
Step 9: Run a no-material-change test fixture
Step 10: Confirm - the output explicitly reports no material change rather than padding the briefing
```

## Success

Morning Pulse becomes a strong daily ritual without relying on unlicensed market-data theater.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Briefing still expects quote completeness | UI or payload still references unsupported market-board behavior | Product truthfulness is compromised |
| Macro Stress depends on deprecated inputs | Dependency scan or smoke proof fails | The feature is not actually migrated |
| No-change behavior is missing | Quiet days generate noisy filler | The exception-first doctrine breaks |

## Rollback

Disable the new briefing template or Macro Stress output and route users to the previous archived pulse while the Phase 6 version is fixed. Do not reactivate deprecated providers silently.

## Dependencies

- M2 complete
- Mobile and Product copy decisions for no-material-change states approved

## Owner

Scheduler Owner + Product Lead

---

# M4_Earnings State & War Room Substrate

## Goal

Make earnings timing and war-room readiness reliable without paid calendar or transcript dependencies.

**Plain English:** The product should know the difference between "we think earnings is around then," "the company confirmed it," and "results are actually out."

## Deliverables

| Deliverable | Description |
|---|---|
| Three-state earnings model | `estimated`, `confirmed`, `actual` with source and timestamp |
| Event-window scheduler behavior | Pre-event and post-event workflows trigger from the new state model |
| War Room evidence pack | Prior filing baseline, release artifacts, slides, contradiction summary |
| Alert reason paths | Earnings-related alerts explain why they fired and what they reference |
| Rights-safe artifact handling | Release and presentation materials handled according to rights posture |

## Acceptance Criteria

- [x] Earnings state is visible and typed for supported watched names
- [x] Confirmed state requires a first-party or official source
- [x] Actual state is set when release evidence is present
- [x] War Room can be generated without transcript text
- [x] Earnings-related alerts include a reason path and source state
- [x] Missing or conflicting timing data is surfaced explicitly

## Smoke Test

```text
Step 1: Seed one estimated earnings event and one confirmed earnings event in test mode
Step 2: Confirm - the API distinguishes the two states clearly
Step 3: Trigger a release artifact event
Step 4: Confirm - the state advances to actual
Step 5: Open the War Room payload
Step 6: Confirm - it includes prior baseline, release artifact, and contradiction/follow-up context
Step 7: Remove transcript text from the fixture
Step 8: Confirm - War Room still validates and remains useful
```

## Success

Earnings workflows become evidence-driven instead of vendor-calendar-driven.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Estimated vs confirmed is blurred | Smoke check or UI review shows ambiguous labeling | User trust drops quickly |
| War Room requires transcript text | Validation or smoke fails when transcript is absent | The workflow is too brittle |
| Alert reason path is missing | Ledger or payload lacks reason metadata | Inbox and notification trust degrade |

## Rollback

Disable the new event-window triggers or War Room generation while keeping the typed state model in place behind a safe fallback.

## Dependencies

- M3 complete
- First-party source registry and call artifact contracts are in place

## Owner

Product API Owner + AI/Reasoning Engineer

---

# M5_Deep Dive / Scenario Final Cutover & Hardening

## Goal

Complete the provider-free cutover for Deep Dive and Scenario paths, then prove the product loop still works end to end.

**Plain English:** This is the final reality check. The product still has to feel serious after the old shortcuts are gone.

## Deliverables

| Deliverable | Description |
|---|---|
| Deep Dive cutover | Report generation works from official truth and first-party context without deprecated provider dependencies |
| Scenario cutover | Scenario and valuation logic no longer require market-data-API beta/correlation assumptions |
| Compatibility layer | Old stored reports remain readable while new contracts are served cleanly |
| End-to-end smoke proof | Core user flows pass under the Phase 6 substrate |
| Rollback documentation | Cutover rollback path documented and tested |
| Final dependency proof | No deprecated provider path remains in the core Thesis loop |

## Acceptance Criteria

- [x] Deep Dive completes without a deprecated market-data provider in the critical path
- [x] Scenario / valuation outputs use the Phase 6 deterministic input model and omit unsupported dimensions explicitly
- [x] Stored older reports remain readable through the current product surface
- [x] End-to-end smoke tests for Deep Dive, Morning Briefing, War Room, and alert reason paths pass
- [x] Rollback has been tested and documented
- [x] Final dependency scan reports no deprecated provider in the protected core path

## Smoke Test

```text
Step 1: Run a Deep Dive for at least 3 supported names
Step 2: Confirm - reports validate and do not require deprecated providers
Step 3: Run a scenario stress workflow with one omitted market-derived dimension
Step 4: Confirm - the omission is explicit and the output remains valid
Step 5: Load an older stored report artifact
Step 6: Confirm - it remains readable in the app or API
Step 7: Trigger Morning Exception Briefing and one earnings alert path
Step 8: Confirm - the full product loop still works end to end
Step 9: Run the final dependency scan
Step 10: Confirm - no protected service path imports or requires a deprecated provider
```

## Success

Thesis survives the cutover as a cleaner, cheaper, more honest intelligence product.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Deep Dive still relies on old provider-shaped assumptions | Dependency scan or smoke path fails | Phase 6 cannot close |
| Scenario path implies false precision | Review or smoke shows hidden unsupported dimensions | Product trust risk |
| Older reports become unreadable | Regression in history or API retrieval | Compatibility breach |
| End-to-end loop feels materially weaker | Product review or smoke evidence shows degraded usefulness | Phase 6 may need scope correction before close |

## Rollback

Roll back the cutover behind flags or versioned read paths while preserving data integrity. Do not silently reintroduce deprecated providers as the default runtime path.

## Dependencies

- M4 complete
- Mobile handling of omissions and source-state truth implemented

## Owner

Engineering Lead + Product Lead

---

## Appendix: Phase 6 Sign-Off Checklist

Before closing any Phase 6 milestone, confirm:

```text
[ ] All acceptance criteria checked off
[ ] Smoke test executed in full and recorded
[ ] CI passing
[ ] Deprecated dependency check passing
[ ] Rollback confirmed executable
[ ] Any scope deferrals logged
[ ] Milestone owner signs off
[ ] Engineering Lead countersigns
```
