# M5 Smoke Plan (Phase 5)

**Milestone:** M5 - Cross-Name Intelligence  
**Owner:** Dexter Engineer + Scheduler Engineer + Product API Engineer  
**Status:** Planned

---

## Purpose

Prove that relationship extraction and propagation deliver explainable second-order exceptions without flooding noise.

---

## Locked Decision Targets

1. Relationship extraction quality and provenance
2. Confidence-threshold suppression behavior at default `0.70`
3. Propagation alert explainability
4. Non-related name protection

---

## Preconditions

- M1 rule substrate is stable
- Report ingestion and extraction path is operational
- Scheduler propagation lane is test-runnable

---

## Smoke Steps

1. Seed relationship graph from deterministic report fixtures.
2. Trigger source event and run propagation evaluation.
3. Confirm only qualified related names receive propagated exceptions.
4. Confirm alert text includes source, relationship type, and reasoning.
5. Validate default `0.70` behavior, then apply stricter threshold (for example `0.85`) and confirm additional suppression.
6. Confirm unrelated names receive no propagation alert.

---

## Evidence Required For Closeout

- Extraction fixture proof
- Relationship persistence proof
- Propagation evaluator proof
- Confidence-threshold test proof for default and stricter override
- Alert-ledger propagation proof

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PENDING | TBD | - |
| 2 | PENDING | TBD | - |
| 3 | PENDING | TBD | - |
| 4 | PENDING | TBD | - |
| 5 | PENDING | TBD | - |
| 6 | PENDING | TBD | - |
