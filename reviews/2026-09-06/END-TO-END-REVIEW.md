# Phase 7 end-to-end review

Date: 2026-09-07
Scope: current working tree, Phase 7 M1-M13, including uncommitted M13 work

## Executive verdict

Phase 7 is not ready for an unconditional production sign-off.

The repository has substantial implemented and evidenced functionality, and M7 is correctly treated as superseded rather than broken. However, several current production paths do not enforce the product's own data, provenance, and output-safety rules. The most consequential problems are:

1. M4 macro/geopolitical inputs never reach the normal Pulse dispatch path.
2. M11 filing-text extraction exists but is not integrated, so every Filing Read reports that filing text is missing.
3. LLM copy can publish unsupported numbers, sources, events, dates, and causal claims.
4. Headline URLs accept arbitrary schemes and are rendered as clickable links.
5. The default Pulse price provider is Yahoo Finance despite the current source-policy lock.
6. A fixture recent-context provider can contaminate live Deep Dive prompts when the optional M9 tool is enabled.
7. Four non-consecutive quarterly rows are labeled and used as true TTM.

The current implementation should be considered suitable for deterministic fixture demonstrations and targeted validation, but not yet for a production release claiming all M1-M13 guarantees.

## System-level assessment

| Layer | Current state | Main risk |
|---|---|---|
| Market/data ingestion | Partial | Invalid replay dates are silently changed; default Pulse name pricing uses an unapproved provider |
| Pulse assembly | Partial | M4 production headline/macro input is disconnected; replay comparisons can read future reports |
| Dexter analysis | Partial | Live optional tooling can inject fixtures; LLM claims are not grounded against the deterministic fact pack |
| Deep Dive filing intelligence | Blocked | Filing-text extractor is not connected to the report pipeline |
| Financial indicators | Conditional | TTM continuity and meaningful positive denominators are not enforced; live price provenance is incomplete |
| HTML/PDF rendering | Conditional | Unsafe headline schemes become links; internal omission labels reach customer output |
| Contracts/validation | Partial | Several trust-boundary fields are type-checked but not semantically validated |
| Evidence/tests | Mixed | Historical milestone evidence is strong for happy paths, but live and adversarial boundaries remain unproved |

## Consolidated findings

### P1 — M4 shock behavior is unreachable through normal production dispatch

`apps/product-api/src/server.ts:5358-5391` calls the Pulse builder without the M4 headline or macro-news inputs. `apps/product-api/src/pulse/report-builder.ts:929-935` consequently receives no candidates and builds the calm fallback.

The direct-builder artifacts prove rendering, but the real dispatch job cannot promote a macro/geopolitical shock. This is a release blocker because it removes the milestone's central behavior rather than degrading one edge case.

Affected milestones: M4, M8, M10.

### P1 — M11 filing-text extraction is not connected to Deep Dive

The extractor exists in `apps/data-openbb/src/filing_text.py:53-86`, but no active data-service or worker path invokes it. `apps/dexter-worker/src/filing-intelligence.ts:568-574` adds `missing_filing_text` unconditionally, and `:651-676` can use transcript commentary only.

As a result, Filing Read cannot compare filing language for MD&A, risks, liquidity, or segments. M12/M13 add financial lenses but do not repair the M11 input path.

Affected milestones: M11-M13.

### P1 — LLM output is structurally validated but not fact-grounded

`apps/dexter-worker/src/pulse-brief.ts:474-588` checks length, trading-language patterns, the word `because`, and uppercase ticker/acronym membership. It does not verify returned numbers, dates, events, source names, market values, or non-literal causal language against the deterministic fact pack. Valid-looking invented claims can therefore replace deterministic copy at `:636-641`.

The prompts ask the model to preserve facts, but prompts are not an enforcement boundary. This violates the M6/M10 lock that the LLM cannot mutate facts, provenance, events, or values.

Affected milestones: M6, M10.

### P1 — Headline URLs allow executable schemes

`packages/contracts/src/market-pulse-morning-edition.ts:103-106` and `apps/product-api/src/market-pulse-validation.ts:480-482` accept any string as `source_url`. `apps/product-api/src/pulse-brief-render.ts:312-320` places that value directly in `href` after HTML escaping. HTML escaping does not neutralize a `javascript:` scheme.

Only approved `http:` and `https:` URLs should become links; rejected values can be rendered as plain source text or omitted.

Affected milestones: M3, M8, M10.

### P1 — Production Pulse prices default to Yahoo Finance

`apps/dexter-worker/src/config.ts:232-235` defaults to `https://query1.finance.yahoo.com`, and `apps/dexter-worker/src/pulse-brief.ts:125-142` calls its chart endpoint for portfolio rows. This conflicts with the current Phase 7 source-policy lock. Existing evidence uses fixtures or a local mock and does not prove a compliant production price path.

Affected milestones: M10.

### P1 — Optional M9 tooling can inject fixture context into live runs

`apps/dexter-worker/src/pipeline.ts:3083-3094` invokes the recent-context tool without a provider. `apps/dexter-worker/src/tools/recent-context/recent-context-tool.ts:53-61` then creates `FixtureRecentContextProvider`, even when fixture mode is false.

With the tool flags enabled in live mode, hard-coded recent context can influence a customer Deep Dive. Until a live provider exists, live mode should return an omission or reject this configuration.

Affected milestones: M9 and all later Deep Dive output.

### P1/P2 — TTM calculation does not validate quarter continuity

`apps/dexter-worker/src/financial-indicators.ts:117-126` sorts rows, while `:677-685` takes the latest four and sums them. It does not reject duplicate periods or a missing middle quarter. Four rows spanning more than twelve months are therefore labeled true TTM and can alter margins, cash conversion, valuation, benchmarks, and company classification.

This is a production data-integrity blocker for M12 and the single confirmed defect in the active M13 change. The repair belongs in the shared TTM builder: accept exactly four unique consecutive fiscal quarters, otherwise use the existing annual fallback and omission.

Affected milestones: M12, M13.

### P2 — Historical replays can consume future artifacts

Two independent paths select the latest record without bounding it to the requested date:

- `apps/product-api/src/server.ts:5344-5349` selects the latest Pulse for M2 daily comparison.
- `apps/product-api/src/research-state.ts:192-197, 308-310, 324` selects the latest readable Deep Dive during M5 refresh.

Historical rebuilds can therefore generate daily deltas or research state using information that did not exist at the replay date. Both should select the latest artifact at or before the requested cycle/as-of boundary.

Affected milestones: M2, M5 and replay-dependent later output.

### P2 — Trust-boundary validation is incomplete

Three concrete cases remain:

- M1 malformed `as_of` values are normalized to today by `apps/data-openbb/src/service.py:3039-3041` and `:547-548`, silently changing the requested replay.
- M3 data-bearing rows can carry empty or malformed evidence because the schemas and validator do not consistently require and validate usable evidence (`packages/contracts/src/market-pulse-morning-edition.ts:115-185`, `apps/product-api/src/market-pulse-validation.ts:493-559`).
- M5 holding fields are trimmed before runtime type checks (`apps/product-api/src/routes/research-state-routes.ts:65-67, 149, 186-187`), so malformed JSON can throw instead of returning validation errors.

These are small boundary fixes with outsized value because they prevent silent date changes, unsupported customer claims, and avoidable 500 responses.

### P2 — Current customer output exposes internal omission labels

`apps/product-api/src/pulse-brief-plan.ts:671-684` converts optional M3 coverage notes into `morning_edition` omissions. `apps/product-api/src/pulse-brief-render.ts:333-348` prints omission families verbatim. Checked-in M8/M10 artifacts show the resulting `morning_edition` apology even though absent optional modules are supposed to hide cleanly.

Real omissions need reader-facing names; absent optional modules should not create footer copy.

Affected milestones: M3, M8, M10.

### P2 — Provider and safety policy helpers are not enforced at the final boundary

The default provider order in `apps/dexter-worker/src/config.ts:136-143` permits Anthropic/OpenAI after OpenRouter fails, and `apps/dexter-worker/src/live-dexter.ts:114-151` tries those fallbacks for Pulse copy. This conflicts with the M6/M10 OpenRouter-only decision unless the decision lock is explicitly amended.

Separately, `assertCustomerSafeText` in `apps/dexter-worker/src/tools/tool-policy.ts:48-82` has no caller. The final pipeline validates schema shape at `apps/dexter-worker/src/pipeline.ts:3593-3606` but does not enforce the customer-text policy.

Affected milestones: M6, M9, M10.

### P2 — Financial multiples accept economically invalid denominators

`safeDivide` at `apps/dexter-worker/src/financial-indicators.ts:70-75` rejects zero but accepts negative values. P/E and EV/EBITDA at `:262-276` and `:306-317` can therefore expose ordinary multiple interpretations for negative EPS or EBITDA, despite their own descriptions requiring meaningful denominators.

Price provenance also remains incomplete in live mode: the pipeline passes only a number at `apps/dexter-worker/src/pipeline.ts:3491-3500`, and `defaultPriceReference` manufactures generic source/date metadata while recording an omission. The omission makes the gap visible, but price-dependent ratios still appear as if backed by an approved close. This should be resolved as a product/data contract decision before production sign-off.

Affected milestones: M12, M13.

### P2 — Additional correctness and auditability gaps

- M2 determines “nothing material changed” from coarse breadth/macro/sector buckets, so large same-direction index moves can be suppressed (`apps/product-api/src/pulse/editorial-issue.ts:74-89`, `apps/product-api/src/pulse/common.ts:81-95`).
- M4 accepts every `topic: "sector"` headline and can classify ordinary sector news as geopolitical (`apps/product-api/src/pulse/macro-news.ts:160-175`).
- M11 SEC/XBRL evidence has no filing URL, accession, or equivalent source locator (`apps/dexter-worker/src/filing-intelligence.ts:148-175`).

## Milestone disposition

| Milestone | Disposition | Current reason |
|---|---|---|
| M1 | Conditional | Replay date validation is ambiguous and silently falls back |
| M2 | Conditional | Future-report contamination and coarse daily-delta detection |
| M3 | Blocked | Unsafe headline links and weak evidence validation |
| M4 | Blocked | Central production dispatch path is disconnected |
| M5 | Conditional | Historical Deep Dive selection and malformed holding input |
| M6 | Blocked | LLM grounding and provider-boundary enforcement |
| M7 | Superseded/accepted | M8/M10 intentionally replaced its customer-facing renderer; no current M7 defect found |
| M8 | Blocked | Unsafe links and internal footer labels remain in the current renderer |
| M9 | Blocked when tools enabled | Fixture context can enter live prompts; final policy is unenforced |
| M10 | Blocked | Yahoo default, LLM grounding, provider fallback |
| M11 | Blocked | Filing-text deliverable is structurally unreachable |
| M12 | Blocked | TTM continuity, denominator semantics, price provenance |
| M13 | Conditional | Main surface is present; true-TTM continuity remains wrong |

## Validation status

- `@thesis/product-api` TypeScript no-emit compilation: passed.
- `@thesis/dexter-worker` TypeScript no-emit compilation: passed.
- Contracts suite observed in the shared run: 17/17 passed.
- Dexter worker suite: 57/58 passed. The failing fixture assertion expected freshness `fresh` or `degraded`, but the report was `stale`; this appears date-sensitive and is not counted as proof of the production defects above.
- Product API package test command could not complete because concurrent TypeScript emits hit `TS5033/EPERM` on existing `dist` files. A later no-emit compile passed, so this is recorded as an incomplete test run rather than a source failure.
- Historical milestone evidence proves many deterministic fixture, contract, render, and happy-path checks. It does not close the live-provider, adversarial LLM, replay-order, filing-text integration, or discontinuous-quarter gaps above.

No new test files were added and no application source file was edited during this review.

## Recommended repair order

1. Enforce customer-output boundaries: safe link schemes, grounded LLM copy, OpenRouter-only Pulse behavior, and the final text policy.
2. Restore real production inputs: wire M4 approved headlines/macro events and M11 reviewed filing excerpts.
3. Protect data truth: reject non-consecutive TTM quarters, require meaningful denominators, and require real typed price provenance before price-dependent ratios are shown as supported.
4. Make every historical selector date-bounded and reject invalid replay dates.
5. Tighten M3/M5 trust-boundary validation and map omission families to reader-facing copy.
6. Rerun the existing package/full-stack checks serially, then record live-mode proof for the repaired provider and ingestion paths.

Do not spend time reviving the M7 newspaper renderer. It is intentionally superseded and its current lack of callers is not technical debt that needs fixing.
