# Phase 6 M4 Smoke Evidence

**Date:** 2026-04-18  
**Run by:** Codex  
**Milestone:** Phase 6 M4 - Earnings State & War Room Substrate  
**Environment:** Local Windows workspace, in-memory Product API store, internal OpenBB calendar mock, full monorepo quality gate run

---

## Commands

```text
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm run phase6:m0:guard
```

---

## Result

**Overall:** PASS

- Repo lint passed across all workspaces.
- Repo typecheck passed across all workspaces.
- Repo tests passed, including:
  - `apps/product-api/tests/ph6-m4-earnings-state.test.ts`
  - `apps/product-api/tests/earnings-state-policy.test.ts`
  - root integration tests (`test_m2_data_plane_endpoints.py`, `test_m3_dexter_worker.py`, `test_m4_product_api.py`, `test_m6_market_pulse.py`)
- Phase 6 dependency guard passed:
  - `Phase 6 M0 guard: pass (60 known baseline finding(s), 0 new protected-path finding(s)).`

---

## Milestone Smoke Mapping

1. Seed one estimated event and one confirmed event in test mode  
   Result: PASS. Calendar sync fixture ingested both states for watched ticker.

2. Confirm API distinguishes state cleanly  
   Result: PASS. `/v1/research/earnings/state` returns typed `timing_state`, `source_state`, and explicit conflict metadata.

3. Trigger release artifact event and confirm promotion to actual  
   Result: PASS. Ingesting `earnings_release` artifact moved state to `actual`.

4. Open War Room payload and confirm transcript optional  
   Result: PASS. `/v1/research/war-room/:id` returns `evidence_pack` with transcript object marked unavailable when absent.

5. Confirm alert reason paths are present  
   Result: PASS. `earnings_war_room` alert context includes `reason_code`, `reason_text`, `earnings_timing_state`, `earnings_source_state`, `earnings_evidence_state`, and conflict flag.

---

## Key Implementation Proof

- Added new typed contract:
  - `packages/contracts/src/earnings-state.ts`
- Added durable calendar event state columns via migration:
  - `timing_state`, `source_state`, `source_ref`, `reason_text`
- Added authenticated state endpoint:
  - `GET /v1/research/earnings/state`
- Added policy enforcement:
  - `confirmed` timing requires `official` or `first_party`; otherwise the state is downgraded to `estimated` with explicit reason text.
- Added War Room payload context:
  - `earnings_state`, `evidence_pack`, and `reason_path`.

---

## Rollback Note

1. Revert the `earnings-state` contract export and Product API integration.
2. Revert migration `ph6m4_030_earnings_state` (down migration available).
3. Revert War Room payload additions (`earnings_state`, `evidence_pack`, `reason_path`).
4. Re-run lint/typecheck/test and guard before redeploy.

Do not reintroduce provider-backed implicit timing assumptions as rollback shortcuts.

---

## Sign-Off State

- Owner: Pending review
- Engineering Lead: Pending review
- GitHub CI: Pending push/hosted run
