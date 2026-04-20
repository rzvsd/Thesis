# M4 Smoke Plan - Research Authoring Engine

**Milestone:** M4 - Research Authoring Engine
**Status:** Passed (2026-04-20)

---

## Smoke Steps

1. Generate AAPL report.
2. Generate MSFT report.
3. Generate TSLA report.
4. Generate sparse fixture report.
5. Confirm each memo opens with a specific investment argument.
6. Confirm material claims map to computed facts, evidence, or omissions.
7. Confirm generic or template-cloned prose fails the authoring gate.

---

## Evidence Required

- Snapshot test summary
- Prompt version
- Generated memo samples
- Unsupported-claim check summary
- Generic-prose rejection proof

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | AAPL fixture report generated and validated through dexter tests |
| 2 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | MSFT fixture report generated and validated through dexter tests |
| 3 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | TSLA fixture report generated and validated through dexter tests |
| 4 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | Sparse `LIMITED` fixture verified omission-forward narrative |
| 5 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | Memos open with ticker-specific investment argument |
| 6 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | Material claims carry `metric`/`evidence`/`omission` support refs |
| 7 | Passed | `evidence/2026-04-20_m4-research-authoring-proof.md` | New M4 tests reject generic cross-ticker memo cloning behavior |
