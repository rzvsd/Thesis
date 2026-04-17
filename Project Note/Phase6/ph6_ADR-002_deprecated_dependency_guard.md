# Phase 6 ADR-002 - Deprecated Dependency Guard

**Status:** Accepted  
**Date:** 2026-04-17  
**Milestone:** M0  

---

## Context

Phase 6 removes old provider assumptions. Without a guardrail, a deprecated import or required environment variable can quietly re-enter the active code path.

The guard must be strict enough to protect runtime code, but not so broad that historical docs and evidence become impossible to keep.

---

## Decision

Add a Phase 6 M0 deprecated-dependency guard that scans protected active paths and compares findings to an explicit baseline.

Protected paths are defined in `PH6_DECISION_LOCKS.md`.

The guard must:

- inventory known active references,
- fail on new protected-path findings,
- provide a self-test that proves a temporary forbidden import fails,
- exclude archived Phase1-Phase5 history from active-path failure behavior.

---

## Consequences

- CI can reject accidental reintroduction of deprecated providers.
- Current known findings are not hidden; they are baseline-tracked until removed in later milestones.
- Documentation history remains readable without breaking builds.

---

## Evidence Required

- M0 baseline JSON.
- M0 inventory markdown.
- M0 guard pass.
- M0 self-test pass.
- CI workflow includes the guard.
