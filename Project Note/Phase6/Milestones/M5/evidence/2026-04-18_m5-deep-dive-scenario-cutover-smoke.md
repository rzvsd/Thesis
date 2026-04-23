# Phase 6 M5 Smoke Evidence

**Date:** 2026-04-18  
**Run by:** Codex  
**Milestone:** Phase 6 M5 - Deep Dive / Scenario Final Cutover & Hardening  
**Environment:** Local Windows workspace, in-memory Product API store, internal OpenBB mock, full monorepo quality gate run

---

## Commands

```text
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm phase6:m0:guard
corepack pnpm phase6:m5:dependency-scan
git -c core.safecrlf=false diff -- apps/dexter-worker/src/dcf/index.ts apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt apps/mobile/android/app/src/main/java/com/thesis/mobile/model/ReportViewMapper.kt apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt apps/product-api/src/server.ts apps/product-api/tests/m7-report-features.test.ts apps/product-api/tests/ph6-m5-cutover.test.ts scripts/phase6/m5-core-dependency-scan.mjs package.json packages/contracts/src/scenario-request.ts | git apply --check --reverse --ignore-whitespace
```

---

## Result

**Overall:** PASS

- Repo lint passed across all workspaces.
- Repo typecheck passed across all workspaces.
- Repo tests passed, including:
  - `apps/product-api/tests/ph6-m5-cutover.test.ts`
  - `apps/product-api/tests/m7-report-features.test.ts`
  - root integration chain (`test_m2_data_plane_endpoints.py`, `test_m3_dexter_worker.py`, `test_m4_product_api.py`, `test_m6_market_pulse.py`)
- Phase 6 M0 guard passed:
  - `Phase 6 M0 guard: pass (60 known baseline finding(s), 0 new protected-path finding(s)).`
- Phase 6 M5 dependency scan passed:
  - `Phase 6 M5 core dependency scan: pass (0 deprecated provider findings).`
- Reverse-apply rollback rehearsal check passed for all M5 changed files.

---

## Milestone Smoke Mapping

1. Run Deep Dives for 3 supported names  
   Result: PASS. `ph6-m5-cutover.test.ts` executes queue -> claim -> complete lifecycle for `AAPL`, `MSFT`, and `TSLA`.

2. Confirm reports validate without deprecated providers  
   Result: PASS. All three reports are fetched successfully via `/reports/:id` and remain readable on the current API surface.

3. Run a scenario with one omitted market-derived dimension  
   Result: PASS. Scenario execution succeeds on `MSFT` with deterministic overrides and no beta dependency.

4. Confirm omission is explicit  
   Result: PASS. Response includes:
   - `deterministic_model: "phase6_deterministic_v1"`
   - omission codes: `market_beta_omitted`, `legacy_beta_ignored`, `spot_reference_unavailable`
   - omitted implied upside when spot reference is unavailable.

5. Run final dependency scan and confirm clean pass  
   Result: PASS. `phase6:m5:dependency-scan` returns zero findings.

---

## Key Implementation Proof

- Scenario contract extended with omission truth and deterministic model marker:
  - `packages/contracts/src/scenario-request.ts`
- Deterministic DCF no longer depends on beta input:
  - `apps/dexter-worker/src/dcf/index.ts`
- Product API scenario output now:
  - strips legacy beta from assumptions,
  - returns top-level and per-snapshot omissions,
  - returns `deterministic_model`.
  - `apps/product-api/src/server.ts`
- Mobile report mapping and Scenario UI now surface model + omission text:
  - `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt`
  - `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/ReportViewMapper.kt`
  - `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt`
- New M5 core dependency scan command:
  - `scripts/phase6/m5-core-dependency-scan.mjs`
  - `package.json`

---

## Rollback Rehearsal Note

Rollback rehearsal was executed as a reverse patch-apply check against all changed M5 files. The check passed, confirming the M5 cutover diff can be cleanly reverted if required.

Rollback steps:

1. Revert M5 changed files for contracts, Product API scenario shaping, mobile omission rendering, and deterministic DCF model.
2. Remove `phase6:m5:dependency-scan` script and scanner file if cutover is rolled back.
3. Re-run lint/typecheck/test and M0 guard before redeploy.

Do not restore deprecated-provider assumptions as a rollback shortcut.

---

## Sign-Off State

- Owner: Approved on 2026-04-23
- Engineering Lead: Accepted by owner delegation on 2026-04-23
- Hosted GitHub CI: Deferred to the next push; not treated as an open Phase 6 blocker in the local closeout record
