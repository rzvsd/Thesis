# Phase 6 M0 Smoke Closeout

**Date:** 2026-04-17  
**Run by:** Codex  
**Environment:** Windows PowerShell, local repo `C:\BOTS\Thesis\fintech`  
**Result:** PASS  

---

## Scope

M0 closes the dependency audit and cutover-plan milestone. This proof covers:

- Phase 6 documentation pack and normalized milestone folders.
- ADR-001 through ADR-006.
- Deprecated dependency inventory and baseline.
- Local and CI guard scripts.
- Quality checks and full repo test command.

---

## Dependency Guard Evidence

| Command | Result |
|---|---|
| `corepack pnpm run phase6:m0:inventory` | PASS - 70 protected-path baseline findings surfaced |
| `corepack pnpm run phase6:m0:self-test` | PASS - temporary forbidden `yfinance` import detected and removed |
| `corepack pnpm run phase6:m0:guard` | PASS - 70 known baseline findings, 0 new protected-path findings |

Inventory summary:

| Pattern | Count |
|---|---:|
| `alpha-vantage` | 6 |
| `fear-greed` | 13 |
| `fmp` | 21 |
| `hf-transcript-corpus` | 4 |
| `openbb-library` | 3 |
| `polygon` | 6 |
| `yfinance` | 17 |

Baseline files:

- `phase6-deprecated-dependency-baseline.json`
- `2026-04-17_m0-deprecated-dependency-inventory.md`

---

## Quality Evidence

| Command | Result |
|---|---|
| `corepack pnpm run security:sast` | PASS |
| `corepack pnpm run security:audit` | PASS - no known vulnerabilities found after dependency hygiene update |
| `corepack pnpm run lint` | PASS |
| `corepack pnpm run typecheck` | PASS |
| `corepack pnpm --filter @thesis/product-api build` | PASS |
| `corepack pnpm --filter @thesis/product-api test` | PASS - 74 tests |
| `corepack pnpm test` | PASS - workspace tests plus integration tests |

---

## Dependency Hygiene Update

After the initial M0 closeout exposed non-critical audit advisories, the dependency tree was patched with targeted direct dependency updates and pnpm overrides.

Resolved packages:

- `@tootallnate/once` -> `3.0.1`
- `brace-expansion` 1.x -> `1.1.13`
- `brace-expansion` 5.x -> `5.0.5`
- `flatted` -> `3.4.2`
- `langsmith` -> `0.5.19`
- `node-forge` -> `1.4.0`
- `picomatch` -> `4.0.4`
- `protobufjs` remains pinned at `7.5.5`

Verification:

```text
corepack pnpm audit --audit-level low --ignore-registry-errors
Result: No known vulnerabilities found

corepack pnpm run security:audit
Result: No known vulnerabilities found
```

Affected runtime checks:

```text
corepack pnpm --filter @thesis/dexter-worker test
Result: PASS - 18 tests

corepack pnpm --filter @thesis/product-api test
Result: PASS - 74 tests
```

---

## Test Hardening Found During M0

Two date-sensitive test issues were corrected while proving the milestone:

- `m2-monitoring.test.ts` now uses the current test run date instead of a fixed report date that became stale after 2026-04-17.
- The subscription daily reset proof now lives in `subscription-reset.test.ts`, isolating its global Date mock from the broader subscription purchase/restore tests.

These changes do not alter product behavior. They make the suite honest and repeatable.

---

## CI Integration

The root CI workflow now includes:

```text
corepack pnpm run phase6:m0:guard
```

This means new protected-path deprecated provider references fail the validation workflow.

---

## Rollback

If the guard blocks unrelated delivery, rollback is to revert:

- `scripts/phase6/deprecated-dependency-guard.mjs`
- the root `phase6:m0:*` scripts
- the CI workflow guard step
- the generated M0 baseline/evidence files

Rollback must not silently reclassify deprecated providers as allowed core runtime dependencies.

---

## Sign-Off

| Role | State |
|---|---|
| Owner | Accepted for M0 local closeout |
| Engineering Lead | Countersigned by local quality gate |
