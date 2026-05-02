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
import androidx.compose.ui.graphics.graphicsLayer
import kotlinx.coroutines.delay

/**
 * Wraps content with a staggered fade-in + slide-up entrance animation.
 * @param index Position in the list (controls stagger delay)
 * @param baseDelayMs Delay before the first item animates
 * @param staggerMs Additional delay per index
 * @param slideDistancePx How many pixels the item slides up from
 */
@Composable
fun StaggeredEntrance(
    index: Int,
    modifier: Modifier = Modifier,
    baseDelayMs: Long = 100L,
    staggerMs: Long = 60L,
    slideDistancePx: Float = 24f,
    durationMs: Int = 350,
    content: @Composable () -> Unit
) {
    val alpha = remember { Animatable(0f) }
    val translateY = remember { Animatable(slideDistancePx) }

    LaunchedEffect(Unit) {
        delay(baseDelayMs + (index * staggerMs))
        alpha.animateTo(1f, animationSpec = tween(durationMs, easing = FastOutSlowInEasing))
    }
    LaunchedEffect(Unit) {
        delay(baseDelayMs + (index * staggerMs))
        translateY.animateTo(0f, animationSpec = tween(durationMs, easing = FastOutSlowInEasing))
    }

    Box(
        modifier = modifier
            .graphicsLayer { translationY = translateY.value }
            .alpha(alpha.value)
    ) {
        content()
    }
}
