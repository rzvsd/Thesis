package com.thesis.mobile.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.patrykandpatrick.vico.compose.axis.horizontal.rememberBottomAxis
import com.patrykandpatrick.vico.compose.axis.vertical.rememberStartAxis
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.line.lineChart
import com.patrykandpatrick.vico.core.entry.ChartEntryModelProducer
import com.patrykandpatrick.vico.core.entry.entryOf
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun SentimentDashboardScreen(
    current: SentimentSnapshotView?,
    history: List<SentimentSnapshotView>,
    selectedRangeDays: Int,
    sentimentError: String?,
    onSelectRange: (Int) -> Unit,
    onBack: () -> Unit
) {
    val chartRows = remember(history) { history.sortedBy { it.marketDate } }
    val modelProducer = remember { ChartEntryModelProducer() }
    LaunchedEffect(chartRows) {
        val entries = chartRows.mapIndexed { index, row ->
            entryOf(index.toFloat(), row.score.toFloat())
        }
        modelProducer.setEntries(entries)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = ThesisDimens.ScreenPaddingHorizontal,
            end = ThesisDimens.ScreenPaddingHorizontal,
            top = ThesisDimens.ScreenPaddingTop,
            bottom = ThesisDimens.ScreenPaddingBottom
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = onBack,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.DarkSurface,
                        contentColor = ThesisColors.TextPrimaryDark
                    )
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("Back")
                }
                Text(
                    text = "Fear & Greed Dashboard",
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimaryDark
                )
            }
        }

        item {
            SentimentGaugeCard(current = current, sentimentError = sentimentError)
        }

        item {
            SentimentRangeSelector(
                selectedRangeDays = selectedRangeDays,
                onSelectRange = onSelectRange
            )
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurfaceHigh)
            ) {
                Column(modifier = Modifier.padding(ThesisDimens.CardPadding)) {
                    Text(
                        text = "Trend",
                        style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = ThesisColors.TextPrimaryDark
                    )
                    Text(
                        text = "Last $selectedRangeDays day sentiment history.",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    if (chartRows.isEmpty()) {
                        Text(
                            text = "No sentiment history available for this range yet.",
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextTertiaryDark
                        )
                    } else {
                        Chart(
                            chart = lineChart(),
                            chartModelProducer = modelProducer,
                            startAxis = rememberStartAxis(),
                            bottomAxis = rememberBottomAxis(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                        )
                    }
                }
            }
        }

        item {
            Text(
                text = "Sub-score Breakdown",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
        }

        if (current?.subScores.isNullOrEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface)
                ) {
                    Text(
                        text = "Sub-scores are not available yet.",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark,
                        modifier = Modifier.padding(ThesisDimens.CardPadding)
                    )
                }
            }
        } else {
            items(current?.subScores.orEmpty()) { subScore ->
                SubScoreRow(subScore = subScore)
            }
        }
    }
}

@Composable
private fun SentimentRangeSelector(
    selectedRangeDays: Int,
    onSelectRange: (Int) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(7, 30, 90).forEach { option ->
            val selected = selectedRangeDays == option
            AssistChip(
                onClick = { onSelectRange(option) },
                label = { Text("$option days") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (selected) ThesisColors.AccentBlue.copy(alpha = 0.2f) else ThesisColors.DarkSurface,
                    labelColor = if (selected) ThesisColors.AccentBlueLight else ThesisColors.TextSecondaryDark
                )
            )
        }
    }
}

@Composable
private fun SentimentGaugeCard(
    current: SentimentSnapshotView?,
    sentimentError: String?
) {
    val score = current?.score ?: 0.0
    val clampedScore = score.coerceIn(0.0, 100.0)
    val progress = (clampedScore / 100.0).toFloat()
    val label = when (current?.label?.lowercase()) {
        "extreme_fear" -> "Extreme Fear"
        "fear" -> "Fear"
        "neutral" -> "Neutral"
        "greed" -> "Greed"
        "extreme_greed" -> "Extreme Greed"
        else -> "Unavailable"
    }
    val color = when (current?.label?.lowercase()) {
        "extreme_fear", "fear" -> ThesisColors.SignalNegative
        "greed", "extreme_greed" -> ThesisColors.SignalPositive
        "neutral" -> ThesisColors.SignalNeutral
        else -> ThesisColors.TextTertiaryDark
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurfaceHigh)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(ThesisDimens.CardPadding),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Current Sentiment",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
            Spacer(modifier = Modifier.height(16.dp))
            Box(
                modifier = Modifier
                    .size(220.dp, 140.dp),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val stroke = Stroke(width = 18.dp.toPx(), cap = StrokeCap.Round)
                    val arcSize = Size(size.width, size.width)
                    val topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - arcSize.height)
                    drawArc(
                        color = ThesisColors.ConfidenceRingBg,
                        startAngle = 180f,
                        sweepAngle = 180f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = stroke
                    )
                    drawArc(
                        color = color,
                        startAngle = 180f,
                        sweepAngle = 180f * progress,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = stroke
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (current == null) "--" else clampedScore.toInt().toString(),
                        style = ThesisTypography.displayMedium,
                        color = ThesisColors.TextPrimaryDark
                    )
                    Text(
                        text = label,
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = color
                    )
                }
            }
            if (!sentimentError.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = sentimentError,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.SignalWarning
                )
            }
        }
    }
}

@Composable
private fun SubScoreRow(subScore: SentimentSubScoreView) {
    val scoreText = subScore.normalizedScore?.let { "${it.toInt()}/100" } ?: "--"
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(ThesisDimens.CardPadding),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = subScore.inputName.replace('_', ' '),
                    style = ThesisTypography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimaryDark
                )
                Text(
                    text = "Provider: ${subScore.provider}",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextTertiaryDark
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = scoreText,
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = if (subScore.available) ThesisColors.TextPrimaryDark else ThesisColors.TextTertiaryDark
                )
                Text(
                    text = if (subScore.available) "available" else "missing",
                    style = ThesisTypography.labelSmall,
                    color = if (subScore.available) ThesisColors.SignalPositive else ThesisColors.SignalWarning
                )
            }
        }
    }
}
