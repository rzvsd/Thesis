# HANDOFF-H (PR-4a, WP-H: compose-bom 2025.04.00 and harness to CMP 1.7.3)

Changes WP-H needs or recommends in files it does not own, for the PR-4b owner. None blocks PR-4a: every item below
compiles and behaves the same on 1.7 (warnings only), is a comment that still describes the 1.6 / M3 1.2 state, or is
an optional PR-4b upgrade. Paths are relative to `apps/mobile/android/app/src/main/java/com/thesis/mobile/`; line
numbers are at the PR-4a head. The PR-4a note is `PR4A-BOM.md` next to this file.

| File | Change | Reason |
|---|---|---|
| `ui/components/Inputs.kt` (230, 296), `ui/screens/AuthScreen.kt` (322, 372, 409), `ui/screens/DeleteAccountControl.kt` (124), `ui/screens/HistoryScreen.kt` (237), `ui/screens/PasswordResetContent.kt` (145, 158), `ui/screens/SettingsScreen.kt` (674) | `KeyboardOptions(autoCorrect = …)` → `KeyboardOptions(autoCorrectEnabled = …)` | Foundation 1.7 deprecates the old constructor (WARNING level; it maps to the new parameter, so behaviour is unchanged). Clean-up for PR-4b. |
| `ui/screens/NamesScreen.kt` (1297) | `Modifier.animateItemPlacement(ThesisMotion.spatial())` → `Modifier.animateItem(fadeInSpec = null, placementSpec = ThesisMotion.spatial(), fadeOutSpec = null)` | Deprecated (WARNING) in 1.7; kept as is in PR-4a so the bump changes no motion (spec 6.4 lists `animateItem` as a PR-4b option). |
| `ui/motion/DismissibleItem.kt` (KDoc at 24) | "`animateItemPlacement` (Compose 1.6) moves the survivors but does not animate the removed item" → name `animateItem` (Compose 1.7), and say whether its `fadeOutSpec` now covers the removal once NamesScreen moves to it | Comment only, still true on 1.7 for `animateItemPlacement`; it becomes stale with the NamesScreen change above. |
| `ui/components/Inputs.kt` (KDoc at 126) | "M3 1.2 cuts the floating label's gap" → "M3 1.2 and 1.3 cut …"; note that the label's top padding (`Kit.fieldLabelOverhang`) is 8 sp since M3 1.3 (8 dp in 1.2) | Comment only. The behaviour fix is in `ui/theme/KitTokens.kt` (`Kit.fieldLabelOverhang` is now 8.sp, read with `toPx()` unchanged). |
| `ui/components/Overlays.kt` (KDoc at 90), `ui/screens/report/ReportPanels.kt` (81) | Overlays: "On M3 1.2 a ThesisSheet is a separate window with unreliable IME insets"; ReportPanels: "no text fields inside a sheet on M3 1.2". The app is on M3 1.3 after PR-4a: re-check on a device, then reword (or move the text fields into the sheet) | M3 1.3 sheets take `contentWindowInsets` and handle IME better; if a device pass confirms it, text fields may move into `ThesisSheet` (spec 6.4 optional). |
| `ui/screens/AuthScreen.kt` (418) | Nothing for 1.7; plan the move from `AutofillNode`/`LocalAutofillTree` to `Modifier.semantics { contentType = … }` before Compose 1.8 | The old autofill API still works on 1.7.8; it is deprecated in 1.8. |
