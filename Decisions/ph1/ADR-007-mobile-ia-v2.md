# ADR-007 - Mobile IA V2

**Status:** Accepted  
**Date:** 2026-04-08  
**Owners:** Product Lead + Engineering Lead

---

## Context

The live Android app still centers on a 3-tab structure:

- Today
- Research
- Portfolio

That structure hides several now-critical behaviors behind sub-modes:

- followed-name monitoring
- alert history
- settings and trust controls

Phase 3 already made those behaviors more important. Phase 4 formalizes them in the root product map.

---

## Decision

The canonical mobile IA is changed to:

1. Today
2. Names
3. Research
4. Inbox
5. You

Additional locked decisions:

- Portfolio is split into Names and You
- Inbox is backed by Product API-owned alert ledger persistence
- existing Thesis theme language is preserved; this is not a visual rebrand
- notification deep links target exact downstream context, while Inbox preserves the alert history and explanation

---

## Consequences

### Positive

- core daily flows become first-class instead of hidden
- alert transparency becomes explicit
- account and control surfaces stop competing with per-name monitoring
- future work can target stable screen ownership rules

### Negative

- routing and notification semantics must be updated together
- mobile code touched by the change is broad even though the visual system stays stable
- an alert ledger persistence layer is required for Inbox to be real

---

## Guardrails

- no mobile-only reconstruction of Inbox
- no change to the Thesis palette/typography doctrine as part of this ADR
- no per-name mute or frequency-tuning semantics without a later explicit decision
