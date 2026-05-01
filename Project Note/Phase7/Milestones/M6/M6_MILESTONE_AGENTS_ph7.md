# Phase 7 M6 - Guarded LLM Pulse Editorial Writer

## Goal

Add an optional LLM editorial writer for Pulse that turns the deterministic Pulse and `UserResearchState` into a more readable morning briefing without changing the facts, data, provenance, or product identity.

## Locked Behavior

- Deterministic Pulse remains the source of truth.
- LLM generation is disabled by default.
- OpenRouter is the only M6 production LLM provider.
- The LLM may rewrite narrative/editorial fields only.
- The LLM must not mutate market tape values, Macro Stress, source metadata, user research state, prices, tickers, events, or provenance.
- If disabled, missing-key, timeout, malformed JSON, provider error, or policy violation occurs, Pulse falls back to the deterministic report.
- No buy/sell/hold language, price targets, execution instructions, or terminal-style signals.
- No new app tab, chat/Q&A endpoint, broker flow, screener, or public lab surface.

## Deliverables

- Product API OpenRouter client.
- Guarded Pulse editorial writer.
- Evidence-pack prompt built from whitelisted deterministic fields.
- Policy validator for trading language and unsupported ticker claims.
- Optional `editorial_generation` metadata on `MarketPulseReport`.
- Tests for valid generation and fallback paths.
- HTML/PDF evidence generated from a mocked OpenRouter response.

## Acceptance

- LLM editorial pass is off by default.
- Valid OpenRouter JSON can update the editorial narrative.
- Invalid/malformed/provider-failed output falls back to deterministic Pulse.
- Policy-violating trading language is rejected.
- Generated report remains contract-valid.
- No secrets are committed.
