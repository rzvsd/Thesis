# PR-4b integration (WP-INT): the optional Compose 1.7 upgrades

Branch `redesign/pr4b` on PR-4a (570aefc). Merged with `--no-ff`: `wp/pr4b-K` (kit and Compare/Search/Notes:
CompareTable fit at 412 dp, a note hit's exact trail entry, the drop cap on `getLineBaseline`), then `wp/pr4b-M`
(shell and motion: `sharedBounds` container transform, seekable predictive back, `animateItem` fades, Material3 1.3
pull to refresh). Paths are relative to `apps/mobile/android/` unless they start with `docs/`. The WP notes are
[`HANDOFF-K.md`](HANDOFF-K.md) and [`HANDOFF-M.md`](HANDOFF-M.md); the spec text is updated in
DESIGN-DIRECTION 4.1 (status), 4.4, 4.5, 5.10 and 6.4.

## Merge

One conflict, `ui/shell/ShellDestinations.kt`, end of file: WP-K's note-entry anchor helpers and WP-M's `RowBounds`
were both appended there. Both kept; the helpers then moved to `Destination.Name` (below). Everything else merged
cleanly and the two WPs' APIs met without change: WP-K's edits in `ShellDestinations.kt` are route arguments only
(`SearchEntry.onOpenNote`, `NameEntry`'s `scrollTo` / `noteKey`), WP-M's are the row-bounds plumbing and the
transform.

## Handoff requests done here

| From | Request | Done |
|---|---|---|
| K | Move `noteEntryAnchor` / `noteEntryOf` next to `ANCHOR_NOTES`, add a codec case | `Destination.Name.ANCHOR_NOTE_ENTRY_PREFIX` (`"notes:"`), `noteEntryAnchor(reportId)`, `noteEntryOf(anchor)` in the companion; `ShellDestinations` and `NoteHitTest` call them there. `DestinationCodecTest`: `Name("AAPL", null, "notes:rep-1")` round-trips, and a new test pins which anchors name an entry. |
| K | `DeepDivePresentationCards.FittingCompareTable`: use the kit's fit, not its hand mirror | `rememberCompareTableNeeds(full)` + `fitCompareTable(needs, widthPx)`: the full table when it fits without scrolling, else the compact one (which the kit fits the same way). The mirror (`TableFit`, ~50 lines) is gone, with its unused imports. |
| K | `ThesisMotion.MarkHold` | `MarkHold = Screen + Draw` (1.2 s) in `ui/motion/Motion.kt`; `Notes.kt`'s private `NOTE_MARK_HOLD` removed. |
| K | Name the compact densities | `Kit.tableCellPaddingCompactH` (8 dp), `Kit.tableCellPaddingTightH` (6 dp); `compareTableDensities()` / `compareTableScrollDensity()` read them (same px as `ThesisSpace.s` / `xs + xxs`). |
| M | Remove `androidx.compose.material:material` (app) and `material-desktop` (harness) | Both rows gone. No `androidx.compose.material.*` import is left outside `material3`, `material.icons` and `material.ripple`; `RippleAlpha` comes from `material-ripple`, which `material3` 1.3 declares as a dependency (checked in the CMP 1.7.3 module file) and exposes in its own public API (`RippleConfiguration(color, rippleAlpha: RippleAlpha?)`), so it stays on the compile classpath (to be confirmed by CI's `:app:compileDebugKotlin`, which has not run on this branch yet). |
| M | NotesTrail: animate a note joining the trail | `NotesTrail` remembers the keys it has shown; an entry whose key is new after the first paint is wrapped in `AnimatedVisibility` (`fadeIn(Base, CrossfadeDelay, EaseStandard) + expandVertically(spatial, from top)`; reduced motion: `Quick` fade only). The focused-entry modifier (mark + placement report) sits on the wrapper, outside its clip, so a note hit still reads the entry's own position in the trail. Test: `NotesTrailMotionTest` (first paint never fades; the new entry starts transparent and reaches full while the entries below move down over time; under reduced motion it fades and the trail makes room at once). |
| M | Shim hook for a held predictive gesture | `PreviewBack.gesture(events: Flow<ThesisBackEvent>)` and `PreviewBack.innermostIsPredictive` in `design-preview/src/shim/.../platform/Back.kt`; `BackGestureDriver` uses them (no reflection). The Android `Back.kt` is unchanged. |
| M | Docs: 4.5 table, 4.4 lists, 6 status, HANDOFF-M3, PR3-INTEGRATION | Done (text from HANDOFF-M, plus the notes-trail and lazy-list rows in 4.4). |
| M | Pulse: no page-coloured strip above the hero while pulling | New `onHero` on `ThesisRefreshBox` / `ThesisPullRefresh`: the gap the pull opens at the top is painted `heroBg`, and the hairline takes `heroOf(palette)` (in light the `line`/`ink` line was dark on the navy). Pulse passes `onHero = true`. Under reduced motion the content does not move, so there is no gap to paint. `SentimentDashboardScreen` has no HeroBand (its gap is page over page), so it keeps the default. |

## Not done (recorded for later)

- **K, report notes anchor**: needs a `Destination.Report` notes anchor that only the report host (WP-C) can honour.
- **M, delete `ContainerTransformHost`** (optional cleanup): kept with its gallery render and behaviour test.
- **Sheet IME** (HANDOFF-H): waits for the device pass.
- **Inbox placement**: Inbox keeps `placement = false` (fades, no glide) by design, now written into 4.4.

## Review round (WP-INT)

| Finding | Done |
|---|---|
| Report closes into its row: content cut in one frame (ShellLayers) | `contentIn` fades out over `ThesisMotion.ReportContentOut` (75 ms, linear) on the way out, over the cover; the way in is unchanged (alpha 0 while the bounds grow). The WebView is in the overlay for those 75 ms only: a device-gate item with a one-constant fallback. `ShellTransformMotionTest` checks a partial alpha, a monotonic fade and no content from 128 ms. |
| `coverTopPx` read `safeDrawing` (IME) in composition for every report | Gone. The cover reads `TopBarInsets` (status bar and cutout, no IME; the bar's own insets) with `getTop(density)` in its `drawBehind`, which only runs while the cover is drawn. |
| CompareNames blank column at 412 dp | After the usual fit, `fitCompareTable` tries, at each density that wraps headers, narrowing every column with no figures at all (`valueWide == 0`: "No report yet", "Couldn't load") to its header's longest word, never under the column floor (48 dp: the headers are sort buttons). That costs two header lines over one-line headers, and it is taken only when it grows strictly fewer taller rows than the usual fit (a first version that tried it inside the density loop let a looser padding win with more wrapped labels; caught in the render). Renders: `research-compare-names-column-failed` (two blank columns) now keeps "Gross margin", "Net cash (debt)" and "Value discipline" on one line, with "No / report / yet" one header line taller. `research-compare-names` (one blank column) is unchanged: the 48 dp floor lets NVDA give up only 13 dp, which saves one label for one header line, a tie. Going further needs the HANDOFF-E 32 footer slot or a narrower floor, which the touch-target rule rules out. `KitModelTest`. |
| Held back seek: the preview's edge cuts glyphs of the page under | The page under a held plain-pop seek clears its content toward the .90 preview's edges (`clearAroundBackPreview`: `DstOut` gradients in the four strips, offscreen only while it runs, eased off over `Quick` on commit or cancel). Its page background is untouched, so no band shows over the glow. |
| Note hit: the entry before ghosts behind the bar's title | A note hit's entry lands `headerToSection` (24 dp) under the bar instead of `headerTop` (8 dp), so the hit has the section rhythm's room under the bar's hairline and the previous entry's last line moves down by 16 dp. Section anchors are unchanged. Partly fixed: at 2.0x the previous entry's lines are taller than the nudge, so one still sits behind the title (`name-note-hit-360-fs200`), and at 412 dp the page is at its end, so nothing moves (`name-note-hit`). Text under the bar shows through its 92% alpha on any scrolled page, so this is left to the bar's design (and the device pass). |
| Handoff claimed CI had confirmed the Material 2 removal | Reworded: to be confirmed by CI. |
| Navigation during a cancelled gesture's settle cut in one frame | `TabSeek.drive`: a `Cancelling` gesture settles only while the navigator is still on the page it was over; otherwise the gesture ends and the layer follows the new target (rewind or run on within 90 ms). `ShellBackGestureTest`: a back and a push 100 ms into the settle both still move 32 ms later (the back case fails on the old code). |
| Page under a held gesture ran its loads | WarRoom, ScenarioStress, CompareReports (and its notes trail) and CompareNames ensure only while they are the tab's top entry, keyed on it, as Pulse, Name and Report already do; they run again when the entry comes back on top, as they did when it was composed afresh before PR-4b. `ShellBackGestureTest`: a cancelled gesture over a War Room asks for nothing; the commit asks once. Names' root `onLoadNotes` (a list refresh, no shared single-slot state) is left as it is. |
| `ItemMotion` KDoc: "first paint never animates" | Corrected: rows replacing Names' skeleton item are new keys and fade in. The skeleton and state items carry no `animateItem`, so they leave in one frame and never overlap the rows (the overlap the finding inferred does not happen: Compose keeps a removed item for a fade only when it has an item animation). |

Verified on this round's head (CMP 1.7.3 harness): `compileKotlin compileTestKotlin` clean; app unit tests 479, 0
failures; every render, semantics and harness test class run with `-Pscreens.only` on the affected renders
(`motion4b`, `research-compare`, `report-compare`, `name-note-hit`), 0 failures, then the Research, Report and Kit
classes again after the CompareTable change; `tools/design-lint.sh` OK, 0 findings. Renders that changed: the held
back seek frames (`motion4b-seek-push-*`, no cut glyph above the preview), `motion4b-seek-report-commit-commit-60ms`
(the report's content fading over its cover, no empty slab), `name-note-hit-360-fs200`, `name-note-hit-newest-mark`
and `research-compare-names-column-failed`. No Android-only file changed.

## Device pass (CI and a phone only)

`./gradlew :app:compileDebugKotlin` and `:app:testDebugUnitTest` must run in CI: the Material 2 removal touches
`app/build.gradle.kts`, and no Android-only file changed in this PR (`ThesisApp`, `MainViewModel`, `ui/platform/*`
are as in PR-4a). Then, on a phone (from HANDOFF-M, the first item is a **gate**):

1. **Gate, report WebView in the transform.** History/Research row → report and back into the row (also a held back
   gesture, then commit): no flash, blank or stale WebView frame; the WebView survives (no reload, scroll kept); at
   rest the report and tab layers inside `SharedTransitionLayout` scroll and lay out normally (resize, rotation, IME),
   and frame time on History, Research and the report does not regress against PR-4a. If it fails: move
   `ReportBaseLayer` out of `ShellTransformScope` and drop the report's transform (Name's stays). Also on the way
   out: the report's content now fades out over the shrink's first 75 ms (`ThesisMotion.ReportContentOut`), drawn
   in the transform overlay for those frames only. If that shows a blank or stale WebView frame, set
   `ReportContentOut` to 0 (the content then leaves in one frame, as before the review round).
2. Seekable back: a held edge swipe on a pushed page shows the page under at ≤ 40%, its content cleared toward the
   preview's edges (no glyph cut by the preview's edge); cancel settles back, and a back or a tap that pushes during
   that settle moves on without a cut; commit slides the page on top off toward the finger. A held then cancelled
   gesture over a War Room, Compare or Scenario page under loads nothing. WebView back inside a report still goes
   back in the page first.
3. Pull to refresh (M3 1.3): 72 dp arm with one haptic, 16 dp rest gap, TalkBack "Refresh" action; on Pulse the gap
   is navy and the line legible on it.
4. Names / Inbox items fade in and out; Names rows glide on sort.

## Verification (this branch)

Run on the integration head with `/opt/gradle/bin/gradle -p design-preview ... --offline` (CMP 1.7.3):

- `compileKotlin compileTestKotlin`: clean.
- App unit tests (`test -PappTestsOnly`): 478 tests, 0 failures, 0 errors.
- Renders, semantics and harness tests (`test -PrendersOnly`, full run, 37 min): 730 tests, 0 failures, 0 errors;
  1262 PNGs (631 screens, dark and light). Looked at: the PR-4b motion frames (container transform open/close at
  412 dp and 360 dp/2.0x, held back at 25%/50% for push, Name and report, cancel and commit, reduced motion), Names
  and Pulse pull to refresh (Pulse's gap is navy with a legible line in both themes), the note-hit renders, Compare
  names/reports at 412/360 dp and 1.3x/2.0x, and contact sheets of Shell, Today, Research, Inbox and Names. No
  regressions against PR-4a.
- `tools/design-lint.sh`: OK, 0 findings in 97 files, none above the baseline.
- `tools/gold-share.py design-preview/build/screens`: 980 renders measured (kit sheets skipped), none over 8%; the
  highest is `account-onboarding-4-names-scale2.0-dark` at 7.62% (unchanged screen).
- Android-only files: none changed in this PR besides `app/build.gradle.kts` (the Material 2 row). Checked that no
  `androidx.compose.material.*` import outside `material3`, `material.icons` and `material.ripple` is left in
  `app/src`, that `ThesisShell`'s signature (the one `ThesisApp` calls) is unchanged, and that `MainViewModel`'s
  `Destination.Name(symbol, pagerScope, anchor)` passes the new `notes:<reportId>` anchor through untouched.
