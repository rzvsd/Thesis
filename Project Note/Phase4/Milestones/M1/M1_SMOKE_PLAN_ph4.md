# M1 Smoke Plan (Phase 4)

**Milestone:** M1 - Phase 4 Baseline, Docs, and Interface Lock  
**Owner:** Product Lead + Engineering Lead  
**Status:** Passed

---

## Purpose

Prove that Phase 4 exists as a governed workstream with a single canonical navigation and documentation source of truth.

---

## Locked Decision Targets

1. Root 5-tab IA
2. Screen ownership rules
3. Inbox source-of-truth doctrine
4. Phase 4 document set and milestone structure

---

## Preconditions

- Earlier-phase docs remain available in the repo
- Phase 4 folder exists
- ADR path exists under `Decisions/`

---

## Smoke Steps

1. Confirm Phase 4 root docs exist.
2. Confirm milestone-local docs exist for M1-M4.
3. Confirm ADR-007 exists and matches the 5-tab doctrine.
4. Confirm the Phase 4 screen mapping explicitly supersedes the old 3-tab assumption for future work.

---

## Evidence Required For Closeout

- Root doc file list
- ADR path
- Canonical screen-map path
- Summary artifact recording the doc checks

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase4/Milestones/M1/evidence/2026-04-08/m1-docs-summary.json` | Root doc set present: `ph4_AGENTS`, `ph4_BLUEBOOK`, `ph4_MILESTONES`, `ph4_PRD`, `ph4_ROADMAP`, `PH4_SCREEN_MAPPING`. |
| 2 | PASS | `Project Note/Phase4/Milestones/M1/evidence/2026-04-08/m1-docs-summary.json` | Milestone-local AGENTS and smoke-plan docs created for M1-M4. |
| 3 | PASS | `Decisions/ADR-007-mobile-ia-v2.md` | ADR locks the 5-tab doctrine and Inbox ownership guardrails. |
| 4 | PASS | `Project Note/Phase4/PH4_SCREEN_MAPPING.md` | Screen map explicitly supersedes Phase 2 M6 for future Phase 4 work. |
