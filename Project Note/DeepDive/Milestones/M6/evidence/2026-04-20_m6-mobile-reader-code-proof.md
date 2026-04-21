# M6 Mobile Reader Code Proof

**Date:** 2026-04-20  
**Milestone:** Deep Dive Revamp M6 - Mobile Research Reader  
**Status:** Active

## What Was Implemented

- Android models now read the richer Deep Dive artifact fields:
  - `investment_memo`
  - `financial_analysis`
  - `value_discipline`
  - `kill_switch_conditions`
- `ReportViewMapper` now parses those blocks into typed mobile views.
- `OfflineJsonCodec` now preserves those blocks for offline reopen.
- Deep Dive mobile rendering now follows a structured reader path when the new artifact exists:
  - Hero verdict
  - Read This First
  - Executive Memo
  - Financial Quality
  - Value Discipline
  - Valuation
  - Risks And Kill Switches
  - Evidence And Appendix
  - Proof accordions / notes / scenario / feedback / export
- Legacy reports still fall back to the prior `See The Story` / `Understand It` reader path.

## Files Touched

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/ReportViewMapper.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/DeepDiveReaderOutline.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/offline/OfflineJsonCodec.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/copy/DeepDiveCopy.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDivePresentationCards.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt`
- `apps/mobile/android/app/src/test/java/com/thesis/mobile/model/ReportViewMapperTest.kt`
- `apps/mobile/android/app/src/test/java/com/thesis/mobile/model/DeepDiveReaderOutlineTest.kt`
- `apps/mobile/android/app/src/test/java/com/thesis/mobile/offline/OfflineJsonCodecTest.kt`

## Commands Run

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
./gradlew.bat testDebugUnitTest
./gradlew.bat lintDebug
```

## Results

- `testDebugUnitTest`: Passed
- `lintDebug`: Passed

## What Is Proven

- Structured report fields are deserialized on Android.
- Offline cache retains the new Deep Dive reader fields.
- Legacy fallback remains covered by unit tests.
- Mobile reader order is implemented in code to match the Deep Dive report template.

## What Is Not Yet Proven Here

- Physical-device render proof
- Login -> Research -> Deep Dive device smoke
- History reopen and offline reopen on a real device
- Maestro screenshots / physical screenshots

## Blocker / Environment Note

- `adb` was not showing any connected device from this shell during this verification pass.
- M6 therefore remains **Active**, not closed, until device smoke evidence is captured.
