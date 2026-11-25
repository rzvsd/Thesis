package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import com.thesis.mobile.ui.theme.LocalReducedMotion

/*
 * Small state-change motions for kit components (docs/app-redesign/DESIGN-DIRECTION.md 3 #16, #33; 4.2; 4.4; 4.8):
 * the SegmentedControl indicator glide, StageProgress's ring and check draw-on and the one-off reward pulse.
 * All of them show the final state on first paint and under reduced motion (except the indicator, which simply
 * jumps), and are read in the draw or layer phase.
 */

/**
 * Indicator position (segment index as a float) gliding on the `spatial` spring (damping 1, no overshoot) toward
 * [target]. First paint and reduced motion: no glide. Read it in the draw phase (`drawBehind { … value … }`).
 */
@Composable
fun animateIndicatorPosition(target: Int): State<Float> {
    val reduced = LocalReducedMotion.current
    val position = remember { Animatable(target.toFloat()) }
    LaunchedEffect(target, reduced) {
        if (reduced) position.snapTo(target.toFloat()) else position.animateTo(target.toFloat(), ThesisMotion.spatial())
    }
    return position.asState()
}

/**
 * A 0..1 "drawn" progress for a state that completes (a stage ring filling, its check drawing, a saved check):
 * when [done] turns true after first paint it draws over [durationMillis] (`Base`, `EaseCalm`); when it turns
 * false it clears over `Quick`. First paint and reduced motion: the final value at once.
 */
@Composable
fun rememberDrawOn(done: Boolean, durationMillis: Int = ThesisMotion.Base): State<Float> {
    val reduced = LocalReducedMotion.current
    val progress = remember { Animatable(if (done) 1f else 0f) }
    LaunchedEffect(done, reduced) {
        val target = if (done) 1f else 0f
        when {
            reduced -> progress.snapTo(target)
            done -> progress.animateTo(target, tween(durationMillis, easing = ThesisMotion.EaseCalm))
            else -> progress.animateTo(target, tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit))
        }
    }
    return progress.asState()
}

/**
 * The reward pulse (the `reward` spring, the app's one celebratory motion: "Deep Dive ready", the final
 * generation stage completing). When [trigger] changes after first paint and [enabled], the element swells to
 * about 1.08 and settles (damping 0.8). Never on first paint; static under reduced motion (4.8). Layer phase only.
 */
fun Modifier.rewardPulse(trigger: Any?, enabled: Boolean = true): Modifier = composed {
    val reduced = LocalReducedMotion.current
    val scale = remember { Animatable(1f) }
    val first = remember { booleanArrayOf(true) }
    LaunchedEffect(trigger) {
        if (first[0]) {
            first[0] = false
            return@LaunchedEffect
        }
        if (enabled && !reduced) {
            scale.snapTo(1f)
            scale.animateTo(1f, ThesisMotion.reward(), initialVelocity = ThesisMotion.RewardVelocity)
        }
    }
    graphicsLayer {
        val s = scale.value
        scaleX = s
        scaleY = s
    }
}
