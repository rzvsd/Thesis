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
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.ui.unit.IntSize

/*
 * Content and navigation transitions (docs/app-redesign/DESIGN-DIRECTION.md 4.4, 4.5, 4.8). The shell (WP-INT) and
 * the kit build their AnimatedContent transitions from these, so every value comes from ThesisMotion and the
 * reduced-motion path is the same everywhere: a 150 ms crossfade with no travel and no scale.
 *
 * Depth runs along X (the predictive-back axis); vertical travel is for modal destinations only.
 */
object ThesisTransitions {

    // ---- Shared axis X (push / pop within a tab, Auth <-> Password reset) -------------------------------------

    /**
     * Shared-axis X push ([forward] = true) or pop: the new screen slides in 24 dp from the leading side with a fade
     * over `Screen` (300 ms, `EaseEnter`); the old one slides 24 dp the other way and fades out over 180 ms
     * (`EaseExit`). Pop mirrors it. [shiftPx] is [ThesisMotion.PushOffset] in px. Reduced motion: 150 ms crossfade.
     */
    fun sharedAxisX(forward: Boolean, reduced: Boolean, shiftPx: Int): ContentTransform =
        if (reduced) reducedCrossfade() else sharedAxisXEnter(forward, shiftPx) togetherWith sharedAxisXExit(forward, shiftPx)

    /** The incoming half of [sharedAxisX]. */
    fun sharedAxisXEnter(forward: Boolean, shiftPx: Int): EnterTransition {
        val direction = if (forward) 1 else -1
        return slideInHorizontally(tween(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { direction * shiftPx } +
            fadeIn(tween(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter))
    }

    /** The outgoing half of [sharedAxisX]. */
    fun sharedAxisXExit(forward: Boolean, shiftPx: Int): ExitTransition {
        val direction = if (forward) 1 else -1
        return slideOutHorizontally(tween(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)) { -direction * shiftPx } +
            fadeOut(tween(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit))
    }

    // ---- Tabs and modal destinations (4.5) --------------------------------------------------------------------

    /** Tab fade-through: out 90 ms `EaseExit`; in fade + scale .985 -> 1, 210 ms after 90 ms, `EaseEnter`. */
    fun fadeThrough(reduced: Boolean): ContentTransform {
        if (reduced) return reducedCrossfade()
        val enter = tween<Float>(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)
        return (fadeIn(enter) + scaleIn(enter, initialScale = ThesisMotion.TabScaleFrom)) togetherWith
            fadeOut(tween(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit))
    }

    /**
     * Modal rise (Paywall, You, Search): opening rises [risePx] ([ThesisMotion.ModalOffset]) with a fade over 300 ms;
     * closing sinks back over 240 ms. The screen underneath stays put.
     */
    fun modalRise(open: Boolean, reduced: Boolean, risePx: Int): ContentTransform {
        if (reduced) return reducedCrossfade()
        val transform = if (open) {
            (slideInVertically(tween(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { risePx } +
                fadeIn(tween(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter))) togetherWith
                fadeOut(tween(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit))
        } else {
            fadeIn(tween(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseStandard)) togetherWith
                (slideOutVertically(tween(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit)) { risePx } +
                    fadeOut(tween(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit)))
        }
        // The modal is always the upper layer: above the screen when it opens, still above it while it closes.
        transform.targetContentZIndex = if (open) 1f else -1f
        return transform
    }

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
