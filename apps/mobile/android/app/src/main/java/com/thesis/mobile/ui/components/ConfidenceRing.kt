package com.thesis.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * Visual confidence indicator.
 * Fills a ring from 0 to 1 based on the confidence score.
 * Example: 0.8 shows an 80% filled blue ring.
 */
@Composable
fun ConfidenceRing(
    score: Float,
    modifier: Modifier = Modifier
) {
    // Clamp between 0 and 1
    val safeScore = score.coerceIn(0f, 1f)
    val sweepAngle = safeScore * 360f

    Box(
        modifier = modifier.size(ThesisDimens.ConfidenceRingSize),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(ThesisDimens.ConfidenceRingSize)) {
            // Background track
            drawArc(
                color = ThesisColors.ConfidenceRingBg,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(
                    width = ThesisDimens.ConfidenceRingStroke.toPx(),
                    cap = StrokeCap.Round
                )
            )

            // Foreground progress (starts at top: -90 degrees)
            if (sweepAngle > 0) {
                drawArc(
                    color = ThesisColors.AccentBlue,
                    startAngle = -90f,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    style = Stroke(
                        width = ThesisDimens.ConfidenceRingStroke.toPx(),
                        cap = StrokeCap.Round
                    )
                )
            }
        }

        // Optional numeric display in the center
        Text(
            text = "${(safeScore * 10).toInt()}/10",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextSecondaryDark
        )
    }
}
