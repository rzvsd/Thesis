# Phase 7 M2 - Pulse Editorial Freshness & Daily Delta

**Status:** In progress  
**Owner:** Product API Owner + Product Lead  
**Last Revised:** 2026-04-26

---

## Goal

Make Pulse read like a daily financial briefing issue instead of a repeated section bundle.

M2 adds deterministic editorial structure:

- headline
- dek
- lead
- what changed
- why it matters
- what to watch
- signal versus noise
- coverage notes

---

## Implementation Brief

1. Add optional `MarketPulseEditorialIssue` contract support.
2. Extend `MarketPulseReport` with optional `editorial_issue`.
3. Extend `MarketPulseSections` with optional editorial sections.
4. Product API loads the prior Pulse before writing the next Pulse.
5. Product API fetches the next 7 days of earnings-calendar events for tracked issuers.
6. Product API creates deterministic editorial items from actual Pulse facts.
7. Renderer prefers the editorial issue flow when present and falls back to M1 layout when absent.
8. Export output must use clean customer-facing coverage language.

---

## Acceptance

- Contract accepts reports with and without editorial issue.
- First run renders a baseline editorial issue.
- Second run compares against prior Pulse.
- Calendar-backed watch items render when available.
- Calendar outage degrades without blocking Pulse.
- HTML/PDF render the editorial issue without raw internal labels.
- No LLM, new tab, trading workflow, or terminal surface is introduced.

---

## Evidence Folder

Proof lives in:

```text
Project Note/Phase7/Milestones/M2/evidence/
```
