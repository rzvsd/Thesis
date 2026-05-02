package com.thesis.mobile.ui.animations

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import kotlinx.coroutines.delay

/**
 * Animates content with a scale + fade reveal, like data "materializing."
 * Used for signal badges, score blocks, and chart elements.
 */
@Composable
fun RevealAnimation(
    modifier: Modifier = Modifier,
    delayMs: Long = 0L,
    durationMs: Int = 400,
    initialScale: Float = 0.85f,
    content: @Composable () -> Unit
) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(initialScale) }

    LaunchedEffect(Unit) {
        delay(delayMs)
        alpha.animateTo(1f, animationSpec = tween(durationMs, easing = FastOutSlowInEasing))
    }
    LaunchedEffect(Unit) {
        delay(delayMs)
        scale.animateTo(1f, animationSpec = tween(durationMs, easing = FastOutSlowInEasing))
    }

    Box(
        modifier = modifier
            .scale(scale.value)
            .alpha(alpha.value)
    ) {
        content()
    }
}

/**
 * Shimmer/flash effect for signal badges — a brief gold pulse on reveal.
 */
@Composable
fun ShimmerReveal(
    modifier: Modifier = Modifier,
    delayMs: Long = 300L,
    content: @Composable (shimmerProgress: Float) -> Unit
) {
    val shimmer = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        delay(delayMs)
        shimmer.animateTo(1f, animationSpec = tween(600, easing = FastOutSlowInEasing))
    }

    Box(modifier = modifier) {
        content(shimmer.value)
    }
}
