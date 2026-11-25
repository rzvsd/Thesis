package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisPalette
import kotlin.math.min

/**
 * Motion tokens (docs/app-redesign/DESIGN-DIRECTION.md, section 4.2). The only durations, easings, springs and
 * travel distances the app uses: screens, the shell and the kit read them from here (rubric T5, M2).
 *
 * Quiet motion: damping 1.0 everywhere; the only overshoots are [pressRelease] (~1%) and the one-off [reward].
 * Exits run at about 60% of their entrance. Under reduced motion use [timed] (collapses to `snap()`), and keep
 * the press tint but not the scale (section 4.8).
 */
object ThesisMotion {
    // Durations (ms)
    /** Press-in. */
    const val Press = 90
    /** Colour/selection, icon swaps, exits of small things. */
    const val Quick = 150
    /** Top bar background, hairline and title crossfade when content scrolls under it (section 3, #3). */
    const val Bar = 200
    /** Dialog and snackbar entrance (section 4.4). Their exits use [Quick]. */
    const val Dialog = 220
    /** Crossfades, content state changes, tape refresh. */
    const val Base = 240
    /** Sheet content, panels, first-open lists on Home/Pulse. */
    const val Enter = 320
    /** Push/pop, container transform, tab fade-through total. */
    const val Screen = 300
    /** Container transform out (section 4.5). */
    const val ScreenOut = 240
    /** Outgoing screen of a shared-axis push (section 4.5). */
    const val PushOut = 180
    /** Tab fade-through: outgoing fade, then incoming fade + scale after it (section 4.5). */
    const val TabOut = 90
    const val TabIn = 210
    /** `StateCrossfade`: incoming content waits this long after the outgoing fade starts (section 4.4). */
    const val CrossfadeDelay = 60
    /** `RollingNumber` per digit, plus [RollStagger] per position from the right (capped at [RollStaggerCap]). */
    const val Roll = 360
    const val RollStagger = 18
    const val RollStaggerCap = 4
    /** Chart draw-on. */
    const val Draw = 900
    /** Chart range change. */
    const val Morph = 500
    /** Skeleton sweep and rest. */
    const val ShimmerSweep = 1400
    const val ShimmerRest = 600
    /** `LoadingHairline` loop (linear). */
    const val HairlineLoop = 2250
    /** `LiveDot` (War Room live only), reversing loop. */
    const val LivePulse = 2000
    /** Refreshing arc: one rotation. */
    const val RefreshSpin = 1100
    /** Home and Pulse first open per issue only. */
    const val StaggerStep = 35
    const val StaggerMaxSteps = 8
    /**
     * `EntranceCoordinator`: only items that attach within this long of the coordinator's first entrance frame
     * animate; later ones (scrolled in, paged in) appear at once (playbook section 5).
     */
    const val EntranceWindow = 700L
    /** `rememberShowSkeleton`: a skeleton appears only after this grace (loads faster than it never flash one)... */
    const val SkeletonGrace = 300L
    /** ...and once shown stays at least this long, so it never flickers (section 3, #25). */
    const val SkeletonMinShow = 400L

    // Travel
    /** Entrance rise (sheets, panels, banners, swapped text). */
    val EnterOffset: Dp = 8.dp
    /** Snackbar rise. */
    val SnackbarOffset: Dp = 12.dp
    /** Shared-axis X push/pop. */
    val PushOffset: Dp = 24.dp
    /** Modal destinations only (Paywall, You, Search). */
    val ModalOffset: Dp = 32.dp
    /** Pull to refresh: pull distance (after M2's 0.5 drag resistance) that arms a refresh. */
    val RefreshThreshold: Dp = 72.dp
    /** Pull to refresh: how far the content follows the finger at the arming point. */
    val RefreshTravel: Dp = 40.dp
    /** Pull to refresh: the gap the content keeps open above it while refreshing (the hairline sits in it). */
    val RefreshRest: Dp = 16.dp
    /** Predictive back preview: sideways shift toward the swipe edge at full progress (section 4.5). */
    val BackShift: Dp = 8.dp

    // Shares and ratios
    /** `RollingNumber` edge fade: top and bottom share of the slot faded with a DstIn gradient (section 4.6). */
    const val RollMaskFraction = 0.18f
    /** Container transform: the detail fades in over the last 70% of the reveal (section 4.5). */
    const val TransformContentFrom = 0.30f
    /** Predictive back preview: content scales toward this (section 4.5). */
    const val BackScaleTo = 0.90f
    /** Shimmer: band width as a share of the screen width (one continuous light across all blocks). */
    const val ShimmerBandFraction = 0.45f
    /** Shimmer highlight: `ink` at this alpha on graphite; `surface` at the light alpha on paper. */
    const val ShimmerHighlightAlphaDark = 0.06f
    const val ShimmerHighlightAlphaLight = 0.85f
    /** Pull to refresh: content travel past the arming point is capped here (share of [RefreshTravel]). */
    const val RefreshOverPull = 1.2f
    /**
     * `rewardPulse`: initial velocity (scale units per second) given to the `reward` spring. With
     * damping 0.8 / stiffness 380 the mark swells to about 1.08 and settles in about 400 ms.
     */
    const val RewardVelocity = 2.6f

    // Scales
    /** Standalone buttons and standalone clickable cards only. */
    const val PressScaleButton = 0.97f
    /** Dialog entrance starts here. */
    const val DialogScaleFrom = 0.96f
    /** Tab fade-through: incoming screen starts here. */
    const val TabScaleFrom = 0.985f

    // Press tint: ink @ 6% on paper, @ 8% on graphite. The one press language.
    const val PressTintAlphaLight = 0.06f
    const val PressTintAlphaDark = 0.08f

    /** The press tint for [p] (`ink` at the PressTint alpha). */
    fun pressTint(p: ThesisPalette): Color =
        p.ink.copy(alpha = if (p.isLight) PressTintAlphaLight else PressTintAlphaDark)

    /**
     * Press tint for a control on an `ink` container (the snackbar): `surface` at the alpha of the opposite theme,
     * since the container is dark in the light theme and light in the dark theme. An ink tint would not show.
     */
    fun pressTintOnInk(p: ThesisPalette): Color =
        p.surface.copy(alpha = if (p.isLight) PressTintAlphaDark else PressTintAlphaLight)

    // Easing
    val EaseStandard: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    val EaseEnter: Easing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
    val EaseExit: Easing = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)
    val EaseCalm: Easing = CubicBezierEasing(0.33f, 0f, 0.15f, 1f)
    val EaseInOut: Easing = CubicBezierEasing(0.45f, 0f, 0.55f, 1f)
    val Linear: Easing = LinearEasing

    // Springs (damping 1.0 unless named otherwise)
    /** Small moves. */
    fun <T> spatialFast(visibilityThreshold: T? = null): SpringSpec<T> = spring(1f, 1400f, visibilityThreshold)

    /** Segment indicator, expand, placement. */
    fun <T> spatial(visibilityThreshold: T? = null): SpringSpec<T> = spring(1f, 700f, visibilityThreshold)

    /** Bounds, large panels, predictive-back cancel. */
    fun <T> spatialSlow(visibilityThreshold: T? = null): SpringSpec<T> = spring(1f, 380f, visibilityThreshold)

    /** Colour/alpha that must be interruptible. */
    fun <T> effects(visibilityThreshold: T? = null): SpringSpec<T> = spring(1f, 1600f, visibilityThreshold)

    /** Release after press: the only overshoot (~1%). */
    fun <T> pressRelease(visibilityThreshold: T? = null): SpringSpec<T> = spring(0.85f, 700f, visibilityThreshold)

    /** Once only: the "Deep Dive ready" pulse. */
    fun <T> reward(visibilityThreshold: T? = null): SpringSpec<T> = spring(0.8f, 380f, visibilityThreshold)

    // Timed specs
    /** Press-in: [Press] ms, [EaseStandard]. */
    fun <T> pressIn(): FiniteAnimationSpec<T> = tween(Press, easing = EaseStandard)

    /** Colour/selection changes: [Quick] ms, [EaseStandard]. */
    fun <T> quick(): FiniteAnimationSpec<T> = tween(Quick, easing = EaseStandard)

    /** Crossfades: [Base] ms, [EaseStandard]. */
    fun <T> base(): FiniteAnimationSpec<T> = tween(Base, easing = EaseStandard)

    /** Anything appearing: [Enter] ms, [EaseEnter]. */
    fun <T> enter(): FiniteAnimationSpec<T> = tween(Enter, easing = EaseEnter)

    /** Top bar background, hairline and title: [Bar] ms, [EaseStandard]. */
    fun <T> bar(): FiniteAnimationSpec<T> = tween(Bar, easing = EaseStandard)

    /** A timed spec that collapses to `snap()` under reduced motion. */
    fun <T> timed(
        reduced: Boolean,
        durationMillis: Int,
        delayMillis: Int = 0,
        easing: Easing = EaseStandard,
    ): FiniteAnimationSpec<T> = if (reduced) snap() else tween(durationMillis, delayMillis, easing)

    /** Stagger delay for the [order]-th item (first open of Home/Pulse only). */
    fun staggerDelay(order: Int): Int = min(order, StaggerMaxSteps) * StaggerStep

    /** `RollingNumber`: delay of the column [fromRight] positions from the right (0 = last character). */
    fun rollDelay(fromRight: Int): Int = min(fromRight, RollStaggerCap) * RollStagger
}
