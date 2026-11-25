package com.thesis.mobile.ui.motion

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.VisibilityThreshold
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.ui.unit.IntSize

/*
 * Content and navigation transitions (docs/app-redesign/DESIGN-DIRECTION.md 4.4, 4.5, 4.8). The shell's push / pop
 * and the kit build their AnimatedContent transitions from these, so every value comes from ThesisMotion and the
 * reduced-motion path is the same everywhere: a 150 ms crossfade with no travel and no scale.
 *
 * Depth runs along X (the predictive-back axis); vertical travel is for modal destinations only.
 */
object ThesisTransitions {

    // ---- Shared axis X (push / pop within a tab, Auth <-> Password reset) -------------------------------------

    /**
     * Shared-axis X push ([forward] = true) or pop, in sequence within `Screen` (300 ms, 4.5): the old screen slides
     * 24 dp away and fades out first (`TabOut` 90 ms, `EaseExit`), then the new one slides in 24 dp from the leading
     * side and fades in (`TabIn` 210 ms after 90, `EaseEnter`). The new screen is drawn over the old one but stays
     * transparent until the old one has gone, so the two never double-expose (4.5 "nothing double-exposes") and the
     * old screen's exit, or a predictive back's .90 preview, is seen to its end. Pop mirrors it. [shiftPx] is
     * [ThesisMotion.PushOffset] in px. Reduced motion: 150 ms crossfade. The shell's push and pop and
     * Auth <-> Password reset all use this one spec.
     */
    fun sharedAxisX(forward: Boolean, reduced: Boolean, shiftPx: Int): ContentTransform =
        if (reduced) reducedCrossfade() else sharedAxisXEnter(forward, shiftPx) togetherWith sharedAxisXExit(forward, shiftPx)

    /** The incoming half of [sharedAxisX]: 210 ms `EaseEnter`, after the outgoing half's 90 ms. */
    fun sharedAxisXEnter(forward: Boolean, shiftPx: Int): EnterTransition {
        val direction = if (forward) 1 else -1
        return slideInHorizontally(sharedAxisInSpec()) { direction * shiftPx } + fadeIn(sharedAxisInSpec())
    }

    /** The outgoing half of [sharedAxisX]: 90 ms `EaseExit`. */
    fun sharedAxisXExit(forward: Boolean, shiftPx: Int): ExitTransition {
        val direction = if (forward) 1 else -1
        return slideOutHorizontally(sharedAxisOutSpec()) { -direction * shiftPx } + fadeOut(sharedAxisOutSpec())
    }

    /** How long the incoming half of [sharedAxisX] waits: the outgoing half's whole exit (`TabOut`, 90 ms). */
    const val SharedAxisInDelay: Int = ThesisMotion.TabOut

    /** How long the incoming half of [sharedAxisX] runs once it starts (`TabIn`, 210 ms): 300 ms in all. */
    const val SharedAxisIn: Int = ThesisMotion.TabIn

    /** [sharedAxisX]'s incoming timing (also the shell's report-layer uncover). */
    fun <T> sharedAxisInSpec(): FiniteAnimationSpec<T> =
        tween(SharedAxisIn, delayMillis = SharedAxisInDelay, easing = ThesisMotion.EaseEnter)

    /** [sharedAxisX]'s outgoing timing. */
    fun <T> sharedAxisOutSpec(): FiniteAnimationSpec<T> = tween(SharedAxisInDelay, easing = ThesisMotion.EaseExit)

    // Tabs and modal destinations (4.5) have no kit spec: the shell owns them (ui/shell/ShellMotion.kt: the tab
    // fade-through, which scales the page but never the glow (4.3.4), and the modal rise/fall, which covers the
    // page instead of double-exposing it). Build those transitions there, not from a second copy here.

    // ---- Content states (#27, 4.4) ----------------------------------------------------------------------------

    /**
     * `StateCrossfade` between Loadable kinds: fade out `Quick` (`EaseExit`), fade in `Base` after 60 ms
     * (`EaseStandard`), the size change on the `spatial` spring. Reduced motion: 150 ms crossfade, size snaps.
     */
    fun stateCrossfade(reduced: Boolean): ContentTransform =
        if (reduced) {
            ContentTransform(
                fadeIn(quickLinear()),
                fadeOut(quickLinear()),
                sizeTransform = SizeTransform { _, _ -> snap() },
            )
        } else {
            ContentTransform(
                fadeIn(tween(ThesisMotion.Base, ThesisMotion.CrossfadeDelay, ThesisMotion.EaseStandard)),
                fadeOut(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit)),
                sizeTransform = SizeTransform { _, _ -> ThesisMotion.spatial(IntSize.VisibilityThreshold) },
            )
        }

    /**
     * A non-numeric text swap (stage labels, status lines): the incoming text fades in over `Base` after 60 ms while
     * rising [risePx] ([ThesisMotion.EnterOffset]); the outgoing one fades out over `Quick`. No blur, no scale.
     * Reduced motion: 150 ms crossfade.
     */
    fun textSwap(reduced: Boolean, risePx: Int): ContentTransform =
        if (reduced) {
            reducedCrossfade()
        } else {
            (fadeIn(tween(ThesisMotion.Base, ThesisMotion.CrossfadeDelay, ThesisMotion.EaseStandard)) +
                slideInVertically(tween(ThesisMotion.Base, easing = ThesisMotion.EaseStandard)) { risePx }) togetherWith
                fadeOut(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit))
        }

    /** A value swap that must not move (market values, tape items, 4.6): a `Base` crossfade (`EaseStandard`). */
    fun valueCrossfade(reduced: Boolean): ContentTransform =
        if (reduced) reducedCrossfade() else fadeIn(ThesisMotion.base()) togetherWith fadeOut(ThesisMotion.base())

    /** The reduced-motion replacement for every transition: a 150 ms crossfade (4.8). */
    fun reducedCrossfade(): ContentTransform =
        fadeIn(quickLinear()) togetherWith fadeOut(quickLinear())

    private fun quickLinear(): FiniteAnimationSpec<Float> = tween(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)
}
