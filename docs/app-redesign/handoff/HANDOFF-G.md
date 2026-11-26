# HANDOFF-G (WP-G Account and entry): changes needed outside WP-G's files

Each item: file, change, reason.

## WP-INT (hot spots)

1. `ui/MainViewModel.kt` (+ `UiState`): publish the Auth result as a typed `AuthStatus` (`ui/screens/AuthStatus.kt`)
   instead of plain `message` strings, and pass it to `AuthScreen(status = ...)`. Reason: the screen must not infer
   tone or mode from message wording; `AuthStatus.fromMessage` is a stopgap keyed on the current sentences and goes
   once the VM publishes the type.
2. `ui/ThesisApp.kt`: drop the `PreLoginInsets` (safeDrawing padding) around Onboarding, Auth and Password reset.
   Reason: each screen now owns its insets (consumption-aware `windowInsetsTopHeight/BottomHeight`), so the HeroBand
   can run under the status bar (2.7 HeroBand rule). With the wrapper kept they still lay out correctly, only the
   band stops at the status bar.
3. `ui/shell/ThesisShell.kt` + `ui/shell/ShellDestinations.kt`: route `state.paywallFeature` to
   `Destination.Paywall` on the modal stack (5.23) and delete the `if (paywallOpen) PaywallScreen(...)` branch; in
   `ShellDestinations`, pass `padding = padding` and `apiBaseUrl = state.apiBaseUrl` to `PaywallScreen`. Reason:
   the paywall is no longer a `Dialog`; drawn inline it covers the shell (opaque, takes every touch, own back bar),
   but only the modal stack gives it the 4.5 rise and the reduced-motion path. With `padding` set the screen drops
   its own bar and the HeroBand sits under the frame's bar. Interim (while the inline branch stays): the standalone
   paywall now rises in (fade + `ModalOffset`, `Enter`) and is a traversal group with a pane title, but TalkBack can
   still reach the shell under it; if the branch has to stay longer, give the shell content
   `Modifier.clearAndSetSemantics {}` while `paywallOpen`.
4. `ui/MainViewModel.kt` `requestFeatureUpgrade`: stop posting "Upgrade to Pro to use this feature." when the
   paywall opens. Reason: the paywall itself is the explanation; the snackbar duplicates it.
5. **Merge-blocking for WP-INT.** `ui/shell/ShellDestinations.kt` (`Destination.You` -> `SettingsScreen`): pass the new parameters:
   `notes = state.allNotes`, `onLoadNotes = mainViewModel::allNotes`,
   `onExportNotes = { name, md -> platform.shareOrSave(name, md) }` (system share sheet or `CreateDocument("text/markdown")`),
   `onImportHoldings = <open WP-B's HoldingsCsvImport panel>`. Reason: You > Your notes and Portfolio (5.22); rows
   stay hidden or read-only while these are not passed, so "Export my notes" and "Import holdings" cannot be
   reached in the shipped app until this lands. Once it does, render You with the section visible to confirm, and
   the Onboarding privacy lede may again say the notes can be exported from You (it no longer promises that, see
   the checklist notes).
6. `ui/shell/ShellDestinations.kt`: `SettingsScreen` no longer uses `subscriptionOffers`, `onRefreshOffers`,
   `onStartPurchase`, `canStartPurchase` (plans are chosen on the Paywall that "See Pro" opens). They are kept for
   source compatibility; remove them from the call and then from the signature in one change.

## WP-K (kit, frozen for WP-G)

7. `ui/components/Bars.kt` `ThesisTopBar`: add a navigation-icon option (Back or Close). Reason: 5.23 asks for a
   close glyph top-left on the Paywall (and modal sheets generally); WP-G uses Back meanwhile.
8. `ui/components/PlasmaOrb.kt`: delete once WP-C's `DeepDiveLoadingScreen` stops using it. Reason: WP-G removed the
   onboarding use (the WP-G acceptance item "PlasmaOrb deleted"); the file is kit-owned and still referenced by WP-C.
9. `ui/motion/Motion.kt`: add a named cascade step token (60 ms) for staggered entrances of a few elements.
    Reason: Onboarding uses `ThesisMotion.CrossfadeDelay` (also 60 ms) as its step for now.
10. `ui/format/Fmt.kt`: add `dateTime(instant)` ("14:30, 26 Nov") using Fmt's own zone. Reason: You's quiet-until
    caption combines `time()` and `shortDate()` and has to take the zone from `ZoneId.systemDefault()`.

15. `ui/components/Chips.kt` `SegmentedControl`: let a label that does not fit its segment wrap to two lines (or
    report the overflow) instead of cutting it at the pill edge (`maxLines = 1`). Reason: A4, 2.0x on 360 dp cut
    "Create account" to "Create" on Auth. WP-G measures first (`ui/screens/SegmentFit.kt` `segmentLabelsFit`) and
    falls back to "Sign up" on Auth and to a switch for Up and down colours; both can go once the kit handles it.
16. `ui/components/Rows.kt`: one title weight for the rows that share a RowGroup. `ActionRow` titles are `rowTitle`
    (SemiBold) while `DataRow` and `ToggleRow` labels are `body` (Regular), so You > Appearance, Subscription and
    Help and legal mix bold and regular titles in one card. WP-G's own `LabelledControl` now uses the ToggleRow
    styles (`body`, sub `bodySmall`); align ActionRow (or the other two) so the card reads as one anatomy
    ("System notification settings" against "Allow notifications"; "Manage subscription" against "Deep Dives
    today"). Round 4 adds two `Rows.kt` points seen at 2.0x on 360 dp: `DataRow` needs a label minimum width or a
    stacked layout (label over value) at large scales ("Deep Dives today" wraps one word per line beside "7 of 10
    left"), and `ActionRow`'s leading/trailing icon should centre on the title's first line, not on the whole
    title + caption block.
17. `ui/format/Fmt.kt`: expose the injected zone and today (`val zone`, `fun today()`), or add item 10's
    `dateTime(instant)` plus a `today()`. Reason: Fmt's clock and zone are private, so You takes its own
    `clock: Clock` parameter (default `Clock.systemDefaultZone()`, fixed in renders and tests) for the notes export
    date, the quiet-until check and the billing period date. With these on Fmt the parameter can go.
18. `ui/components/LegalLinks.kt` (touched by WP-G for 5.3): it no longer imports `ui.copy.AccountCopy`; the link
    labels are parameters with defaults local to the file. The lead words, "and" and the two links now share one
    `FlowRow` (words spaced by the measured width of a space), so the Auth sentence wraps as one sentence instead of
    always breaking after "the"; the lead is `bodySmall` ink2 like "and". Round 3: each link reports only its text's
    height to the flow and centres its 48 dp touch box on that line (a `layout` modifier), so every line has the pitch
    of running text; the lead is one semantics node (the whole sentence on its first word, the other words
    `clearAndSetSemantics {}`) and `traversalIndex` 0-3 orders lead, Terms, "and", Privacy. A kit way to extend a
    touch area without growing the layout would replace the modifier. Please review it as a kit change.

21. `ui/components/Overlays.kt` `ThesisDialogContent`: put the title, `body` and `content` in a
    `Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()))`, so `DialogActions` stay pinned
    and visible whatever the content. Reason: A4. At 2.0x on 360 dp the delete-account dialog filled the window and
    pushed "Delete permanently" and "Cancel" off-screen (the same on short phones at 1.3x, or with the keyboard
    open). WP-G now draws the delete body inside its own weighted, scrolling content column (body passed as content,
    not `body`) with a fade at its foot while more is below, and keeps the DELETE field outside it, pinned with the
    actions; `AccountSemanticsTest` checks field and actions inside a 360 x 640 dp window at 2.0x. Once the kit
    scrolls, WP-G can pass `body` again. Also: a tall dialog card runs from the window's top edge to its bottom
    edge; `ThesisDialog` could keep a vertical margin (for example `ThesisSpace.xxl` plus the system bars) so the
    card always reads as floating.
22. `ui/components/HeroBand.kt`: a `bottomRule: Boolean = true` option. Reason: the full-screen Onboarding band has
    no page below, so its gold bottom rule lay along the screen's bottom edge, under the gesture bar. WP-G makes the
    band one rule width taller than the screen (a `layout` modifier, with matching bottom padding) so the rule is
    drawn off-screen; with the option that can go.
23. `ui/components/Rows.kt` `ActionRow`: an `enabled` (and ideally `loading`) parameter: muted title and caption,
    `disabled()` semantics, no press. Reason: You > Subscription's Restore purchases and Refresh plan status must
    stand down while a store action runs. WP-G's `BusyAwareActionRow` re-provides a muted palette, adds `disabled()`
    and a "Waiting for the request in progress" caption, and ignores the tap; it goes once the kit row has the flag.
24. `ui/components/Bars.kt` `RunBar`: an opaque (or blurred) background option, or a fade of the page into the bar.
    Reason: on the Paywall the plan cards' borders and prices show through the 92% bar right behind "Continue". WP-G
    also moved the example alert below the plans, so the Yearly price is on the first screen at 412 x 915 dp.
25. `ui/components/Headers.kt` (`ScreenHeader` deck): consider `bodySmall` for the deck at large font scales, or a
    middle ellipsis for an email that does not fit. Reason: at 2.0x on 360 dp You's email deck wraps at ".com".
    Acceptable as it is; optional.

## WP-INT (hot spots), continued

19. `ShellDestinations` (`Destination.You`): pass the shell's clock to `SettingsScreen(clock = ...)` if the shell
    holds one (the same one `LocalFmt` is built from); the default is the system clock.
20. Paywall offers: the screen now ends the skeletons after `PAYWALL_OFFERS_WAIT_MILLIS` (10 s) with an error
    banner and "Try again" (`onRefreshOffers`). A typed offers error from the ViewModel would let it say so at
    once instead of waiting; optional.

## PR checklist notes (open items and deliberate deviations)

- Onboarding cascade (5.2): eyebrow, title, lede at 0 / 60 / 120 ms as specified; the product fragment above the
  eyebrow enters with it (step 0).
- Verify step (5.3): a free-text `ThesisTextField`, not the 6-digit `NumberField`: the API's `verification_token`
  is not guaranteed to be six digits. No "Send a new code" (no resend endpoint, item 13); "Use another email"
  stands in. Switch to NumberField once the API confirms a 6-digit code.
- Paywall close glyph (5.23): Back arrow until item 7 lands.
- Paywall benefit checks (5.23): 16 dp (`ThesisSpace.iconS`), ink2, as specified (round 4; was 20 dp).
- Pulse page fragment (5.2 "a real morning line in heroLine with its eyebrow"): the morning line is labelled with a
  plain caption ("The morning line"), not the kit `Eyebrow`, so the page's own ruled eyebrow ("Pulse") stays the
  only kicker on the page (V3). Deliberate deviation; switch to `Eyebrow` if the spec owner wants the literal one.
- Onboarding cover (5.2): the 64 dp T mark is anchored to the title block, `ThesisSpace.xxl` above the eyebrow
  (round 4), instead of floating in the free height; the product fragments on pages 2 to 4 still float 4 : 1.
- Onboarding privacy lede: "Decisions stay with you, and the notes you write are private to your account." It no
  longer says the notes can be exported from You, because that row is hidden until item 5 is wired.
- Auth status (5.3, "typed status enum, no substring guessing"): `AuthStatus.fromMessage` is the stopgap until
  item 1 lands; then pass `status=` and delete `fromMessage`.
- "PlasmaOrb deleted": only partly met; the file stays until WP-C's DeepDiveLoadingScreen stops using it (item 8).
  Close this checklist item when WP-C/WP-K delete the file.
- Feedback: the subscription feedback row shows for every tier again, as before the redesign (Pro: "Thinking of
  cancelling?" with Cancel / Downgrade; Free: "Not on Pro yet?", reasons and note, source surface
  `settings_subscription_free`, no win-back prompt). Help and legal has no general feedback row until item 14
  exists.
- Log out (5.22 asks for a TertiaryButton): an `ActionRow` with the sign-out icon in its own card, so it shares the
  text edge and anatomy of every other You action and the Delete account button below it; a TertiaryButton's label
  would sit inset from the text edge. Title weight follows item 16.
- Your notes and Portfolio stay hidden in the app until WP-INT wires item 5 (without `onExportNotes` the notes are
  not passed either, so "None yet" would be wrong for a user who has notes).
- Notification family labels come from `AccountCopy.notificationFamily` (sentence case). `Phase4Copy` keeps its
  Title Case labels because `Phase4CopyTest` pins them; the spec's pointer to Phase4Copy is met in wording only.

## WP-C / other owners

11. `ui/screens/ConvictionIntelligenceCards.kt`: `MonthlyCoherenceSection` has no caller now (You draws the monthly
    review natively); the owner can delete it.
12. `res/mipmap-*/ic_launcher*.png` (5 densities): no longer referenced by the adaptive icon (minSdk 26 always uses
    `mipmap-anydpi-v26`); delete them in a resource clean-up (outside WP-G's `res/drawable/ic_launcher_*`).

## API / product (not code in this repo's app)

13. Verify step "Send a new code": there is no resend-verification endpoint; the verify step offers "Use another
    email" only. Add `POST /auth/resend-verification` and a VM call, then a TertiaryButton in `AuthScreen`.
14. A general feedback channel for You > Help and legal ("feedback" in 5.22): only the subscription cancellation
    feedback exists (`onSubmitSubscriptionFeedback`, codes `cancel_*` only, and the VM tracks it as a cancel or
    downgrade reason); it lives under Subscription for every tier. A general code (or endpoint) and VM call would let
    Help and legal offer "Send feedback".

## Note

- `res/values/splash.xml`: WP-G swapped `windowSplashScreenAnimatedIcon` to `@drawable/ic_mark_t` as the carried
  item in DESIGN-DIRECTION section 8 assigns ("WP-G: the splash windowSplashScreenAnimatedIcon ... swap to the vector
  T mark"); one line, nothing else in the file changed.
