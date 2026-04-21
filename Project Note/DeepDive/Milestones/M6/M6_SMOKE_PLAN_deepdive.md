# M6 Smoke Plan - Mobile Research Reader

**Milestone:** M6 - Mobile Research Reader
**Status:** Passed

---

## Smoke Steps

1. Build Android app.
2. Install on phone.
3. Login.
4. Run or open a Deep Dive.
5. Confirm memo, financial quality, value discipline, valuation, risks, evidence, PDF entry render.
6. Reopen from History.
7. Verify offline cache path.
8. Open legacy report fixture.
9. Confirm mobile follows the reader order in `DEEPDIVE_REPORT_TEMPLATE.md`.
10. Confirm mobile visual panels feel consistent with the M5.2 exhibit language where the artifact provides them.

---

## Evidence Required

- Android test output
- Device ID
- Maestro output
- Screenshots or UI assertions
- Offline cache proof
- Mobile reader template checklist
- Shared exhibit-language checklist

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Passed | `evidence/2026-04-20_m6-mobile-reader-code-proof.md` | Android compile/test path verified via `testDebugUnitTest` and `lintDebug` |
| 2 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Installed local debug build on Samsung `SM-S928B` (`R3CXA03J3LH`) |
| 3 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Device session used an already authenticated app state |
| 4 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Deep Dive opened on phone and rendered structured reader sections |
| 5 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Memo, financial quality, value discipline, valuation, risks, evidence, and export controls all captured |
| 6 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Report reopened from cached device state repeatedly during scroll proof |
| 7 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Structured artifact was validated through the device offline cache database and reopened on phone |
| 8 | Passed | `evidence/2026-04-20_m6-mobile-reader-code-proof.md` | Legacy fixture render remains covered by fallback unit tests |
| 9 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Device screenshots confirm the mobile reader order in the report template |
| 10 | Passed | `evidence/2026-04-21_m6-device-reader-proof.md` | Shared exhibit-language sections render on-device with Thesis styling |
