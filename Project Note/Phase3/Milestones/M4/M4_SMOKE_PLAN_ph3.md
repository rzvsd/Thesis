# M4 Smoke Plan (Phase 3)

**Milestone:** M4 - Mobile Reliability, Security and Operational Readiness  
**Owner:** Mobile Engineer + Platform Engineer + Product API Engineer + QA Lead  
**Status:** Closed

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
| 1 | PASS | `pnpm qa:maestro:prepare` console output; `qa/maestro/.maestro.env` | Prepare now succeeds on connected physical device `R3CXA03J3LH` and writes runtime env for canonical flow. |
| 2 | PASS | `qa/maestro/output/2026-04-05T06-26-25-420Z/summary.json` | Canonical Phase 3 M4 flow (`ph3_m4_smoke.yaml`) passes on physical device. |
| 3 | PASS | `artifacts/m4/maestro/2026-04-05T09-34-44/five-pass-summary.json` | Five consecutive physical-device Maestro smoke runs pass (same flow + same device). |
| 4 | PASS | `artifacts/m4/e2e/2026-04-04T22-10-40/summary.json` | `pnpm test:e2e` passes core auth/deep-dive/pulse/notification flow. |
| 5 | PASS | `artifacts/m4/load/2026-04-04T21-57-01/summary.json` | `pnpm test:load` passes all mandatory scenarios and thresholds. |
| 6 | PASS | `apps/mobile/android/app/build.gradle.kts`, `apps/mobile/android/app/src/release/res/xml/network_security_config.xml` | Release build now fails closed unless real release URL/host/pins are provided via release properties. |
| 7 | PASS | `apps/mobile/android/app/src/release/res/xml/network_security_config.xml`, `apps/mobile/android/app/build.gradle.kts`, `Project Note/Phase3/Milestones/M4/M4_SIGNED_RELEASE_RUNTIME_PINNING_PROOF_2026-04-16.md` | Signed release (`5.0.10-pinning-proof`) installed on physical device; runtime enforces `network_security_config` and fails closed on invalid pin digest (`digest length ... expected length for SHA-256 of 32`). |
| 8 | PASS | `apps/product-api/tests/m4-push-devices.test.ts` | Multi-device push behavior validated (install-scoped registration + targeted unregister). |
| 9 | PASS | `artifacts/m4/runbooks/2026-04-05T01-09-39/summary.json` | API/queue/notification/stale-job alert hooks and runbook readiness smoke pass. |
| 10 | PASS | Root `pnpm test` run output | Full inherited regression chain and integration suites pass after M4 changes. |
