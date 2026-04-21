# M3 AGENTS - Value Discipline Scorecard

**Milestone:** Deep Dive Revamp M3 - Value Discipline Scorecard
**Status:** Closed (2026-04-20)
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Dexter Engineer + Product Lead |
| Depends on | M2 closed |
| Services | `apps/dexter-worker`, `packages/contracts`, mobile/PDF consumers later |
| Contracts | Value discipline scorecard |

---

## Scope

- [x] Compute Piotroski-style signal availability
- [x] Compute partial/full value score
- [x] Add context interpretation
- [x] Explain cheap-quality tension and value-trap risk
- [x] Test value, quality, distressed, and sparse fixtures
- [x] Include "what this score does not prove" language

## Out Of Scope

- Brokerage weighting
- Buy/sell recommendation
- Peer provider expansion unless already available

## Required Tests

- [x] Score computation tests
- [x] Missing signal tests
- [x] Company-context tests
- [x] Report artifact validation tests
- [x] M3 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [x] Score is never overstated
- [x] Missing inputs are listed
- [x] Interpretation differs by company context
- [x] Scorecard satisfies `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Smoke plan passes

## Decisions Applied

- Use deterministic signal status (`met`/`not_met`/`unavailable`) instead of inferred values.
- Context interpretation is explicit (`quality_mega_cap`, `value_cyclical`, `distressed`, `financial`, `sparse_data`, `general`) and emitted with each scorecard.
- Value-trap warning is emitted only when a cheapness profile coexists with weak quality/freshness evidence.

## Evidence

- `Milestones/M3/evidence/2026-04-20_m3-value-discipline-proof.md`
