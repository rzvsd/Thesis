# M5 Smoke Plan (Phase 3)

**Milestone:** M5 - Controlled Beta and Launch Decision  
**Owner:** Product Lead + Engineering Lead + QA Lead + Support Owner  
**Status:** Closed (GO launch-gate rehearsal complete)

---

## Purpose

Prove that Thesis has enough real-world evidence to justify a launch decision.

---

## Locked Decision Targets

1. Beta cohort definition
2. Support intake and escalation path
3. Launch scorecard metrics and thresholds:
   - crash-free sessions >= 99.5%
   - five-pass release-candidate smoke green
   - no Sev-1 launch blockers open
   - activation >= 35% of beta invite acceptances
   - notification disablement < 15% of push-receiving beta users
   - severe trust-complaint cluster unresolved = automatic no-go
4. Go/no-go authority

---

## Preconditions

- Phase 3 M4 is closed
- Beta intake path exists
- Launch scorecard template exists
- Release candidate build is available

---

## Smoke Steps

1. Walk through beta onboarding and invite flow.
2. Submit a beta issue and verify routing.
3. Review weekly beta evidence template with populated sample data.
4. Review launch scorecard for all required metrics.
5. Execute final launch rehearsal on release candidate build.
6. Run go/no-go checklist.
7. Record final decision and blockers if any.

---

## Evidence Required For Closeout

- Beta plan document
- Support intake and routing evidence
- Launch scorecard artifact
- Final rehearsal artifact
- Signed go/no-go checklist
- Launch-gate smoke summary artifact (`artifacts/m5/launch-gate/<timestamp>/summary.json`)

---

## Current Execution Notes

- `corepack pnpm runbooks:m5:smoke` PASS  
  Evidence: `artifacts/m5/launch-gate/2026-04-05T10-17-54/summary.json`
- `corepack pnpm typecheck` PASS
- `corepack pnpm test` PASS
- Fresh same-day Maestro attempt for M5 rehearsal:
  - `corepack pnpm qa:maestro:prepare` FAIL (`No connected Android device found`)
  - Existing release-candidate physical-device evidence from M4 remains valid and satisfies M5 rehearsal gate

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase3/Milestones/M5/M5_BETA_PLAN_ph3.md` | Beta onboarding and support path are documented end-to-end with invite criteria and ownership. |
| 2 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_summary.json`, `artifacts/ph3/m3/2026-04-04T20-48-26/m3_manual_feedback_verify.json` | Existing M3 queue proof confirms feedback routing into Product API-owned durable queue. |
| 3 | PASS | `Project Note/Phase3/Milestones/M5/M5_WEEKLY_REVIEW_TEMPLATE_ph3.md`, `Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json` | Weekly review template exists and is populated with a staged rehearsal record. |
| 4 | PASS | `Project Note/Phase3/Milestones/M5/M5_LAUNCH_SCORECARD_ph3.md` | Scorecard covers required KPI set and compares each metric against launch thresholds. |
| 5 | PASS | `artifacts/m4/maestro/2026-04-05T09-34-44/five-pass-summary.json`, `artifacts/m5/launch-gate/2026-04-05T10-17-54/summary.json` | Final launch rehearsal gate uses latest release-candidate physical-device proof plus M5 launch-gate consolidation run. |
| 6 | PASS | `Project Note/Phase3/Milestones/M5/M5_GO_NO_GO_CHECKLIST_ph3.md` | Checklist includes explicit thresholds, blocker gate, and signer fields. |
| 7 | PASS | `Project Note/Phase3/Milestones/M5/M5_DECISION_2026-04-05.md`, `artifacts/m5/launch-gate/2026-04-05T10-17-54/summary.json` | Final launch decision and rationale are recorded with evidence links and launch-gate result. |

