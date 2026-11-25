# HANDOFF — WP M1 (Motion kit), PR-2

M1 owns `ui/motion/**` and `ui/animations/**` only. Everything below lives in files other WPs own. Each item gives
the file, the change and the reason. The APIs named are in `ui/motion` on branch `wp/pr2-M1`. This file is
committed with the branch; the integrator also pastes it into the PR description (6.0 rule 1).

## Kit (`ui/components/**`; owner: F2 now, WP-K in PR-3)

1. **`components/Loading.kt` `LoadingHairline`**
   - Change: replace the private `rememberInfiniteTransition` + hard-edged `drawRect` with
     `val phase = rememberHairlinePhase(active)` and `drawTravellingHighlight(phase.value, hairlineHighlight(p))`
     inside the existing `drawBehind`, after `drawRect(p.line)`.
   - Reason: one loop implementation (4.3 rule 10). The highlight gets soft edges, matching the reference
     `linear-gradient(transparent, gold, transparent)`. Under reduced motion it is static through the shared phase.
     It is also the line `ThesisPullRefresh` (behind the kit's `ThesisRefreshBox`) uses, so the two look the same.
2. **`components/Loading.kt` `LiveDot`**
   - Change: `val pulse = rememberLivePulse()` in place of the local infinite transition.
   - Reason: same values (`LivePulse`, `EaseInOut`, reverse; static under reduced motion) from one place.
3. **`components/Loading.kt` `SkeletonBlock`**
   - Change: `Box(modifier.clip(ThesisShape.badge).background(fill).shimmerSweep())`.
   - Reason: 3 #25 shimmer. Without a `ShimmerHost` above, or under reduced motion, `shimmerSweep` draws nothing,
     so this is safe to land before screens adopt it. Screens wrap their loading state in `ShimmerHost { }`, once
     per screen. They decide whether to show a skeleton with `rememberShowSkeleton(loading)` (300 ms grace,
     400 ms minimum).
4. **`components/State.kt` `StateCrossfade`**
   - Change: `transitionSpec = { ThesisTransitions.stateCrossfade(reduced) }` (keep `contentKey = { it.kind }`).
   - Reason: same values as now, but under reduced motion 4.8 asks for a 150 ms crossfade rather than an instant
     swap ("no information lost"). It also keeps one source for the spec.
5. **`components/State.kt` `ThesisRefreshBox` / `RefreshArc`**
   - Change: delegate the kit `ThesisRefreshBox` to `com.thesis.mobile.ui.motion.ThesisPullRefresh` (same first five
     parameters, plus `refreshLabel` / `refreshingLabel` for copy). The kit function stays the single public entry
     point that screens call; the motion one has its own name, so a screen that star-imports both packages never
     hits an ambiguity. Then deprecate `RefreshArc`, or delete it once
     it has no callers.
   - Reason: the PR-2 M1 brief asks for a travelling-hairline refresh indicator, not a spinner. The motion version
     also adds a TalkBack "Refresh" custom action, a polite live region for "Refreshing", and content that follows
     the pull.
   - Spec owner: section 3 #34 and the 4.4 "Pull to refresh" row still describe the arc. Please update them to
     match: the line grows from the centre with the pull, turns `accent` when armed, and while refreshing the
     `HairlineLoop` highlight travels across a 16 dp gap.
6. **`components/Chips.kt` `SegmentedControl`**
   - Change: `val position by animateIndicatorPosition(selectedIndex)` in place of `animateFloatAsState(...)`.
   - Reason: same `spatial` glide. It is final on first paint and snaps under reduced motion without the
     `timed(true, 0)` workaround.
   - `ChapterPills` needs no kit change. Screens drive it with
     `val spy = rememberScrollSpy(listState, chapterStarts); ChapterPills(titles, spy.selected, spy::jumpTo)`.
7. **`components/Story.kt` `StageProgress` / `StageRing` / `StageLine`**
   - Change in `StageRing`: `val drawn by rememberDrawOn(status == StageStatus.Done)`. Fill
     `drawCircle(p.accent, r * drawn)` over the ring, and draw the check with `PathMeasure.getSegment(0, len * drawn)`.
     The pattern is in `MotionRenders.stage`.
   - Change on the ring `Box`: `Modifier.rewardPulse(trigger = status, enabled = isLastStage && status == Done)`.
   - Change in the label `AnimatedContent`: `transitionSpec = { ThesisTransitions.textSwap(reduced, risePx) }`.
   - Reason: 3 #33 "completion: reward pulse" and 4.4 text swap. Both are final on first paint and static under
     reduced motion.

## Shell (`ui/shell/**`, `ui/navigation/**`; owner: WP-INT / M3)

8. **`AppNavigator`**
   - Change: hold one `EntranceRegistry`. Call `retainOnly(allLiveEntryIds)` after every pop, `replaceTop` and
     deep-link stack replacement. Persist it through `saveState()` / `restoreState()` next to the encoded stacks in
     `SavedStateHandle` (an `ArrayList<String>`).
   - Reason: 4.3 rule 2. The seen-set must outlive the screen (tab return, recreation) and die with the entry.
9. **`ThesisShell`, per entry**
   - Change: `ProvideEntranceScope(navigator.entranceRegistry, entry.entryId) { screen() }`.
   - Reason: scopes the entrances to the entry. Without it, every screen shares the process-wide default scope
     `"app"`. That default still never replays, but two entries of the same screen would share a seen-set.
10. **`ThesisShell` transitions**
    - Change: build the `AnimatedContent` specs from `ThesisTransitions.sharedAxisX(forward, reduced, PushOffset px)`,
      `fadeThrough(reduced)` and `modalRise(open, reduced, ModalOffset px)`.
    - Change: use `ContainerTransformHost` (or `containerReveal` + `predictiveBackPreview` directly) for
      list → detail. Rows mark their bounds with `Modifier.captureBounds(rememberBoundsCapture())`.
    - Known trade-off with the 4.5 values: the outgoing screen fades with `EaseExit`, which holds early, while the
      incoming one fades with `EaseEnter`, which is fast early. So the two screens' text overlaps for about the
      first 80 ms of a push (visible in `kit-motion-push-t060`). If that reads as ghosting on the phone APK, the
      fix is a spec change: start the incoming fade about 60 ms later (`CrossfadeDelay`), or end the outgoing fade
      before the incoming one passes about 30% as Material shared axis does. The round-1 reviewers confirmed the
      overlap. **Spec owner decision**: update 4.5 and `ThesisTransitions.sharedAxisXEnter` together. M1 keeps the
      spec values until then.

## Screens (PR-3 WPs)

11. **`screens/DeepDiveScreen.kt` (WP-D)**
    - Change: remove the nine `StaggeredEntrance(index = n)` wrappers.
    - Reason: pushed screens arrive whole (4.3 rule 2). The wrapper is now deprecated and plays only once per
      entry, so nothing breaks before then.
12. **`screens/HomeScreen.kt` (WP-A)**
    - Change: replace `AnimatedCounter` with `RollingNumber(value, Fmt…, style)`.
    - Change: wrap Home's first 8 blocks with `Modifier.staggeredEntrance(key, rememberEntranceCoordinator(pulseIssueId))`.
      Do the same on Pulse.
    - Reason: 4.6. `AnimatedCounter` is now a deprecated, final-on-first-paint wrapper over `RollingNumber`.
13. **Rows removed from a `RowGroup` (Inbox quiet/turn off, Names remove; WP-B, WP-F)**
    - Change: use `DismissibleItem(removing, onRemoved, Modifier.rowGroupSegment(position)) { Row… }`, with the
      segment as the modifier and not inside the content, plus `animateItemPlacement(ThesisMotion.spatial())` on
      the survivors.
    - Reason: if the segment sits inside the content, its surface fades with the row and leaves a page-coloured
      gap in the card for about 100 ms.
14. **`components/ConfidenceRing.kt` (kit; F2 now, WP-K in PR-3)**
    - Change: drop the `delay(800L)` + `Animatable` text fade and `Modifier.alpha(textAlpha.value)`. Where the ring
      shows a frozen report figure, make it final on first paint (4.6: frozen report figures never animate). If a
      live use needs a reveal, draw the ring with `rememberDrawOn(...)` and read any alpha inside `graphicsLayer`.
    - Reason: it replays on every composition, uses a raw `delay` and `FastOutSlowInEasing` (not `ThesisMotion`),
      and the M1 criterion forbids animated `Modifier.alpha` in the kit. It predates PR-2 and is outside M1's files.

## Spec owner (`docs/app-redesign/DESIGN-DIRECTION.md`)

15. **3 #34 and the 4.4 "Pull to refresh" row** still describe the 0 -> 300 degree arc and the rotating 90 degree
    arc (`RefreshSpin`). Update them to the travelling hairline (item 5).
16. **4.5 shared axis X** double-exposure (item 10).
17. **`reward`**: `RewardVelocity` is now 1.85, so the `spring(0.8, 380)` pulse peaks at 1.04 (5, "Deep Dive
    ready": 1 -> 1.04 -> 1). The peak comes at about 55 ms: that rise is set by the spring itself (spec 4.2), so it
    reads as a quick pop. If a slower swell is wanted, 4.2 would need a lower stiffness (about 200 puts the peak
    near 75 ms) rather than a different impulse.
