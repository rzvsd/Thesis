# M5 Launch Scorecard (Phase 3)

**Milestone:** M5 - Controlled Beta and Launch Decision  
**Decision Date:** 2026-04-05  
**Data mode:** Staged rehearsal (with carried M3/M4 production-path evidence)

---

## Launch Gate Summary

| Gate | Threshold | Current | Status |
|---|---|---|---|
| Crash-free sessions | >= 99.5% | 99.82% | PASS |
| Five-pass release-candidate smoke | Must be green | Green (`pass_count=5`) | PASS |
| Unresolved Sev-1 launch blockers | 0 | 0 | PASS |
| Activation (% invite acceptances activated) | >= 35% | 45.24% (19/42) | PASS |
| Notification disablement (% push users) | < 15% | 6.67% (8/120) | PASS |
| Severe trust-complaint clusters unresolved | 0 | 0 | PASS |

---

## Required KPI Coverage (M5 Acceptance)

| KPI Family | Metric | Current | Source |
|---|---|---|---|
| Activation | Activated users / invite acceptances | 45.24% | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Repeat-use proxy | 7-day repeat-use proxy | 73.68% | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Crash-free | Crash-free sessions | 99.82% | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Notification quality | Notification disablement | 6.67% | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Trust complaints | Severe unresolved clusters | 0 | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Conversion | Conversion proxy | 22.40% | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Churn | Churn signal proxy | 4.10% | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |
| Blocker status | Open Sev-1 launch blockers | 0 | `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` |

---

## Supporting Reliability And Intake Evidence

- M4 release-candidate reliability:
  - `artifacts/m4/maestro/2026-04-05T09-34-44/five-pass-summary.json`
  - `artifacts/m4/e2e/2026-04-04T22-10-40/summary.json`
  - `artifacts/m4/load/2026-04-04T21-57-01/summary.json`
  - `artifacts/m4/runbooks/2026-04-05T01-09-39/summary.json`
- M3 support-intake durability:
  - `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_summary.json`
  - `artifacts/ph3/m3/2026-04-04T20-48-26/m3_manual_feedback_verify.json`

---

## Scorecard Outcome

All mandatory launch-gate thresholds are green in rehearsal data.

Decision recommendation: **GO** for the controlled beta launch gate, with explicit follow-up on remaining operational admin constraints (Linear issue-cap).

