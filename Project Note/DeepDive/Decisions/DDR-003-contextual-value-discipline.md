# DDR-003 - Contextual Value Discipline

**Status:** Accepted
**Date:** 2026-04-20

---

## Decision

The value-investing section will include Piotroski-inspired signals, but it will interpret them by company context rather than treating the score as a universal master verdict.

---

## Rationale

Piotroski F_SCORE is powerful for high book-to-market, neglected, and distressed value names. For quality mega-caps, the same inputs are still useful but do not fully answer the investment question.

Thesis should explain:

- financially strong but expensive
- cheap but deteriorating
- high quality with low margin of safety
- value-trap risk
- sparse data with incomplete value signal

---

## Consequences

- M3 needs a company-context adapter.
- Mobile and PDF labels must avoid overstating Piotroski.
- Missing inputs must degrade score confidence.

---

## Guardrails

- Do not hide the score when incomplete; show partial score and missing inputs.
- Do not convert Piotroski into buy/sell advice.
- Do not use value score as the only determinant of report signal.

