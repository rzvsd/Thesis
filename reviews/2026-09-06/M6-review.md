# Phase 7 M6 review

Date: 2026-09-07

## Scope and milestone context

Reviewed the M6 milestone brief, M6 evidence and mocked export, the current Dexter-owned Pulse editorial path that superseded the original Product API writer, the provider configuration/runner, prompt construction, copy validation, and focused worker tests. M8 replaced the old newspaper presentation and M10 later expanded the Pulse editorial field set, but both continue to use the Dexter Pulse copy path. M6's provider and deterministic-facts guardrails therefore remain relevant; the original Product API file named by the M6 note is historical.

## Findings

### P1 — The LLM guard does not reject invented numbers, sources, events, or causal claims outside its narrow token checks

Locations: `apps/dexter-worker/src/pulse-brief.ts:474-588` and `apps/dexter-worker/src/pulse-editorial-prompt.ts:24-35`.

The prompt tells the model to use only supplied facts, but `validateCopy` only enforces word budgets, the banned advice regex, the literal word `because`, and uppercase ticker/acronym membership. It does not compare numeric claims, source names, event names, dates, or market values in the returned prose with the deterministic report. A response containing a fabricated percentage or unsupported source can therefore pass and replace the deterministic narrative. This directly defeats the M6 lock that LLM output cannot mutate facts, data values, sources, events, or provenance, and the later M10 lock preserves the same restriction. Existing tests cover valid output, missing/disabled configuration, malformed JSON, trading language, and unsupported tickers, but no unsupported-number/source/event case. The safe behavior is to reject or fallback unless claims are grounded in a deterministic fact pack.

### P2 — Pulse editorial fallback uses Anthropic/OpenAI despite the M6 OpenRouter-only production lock

Locations: `apps/dexter-worker/src/config.ts:136-143`, `apps/dexter-worker/src/config.ts:294-325`, `apps/dexter-worker/src/live-dexter.ts:114-151`, and `apps/dexter-worker/src/live-runner.mjs:131-167`.

The live provider order defaults to `openrouter,anthropic,openai`, and `runLiveDexterQuery` retries the same Pulse prompt across every configured attempt. `applyDexterCommentary` calls that shared function at `apps/dexter-worker/src/pulse-brief.ts:628-636`, so an OpenRouter failure can generate customer Pulse copy through Anthropic or OpenAI. M6 explicitly locks OpenRouter as the only production LLM provider and requires provider failure to fall back to deterministic Pulse. The current behavior is directly observable from the attempt loop and the runner's three-provider dispatch; the M10 evidence only proves fixture-mode output and does not supersede this provider lock. Pulse should use an OpenRouter-only attempt and deterministic fallback, or a later decision must explicitly amend the M6 lock.

## Tests reviewed and run

Reviewed:

- `Project Note/Phase7/Milestones/M6/M6_MILESTONE_AGENTS_ph7.md`
- `Project Note/Phase7/Milestones/M6/evidence/2026-04-27_m6_llm_editorial_writer_verification.md`
- `Project Note/Phase7/Milestones/M6/evidence/2026-04-27_m6_test_output.log`
- `Project Note/Phase7/Milestones/M6/evidence/generated-2026-04-27/pulse-2026-04-27-llm-editorial.json`
- `apps/dexter-worker/src/pulse-brief.ts`
- `apps/dexter-worker/src/pulse-editorial-prompt.ts`
- `apps/dexter-worker/src/config.ts`
- `apps/dexter-worker/src/live-dexter.ts`
- `apps/dexter-worker/src/live-runner.mjs`
- `apps/dexter-worker/tests/pulse-brief.test.ts`
- `apps/dexter-worker/tests/pipeline.test.ts`

The checked-in M6 evidence records the Product API build, contracts, focused writer tests, and Market Pulse regression as passing. The current shared worker test evidence also records Pulse brief and live-provider configuration tests passing. I did not rerun the worker suite because the parent review was already running the shared worker/API checks; no source or test files were changed.

## Gaps and verdict

M6's original Product API writer and newspaper export are superseded by the Dexter/M8/M10 path, so those historical rendering artifacts are not a current acceptance gate. The two guardrail defects remain current in the worker path. The test evidence proves deterministic fallback for malformed/trading output and provider configuration mechanics, but does not prove claim-level numeric/source/event grounding or enforcement of the OpenRouter-only production policy.

Verdict: **M6 should not receive an unconditional validation pass.** The unsupported-claim gap is the primary data-integrity blocker; provider fallback is a separate policy blocker unless an explicit later ADR changes the M6 provider lock.
