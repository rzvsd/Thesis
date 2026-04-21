# M1 Smoke Plan - Structured Report Contract

**Milestone:** M1 - Structured Report Contract
**Status:** Passed (2026-04-20)

---

## Smoke Steps

1. Build `packages/contracts`.
2. Run Product API report-validation tests.
3. Run Dexter schema-validation tests.
4. Deserialize a legacy report without new fields.
5. Deserialize a full v2 report fixture.
6. Deserialize a sparse v2 report fixture.
7. Confirm fixture fields can render every required template section or explicit omission.

---

## Evidence Required

- Test command output summary
- Fixture names
- Contract file list
- Validation pass/fail record
- Template coverage checklist from `DEEPDIVE_REPORT_TEMPLATE.md`

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | `@thesis/contracts` build/test passed |
| 2 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | Product API validation tests passed |
| 3 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | Dexter schema-validation tests passed |
| 4 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | Legacy fixture deserialize/validation passed |
| 5 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | Full v2 fixture validation passed |
| 6 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | Sparse v2 fixture validation passed |
| 7 | PASS | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` | Template section coverage via section or omission proved |
