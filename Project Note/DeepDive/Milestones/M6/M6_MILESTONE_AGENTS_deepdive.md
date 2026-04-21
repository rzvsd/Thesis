# M6 AGENTS - Mobile Research Reader

**Milestone:** Deep Dive Revamp M6 - Mobile Research Reader
**Status:** Passed
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Android Engineer + Product Lead |
| Depends on | M1-M5.2 closed |
| Services | `apps/mobile/android`, `qa/maestro` |
| Contracts | Structured report artifact, offline cache fields |

---

## Scope

- [x] Render executive reader from structured artifact
- [x] Render financial quality and value discipline sections
- [x] Render valuation, risks, evidence, PDF entry
- [x] Preserve old report fallback
- [x] Preserve offline cache round trip
- [x] Preserve Thesis visual language
- [x] Follow the mobile reader order in `DEEPDIVE_REPORT_TEMPLATE.md`

## Out Of Scope

- New root navigation
- Decorative charts unsupported by report data
- Replacing PDF artifact with mobile-only rendering

## Required Tests

- Android mapper tests
- Offline cache tests
- UI/unit tests where existing test shape supports it
- Maestro/device smoke
- M6 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [x] Phone reader feels coherent and serious
- [x] Old reports still work
- [x] Offline report opens
- [x] Mobile reader satisfies `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Smoke plan passes

## Implementation Notes

- Added Android model support for `investment_memo`, `financial_analysis`, `value_discipline`, and `kill_switch_conditions`.
- Updated `ReportViewMapper` and `OfflineJsonCodec` so the structured artifact round-trips cleanly.
- Reworked Deep Dive mobile presentation into explicit sections: executive memo, financial quality, value discipline, valuation, risks/kill switches, evidence/appendix.
- Preserved legacy fallback by keeping the older `See The Story` / `Understand It` path for reports without the new structured blocks.
- Added Android unit coverage for mapper, reader outline grouping, and offline round-trip.

## Verification Snapshot

- `testDebugUnitTest` passed locally after setting `JAVA_HOME` to Android Studio JBR for this shell.
- `lintDebug` passed locally.
- Physical-device smoke passed on Samsung `SM-S928B` (`R3CXA03J3LH`) using the local debug build.
- Device proof captured:
  - executive reader and memo flow
  - financial quality section
  - value discipline section
  - valuation and risks section
  - evidence and appendix section
  - proof section handoff
  - export controls (`PDF`, `Card`, `Memo`)
- Device note:
  - the phone's cached live Deep Dive artifact predated the M6 fields, so the debug app's offline cache was seeded with a structured AAPL artifact to verify the real rendered reader path honestly on-device.
