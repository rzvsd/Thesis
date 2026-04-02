# M4 Smoke Plan (Phase 3)

**Milestone:** M4 - Mobile Reliability, Security and Operational Readiness  
**Owner:** Mobile Engineer + Platform Engineer + Product API Engineer + QA Lead  
**Status:** Planned

---

## Purpose

Prove that Thesis behaves like a real release candidate and that the practical launch blockers are closed.

---

## Locked Decision Targets

1. Final release config values
2. Artifact storage posture
3. Push-device model
4. Canonical runners: Maestro for physical-device smoke, `pnpm test:e2e` for CI e2e, `pnpm test:load` for load
5. Mandatory load scenarios and thresholds are fixed:
   - Deep Dive enqueue p95 < 750ms at 25 VUs for 5 minutes
   - Latest Pulse retrieval p95 < 300ms at 50 VUs for 5 minutes
   - Notification fan-out 1,000 synthetic recipients in < 5 minutes with <1% failures

---

## Preconditions

- Release-candidate build available
- Physical Android device available
- Staging or equivalent environment available for alerting and load proof

---

## Smoke Steps

1. Build and install release candidate on physical device.
2. Run canonical Maestro release-candidate flow covering Today -> Research -> Portfolio -> notification -> history.
3. Repeat full device smoke until five consecutive passes are recorded.
4. Run `pnpm test:e2e`.
5. Run `pnpm test:load` mandatory scenarios and capture thresholds.
6. Verify release config contains no placeholders or dev fallbacks.
7. Verify certificate pinning in release path.
8. Verify push-device behavior and artifact retrieval path.
9. Trigger failure paths and confirm alerts.
10. Re-run inherited Phase 1/2 regression smoke.

---

## Evidence Required For Closeout

- Five consecutive smoke artifacts
- E2E CI evidence
- Load test artifact
- Threshold summary with pass/fail decision for each mandatory load scenario
- Config/security proof
- Alert proof
- Regression smoke artifact paths

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | TBD |  |  |
| 2 | TBD |  |  |
| 3 | TBD |  |  |
| 4 | TBD |  |  |
| 5 | TBD |  |  |
| 6 | TBD |  |  |
| 7 | TBD |  |  |
| 8 | TBD |  |  |
| 9 | TBD |  |  |
| 10 | TBD |  |  |
