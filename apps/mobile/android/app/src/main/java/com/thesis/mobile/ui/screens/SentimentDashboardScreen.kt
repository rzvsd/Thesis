package com.thesis.mobile.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.patrykandpatrick.vico.compose.chart.scroll.rememberChartScrollSpec
import com.patrykandpatrick.vico.core.entry.ChartEntryModelProducer
import com.patrykandpatrick.vico.core.entry.entryOf
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun SentimentDashboardScreen(
    current: SentimentSnapshotView?,
    history: List<SentimentSnapshotView>,
    selectedRangeDays: Int,
    sentimentError: String?,
    onSelectRange: (Int) -> Unit,
    onBack: () -> Unit,
    onRefresh: (() -> Unit)? = null
) {
    val chartRows = remember(history) { history.sortedBy { it.marketDate } }
    val recentRows = remember(chartRows) { chartRows.sortedByDescending { it.marketDate }.take(10) }
    val trailingWindow = remember(chartRows) { chartRows.takeLast(7) }
    val trailingAverage = remember(trailingWindow) {
        if (trailingWindow.isEmpty()) null else trailingWindow.map { it.score }.average()
    }
    val selectedRangeDelta = remember(chartRows) {
        val first = chartRows.firstOrNull()?.score
        val last = chartRows.lastOrNull()?.score
        if (first == null || last == null || chartRows.size < 2) {
            null
        } else {
            last - first
        }
    }
    val transitionMarkers = remember(chartRows) {
        chartRows.zipWithNext()
            .filter { it.first.label != it.second.label }
            .map { (previous, next) ->
                "${next.marketDate}: ${formatDashboardLabel(previous.label)} -> ${formatDashboardLabel(next.label)}"
            }
            .takeLast(3)
    }
    val modelProducer = remember { ChartEntryModelProducer() }
    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            onRefresh?.invoke() ?: onSelectRange(selectedRangeDays)
            scope.launch {
                delay(1800L)
                isRefreshing = false
            }
        }
    )

    LaunchedEffect(chartRows) {
        val entries = chartRows.mapIndexed { index, row ->
            entryOf(index.toFloat(), row.score.toFloat())
        }
        modelProducer.setEntries(entries)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.Background)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pullRefresh(pullRefreshState)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = ThesisDimens.ScreenPaddingHorizontal,
                    end = ThesisDimens.ScreenPaddingHorizontal,
                    top = 56.dp + ThesisDimens.ScreenPaddingTop,
                    bottom = ThesisDimens.ScreenPaddingBottom
                ),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
            ) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = if (current == null) "--" else current.score.toInt().toString(),
                            style = ThesisTypography.displayLarge.copy(
                                fontFamily = HeadingFont,
                                fontWeight = FontWeight.Normal
                            ),
                            color = ThesisColors.TextPrimary
                        )
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        Text(
                            text = formatDashboardLabel(current?.label),
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                            color = dashboardLabelColor(current?.label)
                        )
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                        Text(
                            text = current?.marketDate ?: "No data available",
                            style = ThesisTypography.labelSmall,
                            color = ThesisColors.TextMuted
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
                        colors = CardDefaults.cardColors(containerColor = ThesisColors.Surface),
                        border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
                    ) {
                        Column(modifier = Modifier.padding(ThesisDimens.CardPadding)) {
                            Text(
                                text = "Trend",
                                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.TextPrimary
                            )
                            Text(
                                text = "Last $selectedRangeDays day sentiment history.",
                                style = ThesisTypography.bodySmall,
                                color = ThesisColors.TextMuted
                            )
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                            Text(
                                text = "Regime overlays",
                                style = ThesisTypography.labelMedium,
                                color = ThesisColors.TextSecondary
                            )
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
                            ) {
                                RegimeBandLegendItem(
                                    label = "Fear",
                                    range = "0-40",
                                    color = ThesisColors.SignalNegative,
                                    modifier = Modifier.weight(1f)
                                )
                                RegimeBandLegendItem(
                                    label = "Neutral",
                                    range = "41-60",
                                    color = ThesisColors.SignalNeutral,
                                    modifier = Modifier.weight(1f)
                                )
                                RegimeBandLegendItem(
                                    label = "Greed",
                                    range = "61-100",
                                    color = ThesisColors.SignalPositive,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "7-day moving avg",
                                    style = ThesisTypography.labelMedium,
                                    color = ThesisColors.TextMuted
                                )
                                Text(
                                    text = trailingAverage?.let { formatScore(it) } ?: "--",
                                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    color = ThesisColors.TextPrimary
                                )
                            }
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Selected range drift",
                                    style = ThesisTypography.labelMedium,
                                    color = ThesisColors.TextMuted
                                )
                                Text(
                                    text = selectedRangeDelta?.let { formatSignedScore(it) } ?: "--",
                                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    color = when {
                                        selectedRangeDelta == null -> ThesisColors.TextMuted
                                        selectedRangeDelta > 0 -> ThesisColors.SignalPositive
                                        selectedRangeDelta < 0 -> ThesisColors.SignalNegative
                                        else -> ThesisColors.SignalNeutral
                                    }
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            if (chartRows.isEmpty()) {
                                Text(
                                    text = "No sentiment history available for this range yet.",
                                    style = ThesisTypography.bodySmall,
                                    color = ThesisColors.TextMuted
                                )
                            } else {
                                Chart(
                                    chart = lineChart(),
                                    chartModelProducer = modelProducer,
                                    startAxis = rememberStartAxis(),
                                    bottomAxis = rememberBottomAxis(),
                                    chartScrollSpec = rememberChartScrollSpec(isScrollEnabled = false),
                                    isZoomEnabled = false,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(220.dp)
                                )
                            }
                            if (transitionMarkers.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                                Text(
                                    text = "Recent transitions",
                                    style = ThesisTypography.labelMedium,
                                    color = ThesisColors.TextSecondary
                                )
                                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                                transitionMarkers.forEach { transition ->
                                    Text(
                                        text = transition,
                                        style = ThesisTypography.bodySmall,
                                        color = ThesisColors.TextMuted
                                    )
                                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                                }
                            }
                            if (!current?.missingInputs.isNullOrEmpty()) {
                                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                                Text(
                                    text = "Missing inputs: ${current?.missingInputs?.joinToString(", ") ?: ""}",
                                    style = ThesisTypography.bodySmall,
                                    color = ThesisColors.SignalWarning
                                )
                            }
                        }
                    }
                }

                item {
                    Text(
                        text = "Sub-score Breakdown",
                        style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                }

                if (current?.subScores.isNullOrEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = CardDefaults.cardColors(containerColor = ThesisColors.Surface),
                            border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
                        ) {
                            Text(
                                text = "Sub-scores are not available yet.",
                                style = ThesisTypography.bodySmall,
                                color = ThesisColors.TextMuted,
                                modifier = Modifier.padding(ThesisDimens.CardPadding)
                            )
                        }
                    }
                } else {
                    items(current?.subScores.orEmpty()) { subScore ->
                        SubScoreRow(subScore = subScore)
                    }
                }

                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = CardDefaults.cardColors(containerColor = ThesisColors.Surface),
                        border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
                    ) {
                        Column(modifier = Modifier.padding(ThesisDimens.CardPadding)) {
                            Text(
                                text = "Recent History",
                                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.TextPrimary
                            )
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                            if (chartRows.isEmpty()) {
                                Text(
                                    text = "No recent readings available.",
                                    style = ThesisTypography.bodySmall,
                                    color = ThesisColors.TextMuted
                                )
                            } else {
                                recentRows.forEachIndexed { index, snap ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = snap.marketDate,
                                            style = ThesisTypography.labelMedium,
                                            color = ThesisColors.TextMuted
                                        )
                                        Text(
                                            text = snap.score.toInt().toString(),
                                            style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                            color = ThesisColors.TextPrimary
                                        )
                                    }
                                    if (index < recentRows.lastIndex) {
                                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            PullRefreshIndicator(
                refreshing = isRefreshing,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
                backgroundColor = ThesisColors.Surface,
                contentColor = ThesisColors.Primary
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(ThesisColors.Background.copy(alpha = 0.97f))
                .padding(horizontal = ThesisDimens.SpacingSm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            androidx.compose.material3.IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = ThesisColors.Primary)
            }
            Text(
                text = "Fear & Greed Dashboard",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
        }
    }
}

@Composable
private fun RegimeBandLegendItem(
    label: String,
    range: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .padding(
                horizontal = ThesisDimens.SignalBadgePaddingH,
                vertical = ThesisDimens.SignalBadgePaddingV
            ),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, RoundedCornerShape(999.dp))
        )
        Spacer(modifier = Modifier.width(ThesisDimens.SpacingSm))
        Column {
            Text(
                text = label,
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextPrimary
            )
            Text(
                text = range,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
    }
}

private fun formatScore(value: Double): String = String.format(Locale.US, "%.1f", value)

private fun formatSignedScore(value: Double): String =
    if (value > 0) "+${formatScore(value)}" else formatScore(value)

@Composable
private fun SentimentRangeSelector(
    selectedRangeDays: Int,
    onSelectRange: (Int) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(7, 14, 30, 90).forEach { option ->
            val selected = selectedRangeDays == option
            AssistChip(
                onClick = { onSelectRange(option) },
                label = { Text("$option days") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (selected) ThesisColors.Primary.copy(alpha = 0.12f) else ThesisColors.Surface,
                    labelColor = if (selected) ThesisColors.Primary else ThesisColors.TextMuted
                )
            )
        }
    }
}

private fun formatDashboardLabel(label: String?): String = when (label?.lowercase()) {
    "extreme_fear" -> "Extreme Fear"
    "fear" -> "Fear"
    "neutral" -> "Neutral"
    "greed" -> "Greed"
    "extreme_greed" -> "Extreme Greed"
    else -> "Unavailable"
}

private fun dashboardLabelColor(label: String?): Color = when (label?.lowercase()) {
    "extreme_fear", "fear" -> ThesisColors.SignalNegative
    "greed", "extreme_greed" -> ThesisColors.SignalPositive
    "neutral" -> ThesisColors.SignalNeutral
    else -> ThesisColors.TextMuted
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
        colors = CardDefaults.cardColors(containerColor = ThesisColors.Surface),
        border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(ThesisDimens.CardPadding),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Current Sentiment",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
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
                        color = ThesisColors.TextPrimary
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
        colors = CardDefaults.cardColors(containerColor = ThesisColors.Surface),
        border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
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
                    style = ThesisTypography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
                Text(
                    text = "Provider: ${subScore.provider}",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = scoreText,
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                    color = if (subScore.available) ThesisColors.TextPrimary else ThesisColors.TextMuted
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
