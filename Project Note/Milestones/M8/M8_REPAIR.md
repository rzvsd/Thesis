# M8 Repair Plan
**Milestone:** M8 - Product Quality / UX Refinement  
**Purpose:** Convert the initial M8 UI/UX implementation wave into a stable, testable product path that still respects M7 working behavior and M8 doctrine.
**Status:** Complete - engineering repair and proof finished on 2026-03-23

---

## Why This File Exists

The first M8 implementation pass produced real UI progress, but the audit found a mixed state:

- visual improvements exist
- some resume/push work is genuinely wired
- Android compile safety regressed
- some M7-safe user flows regressed
- several M8 surfaces still rely on mocked content or unlinked screen logic

This file is the repair bridge between:

- the approved M8 milestone scope
- the execution-ready ticket plan
- the actual implementation defects discovered during audit

This file does **not** change milestone scope.  
It defines the repair order that must happen before M8 quality claims are trusted.

---

## Audit Summary

### Confirmed Good

- Product API push headline support is wired and tested
- resume persistence foundation exists in mobile session state
- several new Android screens/components reflect the intended M8 visual direction

### Confirmed Broken or Incomplete

- Android app does not currently compile
- raw Stitch export files still live in `src/main/` and break the build
- theme token layer is incomplete / unresolved
- M7-safe auth behavior regressed in the new UI layer
- history open behavior regressed
- watchlist/My Names management is not currently reachable in the new navigation shape
- Home screen is still largely driven by mocked strings
- Deep Dive M8 screen expects fields not present in the current mobile contract/model

---

## Repair Progress Snapshot - 2026-03-23

### Completed in this pass

- Android compile surface stabilized
- Raw `*Stitch.kt` runtime artifacts removed from `src/main/`
- Theme token layer made concrete enough for the current M8 components to compile
- `ThesisApp.kt` flow breakage repaired
- M7-safe auth path restored through the proven register -> verify -> login screen
- History tap rewired to real report/pulse loading
- Watchlist / My Names management made reachable again
- Home screen no longer depends on obvious hardcoded demo strings
- Deep Dive screen reconciled to the current mobile/Product API model instead of invented summary fields
- Repo quality checks passing: `pnpm lint`, `pnpm typecheck`, `pnpm test`

### Closeout status after repair proof

- fresh physical-device rerun completed on device `R3CXA03J3LH`
- end-to-end M8 smoke evidence captured for first-run auth, My Names, history/resume, push tap-through, settings link, and degraded/error handling checks
- documentation and Linear closeout completed
- owner-authorized final sign-off recorded on 2026-03-23

---

## Repair Order

### Phase 1 - Compile Surface Stabilization

Goal: restore a clean Android build before any additional UX iteration.

Required actions:

1. Remove or relocate all raw `*Stitch.kt` HTML export files from `src/main/`
2. Complete or collapse the theme token layer so all referenced color/type/dimension objects compile
3. Clean `ThesisApp.kt` import conflicts and invalid return labels
4. Re-run Android assemble immediately after cleanup

Exit condition:

- `:app:assembleDebug` passes

---

### Phase 2 - Restore M7-Safe Product Behavior

Goal: no M8 polish may ship while M7-proven paths are broken.

Required actions:

1. Reconnect register and verify flows in the new auth UI
2. Rewire history item tap so prior reports actually open
3. Restore reachable watchlist / My Names management
4. Ensure no empty-state CTA routes into an immediate dead end

Exit condition:

- auth works again
- history open works again
- watchlist remains reachable and usable

---

### Phase 3 - Replace Mocked Product Content with Live Data

Goal: M8 surfaces must be product-refined, not hardcoded demo shells.

Required actions:

1. Home greeting/hook derives from live Pulse context
2. What Moved derives from live Pulse sections, not fixed placeholder cards
3. My Names context derives from watchlist + Pulse overlay, not mock strings
4. Worth-a-Deeper-Look card derives from real app state or approved fallback logic
5. History visuals stop using fake signal heuristics
6. Full Pulse route becomes a real view, not a same-tab no-op

Exit condition:

- no core M8 screen depends on obvious hardcoded demo content

---

### Phase 4 - Deep Dive Contract Reconciliation

Goal: the new Deep Dive reading experience must match the real data model.

Required actions:

1. Decide whether to adapt the UI to today's `DeepDiveReportView`
2. Or deliberately extend parsing/model support where justified by current contracts
3. Keep this within M8 scope unless a real schema blocker is proven

Exit condition:

- Deep Dive UI renders from real report data without invented fields

---

### Phase 5 - Proof

Goal: no M8 claims without evidence.

Required checks:

1. Android assemble
2. manual device smoke
3. first-run / no-data
4. My Names flow
5. history / resume
6. push tap-through
7. degraded / error states
8. targeted quality checks

Exit condition:

- milestone proof can be logged honestly in `M8_MILESTONE_AGENTS.md`

---

## Rules During Repair

1. Do not expand M8 scope while repairing it.
2. Do not rewrite architecture to solve UI problems.
3. Do not widen contracts just to make mock UI easier.
4. No raw design-export artifacts remain in production runtime source folders.
5. M7-safe behavior must be preserved before further polish work continues.

---

## Linear Traceability

Repair work should be represented in Linear as:

- one repair umbrella ticket for compile/build stabilization
- one or more bug tickets for M7 regressions discovered during M8 work
- existing M8 pillar tickets updated to reflect whether work is:
  - implemented
  - partially wired
  - mocked
  - blocked

---

## Close Condition for This Repair File

This repair note is considered complete when:

- Android compiles
- no M7-safe flow is regressed
- mocked critical-path content is removed or explicitly documented
- M8 implementation can continue from a stable base

### Repair close evidence

- `apps/mobile/android :app:assembleDebug` PASS
- `pnpm lint`, `pnpm typecheck`, `pnpm test` PASS
- `qa/maestro/output/2026-03-23T18-23-26-307Z/summary.json` PASS
- `qa/maestro/output/2026-03-23T18-26-05-333Z/summary.json` PASS
- `qa/maestro/output/2026-03-23T18-29-29-551Z/summary.json` PASS
- product-api FCM delivery log shows `attempted:1 delivered:1 failed:0 provider:"fcm"`

Repair file close verdict:

- Complete
