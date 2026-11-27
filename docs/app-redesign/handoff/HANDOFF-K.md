# HANDOFF-K (PR-4b, WP-K: note-hit exact entry, CompareTable density at 412 dp, drop-cap baseline)

Changes WP-K needs or recommends in files it does not own, plus the edits it made outside `ui/components` and the
Compare/Search/Notes screens (so their owners can review them). Paths are relative to
`apps/mobile/android/app/src/main/java/com/thesis/mobile/`.

| File | Change | Reason |
|---|---|---|
| `ui/navigation/Destination.kt` (WP-INT) | Optional: move `noteEntryAnchor(reportId)` / `noteEntryOf(anchor)` (now `internal` at the end of `ui/shell/ShellDestinations.kt`) into `Destination.Name`'s companion next to `ANCHOR_NOTES` (for example `ANCHOR_NOTE_ENTRY_PREFIX = "notes:"`), and add a `DestinationCodecTest` case for `Name("AAPL", null, "notes:rep-1")`. | The note-hit anchor rides in the existing `anchor` field (`notes:<reportId>`), so the codec and saved stacks needed no change; `NoteHitTest.theAnchorNamesTheEntryAndSurvivesTheSavedStack` already round-trips it through `DestinationCodec`. The helpers belong with the other anchor constants. |
| `ui/shell/ShellDestinations.kt` (WP-INT / WP-M) — **edited by WP-K, route args only** | `SearchEntry.onOpenNote` passes `noteEntryAnchor(reportId)` instead of `ANCHOR_NOTES`; `NameEntry` maps that anchor to `scrollTo = NameAnchor.Notes` plus `noteKey`; the two helpers at the end of the file. No transition or motion code touched. | 5.27 "note → Name scrolled to Your notes at that entry" (PR3-INTEGRATION tracking list item 2). |
| `ui/screens/NameScreen.kt` (WP-B) — **edited by WP-K** | New `noteKey` parameter (default null); the one-shot anchor scroll targets the trail entry's top when the trail holds it (else "Your notes" as before); `NotesSection` passes `focusKey` / `onFocusPlaced` to the kit `NotesTrail`. | Same item; the kit can only report where the entry is, the page owns its scroll and bar. |
| `ui/screens/DeepDivePresentationCards.kt` (WP-D) | Replace `FittingCompareTable`'s hand mirror of the kit's sizing with the kit's own fit: `val needs = rememberCompareTableNeeds(model)` and `with(density) { fitCompareTable(needs, widthPx) }` (`.scrolls`, `.hidden`). | The kit table now fits more before it scrolls (content-sized columns, then 8 dp and 6 dp padding with labels wrapping between words), so the mirror is conservative: it can pick the compact now-and-change shape where the full table now fits. Nothing breaks (anything the mirror says fits, the kit fits). `ResearchTables.kt` already uses the kit fit. |
| `ui/screens/report/**` (WP-C) | A note hit without a ticker still opens the report at its top (unchanged). If the report host grows a "notes" anchor (open the notes DockPanel), Search can pass it the same way. | The spec's "Name (or report) notes": the report side needs a `Destination.Report` notes anchor that only the host can honour. |
| `ui/motion/Motion.kt` (WP-M) | Optional: a `ThesisMotion.MarkHold` token. The notes trail's mark holds `NOTE_MARK_HOLD = ThesisMotion.Screen + ThesisMotion.Draw` (1.2 s) before it fades over `Base`, defined in `ui/components/Notes.kt`. | Every duration comes from `ThesisMotion`; a named hold token would let other one-shot marks share it. |
| `ui/screens/CompareNamesScreen.kt` (WP-K now) + kit | Follow-up: HANDOFF-E 32's column footer slot (`CompareColumn.action`) would let a name with no report say so under its column; today "No report yet" rides as the second line of the column's period header (`"NVDA\nNo report yet"`). In a tight fit the table wraps it ("No report" over "yet") when that leaves fewer rows taller than keeping it whole (a wrapped label costs a row, wrapped headers cost the header row), so the empty column gives its width to the labels; a period line holding a figure never breaks. | Cosmetic; every column and the median are in view at 412 dp. |
| `ui/theme/KitTokens.kt` (WP-K, not touched in PR-4b) | Optional: name the compact densities as tokens (`tableCellPaddingCompactH = 8.dp`, `tableCellPaddingTightH = 6.dp`). | `CompareTable.kt` builds them from `ThesisSpace` (`s`, `xs + xxs`) to keep this WP out of `ui/theme`. |

## Not done here

- `CompareRow.emphasis` / `onRowLabelClick` (HANDOFF-E 36), `CompareColumn.title` / `muted` (HANDOFF-E 29, 31): not
  needed for the 412 dp fit. A tap on a row's label opens the subject column's figure.

## Kit behaviour other WPs may notice (PR-4b round 2)

- `CompareTableModel.labelShown(row)` is the label as drawn: the unit joins with a non-breaking space ("Gross" over
  "margin, %", never "Revenue," over "$bn"). `labelOf` (TSV, TalkBack) is unchanged. `DeepDivePresentationCards`'
  mirror (WP-D row above) still wraps `labelOf`; the kit fit replaces it.
- A wrapped filing line stacks at its separator, which goes ("10-K" over "31 Oct 2025"); it is spoken as one line.
- In a table that scrolls, a column past the end edge shows its header only as its widest line comes into view (a
  draw-phase fade tied to the scroll, from two thirds in view to whole), so no lone first word peeks in.
- A row's touch target takes keyboard / D-pad focus (Enter or centre opens the subject column's source; press tint
  while focused). A tap in the delta or median column opens nothing and shows no press.
