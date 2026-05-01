# Phase 7 M7 - Newspaper Template Revamp Verification

Date: 2026-04-28

## Scope Verified

This pass replaced the previous 13-module M7 idea with the compact newspaper template locked in:

```text
Project Note/Phase7/Milestones/implementation_plan.md
```

The live renderer now uses:

1. Masthead
2. The Tape
3. What Changed
4. Your Names, only when typed rows exist
5. Today's Calendar, only when typed rows exist
6. Headlines Worth Knowing, only when approved rows exist
7. Signal vs Noise
8. The Backdrop
9. Footer sources and method

The main flow no longer renders standalone Market Overview, Why It Matters, What To Watch, Company/Event Notes, Coverage Notes, visible Method card, daily Structural Context, or repeated inline evidence blocks.

## Code Verification

Commands run:

```powershell
corepack pnpm --filter @thesis/product-api build
node --test --test-concurrency=1 dist/apps/product-api/tests/market-pulse-render.test.js dist/apps/product-api/tests/pulse-editorial-writer.test.js
node --test --test-concurrency=1 dist/apps/product-api/tests/market-pulse.test.js
node --test --test-concurrency=1 dist/apps/product-api/tests/ticker-registry-sync.test.js
corepack pnpm --filter @thesis/contracts test
python -m unittest discover -s tests -p "test_*.py" # from apps/data-openbb
corepack pnpm --filter @thesis/product-api test
```

Results:

- Product API build passed.
- Focused renderer/editorial writer tests passed: 4/4.
- Pulse dispatch/personalization regression test passed: 1/1.
- Ticker registry sync regression tests passed: 6/6.
- Contracts tests passed: 17/17.
- data-openbb tests passed through the repo-appropriate built-in unittest runner: 34/34.
- Product API full package test passed with a realistic timeout: 98/98 in about 306 seconds.

Resolved local caveats:

- The prior `pytest` blocker was a command issue. `apps/data-openbb/tests/test_service.py` is a `unittest` suite and does not require global `pytest`.
- The prior Product API timeout was an outer command ceiling issue. The suite is long, especially PDF/export and integration-style route tests, but it passed when allowed to complete.

## Artifact Proof

Generated from the 2026-04-28 Pulse report:

```text
Project Note/Phase7/Milestones/M7/evidence/generated-2026-04-28/pulse-2026-04-28-newspaper.html
Project Note/Phase7/Milestones/M7/evidence/generated-2026-04-28/pulse-2026-04-28-newspaper.pdf
Project Note/Phase7/Milestones/M7/evidence/generated-2026-04-28/pulse-2026-04-28-newspaper.png
```

Size check:

- HTML: 11,468 bytes, under the 15 KB test ceiling.
- HTML lines: 104, under the 500-line test ceiling.
- Old visible-section terms scan returned false for: Market Overview, Why It Matters, What To Watch, Company/Event Notes, Coverage Notes, `data_incomplete`, `bounded_context`, and obsolete company/event filler.

## Provider Check

Live provider probes on 2026-04-28:

| Candidate | Result | M7 Decision |
|---|---:|---|
| Federal Reserve speeches RSS | 200 | Approved free/official candidate for calendar/headline enrichment |
| Federal Reserve press/FOMC RSS | 200 | Approved free/official candidate for calendar/headline enrichment |
| BEA news release RSS | 200 | Approved free/official candidate for macro calendar/headline enrichment |
| Census economic indicators calendar HTML | 200 | Approved free/official candidate for calendar enrichment, parser needed |
| BLS public data API | 200 | Approved free/official data source for published BLS observations |
| Bloomberg markets RSS | 200 | Reachable approved headline candidate, subject to source policy |
| Reuters legacy business RSS | DNS failure | Do not rely on this URL; replace or omit gracefully |
| BLS release schedule `.ics` | 403 | Do not make this a hard dependency from this environment |
| BLS RSS | 403 | Do not make this a hard dependency from this environment |
| Yahoo earnings calendar HTML | 200 | Still excluded from production Market Tape and provenance; not a Phase 7 production dependency |

Provider handling lock:

- Optional provider 404/403/429/DNS failures skip the optional section or move omission truth to the footer.
- A failed optional provider must not render a broken card or customer-facing debug label.
- Market Tape remains FRED-only in production runtime.
- Yahoo and Alpha Vantage remain excluded from Market Tape production runtime and provenance.
- Calendar fallback order should be official-first: Fed release calendar/RSS, BEA RSS, Census calendar HTML, BLS public data API for observation freshness, then a small manually reviewed weekly calendar fixture when an official calendar endpoint blocks automation.
- Media RSS, including Bloomberg if approved, can supply headline metadata only; it must not become production truth for market data or macro facts.

## Acceptance Notes

- The renderer consumes `PulseIssuePlan` as the main structure owner.
- The LLM editor remains a copy pass and is capped at 600 tokens.
- Quiet-day handling bypasses the LLM and can render a valid short issue.
- Legacy stored reports are sanitized at render time so obsolete company/event filler does not reappear in What Changed.
