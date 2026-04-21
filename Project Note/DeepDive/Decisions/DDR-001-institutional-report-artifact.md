# DDR-001 - Institutional Report Artifact

**Status:** Accepted
**Date:** 2026-04-20

---

## Decision

Deep Dive Revamp will use a structured report artifact as the source of truth.

Mobile and PDF render from this artifact. They do not invent their own research structure.

---

## Rationale

The current Deep Dive can render a better mobile experience, but the underlying report still feels shallow because it is close to section assembly.

A serious research product needs stable sections, computed metrics, evidence links, valuation assumptions, omissions, and narrative all bound together.

---

## Consequences

- Contracts must be expanded before UI work.
- Product API and Dexter must validate the artifact.
- PDF export can become serious because it is fed by structured data.
- Mobile can stay readable without becoming the full appendix.

---

## Guardrails

- Old reports must still render.
- New fields are additive until the workstream is fully closed.
- The artifact owns the truth; renderers own presentation only.

