# Deep Dive Revamp Decision Locks

**Status:** Active
**Last Revised:** 2026-04-22

---

## Locked Decisions

| # | Decision | Status | Rationale |
|---|---|---|---|
| D1 | Deep Dive Revamp is a formal workstream, not a cosmetic UI fix | Locked | The gap is report substance, not card styling |
| D2 | The durable report artifact is the source of truth | Locked | Mobile and PDF must render the same research truth |
| D3 | Deterministic financial analysis comes before LLM narrative | Locked | Prevents fabricated metrics and vague prose |
| D4 | PDF is a serious artifact, not a mobile printout | Locked | User expects a real research report |
| D5 | Piotroski is contextual, not universal | Locked | It is strongest for value/distressed names; mega-cap quality names need broader interpretation |
| D6 | Existing Deep Dive reports must keep rendering | Locked | History and offline cache cannot break |
| D7 | Reference PDFs set quality bar only | Locked | No copied text, layout, branding, or proprietary expression |
| D8 | No new top-level app tab is introduced | Locked | Research remains the Deep Dive home |
| D9 | Full-data editorial PDF target remains 10-14 pages | Locked | A full due diligence artifact needs summary, six sections, issuer metadata, evidence, and appendix without becoming a book |
| D10 | Mobile is a summary-first inline-expand reader over the canonical report, not the canonical report itself | Locked | The artifact and PDF carry full proof; mobile makes it readable on phone first and expandable second |
| D11 | Tests must fail shallow reports | Locked | A technically valid but content-thin output is a product failure |
| D12 | M1 contract shape is additive fields on `AnalysisReport` | Locked | Lowest-risk path for backward compatibility across Product API, Dexter, and mobile |
| D13 | M2 ships without peer-comparison dependency | Locked | Financial engine is company-history-first and omission-aware when peer data is unavailable |
| D14 | M2 fixture baseline uses full-data and sparse-data deterministic paths already in repo | Locked | Avoids blocker dependency while preserving hard-gate test coverage for complete and sparse histories |
| D15 | PDF renderer ownership remains Product API utility plus route, with M9 using the editorial HTML/CSS-to-PDF path and no new service | Locked | Meets template and test gates while preserving existing service boundaries |
| D16 | M5.2 is a formal visual-exhibits milestone between M5 and M6 | Locked | Keeps implementation separate from final proof and prevents M7 scope pollution |
| D17 | Chart visuals must be generated from real report figures with omission-aware fallback | Locked | Beautiful output must stay honest and reproducible |
| D18 | M5.2 visual references set exhibit style direction only, not layout to copy | Locked | Thesis should be inspired by institutional research quality without cloning proprietary work |
| D19 | Live Deep Dive uses free Thesis data sources plus OpenRouter-first provider routing | Locked | Removes the paid-data blocker while keeping backend auth server-safe and fallback-capable |
| D20 | `Deep Dive` remains the user-facing product entrypoint name | Locked | The upgrade changes report depth, not navigation identity |
| D21 | The canonical long-form report layer is `due_diligence` with exactly six sections | Locked | The product now defaults to full due diligence rather than memo-first output |
| D22 | `investment_memo` remains a short compatibility summary derived from the canonical report | Locked | Existing clients and entry points need a stable summary layer without creating a second truth source |
| D23 | Existing value-discipline logic survives inside the due-diligence model, primarily under `financial_analysis` and `valuation_and_thesis_stance` | Locked | M8 reorganizes the report taxonomy without discarding M2-M3 discipline |
| D24 | Every due-diligence section must surface omissions directly instead of filling gaps with prose | Locked | Strict omission honesty is part of the product promise, not an implementation detail |
| D25 | Follow-on milestone numbering continues as whole-number milestones after M7, with decimal suffixes reserved only for inserted cross-cutting slices like M5.2 | Locked | The existing DeepDive style already uses whole-number milestones for the main path and a decimal suffix only for inserted milestones, so `M8` and `M9` continue the main line |
| D26 | M9 upgrades due-diligence authoring to a verbose editorial standard without changing the six-section taxonomy | Locked | The next gap is depth and clarity of explanation, not a new report structure |
| D27 | Issuer metadata is mandatory on the report surface and metadata appendix | Locked | Users need to know exactly which issuer/listing context the report covers, and missing metadata must be visible |
| D28 | Verbose authoring does not turn `investment_memo` or mobile into long-form defaults | Locked | Summary-first behavior remains product-critical even when the canonical report becomes more editorial |

---

## Open Decisions (M8 / M9 Closeout)

| # | Decision Needed | Owner | Needed By | Notes |
|---|---|---|---|---|
| O4 | Exact paid/provider data policy for future transcripts/estimates | Product Lead | Before live provider expansion | Current revamp should work with existing allowed data first |
| O5 | Legacy-report backfill strategy for `due_diligence` (`lazy projection` vs stored migration) | Engineering Lead + Product Lead | Before M8 implementation closes | Compatibility is locked; storage/backfill mechanics are still open |

---

## Deferred Decisions

| Decision | Deferred Until | Reason |
|---|---|---|
| Brokerage-aware position sizing | Future portfolio phase | Not needed for research report quality |
| Real-time market data | Future market-data phase | Deep Dive is a research artifact, not trading terminal |
| Analyst consensus provider | Future provider/legal review | Report can be useful without stored consensus rows |
| Custom LLM fine-tuning | Future model-quality phase | Prompt/report compiler discipline comes first |
