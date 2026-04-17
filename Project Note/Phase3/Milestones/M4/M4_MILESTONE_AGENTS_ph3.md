# AGENTS.md - Phase 3 M4 Mobile Reliability, Security and Operational Readiness
**Milestone:** Phase 3 M4 - Mobile Reliability, Security and Operational Readiness  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase2/ph2_AGENTS.md`, then `Project Note/Phase3/ph3_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase3/Milestones/M4/M4_MILESTONE_AGENTS_ph3.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 3 M4 - Mobile Reliability, Security and Operational Readiness |
| **Linear Project** | Phase 3 M4 - Mobile Reliability, Security and Operational Readiness |
| **Owner** | Mobile Engineer + Platform Engineer + Product API Engineer + QA Lead |
| **Status** | Closed |
| **Depends on** | Phase 3 M3 closed; release-candidate environment available |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Canonical release validation environment is fixed: release-candidate checks use the production-candidate host/certificate chain and release build values only | RESOLVED | Platform Engineer | Milestone start |
| G2 | Production-safe artifact storage direction is fixed: release path uses durable S3-compatible object storage; local filesystem artifact storage is forbidden outside local development | RESOLVED | Platform Engineer + Product API Engineer | Milestone start |
| G3 | Push-device model is fixed: one durable device record per installation, many devices per user, invalidated on token rotation or confirmed delivery failure | RESOLVED | Product API Engineer + Product Lead | Milestone start |
| G4 | Canonical proof runners are fixed: Maestro for physical-device smoke, `pnpm test:e2e` for CI e2e, and `pnpm test:load` for mandatory load scenarios | RESOLVED | QA Lead + Engineering Lead | Milestone start |
| G5 | Mandatory load scenarios and thresholds are fixed and may not be softened during implementation: Deep Dive enqueue p95 < 750ms at 25 VUs for 5 minutes, latest Pulse p95 < 300ms at 50 VUs for 5 minutes, notification fan-out 1,000 synthetic recipients in < 5 minutes with <1% failures | RESOLVED | QA Lead + Engineering Lead | Milestone start |

**Rule:** M4 cannot close with placeholder security, placeholder test coverage, or undefined pass/fail thresholds.

---

## 1. What This Milestone Is Building

M4 converts Thesis into a release candidate with real operational proof.

This milestone upgrades:

- smoke reliability
- e2e and load coverage
- release config safety
- certificate pinning proof
- production-safe storage
- push/device reliability
- alerting and runbooks

**Plain English summary for non-technical audit:**  
M4 is where "it usually works" stops being acceptable.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/MILESTONES.md` (M7-M9)
- `Project Note/Phase1/BLUEBOOK cld.md`

### Phase 2 docs

- `Project Note/Phase2/ph2_MILESTONES.md` (M9)
- `Project Note/Phase2/Milestones/M9/M9_MILESTONE_AGENTS_ph2.md`
- `Project Note/Phase2/Milestones/M9/M9_SMOKE_PLAN_ph2.md`

### Phase 3 docs

- `Project Note/Phase3/ph3_AGENTS.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/Milestones/M4/M4_SMOKE_PLAN_ph3.md`

### Current code surfaces

- `apps/mobile/android/`
- `apps/product-api/src/`
- `infra/`
- `tests/e2e/`
- `tests/load/`
- `qa/maestro/`

---

## 3. Scope - What Is In

- [x] Five-pass release-candidate physical-device smoke requirement
- [x] Implemented e2e suite
- [x] Implemented load suite
- [x] Removal of release-path dev placeholders and fallback secrets
- [x] Real certificate pinning proof (includes signed-release runtime enforcement evidence)
- [x] Production-safe artifact storage
- [x] Production-safe push/device handling
- [x] Core alerting and rollback/runbook proof

Full acceptance source: `Project Note/Phase3/ph3_MILESTONES.md -> M4`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Premium/paywall strategy changes | M3 |
| Beta support operations and launch review | M5 |
| New report trust logic | M1 |
| New Today personalization rules | M2 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Mobile | `apps/mobile/` | Release-candidate stability, real-device smoke reliability, security config |
| Product API | `apps/product-api/` | Config hygiene, storage posture, `user_devices`-style push/device model, alerting hooks |
| Infra | `infra/` | Storage, env handling, test and alert wiring |
| QA suites | `tests/e2e/`, `tests/load/`, `qa/maestro/` | Real executable proof instead of placeholders |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Push device or artifact metadata if needed | Additive only | `packages/contracts/src/` |

**Rule:** M4 should avoid unnecessary contract churn. The goal is launch-safe behavior, not payload expansion.

---

## 7. Phase 1 and 2 Wiring Obligations

| Existing System | Built In | Phase 3 M4 Change | Why Here |
|---|---|---|---|
| Android MVP and device smoke | Phase 1 M7 | Require repeated release-candidate proof | Single-pass smoke is not launch-grade |
| Production hardening | Phase 1 M9 and Phase 2 M9 | Close the unresolved practical gaps | This is where hardening becomes real |
| Artifact serving path | Phase 1/2 product API | Make storage multi-instance safe | Serious growth requires safer storage posture |
| Push notification path | Phase 1/2 | Remove single-device fragility or explicitly prove alternative | Re-engagement cannot be brittle |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 3 M4 - Mobile Reliability, Security and Operational Readiness

**Naming:**
```
[PH3-M4] What is being built
[PH3-M4][BUG] What is broken
[PH3-M4][SPIKE] What is being investigated
```

| Ticket | Acceptance Mapping |
|---|---|
| `[PH3-M4] Five-pass release candidate smoke` | Physical-device stability criteria |
| `[PH3-M4] Implemented e2e suite` | E2E criteria |
| `[PH3-M4] Implemented load suite` | Load criteria |
| `[PH3-M4] Release config and pinning closeout` | Config/security criteria |
| `[PH3-M4] Storage and push readiness` | Storage/push criteria |
| `[PH3-M4] Ops alerts and runbooks` | Alerting criteria |

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| RC smoke run completed | INFO | `{ service, build, result, timestamp }` |
| RC smoke flake detected | WARN | `{ service, flow, step, timestamp }` |
| Load threshold breach | ERROR | `{ service, scenario, metric, value, timestamp }` |
| Pinning failure | ERROR | `{ service, host, timestamp }` |
| Artifact storage fallback triggered | ERROR | `{ service, path, timestamp }` |
| Push delivery mismatch | ERROR | `{ service, user_id_hash, device_count, timestamp }` |

---

## 10. Testing Requirements

- [x] Five consecutive release-candidate smoke passes on physical hardware
- [x] Implemented e2e suite in CI
- [x] Implemented load suite with recorded thresholds
- [x] Security validation for real pinning config (build-time fail-closed proof + signed-release runtime enforcement proof complete)
- [x] Existing Phase 1/2 regressions re-run

Detailed execution lives in `M4_SMOKE_PLAN_ph3.md`.

---

## 11. Definition Of Done

- [x] All M4 acceptance criteria in `ph3_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] E2E and load suites are implemented, not placeholder docs
- [x] Existing mobile/backend regressions still pass
- [x] Linear tickets closed
- [x] QA Lead sign-off recorded
- [x] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date: 2026-04-05
Run by: Codex
Environment: Local repo stack (`STORE_BACKEND=memory`, `QUEUE_BACKEND=memory`) + stubbed data-openbb/news-ingest for deterministic load/e2e
Result: CLOSED (all technical gates passed, including signed-release runtime pinning proof)

Notes:
- `pnpm qa:maestro:prepare` PASS (physical device `R3CXA03J3LH`)
- Five consecutive `pnpm qa:maestro:smoke` PASS (`artifacts/m4/maestro/2026-04-05T09-34-44/five-pass-summary.json`)
- `pnpm test:e2e` PASS (`artifacts/m4/e2e/2026-04-04T22-10-40/summary.json`)
- `pnpm test:load` PASS (`artifacts/m4/load/2026-04-04T21-57-01/summary.json`)
- `pnpm runbooks:m4:smoke` PASS (`artifacts/m4/runbooks/2026-04-05T01-09-39/summary.json`)
- `pnpm typecheck` PASS
- `pnpm test` PASS (includes inherited regression chain + integration suites)
- `:app:compileReleaseKotlin` fails closed without required release properties and succeeds when real release properties are provided
- Signed-release runtime pinning proof captured on physical device (`R3CXA03J3LH`): `Project Note/Phase3/Milestones/M4/M4_SIGNED_RELEASE_RUNTIME_PINNING_PROOF_2026-04-16.md`
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| None open | No active deferrals remain in M4 after runtime pinning proof closure (2026-04-16) | N/A | N/A |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Release validation environment | Use production-candidate host, certificate chain, and release build values only for release validation | No |
| Artifact storage direction | Release path uses durable S3-compatible object storage; local filesystem artifacts are local-dev only | No |
| Push-device model | One durable device record per installation, many devices per user, invalidated on token rotation or confirmed delivery failure | No |
| Canonical proof runners | Maestro for physical-device smoke, `pnpm test:e2e` for CI e2e, and `pnpm test:load` for mandatory load scenarios | No |
| Mandatory load thresholds | Deep Dive enqueue p95 < 750ms at 25 VUs for 5 minutes; latest Pulse p95 < 300ms at 50 VUs for 5 minutes; notification fan-out of 1,000 synthetic recipients in < 5 minutes with <1% failures | No |
