# Phase 7 M3 review

Date: 2026-09-07

## Scope and milestone context

Reviewed the Phase 7 M3 brief, M3 evidence and generated artifacts, the current `MarketPulseMorningEdition` contract, Product API assembly/validation, the current Morning Brief plan/renderer, and M3-focused tests. M3's original newspaper presentation is superseded: M8 explicitly makes the Morning Brief the customer-facing export default, and M10 later extends that path. I therefore treat M3's additive data assembly and provenance rules as current inputs, while judging customer-facing behavior against the later M8/M10 locks.

## Findings

### P1 — Headline source URLs are emitted as executable links without scheme validation

Locations: `packages/contracts/src/market-pulse-morning-edition.ts:103-106`, `apps/product-api/src/market-pulse-validation.ts:480-482`, and `apps/product-api/src/pulse-brief-render.ts:312-320`.

`source_url` is accepted as any string and the current validator only checks its type. The Morning Brief then places it directly in an anchor `href` after HTML escaping. A report containing `source_url: "javascript:alert(1)"` is therefore contract-valid and renders an executable `javascript:` link. A user click can run attacker-controlled script in the application origin if an upstream headline/input is compromised. The M3 rule that headlines expose approved headline metadata and links does not make arbitrary URL schemes safe. Validation/rendering must allow only approved web URL schemes (and ideally the approved-source policy) before producing an anchor.

### P2 — Missing optional modules leak an internal `morning_edition` coverage label into the current customer export

Locations: `apps/product-api/src/pulse/morning-edition.ts:160-165`, `apps/product-api/src/pulse-brief-plan.ts:671-684`, and `apps/product-api/src/pulse-brief-render.ts:333-348`.

When headline rows or portfolio rows are absent, M3 assembly adds explanatory strings to `morning_edition.coverage_notes`. The current M8/M10 Morning Brief fact-pack converts every such note into an omission with family `morning_edition`, and the renderer prints the family verbatim in the Sources and Method footer. A no-headline/no-portfolio report consequently contains `Coverage note: morning_edition, morning_edition had limited approved coverage.` This is directly present in the checked-in M8 artifact `Project Note/Phase7/Milestones/M8/evidence/generated-2026-05-01/pulse-2026-04-27-morning-brief.html:84`, and the M10 generated artifact repeats the same label. It violates the M8 lock that empty optional modules hide completely and customer copy must not expose internal labels. The omission should be suppressed for optional module absence or mapped to a reader-facing message without the internal family name.

### P2 — M3 data-bearing rows can pass validation with no usable evidence

Locations: `packages/contracts/src/market-pulse-morning-edition.ts:115-132`, `packages/contracts/src/market-pulse-morning-edition.ts:157-185`, and `apps/product-api/src/market-pulse-validation.ts:493-559`.

Every M3 item schema requires an `evidence` array but does not require a non-empty array. The Product API validator is weaker still: portfolio and market-board rows only check that `evidence` is an array, while catalyst and sector rows do not validate the evidence field at all; malformed evidence objects in those rows therefore pass the custom incoming-report validator. The M3 provider lock requires individual stock radar data to arrive with explicit `financial_data` evidence, yet the contract fixture and tests deliberately use empty evidence arrays (`packages/contracts/tests/market-pulse-report.test.ts:198-251`). A report can thus expose a portfolio price or catalyst/sector claim with no traceable evidence. Enforce non-empty evidence and validate each item consistently, or omit the row when evidence is unavailable.

## Tests reviewed and run

Reviewed:

- `Project Note/Phase7/Milestones/M3/M3_MILESTONE_AGENTS_ph7.md`
- `Project Note/Phase7/Milestones/M3/evidence/README.md`
- `Project Note/Phase7/Milestones/M3/evidence/2026-04-27_m3_morning_newspaper_verification.md`
- `packages/contracts/tests/market-pulse-report.test.ts`
- `apps/product-api/tests/market-pulse-render.test.ts`
- `apps/product-api/tests/market-pulse.test.ts`
- `Project Note/Phase7/Milestones/M8/evidence/generated-2026-05-01/pulse-2026-04-27-morning-brief.html`
- `Project Note/Phase7/Milestones/M10/evidence/generated-2026-05-04/pulse-2026-05-04-morning-brief.html`

Run during this review:

```text
corepack pnpm --filter @thesis/contracts test: 17/17 passed
corepack pnpm --filter @thesis/product-api test: could not complete because the shared working tree's dist files were locked by the concurrent build (TS5033/EPERM)
```

The M3 evidence note records 15 contract tests, a Product API build, one render test, one Product API test, and 24 data-openbb tests passing on 2026-04-27. Existing M3/M8 render tests cover optional-section hiding but construct `morning_edition.coverage_notes: []`, so they do not catch the assembly-to-footer leak. No reviewed test covers hostile URL schemes or evidence completeness.

## Gaps and verdict

The original M3 newspaper renderer is historical and should not be used as today's customer-export acceptance gate. The additive M3 data path is still consumed by the M8/M10 Morning Brief, so the URL and coverage-label defects remain current. The evidence contract gap also remains current because later milestones preserve the same M3 rows as input. No additional P1 was established.

Verdict: **M3 should not receive an unconditional validation pass in the current working tree.** Fix the unsafe headline-link handling first, then remove the internal optional-module omission label and enforce evidence validity before treating the M3 inputs as clean.
