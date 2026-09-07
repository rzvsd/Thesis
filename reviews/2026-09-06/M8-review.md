# Phase 7 M8 review

Date: 2026-09-07

## Scope and milestone context

Reviewed the M8 Morning Brief milestone brief, M8 evidence and rendered HTML, the current `PulseBriefFactPack`/mode/delta builder and HTML renderer, the Dexter Pulse copy path, and the focused render/brief tests. M10 later supersedes M8's six-field/180-word copy cap and expands the narrative surface, but it preserves the Morning Brief renderer, deterministic issue structure, source discipline, and no-internal-label/customer-copy rules. Findings below are therefore limited to behavior still present in the current M10-backed path.

## Findings

### P1 — Headline links accept arbitrary schemes and are emitted as executable `href` values

Locations: `apps/product-api/src/pulse-brief-plan.ts:337-355`, `apps/product-api/src/pulse-brief-render.ts:312-320`, and the upstream M3 validation/schema at `apps/product-api/src/market-pulse-validation.ts:480-482` / `packages/contracts/src/market-pulse-morning-edition.ts:103-106`.

The brief preserves `source_url` from the report and emits it as an anchor whenever it is truthy. Validation only requires a string, so a report with `source_url: "javascript:alert(1)"` is accepted and renders an executable link; HTML escaping does not make the URL scheme safe. A click can execute script in the application origin if a headline feed or upstream input is compromised. M8 requires headline/source/time/link metadata from approved feeds, but the current path enforces neither safe URL schemes nor approved source URLs. Reject non-HTTP(S) URLs or render untrusted values as plain text.

### P2 — The Sources and Method footer exposes internal omission families and repeats the optional-module apology

Locations: `apps/product-api/src/pulse-brief-plan.ts:671-684` and `apps/product-api/src/pulse-brief-render.ts:333-348`.

The fact-pack converts every `morning_edition.coverage_notes` entry into an omission with the fixed family `morning_edition`, and the renderer prints omission families verbatim. M3 assembly supplies absence notes for missing headlines and portfolio rows, so a normal report with those optional modules empty produces `Coverage note: morning_edition, morning_edition had limited approved coverage.` The checked-in M8 artifact contains this exact output at `Project Note/Phase7/Milestones/M8/evidence/generated-2026-05-01/pulse-2026-04-27-morning-brief.html:84`; the M10 artifact repeats it. The same renderer also prints raw families such as `currency` when tape omissions exist. This violates M8's explicit requirement that optional modules hide without apology and that raw/internal coverage labels do not appear in customer copy. Optional absence should be omitted from the footer, while real data omissions need a reader-facing mapping rather than internal family identifiers.

## Tests reviewed and run

Reviewed:

- `Project Note/Phase7/Milestones/M8/M8_MILESTONE_AGENTS_ph7.md`
- `Project Note/Phase7/Milestones/M8/evidence/generated-2026-05-01/proof.md`
- `Project Note/Phase7/Milestones/M8/evidence/generated-2026-05-01/pulse-2026-04-27-morning-brief.html`
- `Project Note/Phase7/Milestones/M10/M10_MILESTONE_AGENTS_ph7.md`
- `Project Note/Phase7/Milestones/M10/evidence/generated-2026-05-04/pulse-2026-05-04-morning-brief.html`
- `apps/product-api/src/pulse-brief-plan.ts`
- `apps/product-api/src/pulse-brief-render.ts`
- `apps/product-api/tests/market-pulse-render.test.ts`
- `apps/product-api/tests/market-pulse.test.ts`
- `apps/dexter-worker/src/pulse-brief.ts`

The M8 proof records 17/17 contracts, Product API typecheck, 107/107 Product API tests, and clean `git diff --check`. Existing render tests cover optional-section hiding but construct `morning_edition.coverage_notes: []`, so they do not exercise the assembly-to-footer path. No reviewed test covers hostile URL schemes or omission-family sanitization. I did not add tests or rerun the shared suite while the parent agent was running concurrent checks.

## Gaps and verdict

M8's six-field/180-word LLM acceptance is superseded by M10 and is not reported as a defect. The two customer-facing issues remain in the M10-backed renderer and are directly evidenced by checked-in artifacts. The evidence proves the happy-path render and empty-section hiding fixture, but not the real builder output when optional data is absent, safe external-link handling, or humanized omission families.

Verdict: **M8 should not receive an unconditional validation pass for the current Morning Brief path.** Safe-link handling is the primary security blocker; the footer leak is a separate product/contract violation.
