# M4 AGENTS - Research Authoring Engine

**Milestone:** Deep Dive Revamp M4 - Research Authoring Engine
**Status:** Pending
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

- [ ] Add institutional memo authoring prompt
- [ ] Constrain narrative to computed facts, evidence, and omissions
- [ ] Write thesis, what changed, business quality, valuation, risks
- [ ] Add snapshot tests for multiple company archetypes
- [ ] Record LangSmith status or local prompt proof
- [ ] Reject generic prose and unsupported material claims

## Out Of Scope

- New data providers
- PDF rendering
- Mobile reader redesign
- Model fine-tuning

## Required Tests

- Dexter generation tests
- Snapshot tests for AAPL, MSFT, TSLA, sparse fixture
- Claim-support tests where practical
- Degraded-data narrative test
- M4 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [ ] Memo is company-specific
- [ ] Unsupported claims are absent
- [ ] Sparse data remains useful and honest
- [ ] Writing follows `DEEPDIVE_REPORT_TEMPLATE.md`
- [ ] Smoke plan passes
