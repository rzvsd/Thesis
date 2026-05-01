# AGENTS.md - Phase 7 M1 Pulse Market Tape & Clear Daily Context
**Milestone:** M1 - Pulse Market Tape & Clear Daily Context  
**Inherits from:** Root `AGENTS.md`  
**Location:** `Project Note/Phase7/Milestones/M1/M1_MILESTONE_AGENTS_ph7.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M1 - Pulse Market Tape & Clear Daily Context |
| **Owner** | Product API Owner + Data Platform Engineer + Product Lead |
| **Status** | In progress |
| **Depends on** | Phase 6 closeout |

Before implementation, read `PH7_DECISION_LOCKS.md`.

---

## 1. What This Milestone Is Building

This milestone adds a new `market_tape` layer to Morning Exception Briefing so Pulse can explain day-to-day market movement with clearer daily signal and clearer provenance.

---

## 2. Scope - What Is In

- additive `MarketTapePack` contract
- `data-openbb` tape retrieval endpoint
- Pulse assembly update for `market_tape`
- HTML/PDF render support
- free-data omission-forward behavior
- replay-safe `as_of` handling

---

## 3. Scope - What Is Out

- Deep Dive changes
- War Room changes
- terminal-style dashboarding
- Yahoo runtime integration
- Alpha Vantage runtime integration
- paid provider adoption

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `data-openbb` | market tape retrieval, normalization, provenance, and omission truth |
| `product-api` | Pulse assembly, validation, rendering, and export |
| `packages/contracts` | additive market-tape contract and report contract extension |

---

## 5. Testing Requirements

- contract validation for `MarketTapePack`
- endpoint tests for `/v1/market/tape`
- Pulse build tests proving `market_tape` is first and bounded
- render/export tests proving `market_tape` shows cleanly
- replay-safe `as_of` verification

---

## 6. Definition of Done

- [ ] Acceptance criteria in `ph7_MILESTONES.md` are satisfied locally
- [ ] Focused tests pass
- [ ] Smoke proof is recorded in `evidence/`
- [ ] Yahoo and Alpha Vantage are absent from protected runtime/provenance for M1

---

## 7. Smoke Test Log

```text
Date:
Run by:
Environment:
Result:

Step 1:
Result:
...
```
