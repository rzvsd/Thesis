# Phase 7 M11 review

Date: 2026-09-07

## Scope and milestone context

Reviewed the M11 milestone brief and evidence, the current M12/M13-backed filing-intelligence path, contract/runtime validation, the export renderer, and the checked-in M12/M13 Deep Dive artifacts. Findings below are limited to M11 behavior that remains active after the additive M12/M13 work.

## Findings

### P1 — Filing-text extraction is a dead deliverable; every report unconditionally claims the text is missing

Locations: `apps/dexter-worker/src/filing-intelligence.ts:568-574`, `apps/data-openbb/src/filing_text.py:53-86`, and `apps/dexter-worker/src/filing-intelligence.ts:651-676`.

The M11 deliverable requires bounded reviewed-section extraction for MD&A, risk factors, liquidity, and segments, and the product goal explicitly asks whether filing numbers agree with management language. The only implementation of that extractor is an isolated Python utility; no worker or data-service path calls it. The worker instead appends `missing_filing_text` on every run, then labels an optional earnings transcript as `management_commentary` and creates only a generic `new` delta. The generated M12 and M13 reports reproduce the unconditional omission even though they contain segment data and transcript commentary. Consequently the customer-facing Filing Read can never compare reviewed filing language, and the acceptance criterion is structurally impossible to pass. Wire the reviewed excerpts into the historical payload and build language deltas from them, retaining the omission only when the source text is actually unavailable.

### P2 — SEC/XBRL evidence is not auditable because filing references and evidence omit source URLs

Locations: `apps/dexter-worker/src/filing-intelligence.ts:148-158`, `apps/dexter-worker/src/filing-intelligence.ts:161-175`, and `apps/dexter-worker/src/pipeline.ts:3478-3489`.

`FilingIntelligenceFilingRef.source_url` and `EvidenceItem.url` are optional, but the filing builder never supplies either. It derives a form from `period_type`, copies only period/date metadata, and emits evidence whose excerpt says only which fields are available. The current M13 JSON therefore presents “SEC companyfacts/XBRL ... snapshot” claims without a filing/companyfacts URL, accession, or equivalent source locator. That is insufficient for the M11 acceptance requirement that the evidence appendix include SEC/XBRL provenance: a reader or reviewer cannot open the source or distinguish a real filing from a fixture/provider transformation. Preserve the upstream SEC source locator (or an explicit deterministic fixture locator) through the canonical snapshot and include it in both filing refs and evidence.

## Tests reviewed and run

Reviewed the M11 evidence README, M12/M13 generated report JSON/HTML, `apps/dexter-worker/tests/pipeline.test.ts`, `apps/product-api/tests/deepdive-m5-pdf-export.test.ts`, the contract schemas, and filing-text tests. The worker package build completed and its test run produced 57 passes and one existing failure: `MSFT fixture request produces a schema-valid report with no blank sections` fails because `trust_metadata.freshness_state` is `stale` (the assertion expects `fresh` or `degraded`). The Product API test command could not compile because TypeScript received `EPERM` writing existing `dist` files; concurrent/dirty workspace state may be involved. No tests were added.

## Gaps and verdict

The checked-in happy-path artifacts prove deterministic metric deltas, omission rendering, and the new PDF/HTML pages, but they also directly demonstrate the unconditional `missing_filing_text` behavior and absent source locators. M12/M13 add value-lens and education behavior but do not repair either M11 gap.

Verdict: **M11 should not receive an unconditional validation pass for the current filing-intelligence path.** The dead filing-text integration is the primary milestone blocker; missing SEC locators is a separate auditability defect.
