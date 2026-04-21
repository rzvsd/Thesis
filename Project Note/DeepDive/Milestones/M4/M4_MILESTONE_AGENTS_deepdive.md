# M4 AGENTS - Research Authoring Engine

**Milestone:** Deep Dive Revamp M4 - Research Authoring Engine
**Status:** Closed (2026-04-20)
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Dexter Engineer + Prompt Owner |
| Depends on | M1-M3 closed |
| Services | `apps/dexter-worker`, LangSmith prompt path when available |
| Contracts | Memo/narrative fields from structured report artifact |

---

## Scope

- [x] Add institutional memo authoring prompt
- [x] Constrain narrative to computed facts, evidence, and omissions
- [x] Write thesis, what changed, business quality, valuation, risks
- [x] Add snapshot tests for multiple company archetypes
- [x] Record LangSmith status or local prompt proof
- [x] Reject generic prose and unsupported material claims

## Out Of Scope

- New data providers
- PDF rendering
- Mobile reader redesign
- Model fine-tuning

## Required Tests

- [x] Dexter generation tests
- [x] Snapshot tests for AAPL, MSFT, TSLA, sparse fixture
- [x] Claim-support tests where practical
- [x] Degraded-data narrative test
- [x] M4 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [x] Memo is company-specific
- [x] Unsupported claims are absent
- [x] Sparse data remains useful and honest
- [x] Writing follows `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Smoke plan passes

## Decisions Applied

- Implement additive `investment_memo` report artifact fields rather than replacing existing sections.
- Lock material-claim support to typed refs: `metric`, `evidence`, or `omission`.
- Keep deterministic-first policy: memo prose is authored from computed facts and validated support refs.
- Use local synthesizer prompt proof (`m4-synthesizer-fixture-v1`) while LangSmith remote registration remains credential-dependent.

## Evidence

- `Milestones/M4/evidence/2026-04-20_m4-research-authoring-proof.md`
