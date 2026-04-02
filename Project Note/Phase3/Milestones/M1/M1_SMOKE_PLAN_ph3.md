# M1 Smoke Plan (Phase 3)

**Milestone:** M1 - Intelligence Trust and Deep Dive Credibility  
**Owner:** Reasoning Engineer + Product API Engineer + Mobile Engineer + Product Lead  
**Status:** Planned

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
| 1 | TBD |  |  |
| 2 | TBD |  |  |
| 3 | TBD |  |  |
| 4 | TBD |  |  |
| 5 | TBD |  |  |
| 6 | TBD |  |  |
| 7 | TBD |  |  |
| 8 | TBD |  |  |
| 9 | TBD |  |  |
