# M1 Smoke Plan (Phase 3)

**Milestone:** M1 - Intelligence Trust and Deep Dive Credibility  
**Owner:** Reasoning Engineer + Product API Engineer + Mobile Engineer + Product Lead  
**Status:** Passed

---

## Purpose

Prove that Deep Dive trust behavior is visible, accurate, and regression-safe.

---

## Locked Decision Targets

1. Report quality rubric and pass thresholds
2. Trust metadata contract/versioning strategy
3. Thesis-drift comparability rule
4. Trust presentation standard in mobile

---

## Preconditions

- Current Deep Dive generation works in staging/local validation
- Comparable stored reports exist for at least one ticker
- Evaluation pack dataset and rubric are committed
- Mobile build renders current report flows successfully

---

## Smoke Steps

1. Generate a fresh report for a full-data ticker.
2. Verify trust metadata in API response.
3. Verify trust metadata appears in the mobile report view.
4. Verify at least one displayed quote includes provenance.
5. Verify valuation assumptions are shown when valuation is present.
6. Generate or retrieve a comparable follow-up report and verify thesis-drift summary.
7. Run a partial-data ticker and verify honest degradation.
8. Run the evaluation pack and record results.
9. Re-run inherited Deep Dive regression smoke.

---

## Evidence Required For Closeout

- API payload sample showing trust metadata
- Mobile screenshots/video showing trust rendering
- Evaluation pack output artifact
- Regression smoke artifact paths

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-aapl-1.json` | Fresh AAPL report completed through local Product API + fixture Dexter queue path. |
| 2 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-api-smoke-summary.json` | `trust_metadata` present with freshness, evidence count, contradiction state, and valuation state. |
| 3 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/ph3_m1_pass.png` | Physical-device Android screenshot captured after successful Maestro M1 trust flow. |
| 4 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-aapl-1.json` | Quote provenance rendered from report payload and verified in the Android smoke flow. |
| 5 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-aapl-1.json` | Valuation assumptions/state present and surfaced without fabricating missing inputs. |
| 6 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-aapl-2-comparable.json` | Comparable follow-up report includes thesis-drift summary. |
| 7 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-limited.json` | Partial-data fixture degrades honestly (`valuation_state=degraded` / no-signal path). |
| 8 | PASS | `apps/dexter-worker/eval/artifacts/m1-quality-pack-result.json` | 20-ticker M1 evaluation pack completed successfully. |
| 9 | PASS | `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/maestro.log` | Inherited Deep Dive UI path still opens and renders correctly on physical device. |
