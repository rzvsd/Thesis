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
 * Confidence ring: a track with the score's arc from 12 o'clock and the score as "n/10" in the middle. It shows a
 * frozen report figure, so it is final on first paint (4.6: frozen report figures never animate): no sweep, no
 * delayed text fade, nothing replays when the report recomposes.
 */
@Composable
fun ConfidenceRing(
    score: Float,
    modifier: Modifier = Modifier
) {
    val safeScore = score.coerceIn(0f, 1f)
    Box(
        modifier = modifier.size(ThesisDimens.ConfidenceRingSize),
        contentAlignment = Alignment.Center
    ) {
        val trackColor = ThesisColors.Border
        val arcColor = ThesisColors.Primary
        Canvas(modifier = Modifier.size(ThesisDimens.ConfidenceRingSize)) {
            val stroke = ThesisDimens.ConfidenceRingStroke.toPx()
            drawArc(
                color = trackColor,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = stroke, cap = StrokeCap.Butt)
            )
            if (safeScore > 0f) {
                drawArc(
                    color = arcColor,
                    startAngle = -90f,
                    sweepAngle = safeScore * 360f,
                    useCenter = false,
                    style = Stroke(width = stroke, cap = StrokeCap.Round)
                )
            }
        }
        Text(
            text = "${(safeScore * 10).toInt()}/10",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextSecondary
        )
    }
}
