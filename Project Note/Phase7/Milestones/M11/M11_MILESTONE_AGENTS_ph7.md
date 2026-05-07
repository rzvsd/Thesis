# Phase 7 M11 - Deep Dive Filing Intelligence Memo Revamp

## Summary

M11 turns Deep Dive export into a filing intelligence memo centered on SEC 10-Q and 10-K analysis.

The milestone keeps Thesis doctrine intact:

- Deep Dive remains a research and conviction memo, not a trading terminal.
- SEC filings, SEC companyfacts, and XBRL snapshots are the official backbone.
- LLM commentary explains reviewed filing facts but cannot invent, mutate, or trade on them.
- The first visible surface is PDF/HTML export. Mobile can keep opening/downloading the improved PDF.

## Goal

Give the reader a premium company memo that explains:

- what changed in the latest filing
- whether the change was good, bad, or merely interesting
- whether the numbers and management language agree
- what needs confirmation in the next filing

Plain English: Deep Dive should read the filing like a smart analyst sitting beside the user, not like a parser dumping a table.

## Deliverables

| Deliverable | Description |
|---|---|
| Additive contract | `AnalysisReport.filing_intelligence?: FilingIntelligenceBlock` |
| Filing comparison engine | Dexter computes QoQ, YoY, and annual metric deltas from SEC/XBRL snapshots |
| Filing text utility | `data-openbb` has bounded reviewed-section extraction for MD&A, risk factors, liquidity, and segments |
| Guarded LLM memo pass | Dexter may rewrite memo fields from a small fact pack; unsafe output falls back |
| PDF/HTML revamp | Deep Dive export opens with Filing Read, What Changed, and Good / Bad / Interesting pages |
| Evidence and omissions | Filing gaps are explicit; no raw filing dumps reach customer output |

## Locked Product Behavior

- Deep Dive becomes filing-first when filing intelligence exists.
- Old Deep Dive blocks remain compatible and still render after the new opening memo pages.
- Missing filing text, prior quarter, year-ago data, annual history, or segment data creates omission truth.
- The LLM may speak the memo but deterministic facts own the memo.
- No trading advice, price targets, allocation language, broker workflow, terminal flow, or public quant-lab behavior is introduced.

## Interface Plan

- `packages/contracts/src/filing-intelligence.ts`
- `AnalysisReport.filing_intelligence?: FilingIntelligenceBlock`
- `apps/dexter-worker/src/filing-intelligence.ts`
- `apps/data-openbb/src/filing_text.py`
- `apps/product-api/src/report-pdf-editorial.ts`

## Acceptance Criteria

- [ ] `AnalysisReport` validates with and without `filing_intelligence`
- [ ] Dexter fixture pipeline emits a contract-valid filing intelligence block
- [ ] QoQ, YoY, and annual comparisons are computed without fake zero substitution
- [ ] Filing text extraction is bounded and omission-forward
- [ ] LLM memo output is guarded and falls back safely
- [ ] PDF/HTML opens with filing memo pages and still preserves legacy Deep Dive sections
- [ ] Evidence appendix includes SEC/XBRL provenance and omission truth
- [ ] No full raw filing body, trading language, price target, or provider-debug text leaks into customer output

## Smoke Test

```text
Step 1: Run contracts tests.
Step 2: Run data-openbb filing text tests.
Step 3: Run Dexter worker tests.
Step 4: Run Product API Deep Dive PDF/export focused test.
Step 5: Confirm rendered HTML includes Filing Read, What Changed In The Filing, and Good / Bad / Interesting.
Step 6: Confirm legacy and sparse Deep Dive reports remain exportable.
Step 7: Run typecheck, lint, and dependency guard.
Step 8: Record proof under M11 evidence.
```

## Rollback

Disable `filing_intelligence` generation and omit the opening filing memo pages while leaving the additive contract in place. Do not replace SEC/XBRL with an unapproved paid or scraped provider as a shortcut.

## Owners

- Dexter / Reasoning Engineer
- Product API Owner
- Data Platform Engineer
- Product Lead for final memo readability review
