# Phase 6 M3 Smoke Evidence

**Date:** 2026-04-18  
**Run by:** Codex  
**Milestone:** Phase 6 M3 - Morning Exception Briefing & Macro Stress  
**Environment:** Local Windows workspace, in-memory Product API and scheduler test harnesses, Android Studio JBR for mobile debug assemble

---

## Commands

```text
corepack pnpm --filter @thesis/contracts lint
corepack pnpm --filter @thesis/contracts typecheck
corepack pnpm --filter @thesis/scheduler lint
corepack pnpm --filter @thesis/scheduler typecheck
corepack pnpm --filter @thesis/scheduler test
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/product-api typecheck
corepack pnpm --filter @thesis/product-api test
corepack pnpm run phase6:m0:guard

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat app:assembleDebug
```

---

## Result

**Overall:** PASS

- `@thesis/contracts` lint and typecheck passed.
- `@thesis/scheduler` lint, typecheck, and full test suite passed.
- `@thesis/product-api` lint, typecheck, and full test suite passed (`78` tests green).
- `phase6:m0:guard` passed with `0 new protected-path finding(s)`.
- Android `app:assembleDebug` passed once `JAVA_HOME` was pointed at the local Android Studio JBR.

---

## Milestone Smoke Mapping

1. Trigger Morning Exception Briefing in test mode
   Result: PASS. `market-pulse.test.ts` exercised `/internal/pulse/dispatch`, stored a Phase 6 pulse, and retrieved it successfully.
2. Confirm a valid briefing is stored
   Result: PASS. `/pulse/2026-03-21` and `/pulse/latest` returned valid reports with Macro Stress, canonical events, bounded context, and personalized watchlist overlay.
3. Confirm Macro Stress validates
   Result: PASS. `sentiment.test.ts` validated `/internal/macro-stress/dispatch`, `/v1/macro-stress/current`, and `/v1/macro-stress/history`.
4. Run no-material-change fixture and confirm explicit output
   Result: PASS. `ph5-m3-morning-briefing.test.ts` verified explicit no-change delivery for Pro users and exception-path delivery when relevant events exist.
5. Confirm no deprecated provider path is needed
   Result: PASS. Phase 6 dependency guard reported no new protected-path deprecated-provider findings.

---

## Key Implementation Proof

- Morning briefing sections were rebuilt around:
  - `macro_stress`
  - `official_macro_pressure`
  - `canonical_events`
  - `bounded_context`
  - `uncertainty_flags`
- Legacy `sentiment`/Fear & Greed endpoints remain compatibility aliases only; new server endpoints expose Macro Stress directly.
- Scheduler health now exposes `macro_stress_schedule` and `next_macro_stress_fire_at`, while preserving legacy aliases for compatibility.
- Mobile compiles against the new payload shape and Macro Stress presentation path.

---

## Rollback Note

Rollback is straightforward:

1. Revert the Phase 6 M3 contract additions in `packages/contracts`.
2. Revert `product-api` pulse generation and Macro Stress endpoint wiring.
3. Revert scheduler Macro Stress dispatch/schedule aliases.
4. Rebuild Product API and Android app.

Do not silently reactivate deprecated provider-backed Fear & Greed behavior as a rollback shortcut.

---

## Sign-Off State

- Owner: Accepted by owner message on 2026-04-18
- Engineering Lead: Accepted by owner delegation on 2026-04-18
- GitHub CI: Pending push/hosted run
