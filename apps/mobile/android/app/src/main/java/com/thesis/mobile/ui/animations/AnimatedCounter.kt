package com.thesis.mobile.ui.animations

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/**
 * Animated number counter that rolls from 0 to targetValue.
 * Creates the dramatic "computing" effect for scores and metrics.
 */
@Composable
fun AnimatedCounter(
    targetValue: Int,
    modifier: Modifier = Modifier,
    style: TextStyle = TextStyle.Default,
    color: Color = Color.White,
    durationMs: Int = 800,
    delayMs: Long = 200L,
    suffix: String = "",
    prefix: String = ""
) {
    val animatable = remember { Animatable(0f) }
    var displayValue by remember { mutableIntStateOf(0) }

    LaunchedEffect(targetValue) {
        delay(delayMs)
        animatable.animateTo(
            targetValue.toFloat(),
            animationSpec = tween(durationMs, easing = FastOutSlowInEasing)
        )
    }

    displayValue = animatable.value.roundToInt()

    Text(
        text = "$prefix$displayValue$suffix",
        style = style,
        color = color,
        modifier = modifier
    )
}

/**
 * Animated float counter for decimal values (e.g., confidence scores).
 */
@Composable
fun AnimatedFloatCounter(
    targetValue: Float,
    modifier: Modifier = Modifier,
    style: TextStyle = TextStyle.Default,
    color: Color = Color.White,
    durationMs: Int = 800,
    delayMs: Long = 200L,
    decimalPlaces: Int = 1,
    suffix: String = "",
    prefix: String = ""
) {
    val animatable = remember { Animatable(0f) }

    LaunchedEffect(targetValue) {
        delay(delayMs)
        animatable.animateTo(
            targetValue,
            animationSpec = tween(durationMs, easing = FastOutSlowInEasing)
        )
    }

    val formatted = String.format("%.${decimalPlaces}f", animatable.value)

    Text(
        text = "$prefix$formatted$suffix",
        style = style,
        color = color,
        modifier = modifier
    )
}
