package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionInsightFindingView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.OppositeCasePointView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.ui.components.ThesisButton
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun DeepDiveConvictionSection(
    isPro: Boolean,
    timeline: List<ConvictionJournalEntryView>,
    timelineError: String?,
    oppositeCase: OppositeCaseReportView?,
    oppositeCaseError: String?,
    isGeneratingOppositeCase: Boolean,
    onGenerateOppositeCase: () -> Unit,
    onRefreshTimeline: () -> Unit,
    onRequireUpgrade: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionHeader(
            title = Phase4Copy.convictionIntelligenceTitle,
            subtitle = Phase4Copy.convictionIntelligenceSubtitle
        )

        if (!isPro) {
            SurfaceCard {
                Text(
                    text = Phase4Copy.convictionProOnly,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                ThesisButton(
                    text = "Upgrade to Pro",
                    onClick = { onRequireUpgrade("conviction_intelligence") }
                )
            }
            return@Column
        }

        ConvictionTimelineCard(
            timeline = timeline,
            errorMessage = timelineError,
            onRefresh = onRefreshTimeline
        )

        OppositeCaseCard(
            oppositeCase = oppositeCase,
            errorMessage = oppositeCaseError,
            isGenerating = isGeneratingOppositeCase,
            onGenerate = onGenerateOppositeCase
        )
    }
}

@Composable
fun MonthlyCoherenceSection(
    isPro: Boolean,
    insights: List<ConvictionInsightCardView>,
    errorMessage: String?,
    onRefresh: () -> Unit,
    onRequireUpgrade: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        SectionHeader(
            title = Phase4Copy.coherenceTitle,
            subtitle = Phase4Copy.coherenceSubtitle
        )
        SurfaceCard {
            if (!isPro) {
                Text(
                    text = Phase4Copy.convictionProOnly,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                ThesisButton(
                    text = "Upgrade to Pro",
                    onClick = { onRequireUpgrade("conviction_intelligence") }
                )
                return@SurfaceCard
            }

            if (!errorMessage.isNullOrBlank()) {
                Text(
                    text = errorMessage,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.SignalWarning
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            }

            val latest = insights.firstOrNull()
            if (latest == null) {
                Text(
                    text = Phase4Copy.coherenceEmpty,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
            } else {
                Text(
                    text = latest.title,
                    style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
                Text(
                    text = "${latest.periodStart} to ${latest.periodEnd}",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = latest.summary,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
                latest.findings.take(3).forEach { finding ->
                    HorizontalDivider(color = ThesisColors.Border)
                    InsightFindingRow(finding = finding)
                }
            }

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            OutlinedButton(
                onClick = onRefresh,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(
                    ThesisDimens.BorderWidth,
                    ThesisColors.Border
                )
            ) {
                Text("Refresh coherence", color = ThesisColors.TextMuted)
            }
        }
    }
}

@Composable
private fun ConvictionTimelineCard(
    timeline: List<ConvictionJournalEntryView>,
    errorMessage: String?,
    onRefresh: () -> Unit
) {
    SurfaceCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = Phase4Copy.convictionTimelineTitle,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            OutlinedButton(
                onClick = onRefresh,
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(
                    ThesisDimens.BorderWidth,
                    ThesisColors.Border
                )
            ) {
                Text("Refresh", color = ThesisColors.TextMuted)
            }
        }

        if (!errorMessage.isNullOrBlank()) {
            Text(
                text = errorMessage,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.SignalWarning
            )
        }

        if (timeline.isEmpty()) {
            Text(
                text = Phase4Copy.convictionTimelineEmpty,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextMuted
            )
        } else {
            timeline.take(5).forEachIndexed { index, item ->
                if (index > 0) {
                    HorizontalDivider(color = ThesisColors.Border)
                }
                TimelineRow(item = item)
            }
        }
    }
}

@Composable
private fun OppositeCaseCard(
    oppositeCase: OppositeCaseReportView?,
    errorMessage: String?,
    isGenerating: Boolean,
    onGenerate: () -> Unit
) {
    SurfaceCard {
        Text(
            text = Phase4Copy.oppositeCaseTitle,
            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )

        if (oppositeCase == null) {
            Text(
                text = errorMessage?.takeIf { it.isNotBlank() } ?: Phase4Copy.oppositeCaseEmpty,
                style = ThesisTypography.bodyMedium,
                color = if (errorMessage.isNullOrBlank()) ThesisColors.TextMuted else ThesisColors.SignalWarning
            )
            ThesisButton(
                text = if (isGenerating) Phase4Copy.oppositeCaseGenerating else Phase4Copy.oppositeCaseGenerate,
                onClick = onGenerate,
                enabled = !isGenerating
            )
            return@SurfaceCard
        }

        Text(
            text = oppositeCase.oppositeCaseSummary,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextPrimary
        )
        oppositeCase.keyPoints.take(3).forEach { point ->
            HorizontalDivider(color = ThesisColors.Border)
            OppositeCasePointRow(point = point)
        }
        if (oppositeCase.decisiveFactors.isNotEmpty()) {
            HorizontalDivider(color = ThesisColors.Border)
            Text(
                text = "DECISIVE FACTORS",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextMuted
            )
            Text(
                text = oppositeCase.decisiveFactors.take(3).joinToString(separator = " | "),
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextPrimary
            )
        }
    }
}

@Composable
private fun TimelineRow(item: ConvictionJournalEntryView) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = Icons.Default.AutoAwesome,
            contentDescription = null,
            tint = eventColor(item.eventType),
            modifier = Modifier.size(16.dp)
        )
        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = eventLabel(item.eventType),
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = eventColor(item.eventType)
                )
                Text(
                    text = item.eventAt.take(10),
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
            }
            Text(
                text = item.title,
                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = item.summary,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun OppositeCasePointRow(point: OppositeCasePointView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
        Text(
            text = point.title,
            style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = point.summary,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun InsightFindingRow(finding: ConvictionInsightFindingView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
        Text(
            text = finding.findingType.replace('_', ' ').uppercase(),
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = insightColor(finding.findingType)
        )
        Text(
            text = finding.title,
            style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = finding.summary,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
        if (finding.tickers.isNotEmpty()) {
            Text(
                text = finding.tickers.joinToString(separator = " | "),
                style = ThesisTypography.labelSmall,
                color = ThesisColors.Primary
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
        Text(
            text = title,
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = subtitle,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun SurfaceCard(content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm),
        content = content
    )
}

private fun eventLabel(eventType: String): String =
    eventType.replace('_', ' ').uppercase()

@Composable
@ReadOnlyComposable
private fun eventColor(eventType: String) = when (eventType) {
    "kill_switch_alert_fired" -> ThesisColors.SignalNegative
    "freshness_decay_alert_fired" -> ThesisColors.SignalWarning
    "opposite_case_generated" -> ThesisColors.Primary
    "cross_name_alert_fired" -> ThesisColors.SignalWarning
    else -> ThesisColors.TextMuted
}

@Composable
@ReadOnlyComposable
private fun insightColor(findingType: String) = when (findingType) {
    "contradiction" -> ThesisColors.SignalNegative
    "overlap" -> ThesisColors.SignalWarning
    "mismatch" -> ThesisColors.Primary
    else -> ThesisColors.TextMuted
}
