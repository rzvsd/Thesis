package com.thesis.mobile.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * Animated Confidence Ring — sweeps from 0 to the target score
 * over 1.2s with the score text fading in after the ring completes.
 * Creates a theatrical "computing" reveal moment.
 */
@Composable
fun ConfidenceRing(
    score: Float,
    modifier: Modifier = Modifier
) {
    val safeScore = score.coerceIn(0f, 1f)

    // Animate the ring sweep
    val sweepAnim = remember { Animatable(0f) }
    // Animate the text fade-in (starts after ring is ~70% done)
    val textAlpha = remember { Animatable(0f) }

    LaunchedEffect(safeScore) {
        sweepAnim.snapTo(0f)
        textAlpha.snapTo(0f)
        sweepAnim.animateTo(
            safeScore * 360f,
            animationSpec = tween(1200, easing = FastOutSlowInEasing)
        )
    }
    LaunchedEffect(safeScore) {
        // Text appears after ring is mostly filled
        kotlinx.coroutines.delay(800L)
        textAlpha.animateTo(1f, animationSpec = tween(400, easing = FastOutSlowInEasing))
    }

    Box(
        modifier = modifier.size(ThesisDimens.ConfidenceRingSize),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(ThesisDimens.ConfidenceRingSize)) {
            // Background track
            drawArc(
                color = ThesisColors.Border,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(
                    width = ThesisDimens.ConfidenceRingStroke.toPx(),
                    cap = StrokeCap.Butt
                )
            )
            // Animated gold arc
            if (sweepAnim.value > 0) {
                drawArc(
                    color = ThesisColors.Primary,
                    startAngle = -90f,
                    sweepAngle = sweepAnim.value,
                    useCenter = false,
                    style = Stroke(
                        width = ThesisDimens.ConfidenceRingStroke.toPx(),
                        cap = StrokeCap.Round
                    )
                )
            }
        }
        // Score text fades in after ring animation
        Text(
            text = "${(safeScore * 10).toInt()}/10",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextSecondary,
            modifier = Modifier.alpha(textAlpha.value)
        )
    }
}
