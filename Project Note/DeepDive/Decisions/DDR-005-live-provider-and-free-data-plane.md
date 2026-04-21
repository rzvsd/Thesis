# DDR-005 - Live Provider Uses OpenRouter-First And Free Data Plane

**Status:** Accepted
**Date:** 2026-04-21

---

## Decision

Deep Dive live generation no longer requires `FINANCIAL_DATASETS_API_KEY` and no longer treats Anthropic or LangSmith tracing as mandatory launch blockers.

The runtime path is now:

- free Thesis data plane first for research inputs
- `openrouter` as the primary live LLM provider
- `anthropic` or `openai` as optional fallback providers when configured
- local prompt manifest as the default prompt source
- LangSmith as observability and optional prompt source, not a hard gate

---

## Rationale

The project direction is to avoid paid market-data dependencies and rely on the existing allowed data stack such as SEC, news-ingest, and wrapped internal data services. The remaining M7 limitation was architectural only because live mode still hard-required Anthropic, Financial Datasets, and LangSmith tracing even when those were not aligned with the current product doctrine.

OpenRouter-first is acceptable because it is a normal backend credential flow. Codex desktop OAuth is not.

---

## Consequences

- Live Dexter preflight can succeed without `FINANCIAL_DATASETS_API_KEY`.
- A configured `OPENROUTER_API_KEY` is now the preferred way to run `gpt-5.4-mini`.
- Anthropic can still rescue live generation when OpenRouter is unavailable and an Anthropic key/model are configured.
- LangSmith prompt pulls may fall back to the local manifest instead of blocking the run.

---

## Guardrails

- No backend runtime may depend on Codex desktop OAuth.
- No report may fabricate paid-provider data when the free data plane is incomplete.
- Prompt fallback must stay honest: local manifest is allowed, silent fake prompt success is not.
- Operational provider failures remain operational blockers and must be recorded as such.
