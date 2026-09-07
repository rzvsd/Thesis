# Phase 7 M7 Review

## Scope and supersession

Reviewed the M7 milestone brief, M7 verification note and generated artifacts, `pulse-issue-plan.ts`, the current Pulse renderer/brief planner, focused Product API tests, and later M8/M10 locks and evidence.

M8 explicitly replaces the M7 newspaper export with the Morning Brief, and M10 later expands that Morning Brief. Therefore the M7 section order and newspaper artifact are historical acceptance evidence only. Current customer output is owned by `apps/product-api/src/pulse-brief-render.ts:12-39`, which builds the brief plan and renders quiet/full Morning Brief layouts; `buildPulseIssuePlan` in `apps/product-api/src/pulse-issue-plan.ts:53-101` has no current caller in `apps/product-api/src` or its tests.

## Findings

No high-confidence current P1, P2, or P3 defect was established for M7 after applying the documented M8/M10 supersession. Reporting the absence of the old newspaper hierarchy as a defect would contradict the later product locks.

The M7-specific implementation is effectively retired, while the data it introduced remains consumed by the current brief path. The current renderer still conditionally hides names/calendar/headlines (`pulse-brief-render.ts:254-299`), keeps sources/method in one footer (`:333-350`), and renders adaptive quiet/full modes (`:30-35`, `:42-74`), matching the superseding M8/M10 behavior.

## Validation reviewed

- M7 evidence records Product API build pass, focused renderer/editorial tests 4/4, Pulse dispatch regression 1/1, contracts 17/17, data-openbb 34/34, and Product API full package tests 98/98.
- M7 artifact proof records compact HTML/PDF/PNG output and a false result for each obsolete visible-section scan.
- M10 focused evidence records Morning Brief render tests for normal/event output, optional-module hiding, and quiet-day collapse; Product API focused tests pass 4/4. M10 full Product API evidence records 98/98, with workspace typecheck and lint passing.

## Gaps

- There is no reason to add a new M7 newspaper regression test: that surface is intentionally retired by M8.
- Current validation should remain attached to the M8/M10 Morning Brief path and its deterministic fact-pack inputs; the M7 generated artifact should not be used as current export proof.

## Verdict

**M7 is historically validated and current customer-facing acceptance is superseded by M8/M10.** No current M7 defect is supported by the reviewed code and evidence. Use the M10 Morning Brief artifacts and tests as the active Pulse export gate.
