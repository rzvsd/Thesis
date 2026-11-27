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
| M | Remove `androidx.compose.material:material` (app) and `material-desktop` (harness) | Both rows gone. No `androidx.compose.material.*` import is left outside `material3`, `material.icons` and `material.ripple`; `RippleAlpha` comes from `material-ripple`, which `material3` 1.3 declares as a dependency (checked in the CMP 1.7.3 module file) and exposes in its own public API (`RippleConfiguration(color, rippleAlpha: RippleAlpha?)`), so it stays on the compile classpath. CI's `:app:compileDebugKotlin` confirms it. |
| M | NotesTrail: animate a note joining the trail | `NotesTrail` remembers the keys it has shown; an entry whose key is new after the first paint is wrapped in `AnimatedVisibility` (`fadeIn(Base, CrossfadeDelay, EaseStandard) + expandVertically(spatial, from top)`; reduced motion: `Quick` fade only). The focused-entry modifier (mark + placement report) sits on the wrapper, outside its clip, so a note hit still reads the entry's own position in the trail. Test: `NotesTrailMotionTest` (first paint never fades; the new entry starts transparent and reaches full while the entries below move down over time; under reduced motion it fades and the trail makes room at once). |
| M | Shim hook for a held predictive gesture | `PreviewBack.gesture(events: Flow<ThesisBackEvent>)` and `PreviewBack.innermostIsPredictive` in `design-preview/src/shim/.../platform/Back.kt`; `BackGestureDriver` uses them (no reflection). The Android `Back.kt` is unchanged. |
| M | Docs: 4.5 table, 4.4 lists, 6 status, HANDOFF-M3, PR3-INTEGRATION | Done (text from HANDOFF-M, plus the notes-trail and lazy-list rows in 4.4). |
| M | Pulse: no page-coloured strip above the hero while pulling | New `onHero` on `ThesisRefreshBox` / `ThesisPullRefresh`: the gap the pull opens at the top is painted `heroBg`, and the hairline takes `heroOf(palette)` (in light the `line`/`ink` line was dark on the navy). Pulse passes `onHero = true`. Under reduced motion the content does not move, so there is no gap to paint. `SentimentDashboardScreen` has no HeroBand (its gap is page over page), so it keeps the default. |

## Not done (recorded for later)

- **K, CompareNames' blank column at 412 dp** (cosmetic, "follow-up" in HANDOFF-K): needs either HANDOFF-E 32's
  column footer slot or a fit rule that narrows a column with no figures to its longest header word. Every column
  and the median are in view at 412 dp today.
- **K, report notes anchor**: needs a `Destination.Report` notes anchor that only the report host (WP-C) can honour.
- **M, delete `ContainerTransformHost`** (optional cleanup): kept with its gallery render and behaviour test.
- **Sheet IME** (HANDOFF-H): waits for the device pass.
- **Inbox placement**: Inbox keeps `placement = false` (fades, no glide) by design, now written into 4.4.

## Device pass (CI and a phone only)

`./gradlew :app:compileDebugKotlin` and `:app:testDebugUnitTest` must run in CI: the Material 2 removal touches
`app/build.gradle.kts`, and no Android-only file changed in this PR (`ThesisApp`, `MainViewModel`, `ui/platform/*`
are as in PR-4a). Then, on a phone (from HANDOFF-M, the first item is a **gate**):

1. **Gate, report WebView in the transform.** History/Research row → report and back into the row (also a held back
   gesture, then commit): no flash, blank or stale WebView frame; the WebView survives (no reload, scroll kept); at
   rest the report and tab layers inside `SharedTransitionLayout` scroll and lay out normally (resize, rotation, IME),
   and frame time on History, Research and the report does not regress against PR-4a. If it fails: move
   `ReportBaseLayer` out of `ShellTransformScope` and drop the report's transform (Name's stays).
2. Seekable back: a held edge swipe on a pushed page shows the page under at ≤ 40%; cancel settles back; commit slides
   the page on top off toward the finger. WebView back inside a report still goes back in the page first.
3. Pull to refresh (M3 1.3): 72 dp arm with one haptic, 16 dp rest gap, TalkBack "Refresh" action; on Pulse the gap
   is navy and the line legible on it.
4. Names / Inbox items fade in and out; Names rows glide on sort.

## Verification (this branch)

See the commit message of the integration commit for the numbers of the final run: design-preview compile (main and
test), the app's unit tests (`-PappTestsOnly`), the renders/semantics/harness half (`-PrendersOnly`, full run),
`tools/design-lint.sh` (at or below baseline) and `tools/gold-share.py` (every render under 8%).
