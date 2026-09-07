# Phase 7 M4 Review

## Scope and review basis

Reviewed the Phase 7 M4 brief and verification note, M4 generated JSON/HTML/PDF evidence, the current Product API macro-news builder and dispatch path, contracts, renderer/brief planning code, focused tests, later M7/M8 milestone locks, and the available root test logs.

M7 and M8 supersede the original customer-facing standalone-section layout. Their compact issue/brief renderer still consumes `report.macro_news` for headline normalization and event-mode classification, so the M4 data path remains in scope. Findings below are against the current implementation, with superseded presentation requirements excluded.

## Findings

### P1 — Production Pulse dispatch never supplies M4 headline or macro-news inputs

**Location:** `apps/product-api/src/server.ts:5358-5391`; `apps/product-api/src/pulse/report-builder.ts:929-935`

**Trigger:** Run the normal `/internal/pulse/dispatch` job with a real approved macro/geopolitical headline available. `processMarketPulseJob` fetches the calendar only and calls `buildMarketPulseReport` without `headlineItems`, `macroNewsItems`, `macroNewsFetchState`, or `macroNewsUnavailableReason`. The builder therefore receives `undefined` for both M4 input families and constructs the calm fallback (`macro-news.ts:231-261`).

**Impact:** The shipped Pulse job cannot promote a shock, show confirmation state, or change event framing from approved headlines. The M4 generated artifact proves only direct builder/fixture assembly; it is not an end-to-end production path. This fails the M4 goal and the shock-state acceptance criterion for the actual dispatch flow.

**Evidence:** `Project Note/Phase7/Milestones/M4/evidence/2026-04-27_m4_macro_news_verification.md` explicitly says live external ingestion is not proven and belongs to a later milestone. The current M4-focused test asserts only the default calm state (`apps/product-api/tests/market-pulse.test.ts:934-935`), while the shock render test uses a hand-built report (`apps/product-api/tests/market-pulse-render.test.ts:199-217`).

### P2 — Sector-tagged headlines are incorrectly promoted into macro news

**Location:** `apps/product-api/src/pulse/macro-news.ts:160-175`

**Trigger:** Pass an approved headline with `topic: "sector"` and no macro/geopolitical signal, for example `"Technology shares gain after strong chip demand"`. The candidate filter accepts every `sector` topic before checking headline content, then `classifyMacroNewsTopic` falls through to `geopolitical` (`:164-175`, `:34-52`).

**Impact:** Ordinary sector headlines become M4 macro-news items, are copied into the M8 brief's macro headline list (`apps/product-api/src/pulse-brief-plan.ts:337-355`), and can create misleading macro-news coverage/source output. This violates the M4 boundary that macro news is macro/geopolitical input and makes classification dependent on an unrelated upstream topic label.

**Evidence:** No focused test covers a non-macro sector headline. Existing M4 tests cover calm default behavior and a hand-authored shock render, but not candidate filtering/classification.

## Validation reviewed/run

- M4 evidence records contract tests passing (15 tests), Product API build passing, focused renderer test passing, and deterministic calm Pulse test passing.
- M4 evidence also records the full Product API test command timing out twice; it is explicitly not counted as full-suite evidence.
- The repository's available `reviews/2026-09-06/test-suite.log` shows the later root suite did not complete: Product API TypeScript emit failed with `TS5033 ... EPERM` while writing `dist` files. I did not treat that as an M4 source defect.
- Reviewed later M7/M8 locks: they remove the old standalone newspaper presentation, but retain macro shock as an input to brief event-mode logic; this is why P1 remains current after supersession.

## Coverage gaps

- No dispatch-level test proves that an approved headline reaches `buildMarketPulseReport` and changes `macro_news` from calm to shock/watch.
- No classifier test proves that ordinary company/sector headlines are excluded.
- No live approved-source ingestion proof exists in the M4 evidence; the evidence note defers it to a later milestone.

## Verdict

**M4 does not pass as a production-ready milestone.** The contract, deterministic fixture assembly, and rendering pieces are present, but the normal Product API dispatch is disconnected from the M4 input path, so the central shock behavior is unreachable in production. Fix the dispatch ingestion/wiring and add the two focused regression checks above before treating M4 as complete. P2 should be fixed in the same change because it is a small classifier-boundary defect exposed once real headlines are wired.
