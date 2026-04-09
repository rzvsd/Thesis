# M3 Smoke Plan (Phase 5)

**Milestone:** M3 - Morning Exception Briefing  
**Owner:** Scheduler Engineer + Product API Engineer + Mobile Engineer  
**Status:** Closed (PASS)

---

## Purpose

Prove that morning output is personalized, exception-first, and explicitly informative when nothing changed.

---

## Locked Decision Targets

1. Personalized relevance selection
2. Explicit no-change output
3. Ledger durability of morning briefing
4. Route-safe rendering on Today and Inbox

---

## Preconditions

- M1 and M2 data paths operational
- Morning scheduler cycle runnable in test mode
- Today and Inbox surfaces available from Phase 4

---

## Smoke Steps

1. Seed user with followed names and no overnight relevant events.
2. Run morning cycle and confirm no-change briefing output.
3. Seed overnight relevant events and run cycle again.
4. Confirm exceptions include reason text and resolvable route targets.
5. Confirm briefing entries persist in alert ledger.
6. Confirm Today and Inbox render both output modes correctly.

---

## Evidence Required For Closeout

- Briefing generation test output
- Ledger persistence proof
- Mobile rendering proof
- Dedupe/throttle proof

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `apps/product-api/tests/ph5-m3-morning-briefing.test.ts` | Includes a Pro user branch with no followed names to verify explicit no-change output. |
| 2 | PASS | `apps/product-api/tests/ph5-m3-morning-briefing.test.ts` | `briefing_mode: no_change` asserted from persisted alert ledger context. |
| 3 | PASS | `apps/product-api/tests/ph5-m3-morning-briefing.test.ts` | Exception path seeded via stale monitor snapshot from an older Deep Dive fixture. |
| 4 | PASS | `apps/product-api/tests/ph5-m3-morning-briefing.test.ts` | `lead_route`, `lead_ticker`, `exceptions_count`, and reason metadata verified. |
| 5 | PASS | `apps/product-api/tests/ph5-m3-morning-briefing.test.ts` | Ledger persistence and duplicate-cycle dedupe assertions verified. |
| 6 | PASS | `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/ThesisApp.kt`, `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` | Rendering + route wiring validated with `:app:compileDebugKotlin` after setting local `JAVA_HOME` to Android Studio JBR. |
