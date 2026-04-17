# Thesis - Phase 6 Roadmap

Name of the app : "Thesis"  
Marketing for the app : "Every position needs one"

**Thesis — every position needs one**

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04-16  
**Related Documents:** `ph6_BLUEBOOK.md`, `ph6_MILESTONES.md`, `ph6_PRD.md`

> Phase 6 is the final architecture phase. It exists to remove paid and rights-ambiguous market-data assumptions from the core product while preserving the Thesis product edge.

---

## Sequence

```text
M0 Dependency Audit & Cutover Plan
  -> M1 Official Truth Data Plane
  -> M2 Rights & First-Party Context
  -> M3 Morning Exception Briefing & Macro Stress
  -> M4 Earnings State & War Room Substrate
  -> M5 Deep Dive / Scenario Final Cutover & Hardening
```

No milestone begins until the previous one is closed. Closed means:

1. all acceptance criteria checked off,
2. smoke test evidence recorded,
3. rollback confirmed,
4. no hidden dependency on deprecated providers remains in the affected path.

---

## Milestones

| # | Name | One-Line Outcome |
|---|---|---|
| M0 | Dependency Audit & Cutover Plan | The migration away from OpenBB/FMP/yfinance-style assumptions is explicit, testable, and guarded in CI |
| M1 | Official Truth Data Plane | SEC and official macro adapters become the core data substrate |
| M2 | Rights & First-Party Context | Evidence rights, call artifacts, and allowlisted first-party context are production-shaped |
| M3 | Morning Exception Briefing & Macro Stress | Pulse is rebuilt around official macro, disclosure events, and bounded context |
| M4 | Earnings State & War Room Substrate | Estimated/confirmed/actual timing and evidence-pack workflows are live |
| M5 | Deep Dive / Scenario Final Cutover & Hardening | Deep Dive and Scenario paths no longer depend on deprecated providers, and Phase 6 closes cleanly |

---

## Post-Phase Backlog (Not Scheduled)

These items are intentionally unscheduled after Phase 6. They require a fresh ADR, legal review, and product justification.

| Item | Trigger to Schedule |
|---|---|
| Licensed quote provider re-entry | Strong, measured product need that cannot be met with official/first-party substrate |
| Licensed transcript provider | Transcript absence demonstrably harms retention or product value |
| Full-text licensed news warehouse | A bounded rights-clean warehouse proves necessary for differentiated search or alerts |
| Intraday market window analytics | Explicit product decision plus licensed data rights |
| Repo rename from `data-openbb` to `data-public` | Migration risk becomes lower than naming confusion |

---

## Rules

1. Phase 6 must not quietly recreate a provider-backed architecture under new names.
2. A deprecated dependency found in a production path is a release blocker.
3. Rights metadata is not optional for evidence-bearing features.
4. A milestone that keeps the UI intact but leaves the old provider dependency hidden is not done.
5. Phase 6 is complete only when Thesis can run its core intelligence loop without paid market-data APIs.
