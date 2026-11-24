package com.thesis.mobile.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.PlasmaOrb
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.delay

private data class PipelineStepData(
    val title: String,
    val description: String,
    val durationMs: Long
)

private val pipelineSteps = listOf(
    PipelineStepData("Searching filings", "SEC 10-K, 10-Q, 8-K", 4000),
    PipelineStepData("Analyzing fundamentals", "Revenue, margins, cash flow", 6000),
    PipelineStepData("Reading recent news", "Headlines, earnings calls", 5000),
    PipelineStepData("Writing synthesis", "Building your report", 3000)
)

@Composable
fun DeepDiveLoadingScreen(modifier: Modifier = Modifier) {
    var currentStepIndex by remember { mutableIntStateOf(0) }
    var stepsVisible by remember { mutableStateOf(false) }
    var orbVisible by remember { mutableStateOf(false) }
    var headerVisible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(200)
        orbVisible = true
        delay(400)
        headerVisible = true
        delay(300)
        stepsVisible = true
        for (i in pipelineSteps.indices) {
            currentStepIndex = i
            delay(pipelineSteps[i].durationMs)
        }
    }

    val transition = rememberInfiniteTransition(label = "loading")
    val orbPulse by transition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "orbPulse"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = ThesisDimens.ScreenPaddingHorizontal),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            AnimatedVisibility(
                visible = headerVisible,
                enter = fadeIn(tween(800)) + slideInVertically(tween(800)) { -20 }
            ) {
                Text(
                    text = "THESIS INTELLIGENCE ENGINE",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted,
                    modifier = Modifier.padding(bottom = 32.dp)
                )
            }

            AnimatedVisibility(
                visible = orbVisible,
                enter = fadeIn(tween(1200))
            ) {
                PlasmaOrb(
                    modifier = Modifier,
                    size = (180 * orbPulse).dp,
                    intensity = 0.7f + (currentStepIndex.toFloat() / pipelineSteps.size.toFloat()) * 0.3f
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            AnimatedVisibility(
                visible = headerVisible,
                enter = fadeIn(tween(800, delayMillis = 200)) + slideInVertically(tween(800, delayMillis = 200)) { 30 }
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Generating Intelligence",
                        style = ThesisTypography.headlineLarge.copy(
                            fontFamily = HeadingFont,
                            fontWeight = FontWeight.Normal
                        ),
                        color = ThesisColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    Text(
                        text = "Synthesizing filings, fundamentals & news",
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextMuted,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.height(48.dp))

            AnimatedVisibility(
                visible = stepsVisible,
                enter = fadeIn(tween(600, delayMillis = 100)) + slideInVertically(tween(600, delayMillis = 100)) { 40 }
            ) {
                Column(
                    modifier = Modifier.width(280.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    pipelineSteps.forEachIndexed { index, step ->
                        val state = when {
                            index < currentStepIndex -> StepState.COMPLETED
                            index == currentStepIndex -> StepState.ACTIVE
                            else -> StepState.PENDING
                        }
                        PipelineStepRow(
                            title = step.title,
                            description = step.description,
                            state = state,
                            index = index
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            AnimatedVisibility(
                visible = stepsVisible,
                enter = fadeIn(tween(600, delayMillis = 400))
            ) {
                val etaText = when {
                    currentStepIndex >= pipelineSteps.size - 1 -> "Finishing up..."
                    else -> "Usually about a minute"
                }
                Text(
                    text = etaText,
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted,
                    modifier = Modifier
                        .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                        .background(ThesisColors.Surface)
                        .border(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Border,
                            RoundedCornerShape(ThesisDimens.CardCornerRadius)
                        )
                        .padding(horizontal = ThesisDimens.SpacingLg, vertical = ThesisDimens.SpacingSm)
                )
            }
        }
    }
}

private enum class StepState { COMPLETED, ACTIVE, PENDING }

@Composable
private fun PipelineStepRow(title: String, description: String, state: StepState, index: Int) {
    val alphaTarget = when (state) {
        StepState.COMPLETED -> 0.45f
        StepState.ACTIVE -> 1f
        StepState.PENDING -> 0.25f
    }
    val alpha by animateFloatAsState(
        targetValue = alphaTarget,
        animationSpec = tween(500),
        label = "stepAlpha$index"
    )

    val transition = rememberInfiniteTransition(label = "active$index")
    val activePulse by transition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "activePulse$index"
    )

    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier.alpha(alpha)
    ) {
        Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            when (state) {
                StepState.COMPLETED -> {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = "Completed",
                        tint = ThesisColors.SignalPositive,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                StepState.ACTIVE -> {
                    Box(
                        modifier = Modifier
                            .size((20 * activePulse).dp)
                            .clip(CircleShape)
                            .background(ThesisColors.Primary)
                    )
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(ThesisColors.TextInverse)
                    )
                }

                StepState.PENDING -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(ThesisColors.Surface)
                            .border(ThesisDimens.BorderWidth, ThesisColors.Border, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(ThesisColors.Border)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.width(20.dp))

        Column {
            Text(
                text = title,
                style = ThesisTypography.bodyMedium.copy(
                    fontWeight = if (state == StepState.ACTIVE) FontWeight.Medium else FontWeight.Normal
                ),
                color = when (state) {
                    StepState.ACTIVE -> ThesisColors.Primary
                    else -> ThesisColors.TextPrimary
                }
            )
            Text(
                text = when (state) {
                    StepState.COMPLETED -> "COMPLETED"
                    StepState.ACTIVE -> "PROCESSING"
                    StepState.PENDING -> "QUEUED"
                },
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = when (state) {
                    StepState.COMPLETED -> ThesisColors.SignalPositive
                    StepState.ACTIVE -> ThesisColors.Primary
                    StepState.PENDING -> ThesisColors.TextMuted
                }
            )
            if (state == StepState.ACTIVE) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
    }
}
