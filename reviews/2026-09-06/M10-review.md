# Phase 7 M10 Review

## Scope

Reviewed the M10 milestone brief, M10 evidence and fixture-backed artifacts, current Dexter Pulse brief generation/validation, live-provider selection, Product API renderer, and focused tests. M10 is the current Pulse engagement layer; its deterministic fact-pack and customer-safety locks remain active.

## Findings

### P1 — Production Pulse name prices default to the prohibited Yahoo Finance runtime

**Location:** `apps/dexter-worker/src/config.ts:232-235`; `apps/dexter-worker/src/pulse-brief.ts:125-142`

**Trigger:** Run the Dexter Pulse brief without `DEXTER_PULSE_PRICE_BASE_URL`. Configuration defaults to `https://query1.finance.yahoo.com`, and the portfolio-row builder calls `/v8/finance/chart/{ticker}`.

**Impact:** M10 production Pulse uses a Tier 4 provider explicitly excluded by the M8/M10 source policy (Yahoo runtime dependency and scraped quote pages). That makes the name cards and their “latest close” provenance non-compliant with the locked source policy and can make the current brief dependent on an unapproved/blocked endpoint.

**Evidence:** M10 `evidence/README.md` says generated artifacts use fixture mode, so the artifact does not prove production provider compliance. The only focused price test replaces the URL with a local mock (`apps/dexter-worker/tests/pulse-brief.test.ts:16-41`, `:158`); no test asserts the production default is approved.

### P1 — LLM copy validation does not verify claims against deterministic facts

**Location:** `apps/dexter-worker/src/pulse-brief.ts:474-588`

**Trigger:** Enable Pulse LLM commentary and return JSON containing a fabricated number, unsupported source name, event/date, or causal statement that avoids the literal word `because`. `validateCopy` checks word counts, the advice regex, the word `because`, and uppercase ticker/acronym membership only.

**Impact:** The returned copy replaces the deterministic brief (`:636-641`) and can publish unsupported values, provenance, events, or causality despite M10's lock that LLM output cannot mutate facts, values, sources, events, omissions, or provenance. The fallback only activates for the narrow checks above.

**Evidence:** `pulse-editorial-prompt.ts:24-35` instructs the model to stay inside the fact pack, but prompt instructions are not enforcement. M10 focused tests prove rendering and fixture behavior; no current Pulse test injects an unsupported numeric/source/event claim and verifies rejection.

### P2 — Provider fallback can violate the OpenRouter-only M10 production boundary

**Location:** `apps/dexter-worker/src/pulse-brief.ts:628-635`; `apps/dexter-worker/src/live-dexter.ts:114-151`; `apps/dexter-worker/src/config.ts:136-143`

**Trigger:** With LLM commentary enabled, an OpenRouter attempt fails and `DEXTER_PROVIDER_ORDER` is unset (or configured with multiple providers). `runLiveDexterQuery` iterates every configured attempt, and the default order can include Anthropic and OpenAI after OpenRouter.

**Impact:** A failed OpenRouter request can still produce customer-facing M10 copy through another provider instead of using deterministic fallback. This conflicts with the locked single-provider production policy and makes the recorded provider metadata conditional on whichever fallback succeeded.

**Evidence:** The M10 evidence proves fixture-mode rendering and full tests, but contains no multi-provider failure test. The current loop returns the first later provider that succeeds (`live-dexter.ts:131-145`).

## Validation reviewed

- M10 focused Product API evidence: 4/4, including normal/event rendering, optional-module hiding, and quiet-day behavior.
- M10 Product API full suite: 98/98; contracts, workspace typecheck, and lint evidence pass.
- M10 word-budget proof reports visible sections within the expanded 1500-word cap.
- The artifact proof explicitly labels generated data as `DATA_OPENBB_FIXTURE_MODE=true`; it is not live-provider proof.

## Gaps

- No production-config test rejects the Yahoo default or verifies an approved price source.
- No adversarial LLM test covers unsupported numbers, source names, dates/events, or non-`because` causal claims.
- No provider-failure test proves OpenRouter failure produces deterministic fallback without trying another provider.

## Verdict

**M10 is not ready for production sign-off.** The adaptive Morning Brief, renderer, word budgets, and fixture/test evidence are present, but the default Yahoo price path violates the source lock and LLM commentary can pass unsupported factual claims. The provider fallback policy is a second boundary defect. Fix these controls before accepting M10 as a customer-safe release.
