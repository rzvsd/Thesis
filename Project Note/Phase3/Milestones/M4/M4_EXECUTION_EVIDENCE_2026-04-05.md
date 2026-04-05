# M4 Execution Evidence (2026-04-05)

## Automated Gates

- `corepack pnpm test:e2e` PASS  
  Evidence: `artifacts/m4/e2e/2026-04-04T22-10-40/summary.json`
- `corepack pnpm test:load` PASS  
  Evidence: `artifacts/m4/load/2026-04-04T21-57-01/summary.json`
- `corepack pnpm runbooks:m4:smoke` PASS  
  Evidence: `artifacts/m4/runbooks/2026-04-05T01-09-39/summary.json`
- `corepack pnpm typecheck` PASS
- `corepack pnpm test` PASS (workspace + integration chain)

## Release Config / Pinning Checks

- `:app:compileReleaseKotlin` without release properties: FAIL (expected, fail-closed gate).
- `:app:compileReleaseKotlin` with real-format release properties: PASS.
- Release pinning XML now references release-injected values:
  - `@string/release_api_host`
  - `@string/release_cert_pin_primary`
  - `@string/release_cert_pin_backup`

## Physical Device / Maestro Status

- `corepack pnpm qa:maestro:prepare` PASS on physical device `R3CXA03J3LH`.
- Five consecutive `corepack pnpm qa:maestro:smoke` runs: PASS  
  Evidence: `artifacts/m4/maestro/2026-04-05T09-34-44/five-pass-summary.json`
- Closeout note: release pinning config validation is complete; signed-release runtime pinning proof is recorded as owner-approved TBD defer.

## Linear Status

- M4 backlog/todo items are closed or explicitly deferred.
- Explicit defer record: `RZV-225` closed with owner-approved TBD note.
