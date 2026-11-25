package com.thesis.mobile.ui.animations

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import com.thesis.mobile.ui.motion.RollingNumber
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Old count-up counter, kept so HomeScreen compiles until WP-A deletes it in PR-3. Counting up from 0 on every open
 * is gone (4.2: `CountUp` removed; 4.6: the hero figure is final on first paint): it now shows [targetValue] at
 * once and rolls to a new value in place ([RollingNumber]). [durationMs] and [delayMs] are ignored. [color]
 * defaults to the style's colour, then `LocalContentColor` (it used to default to white).
 */
@Deprecated("Use RollingNumber for app-computed values that refresh in place, or a static Text.")
@Suppress("UNUSED_PARAMETER")
@Composable
fun AnimatedCounter(
    targetValue: Int,
    modifier: Modifier = Modifier,
    style: TextStyle = TextStyle.Default,
    color: Color = Color.Unspecified,
    durationMs: Int = 800,
    delayMs: Long = 200L,
    suffix: String = "",
    prefix: String = "",
) {
    RollingNumber(
        value = targetValue,
        format = { "$prefix$it$suffix" },
        style = style,
        modifier = modifier,
        color = color,
    )
}

/** Decimal variant of [AnimatedCounter]: final on first paint, rolls on change. No callers today. */
@Deprecated("Use RollingNumber with the Fmt formatter.")
@Suppress("UNUSED_PARAMETER")
@Composable
fun AnimatedFloatCounter(
    targetValue: Float,
    modifier: Modifier = Modifier,
    style: TextStyle = TextStyle.Default,
    color: Color = Color.Unspecified,
    durationMs: Int = 800,
    delayMs: Long = 200L,
    decimalPlaces: Int = 1,
    suffix: String = "",
    prefix: String = "",
) {
    RollingNumber(
        value = targetValue.toDouble(),
        format = { prefix + fixed(it, decimalPlaces) + suffix },
        style = style,
        modifier = modifier,
        color = color,
    )
}

/** Locale-independent fixed-point text ("12.5"); the old version used the device locale. */
private fun fixed(value: Double, decimals: Int): String =
    if (value.isFinite()) BigDecimal(value).setScale(decimals.coerceAtLeast(0), RoundingMode.HALF_UP).toPlainString()
    else value.toString()
