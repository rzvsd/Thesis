package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveVisualPanelView
import com.thesis.mobile.model.EvidenceLadderPanelView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.RangeBandPanelView
import com.thesis.mobile.model.ScenarioComparePanelView
import com.thesis.mobile.model.TimelinePanelView
import com.thesis.mobile.model.TrustScorecardPanelView
import com.thesis.mobile.model.ValuationBridgePanelView
import com.thesis.mobile.ui.components.SignalBadge
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
internal fun DeepDiveStoryHeaderCard(
    report: DeepDiveReportView,
    isWatched: Boolean
) {
    val header = report.storyHeader
    val ticker = report.ticker ?: "Ticker"
    val headline = header?.headline ?: "$ticker Deep Dive"
    val thesisSummary = header?.thesisSummary ?: report.thesisStatement ?: "Thesis summary unavailable."
    val whyNow = header?.whyNow ?: "Why-now context is unavailable for this legacy report."
    val stance = header?.stanceLabel ?: report.signalValue ?: "watch"

    StorySurface(
        borderColor = signalTint(stance).copy(alpha = 0.35f),
        backgroundColor = signalTint(stance).copy(alpha = 0.06f)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                    MetaLabel("DEEP REPORT")
                    Text(
                        text = ticker,
                        style = ThesisTypography.displayMedium.copy(fontFamily = HeadingFont),
                        color = ThesisColors.TextPrimary
                    )
                }
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
                ) {
                    SignalBadge(signalValue = stance.uppercase())
                    Text(
                        text = if (isWatched) "FOLLOWED" else "RESEARCH",
                        style = ThesisTypography.labelSmall,
                        color = ThesisColors.TextMuted
                    )
                }
            }

            Text(
                text = headline,
                style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = thesisSummary,
                style = ThesisTypography.bodyLarge,
                color = ThesisColors.TextSecondary
            )
            InlineCallout(
                label = "WHY NOW",
                text = whyNow,
                tint = signalTint(stance)
            )
        }
    }
}

@Composable
internal fun DeepDiveReadThisFirst(report: DeepDiveReportView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.readThisFirst)
        report.storyHeader?.readerTakeaway?.let { takeaway ->
            StorySurface {
                MetaLabel(DeepDiveCopy.readerTakeaway.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = takeaway,
                    style = ThesisTypography.bodyLarge,
                    color = ThesisColors.TextPrimary
                )
            }
        }
        report.changeSummary?.let { changeSummary ->
            StorySurface {
                MetaLabel(DeepDiveCopy.whatChanged.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                ComparisonLine(
                    label = DeepDiveCopy.previousView,
                    text = changeSummary.previousView
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                ComparisonLine(
                    label = DeepDiveCopy.currentView,
                    text = changeSummary.currentView
                )
            }
            changeSummary.topChanges.take(3).forEach { change ->
                TopChangeCard(
                    title = change.title,
                    direction = change.direction,
                    impact = change.impactLevel,
                    changed = change.whyItChanged,
                    matters = change.whyItMatters
                )
            }
        }
        if (report.watchItems.isNotEmpty()) {
            StorySurface {
                MetaLabel(DeepDiveCopy.watchNext.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                report.watchItems.forEach { item ->
                    BulletText(text = item)
                }
            }
        }
    }
}

@Composable
internal fun DeepDiveSeeTheStory(report: DeepDiveReportView) {
    if (report.visualPanels.isEmpty()) {
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.seeTheStory)
        report.visualPanels.forEach { panel ->
            VisualPanelCard(panel = panel)
        }
    }
}

@Composable
internal fun DeepDiveUnderstandIt(report: DeepDiveReportView) {
    val explainers = report.explainers ?: return
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.understandIt)
        ExplainerCard("Signal", explainers.signal)
        ExplainerCard("Confidence", explainers.confidence)
        ExplainerCard("Freshness", explainers.freshness)
        ExplainerCard("Valuation", explainers.valuation)
        ExplainerCard("Omissions", explainers.omissions)
        report.coverageTruth?.let { coverage ->
            StorySurface {
                MetaLabel(DeepDiveCopy.coverageTruth.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = coverage.summary,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondary
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                Text(
                    text = "Covered",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
                coverage.covered.forEach { BulletText(text = it) }
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = "Missing",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
                coverage.missing.forEach { BulletText(text = it) }
            }
        }
    }
}

@Composable
internal fun DeepDiveProofHeading() {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        SectionTitle(DeepDiveCopy.checkTheProof)
        Text(
            text = DeepDiveCopy.proofIntro,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        text = title,
        style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont),
        color = ThesisColors.TextPrimary
    )
}

@Composable
private fun StorySurface(
    modifier: Modifier = Modifier,
    borderColor: Color = ThesisColors.Border,
    backgroundColor: Color = ThesisColors.Surface,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(backgroundColor)
            .border(ThesisDimens.BorderWidth, borderColor, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs),
        content = content
    )
}

@Composable
private fun MetaLabel(text: String) {
    Text(
        text = text,
        style = ThesisTypography.labelSmall,
        color = ThesisColors.Primary
    )
}

@Composable
private fun InlineCallout(label: String, text: String, tint: Color) {
    StorySurface(
        borderColor = tint.copy(alpha = 0.25f),
        backgroundColor = tint.copy(alpha = 0.08f)
    ) {
        MetaLabel(label)
        Text(
            text = text,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
    }
}

@Composable
private fun ComparisonLine(label: String, text: String) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
        Text(
            text = label.uppercase(),
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
        Text(
            text = text,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
    }
}

@Composable
private fun TopChangeCard(
    title: String,
    direction: String,
    impact: String,
    changed: String,
    matters: String
) {
    val tint = changeTint(direction)
    StorySurface(
        borderColor = tint.copy(alpha = 0.25f),
        backgroundColor = tint.copy(alpha = 0.06f)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = impact.uppercase(),
                style = ThesisTypography.labelSmall,
                color = tint
            )
        }
        Text(
            text = changed,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
        Text(
            text = matters,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun VisualPanelCard(panel: DeepDiveVisualPanelView) {
    StorySurface {
        panel.eyebrow?.let { MetaLabel(it.uppercase()) }
        Text(
            text = panel.title,
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        panel.summary?.let {
            Text(
                text = it,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
        when (panel) {
            is MetricDeltaPanelView -> MetricDeltaPanel(panel)
            is TimelinePanelView -> TimelinePanel(panel)
            is RangeBandPanelView -> RangeBandPanel(panel)
            is TrustScorecardPanelView -> TrustScorecardPanel(panel)
            is EvidenceLadderPanelView -> EvidenceLadderPanel(panel)
            is ValuationBridgePanelView -> ValuationBridgePanel(panel)
            is ScenarioComparePanelView -> ScenarioComparePanel(panel)
        }
    }
}

@Composable
private fun MetricDeltaPanel(panel: MetricDeltaPanelView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        panel.metrics.forEach { metric ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = metric.label,
                        style = ThesisTypography.labelLarge,
                        color = ThesisColors.TextPrimary
                    )
                    Text(
                        text = metric.note ?: "${formatMaybeNumber(metric.currentValue)} vs ${formatMaybeNumber(metric.referenceValue)}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                Text(
                    text = formatMaybePercent(metric.deltaPct),
                    style = ThesisTypography.labelLarge,
                    color = changeTint(metric.direction)
                )
            }
        }
    }
}

@Composable
private fun TimelinePanel(panel: TimelinePanelView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        panel.points.forEach { point ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .width(8.dp)
                        .height(8.dp)
                        .background(
                            if (point.emphasis == "current") ThesisColors.Primary else ThesisColors.Border,
                            RoundedCornerShape(8.dp)
                        )
                )
                Spacer(modifier = Modifier.width(ThesisDimens.SpacingSm))
                Text(
                    text = point.label,
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted,
                    modifier = Modifier.weight(0.42f)
                )
                Text(
                    text = point.value,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextSecondary,
                    modifier = Modifier.weight(0.58f)
                )
            }
        }
    }
}

@Composable
private fun RangeBandPanel(panel: RangeBandPanelView) {
    Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        StatColumn("Low", panel.lowValue)
        StatColumn("Mid", panel.midValue)
        StatColumn("High", panel.highValue)
    }
    panel.referenceValue?.let {
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
        ComparisonLine(
            label = panel.referenceLabel ?: "Reference",
            text = "${panel.valueLabel ?: "Fair value"} compared with ${formatMaybeNumber(it)}"
        )
    }
}

@Composable
private fun TrustScorecardPanel(panel: TrustScorecardPanelView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            LabelValuePill("Freshness", panel.freshnessState ?: "unknown")
            LabelValuePill("Evidence", panel.evidenceCount?.toString() ?: "n/a")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            LabelValuePill("Contradiction", panel.contradictionState ?: "unknown")
            LabelValuePill("Valuation", panel.valuationState ?: "unknown")
        }
    }
}

@Composable
private fun EvidenceLadderPanel(panel: EvidenceLadderPanelView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        panel.rungs.forEach { rung ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = rung.label,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextSecondary
                )
                Text(
                    text = rung.count.toString(),
                    style = ThesisTypography.labelLarge,
                    color = ladderTint(rung.tone)
                )
            }
        }
    }
}

@Composable
private fun ValuationBridgePanel(panel: ValuationBridgePanelView) {
    Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        panel.points.take(4).forEach { point ->
            StatColumn(point.label, point.value, bridgeTint(point.tone))
        }
    }
}

@Composable
private fun ScenarioComparePanel(panel: ScenarioComparePanelView) {
    Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        StatColumn(panel.baseLabel, panel.baseValue)
        StatColumn(panel.scenarioLabel, panel.scenarioValue)
    }
    panel.deltaText?.let {
        Text(
            text = it,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun RowScope.StatColumn(label: String, value: Double?, color: Color = ThesisColors.TextPrimary) {
    Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
    ) {
        Text(
            text = label.uppercase(),
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
        Text(
            text = formatMaybeNumber(value),
            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
            color = color
        )
    }
}

@Composable
private fun RowScope.LabelValuePill(label: String, value: String) {
    Column(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(ThesisColors.SurfaceElevated)
            .border(ThesisDimens.BorderWidth, ThesisColors.BorderSubtle, RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .padding(ThesisDimens.SpacingMd),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
    ) {
        Text(
            text = label.uppercase(),
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
        Text(
            text = value.replace('_', ' '),
            style = ThesisTypography.labelLarge,
            color = ThesisColors.TextPrimary
        )
    }
}

@Composable
private fun ExplainerCard(title: String, body: String) {
    StorySurface {
        MetaLabel(title.uppercase())
        Text(
            text = body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
    }
}

@Composable
private fun BulletText(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = "-",
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.Primary
        )
        Text(
            text = text,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary,
            modifier = Modifier.weight(1f)
        )
    }
}

private fun signalTint(signal: String): Color = when (signal.lowercase()) {
    "positive" -> ThesisColors.SignalPositive
    "negative" -> ThesisColors.SignalNegative
    "neutral" -> ThesisColors.SignalNeutral
    else -> ThesisColors.SignalWarning
}

private fun changeTint(direction: String): Color = when (direction.lowercase()) {
    "up" -> ThesisColors.SignalPositive
    "down" -> ThesisColors.SignalNegative
    "flat" -> ThesisColors.SignalNeutral
    "mixed" -> ThesisColors.SignalWarning
    else -> ThesisColors.SignalWarning
}

private fun ladderTint(tone: String): Color = when (tone.lowercase()) {
    "strong" -> ThesisColors.SignalPositive
    "moderate" -> ThesisColors.Primary
    else -> ThesisColors.TextMuted
}

private fun bridgeTint(tone: String): Color = when (tone.lowercase()) {
    "spot" -> ThesisColors.SignalWarning
    "mid" -> ThesisColors.Primary
    "high" -> ThesisColors.SignalPositive
    "low" -> ThesisColors.SignalNegative
    else -> ThesisColors.TextPrimary
}

private fun formatMaybeNumber(value: Double?): String =
    value?.let { String.format("%.2f", it) } ?: "n/a"

private fun formatMaybePercent(value: Double?): String =
    value?.let { String.format("%.1f%%", it) } ?: "n/a"
