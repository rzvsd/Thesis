# Deep Dive Revamp Decision Locks

**Status:** Active
**Last Revised:** 2026-04-20

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
| D9 | Full-data PDF target is 8-12 pages | Locked | A serious report needs memo, exhibits, evidence, and appendix without becoming a book |
| D10 | Mobile is the executive reader, not the canonical report | Locked | The artifact and PDF carry full proof; mobile makes it readable on phone |
| D11 | Tests must fail shallow reports | Locked | A technically valid but content-thin output is a product failure |
| D12 | M1 contract shape is additive fields on `AnalysisReport` | Locked | Lowest-risk path for backward compatibility across Product API, Dexter, and mobile |
| D13 | M2 ships without peer-comparison dependency | Locked | Financial engine is company-history-first and omission-aware when peer data is unavailable |
| D14 | M2 fixture baseline uses full-data and sparse-data deterministic paths already in repo | Locked | Avoids blocker dependency while preserving hard-gate test coverage for complete and sparse histories |
| D15 | M5 PDF renderer ownership is Product API utility plus route, no new service | Locked | Meets template and test gates while preserving existing service boundaries |

---

## Open Decisions (Post-M1)

| # | Decision Needed | Owner | Needed By | Notes |
|---|---|---|---|---|
| O4 | Exact paid/provider data policy for future transcripts/estimates | Product Lead | Before live provider expansion | Current revamp should work with existing allowed data first |

---

## Deferred Decisions

| Decision | Deferred Until | Reason |
|---|---|---|
| Brokerage-aware position sizing | Future portfolio phase | Not needed for research report quality |
| Real-time market data | Future market-data phase | Deep Dive is a research artifact, not trading terminal |
| Analyst consensus provider | Future provider/legal review | Report can be useful without stored consensus rows |
| Custom LLM fine-tuning | Future model-quality phase | Prompt/report compiler discipline comes first |
