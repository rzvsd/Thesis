# DDR-002 - Deterministic Analysis Before Narrative

**Status:** Accepted
**Date:** 2026-04-20

---

## Decision

Financial analysis, value discipline, valuation math, omissions, evidence counts, and confidence impacts are deterministic. Dexter may narrate those outputs, but it may not invent them.

---

## Rationale

The user must be able to trust the report. Tables, scores, and valuation cannot be generated as prose guesses.

The reference PDFs show that serious research separates facts, exhibits, and interpretation.

---

## Consequences

- M2 must ship before narrative quality can be judged.
- Tests must validate metric math independently of LLM output.
- Sparse data must create omissions, not filler text.

---

## Guardrails

- No computed metric without required inputs.
- No value score without named missing signals.
- No valuation conclusion without assumptions and a margin-of-safety context.

