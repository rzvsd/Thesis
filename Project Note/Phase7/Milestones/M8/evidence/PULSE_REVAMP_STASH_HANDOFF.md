# Pulse Revamp Stash Handoff

**Date:** 2026-05-02  
**Stash:** `stash@{0}: pre-m9-pulse-brief-layout-v2`

## Why This Exists

Before implementing Phase 7 M9, the in-progress Pulse Morning Brief revamp was preserved separately so M9 could remain a clean Dexter-only evidence-skills milestone.

This stash is not lost work. It is intentionally parked work from the Pulse track.

## Files Preserved

```text
apps/dexter-worker/src/pulse-brief.ts
apps/dexter-worker/tests/pulse-brief.test.ts
apps/product-api/src/pulse-brief-plan.ts
apps/product-api/src/pulse-brief-render.ts
apps/product-api/tests/market-pulse-render.test.ts
apps/product-api/tests/market-pulse.test.ts
packages/contracts/src/market-pulse-report.ts
packages/contracts/tests/market-pulse-report.test.ts
```

## Interpretation

- M9 is closed as a local Dexter evidence-skills commit.
- The Pulse revamp work is separate and should be restored deliberately when returning to the Pulse track.
- Do not apply this stash automatically during Dexter-only work.
- Before restoring it, re-check current `main` and resolve any overlap with later Pulse changes.

## Restore Command

```powershell
git stash apply 'stash@{0}'
```

Use `apply` rather than `pop` until the restored Pulse changes are reviewed and committed.
