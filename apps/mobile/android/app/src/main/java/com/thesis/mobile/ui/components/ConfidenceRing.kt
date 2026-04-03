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

@Composable
fun ConfidenceRing(
    score: Float,
    modifier: Modifier = Modifier
) {
    val safeScore = score.coerceIn(0f, 1f)
    val sweepAngle = safeScore * 360f

    Box(
        modifier = modifier.size(ThesisDimens.ConfidenceRingSize),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(ThesisDimens.ConfidenceRingSize)) {
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

            if (sweepAngle > 0) {
                drawArc(
                    color = ThesisColors.Primary,
                    startAngle = -90f,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    style = Stroke(
                        width = ThesisDimens.ConfidenceRingStroke.toPx(),
                        cap = StrokeCap.Butt
                    )
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
