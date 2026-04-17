# AGENTS.md - Phase 6 Final Data-Substrate Architecture Phase

**Scope:** Phase 6 only.  
**Inherits from:** Root `AGENTS.md` - read that first.
**Read next:** `ph6_BLUEBOOK.md`, `ph6_PRD.md`, `PH6_DECISION_LOCKS.md`, `ph6_MILESTONES.md`, `ph6_SECURITY.md`, and then the current `Milestones/M#/M#_MILESTONE_AGENTS_ph6.md`.

---

## 1. Who You Are In Phase 6

You are the implementation agent for the final data-substrate architecture phase of Thesis.

Your job is to execute the documented migration from provider-backed assumptions to an official-source-first, rights-aware, first-party-context architecture.

You do **not** invent new product doctrine in this phase.
You do **not** smuggle old provider shortcuts back into the system under different names.
You do **not** trade correctness for apparent surface richness.

If a decision is not already documented, you flag it.
If a source is not approved, you do not add it.
If rights are unclear, you do not store or display the text as if they are fine.

---

## 2. Phase 6 Mission In One Sentence

Remove paid and rights-ambiguous market-data dependencies from the core Thesis product without making the product dumb, brittle, or misleading.

---

## 3. Document Hierarchy For This Phase

| Document | Governs |
|---|---|
| Root `AGENTS.md` | Global operating rules |
| `ph6_BLUEBOOK.md` | Final data-substrate architecture doctrine, ownership, compatibility guardrails |
| `ph6_PRD.md` | Product behavior after the no-paid-data cutover |
| `PH6_DECISION_LOCKS.md` | Locked decisions, contract names, guard scope, and evidence standard |
| `ph6_MILESTONES.md` | Phase 6 acceptance criteria, smoke tests, rollback expectations |
| `ph6_SECURITY.md` | Source classes, fetch policy, rights policy, secret cleanup expectations |
| `ph6_DOC_OVERRIDES.md` | Repo-wide document reconciliation work |
| `Milestones/M#/M#_MILESTONE_AGENTS_ph6.md` | Current milestone execution rules |
| `ph6_ADR-*.md` | Explicit Phase 6 architectural decisions |

Before writing code in this phase:

- [ ] Read root `AGENTS.md`
- [ ] Read `ph6_BLUEBOOK.md`
- [ ] Read `ph6_PRD.md`
- [ ] Read `PH6_DECISION_LOCKS.md`
- [ ] Read `ph6_SECURITY.md`
- [ ] Read the relevant milestone in `ph6_MILESTONES.md`
- [ ] Read the current `Milestones/M#/M#_MILESTONE_AGENTS_ph6.md`
- [ ] Confirm which service boundary you are touching
- [ ] Confirm which deprecated dependency assumptions this work removes or preserves

---

## 4. Deprecated Dependencies In This Phase

The following are deprecated as **core production dependencies** in Phase 6:

- OpenBB library as production truth
- FMP / Financial Modeling Prep
- Polygon
- Alpha Vantage
- Twelve Data
- yfinance / Yahoo wrappers
- any personal-use-only market-data feed
- any broad transcript corpus with unclear commercial rights

### Hard rule

A Phase 6 implementation that still depends on one of the above in a production-critical path is incomplete.

---

## 5. Allowed Source Classes

| Source Class | Allowed Use | Notes |
|---|---|---|
| Official public issuer data | Hard truth | SEC / EDGAR / XBRL / exhibits |
| Official public macro data | Hard truth | BLS / BEA / Treasury / Fed / EIA / other explicitly approved sources |
| First-party corporate pages | Enrichment | Allowlisted only; event-driven fetch only |
| Bounded RSS / summary / link feeds | Enrichment | Rights-aware storage/display required |
| Browser automation | Conditional | Allowlisted, event-driven, bounded; never the backbone |
| Paid provider or personal-use feed | Not allowed in core path | Requires new ADR + review to re-enter |

---

## 6. Service-Boundary Rules In Phase 6

| Service | Allowed Focus | Forbidden Focus |
|---|---|---|
| `data-openbb` | Official/public-source adapters and normalization | OpenBB/provider wrapper truth |
| `news-ingest` | First-party context ingest, allowlisted feeds, call artifacts | Full-text publisher warehousing |
| `product-api` | Canonical events, evidence rights, API truth, persistence | Hidden provider fallback logic |
| `scheduler` | Official refresh cadence, trigger logic, event windows | Broad crawl jobs |
| `dexter-worker` | Synthesis, contradiction handling, scenario interpretation | Market-data shortcut truth or user-state persistence |
| `mobile` | Rights-safe display and transparency | Local reconstruction of unsupported quote features |

---

## 7. What You Must Never Do In Phase 6

1. Reintroduce OpenBB/FMP/yfinance-style truth through a helper, shim, or test-only path that later leaks into prod.
2. Store article or transcript full text when rights are unknown.
3. Add a source to the allowlist without documenting its source class and storage/display limits.
4. Turn a missing market-derived field into a guessed number.
5. Hide `estimated` vs `confirmed` event state from the user-facing contract.
6. Add a new package in `packages/` unless it is shared by at least two apps and approved by the milestone owner.
7. Treat browser automation as a blanket crawler.
8. Leave deprecated provider keys in the "required for smoke" path.

---

## 8. Linear Rules For This Phase

Each Phase 6 milestone is its own Linear Project.

Ticket naming:

```text
[PH6-M#] What is being built
[PH6-M#][BUG] What is broken
[PH6-M#][SPIKE] What is being investigated
```

Every ticket must include:

- service(s) touched
- contract(s) touched
- the `ph6_MILESTONES.md` acceptance criterion it satisfies
- whether it removes, preserves, or audits a deprecated dependency assumption

Every bug ticket must include:

- exact reproduction steps
- expected vs actual behavior
- which service emitted the wrong result
- whether rights, source policy, or deprecated dependency behavior is involved
- severity: `P1 Blocker` / `P2 High` / `P3 Normal`

---

## 9. Observability Expectations

Phase 6 keeps the same observability ownership model:

- Sentry for failures
- PostHog for product behavior
- LangSmith for model lineage

### Additional Phase 6 requirement

When a run degrades because of source coverage, rights posture, or missing official inputs, that reason must be visible in logs and surfaced through the appropriate service response, not buried in a generic error string.

---

## 10. When To Stop And Flag

Raise a flag before proceeding if:

- the task reintroduces a paid or personal-use data source
- the task stores text without a documented rights class
- the task adds a new first-party domain without allowlist review
- the task changes a contract used across more than one service
- the task changes alert semantics or earnings-state semantics
- the task needs a new browser automation path or scraping rule
- the task needs to keep an old provider path "temporarily" without a written exit plan
- the task conflicts with `PH6_DECISION_LOCKS.md`

When in doubt: flag it. Do not improvise the migration.

---

## 11. Phase 6 Closeout Standard

Phase 6 is not closed because the screens still render.

Phase 6 is closed only when:

- core smoke tests pass without deprecated provider dependencies
- official and first-party truth paths are stable enough to support the product loop
- rights-aware evidence behavior is implemented end-to-end
- Morning Exception Briefing, Deep Dive, War Room, and Scenario surfaces tell the truth about what is and is not covered
- old docs no longer quietly contradict the Phase 6 architecture
