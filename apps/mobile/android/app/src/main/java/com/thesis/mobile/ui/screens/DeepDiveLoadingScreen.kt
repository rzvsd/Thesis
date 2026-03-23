package com.thesis.mobile.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlin.math.cos
import kotlin.math.sin

// Plasma palette — blue, teal, cyan ONLY. No purple.
private val PlasmaBlue = Color(0xFF4F8CFF)
private val PlasmaTeal = Color(0xFF27E199)
private val PlasmaCyan = Color(0xFF00C2FF)
private val PlasmaDeepBlue = Color(0xFF1A3A6F)

@Composable
fun DeepDiveLoadingScreen(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "plasma")

    // Animate blob positions with different speeds for organic feel
    val phase1 by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(12000, easing = LinearEasing), RepeatMode.Restart),
        label = "phase1"
    )
    val phase2 by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(8000, easing = LinearEasing), RepeatMode.Restart),
        label = "phase2"
    )
    val phase3 by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(15000, easing = LinearEasing), RepeatMode.Restart),
        label = "phase3"
    )
    val phase4 by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(10000, easing = LinearEasing), RepeatMode.Restart),
        label = "phase4"
    )

    // Spinner rotation
    val spinnerRotation by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(2000, easing = LinearEasing), RepeatMode.Restart),
        label = "spinner"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(ThesisColors.DarkBackground)
    ) {
        // ═══════════════════════════════════════════════
        //  PLASMA BACKGROUND — Canvas-drawn animated blobs
        // ═══════════════════════════════════════════════
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Blob 1 — large electric blue, top-left drift
            val b1x = w * 0.2f + cos(Math.toRadians(phase1.toDouble())).toFloat() * w * 0.15f
            val b1y = h * 0.15f + sin(Math.toRadians(phase1.toDouble())).toFloat() * h * 0.1f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(PlasmaBlue.copy(alpha = 0.25f), Color.Transparent),
                    center = Offset(b1x, b1y),
                    radius = w * 0.45f
                ),
                radius = w * 0.45f,
                center = Offset(b1x, b1y)
            )

            // Blob 2 — teal, bottom-right drift
            val b2x = w * 0.8f + sin(Math.toRadians(phase2.toDouble())).toFloat() * w * 0.12f
            val b2y = h * 0.75f + cos(Math.toRadians(phase2.toDouble())).toFloat() * h * 0.08f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(PlasmaTeal.copy(alpha = 0.18f), Color.Transparent),
                    center = Offset(b2x, b2y),
                    radius = w * 0.40f
                ),
                radius = w * 0.40f,
                center = Offset(b2x, b2y)
            )

            // Blob 3 — cyan, center drift
            val b3x = w * 0.5f + cos(Math.toRadians(phase3.toDouble())).toFloat() * w * 0.2f
            val b3y = h * 0.4f + sin(Math.toRadians(phase3.toDouble())).toFloat() * h * 0.15f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(PlasmaCyan.copy(alpha = 0.15f), Color.Transparent),
                    center = Offset(b3x, b3y),
                    radius = w * 0.35f
                ),
                radius = w * 0.35f,
                center = Offset(b3x, b3y)
            )

            // Blob 4 — deep blue, slow orbiting center-bottom
            val b4x = w * 0.4f + sin(Math.toRadians(phase4.toDouble())).toFloat() * w * 0.18f
            val b4y = h * 0.6f + cos(Math.toRadians(phase4.toDouble())).toFloat() * h * 0.12f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(PlasmaDeepBlue.copy(alpha = 0.3f), Color.Transparent),
                    center = Offset(b4x, b4y),
                    radius = w * 0.5f
                ),
                radius = w * 0.5f,
                center = Offset(b4x, b4y)
            )
        }

        // ═══════════════════════════════════════════════
        //  FOREGROUND CONTENT — floating over the plasma
        // ═══════════════════════════════════════════════
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = ThesisDimens.ScreenPaddingHorizontal),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Engine label
            Text(
                text = "THESIS INTELLIGENCE ENGINE",
                style = ThesisTypography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                ),
                color = ThesisColors.TextTertiaryDark,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Brand orb
            Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(bottom = 32.dp)) {
                // Glow behind the orb
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .background(PlasmaBlue.copy(alpha = 0.15f), CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(ThesisColors.DarkSurfaceHigh)
                        .border(1.dp, PlasmaBlue.copy(alpha = 0.3f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Insights,
                        contentDescription = null,
                        tint = PlasmaBlue,
                        modifier = Modifier.size(40.dp)
                    )
                }
            }

            // Title
            Text(
                text = "Generating Intelligence",
                style = ThesisTypography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Text(
                text = "Synthesizing filings, news & alternative data...",
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondaryDark,
                modifier = Modifier.padding(bottom = 40.dp)
            )

            // ── Pipeline ──
            Box(modifier = Modifier.width(300.dp)) {
                // Vertical track
                Box(
                    modifier = Modifier
                        .padding(start = 11.dp, top = 16.dp, bottom = 16.dp)
                        .width(2.dp)
                        .height(220.dp)
                        .background(ThesisColors.DarkBorder.copy(alpha = 0.4f))
                )
                // Active segment
                Box(
                    modifier = Modifier
                        .padding(start = 11.dp, top = 48.dp)
                        .width(2.dp)
                        .height(24.dp)
                        .background(PlasmaTeal.copy(alpha = 0.6f))
                )

                Column(verticalArrangement = Arrangement.spacedBy(28.dp)) {
                    PipelineStep("Searching filings...", "COMPLETED", StepState.COMPLETED)
                    PipelineStep("Analyzing fundamentals...", "PROCESSING", StepState.ACTIVE, spinnerRotation)
                    PipelineStep("Reading recent news...", "QUEUED", StepState.PENDING)
                    PipelineStep("Writing synthesis...", "QUEUED", StepState.PENDING)
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            // ETA Pill
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(ThesisColors.DarkSurfaceHigh)
                    .border(1.dp, ThesisColors.DarkBorder, RoundedCornerShape(50))
                    .padding(horizontal = ThesisDimens.SpacingLg, vertical = ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "Estimated time: ~60 seconds",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextSecondaryDark
                )
            }
        }
    }
}

// ─── Pipeline internals ───

private enum class StepState { COMPLETED, ACTIVE, PENDING }

@Composable
private fun PipelineStep(
    title: String,
    status: String,
    state: StepState,
    spinnerRotation: Float = 0f
) {
    val alpha = when (state) {
        StepState.COMPLETED -> 0.6f
        StepState.ACTIVE -> 1f
        StepState.PENDING -> 0.4f
    }

    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier.padding(start = 0.dp)
    ) {
        // Step indicator
        Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            when (state) {
                StepState.COMPLETED -> {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = PlasmaTeal.copy(alpha = alpha),
                        modifier = Modifier.fillMaxSize()
                    )
                }
                StepState.ACTIVE -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(PlasmaBlue),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .rotate(spinnerRotation)
                                .border(2.dp, Color.White.copy(alpha = 0.8f), CircleShape)
                        )
                    }
                }
                StepState.PENDING -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(ThesisColors.DarkSurface)
                            .border(1.dp, ThesisColors.DarkBorder, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(ThesisColors.DarkBorder)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.width(24.dp))

        Column {
            Text(
                text = title,
                style = ThesisTypography.bodyMedium.copy(
                    fontWeight = if (state == StepState.ACTIVE) FontWeight.Bold else FontWeight.Medium
                ),
                color = when (state) {
                    StepState.ACTIVE -> PlasmaBlue
                    else -> ThesisColors.TextPrimaryDark.copy(alpha = alpha)
                }
            )
            Text(
                text = status,
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
                color = when (state) {
                    StepState.COMPLETED -> PlasmaTeal
                    StepState.ACTIVE -> PlasmaCyan
                    StepState.PENDING -> ThesisColors.TextTertiaryDark
                }.copy(alpha = alpha)
            )
        }
    }
}
