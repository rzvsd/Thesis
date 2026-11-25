package com.thesis.mobile.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveVisualPanelView
import com.thesis.mobile.model.DueDiligenceSectionView
import com.thesis.mobile.model.EvidenceLadderPanelView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.RangeBandPanelView
import com.thesis.mobile.model.ScenarioComparePanelView
import com.thesis.mobile.model.TimelinePanelView
import com.thesis.mobile.model.TrustScorecardPanelView
import com.thesis.mobile.model.ValuationBridgePanelView
import com.thesis.mobile.model.memoSection
import com.thesis.mobile.model.readerIssuerMetadataLine
import com.thesis.mobile.model.readerIssuerName
import com.thesis.mobile.model.toReaderOutline
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
    val issuerName = report.readerIssuerName()
    val issuerMetadataLine = report.readerIssuerMetadataLine()
    val headline = header?.headline ?: "$issuerName Deep Dive"
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
                    MetaLabel(DeepDiveCopy.deepReport.uppercase())
                    Text(
                        text = issuerName,
                        style = ThesisTypography.displayMedium.copy(fontFamily = HeadingFont),
                        color = ThesisColors.TextPrimary
                    )
                    issuerMetadataLine?.let { metadataLine ->
                        Text(
                            text = metadataLine,
                            style = ThesisTypography.labelLarge,
                            color = ThesisColors.TextMuted
                        )
                    }
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
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                LabelValuePill("Confidence", report.confidenceLabel ?: report.confidence?.label ?: "unknown")
                LabelValuePill("Freshness", report.trustMetadata?.freshnessState ?: "unknown")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                LabelValuePill("Evidence", report.trustMetadata?.evidenceCount?.toString() ?: "n/a")
                LabelValuePill("Valuation", report.trustMetadata?.valuationState ?: "unknown")
            }
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
    val outline = report.toReaderOutline()
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.readThisFirst)
        report.investmentMemo?.decisionQuestion?.let { decisionQuestion ->
            StorySurface {
                MetaLabel(DeepDiveCopy.decisionQuestion.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = decisionQuestion,
                    style = ThesisTypography.bodyLarge,
                    color = ThesisColors.TextPrimary
                )
            }
        }
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
        if (outline.topRisks.isNotEmpty()) {
            StorySurface(
                borderColor = ThesisColors.SignalWarning.copy(alpha = 0.2f),
                backgroundColor = ThesisColors.SignalWarning.copy(alpha = 0.06f)
            ) {
                MetaLabel(DeepDiveCopy.topRisks.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                outline.topRisks.forEach { risk ->
                    BulletText(text = risk)
                }
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
internal fun DeepDiveExecutiveMemo(report: DeepDiveReportView) {
    val memo = report.investmentMemo ?: return
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.executiveMemo)
        StorySurface {
            MetaLabel(DeepDiveCopy.companyAngle.uppercase())
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Text(
                text = memo.companyAngle,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondary
            )
        }
        memo.sections.take(3).forEach { section ->
            StorySurface {
                MetaLabel(section.title.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = section.narrative,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondary
                )
                if (section.keyPoints.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    section.keyPoints.forEach { BulletText(text = it) }
                }
            }
        }
        if (memo.sparseDataHonestyNote.isNotBlank()) {
            StorySurface(
                borderColor = ThesisColors.BorderSubtle,
                backgroundColor = ThesisColors.SurfaceElevated
            ) {
                MetaLabel(DeepDiveCopy.omittedInputs.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = memo.sparseDataHonestyNote,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
    }
}

@Composable
internal fun DeepDiveDueDiligence(report: DeepDiveReportView) {
    val outline = report.toReaderOutline()
    if (outline.dueDiligenceSections.isEmpty()) {
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.dueDiligence)
        outline.dueDiligenceSections.forEach { section ->
            DueDiligenceSectionCard(section = section)
        }
    }
}

@Composable
internal fun DeepDiveFinancialQuality(report: DeepDiveReportView) {
    val financials = report.financialAnalysis ?: return
    val outline = report.toReaderOutline()
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.financialQuality)
        if (financials.annualHistory.isNotEmpty()) {
            StorySurface {
                MetaLabel(DeepDiveCopy.fiveYearView.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                financials.annualHistory.takeLast(5).forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = row.period,
                            style = ThesisTypography.labelSmall,
                            color = ThesisColors.TextMuted
                        )
                        Text(
                            text = "Revenue ${formatMaybeNumber(row.revenue)} | FCF ${formatMaybeNumber(row.freeCashFlow)} | Debt ${formatMaybeNumber(row.debtTotal)}",
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextSecondary
                        )
                    }
                }
            }
        }
        if (financials.trendMetrics.isNotEmpty()) {
            StorySurface {
                MetaLabel("TREND METRICS")
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                MetricGrid(metrics = financials.trendMetrics)
            }
        }
        if (financials.qualityMetrics.isNotEmpty()) {
            StorySurface {
                MetaLabel("QUALITY METRICS")
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                MetricGrid(metrics = financials.qualityMetrics)
            }
        }
        outline.financialPanels.forEach { panel ->
            VisualPanelCard(panel = panel)
        }
        if (financials.omissions.isNotEmpty()) {
            StorySurface {
                MetaLabel(DeepDiveCopy.omittedInputs.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                financials.omissions.forEach { omission ->
                    BulletText(text = "${omission.label}: ${omission.reason}")
                }
            }
        }
    }
}

@Composable
internal fun DeepDiveValueDiscipline(report: DeepDiveReportView) {
    val valueDiscipline = report.valueDiscipline ?: return
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.valueDiscipline)
        StorySurface {
            MetaLabel("SCORECARD")
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                StatColumn("Score", valueDiscipline.score.toDouble())
                StatColumn("Max", valueDiscipline.maxScore.toDouble())
                StatColumn("Signals", valueDiscipline.availableSignals.toDouble())
            }
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            ComparisonLine("Context", valueDiscipline.contextLabel.replace('_', ' '))
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Text(
                text = valueDiscipline.interpretation,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondary
            )
        }
        valueDiscipline.signals.groupBy { it.family }.forEach { (family, signals) ->
            StorySurface {
                MetaLabel(family.replace('_', ' ').uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                signals.forEach { signal ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = signal.label,
                                style = ThesisTypography.labelLarge,
                                color = ThesisColors.TextPrimary
                            )
                            Text(
                                text = signal.reason,
                                style = ThesisTypography.bodySmall,
                                color = ThesisColors.TextMuted
                            )
                        }
                        Text(
                            text = signal.status.uppercase(),
                            style = ThesisTypography.labelSmall,
                            color = valueSignalTint(signal.status)
                        )
                    }
                }
            }
        }
        if (valueDiscipline.missingSignals.isNotEmpty()) {
            StorySurface {
                MetaLabel(DeepDiveCopy.omittedInputs.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                valueDiscipline.missingSignals.forEach { BulletText(text = it) }
            }
        }
        StorySurface(
            borderColor = ThesisColors.SignalWarning.copy(alpha = 0.2f),
            backgroundColor = ThesisColors.SignalWarning.copy(alpha = 0.06f)
        ) {
            MetaLabel(DeepDiveCopy.whatThisDoesNotProve.uppercase())
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Text(
                text = valueDiscipline.doesNotProve,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondary
            )
            if (valueDiscipline.valueTrapWarning.summary.isNotBlank()) {
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = valueDiscipline.valueTrapWarning.summary,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
    }
}

@Composable
internal fun DeepDiveValuationSection(report: DeepDiveReportView) {
    val outline = report.toReaderOutline()
    if (report.valuation == null && outline.valuationPanels.isEmpty()) {
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.valuation)
        report.valuation?.let { valuation ->
            StorySurface {
                MetaLabel("FAIR VALUE")
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    StatColumn("Low", valuation.fairValueLow)
                    StatColumn("Mid", valuation.fairValueMid)
                    StatColumn("High", valuation.fairValueHigh)
                }
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                ComparisonLine("Spot", formatMaybeNumber(valuation.spotPrice))
                valuation.assumptions?.let { assumptions ->
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    Text(
                        text = "DCF over ${assumptions.projectionYears ?: 0} years, terminal growth ${formatMaybePercent(assumptions.terminalGrowthRate)}, WACC ${formatMaybePercent(assumptions.wacc)}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                valuation.degradedReason?.let { degradedReason ->
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    Text(
                        text = degradedReason,
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
            }
        }
        outline.valuationPanels.forEach { panel ->
            VisualPanelCard(panel = panel)
        }
        report.explainers?.valuation?.let { explanation ->
            ExplainerCard("Valuation", explanation)
        }
    }
}

@Composable
internal fun DeepDiveRisksAndKillSwitches(report: DeepDiveReportView) {
    val outline = report.toReaderOutline()
    val riskSection = report.memoSection("risks")
    if (riskSection == null && report.killSwitchConditions.isEmpty() && outline.topRisks.isEmpty() && report.watchItems.isEmpty()) {
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.risksAndKillSwitches)
        riskSection?.let { section ->
            StorySurface {
                MetaLabel(section.title.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = section.narrative,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondary
                )
                if (section.keyPoints.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    section.keyPoints.forEach { BulletText(text = it) }
                }
            }
        }
        if (report.killSwitchConditions.isNotEmpty()) {
            StorySurface(
                borderColor = ThesisColors.SignalNegative.copy(alpha = 0.2f),
                backgroundColor = ThesisColors.SignalNegative.copy(alpha = 0.05f)
            ) {
                MetaLabel(DeepDiveCopy.killSwitches.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                report.killSwitchConditions.forEach { condition ->
                    Text(
                        text = condition.conditionText,
                        style = ThesisTypography.labelLarge,
                        color = ThesisColors.TextPrimary
                    )
                    Text(
                        text = listOfNotNull(condition.signalType, condition.thresholdDescription).joinToString(" | "),
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                }
            }
        }
        if (report.watchItems.isNotEmpty()) {
            StorySurface {
                MetaLabel(DeepDiveCopy.watchNext.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                report.watchItems.forEach { BulletText(text = it) }
            }
        }
        outline.riskPanels.forEach { panel ->
            VisualPanelCard(panel = panel)
        }
    }
}

@Composable
internal fun DeepDiveEvidenceAndAppendix(report: DeepDiveReportView) {
    val outline = report.toReaderOutline()
    if (
        report.investmentMemo == null &&
        outline.evidencePanels.isEmpty() &&
        outline.dueDiligenceEvidenceSections.isEmpty() &&
        report.coverageTruth == null
    ) {
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionTitle(DeepDiveCopy.evidenceAndAppendix)
        report.investmentMemo?.materialClaims?.take(4)?.let { claims ->
            if (claims.isNotEmpty()) {
                StorySurface {
                    MetaLabel(DeepDiveCopy.claimSupport.uppercase())
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    claims.forEach { claim ->
                        Text(
                            text = claim.statement,
                            style = ThesisTypography.labelLarge,
                            color = ThesisColors.TextPrimary
                        )
                        claim.supports.forEach { support ->
                            BulletText(text = "${support.supportType}: ${support.summary}")
                        }
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    }
                }
            }
        }
        outline.evidencePanels.forEach { panel ->
            VisualPanelCard(panel = panel)
        }
        if (outline.dueDiligenceEvidenceSections.isNotEmpty()) {
            StorySurface {
                MetaLabel(DeepDiveCopy.dueDiligenceTrail.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                outline.dueDiligenceEvidenceSections.forEach { section ->
                    Text(
                        text = section.title,
                        style = ThesisTypography.labelLarge,
                        color = ThesisColors.TextPrimary
                    )
                    Text(
                        text = listOf(
                            "${section.evidenceRefs.size} evidence refs",
                            "${section.omissions.size} omissions",
                            "${coverageStateLabel(section.coverageState)} coverage"
                        ).joinToString(" | "),
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                }
            }
        }
        report.coverageTruth?.let { coverage ->
            StorySurface {
                MetaLabel(DeepDiveCopy.coverageTruth.uppercase())
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                Text(
                    text = coverage.summary,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondary
                )
                if (coverage.covered.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    coverage.covered.forEach { BulletText(text = it) }
                }
                if (coverage.missing.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    coverage.missing.forEach { BulletText(text = it) }
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
internal fun SectionTitle(title: String) {
    Text(
        text = title,
        style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont),
        color = ThesisColors.TextPrimary
    )
}

@Composable
internal fun StorySurface(
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
internal fun InlineCallout(label: String, text: String, tint: Color) {
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
internal fun ComparisonLine(label: String, text: String) {
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
private fun DueDiligenceSectionCard(section: DueDiligenceSectionView) {
    var isExpanded by rememberSaveable(section.sectionId) { mutableStateOf(false) }
    val tint = coverageStateTint(section.coverageState)
    val chevronRotation by animateFloatAsState(
        targetValue = if (isExpanded) 180f else 0f,
        label = "due_diligence_section_chevron"
    )
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(tint.copy(alpha = 0.06f))
            .border(ThesisDimens.BorderWidth, tint.copy(alpha = 0.25f), shape)
            .clickable { isExpanded = !isExpanded }
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
            ) {
                MetaLabel(section.sectionId.replace('_', ' ').uppercase())
                Text(
                    text = section.title,
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
            }
            Spacer(modifier = Modifier.width(ThesisDimens.SpacingSm))
            CoverageStateChip(section.coverageState)
            Spacer(modifier = Modifier.width(ThesisDimens.SpacingSm))
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = if (isExpanded) "Collapse due diligence section" else "Expand due diligence section",
                tint = tint,
                modifier = Modifier.rotate(chevronRotation)
            )
        }

        MetaLabel(DeepDiveCopy.summaryPreview.uppercase())
        Text(
            text = section.summary,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
        Text(
            text = if (isExpanded) DeepDiveCopy.hideFullSection else DeepDiveCopy.readFullSection,
            style = ThesisTypography.labelLarge,
            color = tint
        )

        AnimatedVisibility(visible = isExpanded) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                MetaLabel(DeepDiveCopy.fullNarrative.uppercase())
                section.narrativeParagraphs.forEach { paragraph ->
                    Text(
                        text = paragraph,
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextSecondary
                    )
                }

                if (section.keyPoints.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                    MetaLabel(DeepDiveCopy.keyPoints.uppercase())
                    section.keyPoints.forEach { point ->
                        BulletText(text = point)
                    }
                }

                if (section.evidenceRefs.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                    MetaLabel(DeepDiveCopy.evidenceRefs.uppercase())
                    section.evidenceRefs.forEach { ref ->
                        BulletText(text = ref)
                    }
                }

                if (section.omissions.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                    MetaLabel(DeepDiveCopy.omittedInputs.uppercase())
                    section.omissions.forEach { omission ->
                        BulletText(text = omission)
                    }
                }
            }
        }
    }
}

@Composable
private fun CoverageStateChip(coverageState: String) {
    val tint = coverageStateTint(coverageState)
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Box(
        modifier = Modifier
            .clip(shape)
            .background(tint.copy(alpha = 0.12f))
            .border(ThesisDimens.BorderWidth, tint.copy(alpha = 0.2f), shape)
            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
    ) {
        Text(
            text = coverageStateLabel(coverageState).uppercase(),
            style = ThesisTypography.labelSmall,
            color = tint
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
internal fun ExplainerCard(title: String, body: String) {
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
internal fun BulletText(text: String) {
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

@Composable
private fun MetricGrid(metrics: List<FinancialDerivedMetricView>) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        metrics.forEach { metric ->
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
                    metric.note?.let { note ->
                        Text(
                            text = note,
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextMuted
                        )
                    }
                }
                Text(
                    text = formatMetricValue(metric),
                    style = ThesisTypography.labelLarge,
                    color = metricTint(metric.direction, metric.status)
                )
            }
        }
    }
}

@Composable
@ReadOnlyComposable
private fun signalTint(signal: String): Color = when (signal.lowercase()) {
    "positive" -> ThesisColors.SignalPositive
    "negative" -> ThesisColors.SignalNegative
    "neutral" -> ThesisColors.SignalNeutral
    else -> ThesisColors.SignalWarning
}

@Composable
@ReadOnlyComposable
private fun changeTint(direction: String): Color = when (direction.lowercase()) {
    "up" -> ThesisColors.SignalPositive
    "down" -> ThesisColors.SignalNegative
    "flat" -> ThesisColors.SignalNeutral
    "mixed" -> ThesisColors.SignalWarning
    else -> ThesisColors.SignalWarning
}

@Composable
@ReadOnlyComposable
private fun ladderTint(tone: String): Color = when (tone.lowercase()) {
    "strong" -> ThesisColors.SignalPositive
    "moderate" -> ThesisColors.Primary
    else -> ThesisColors.TextMuted
}

@Composable
@ReadOnlyComposable
private fun bridgeTint(tone: String): Color = when (tone.lowercase()) {
    "spot" -> ThesisColors.SignalWarning
    "mid" -> ThesisColors.Primary
    "high" -> ThesisColors.SignalPositive
    "low" -> ThesisColors.SignalNegative
    else -> ThesisColors.TextPrimary
}

@Composable
@ReadOnlyComposable
private fun valueSignalTint(status: String): Color = when (status.lowercase()) {
    "pass" -> ThesisColors.SignalPositive
    "fail" -> ThesisColors.SignalNegative
    else -> ThesisColors.SignalWarning
}

@Composable
@ReadOnlyComposable
private fun coverageStateTint(coverageState: String): Color = when (coverageState.lowercase()) {
    "full" -> ThesisColors.Primary
    "limited" -> ThesisColors.SignalNegative
    else -> ThesisColors.SignalWarning
}

private fun coverageStateLabel(coverageState: String): String = when (coverageState.lowercase()) {
    "full" -> "Full"
    "partial" -> "Partial"
    "limited" -> "Limited"
    else -> coverageState.replace('_', ' ')
}

@Composable
@ReadOnlyComposable
private fun metricTint(direction: String, status: String): Color {
    if (status.equals("omitted", ignoreCase = true)) {
        return ThesisColors.TextMuted
    }
    return when (direction.lowercase()) {
        "improving" -> ThesisColors.SignalPositive
        "deteriorating" -> ThesisColors.SignalNegative
        "flat" -> ThesisColors.SignalNeutral
        else -> ThesisColors.TextMuted
    }
}

private fun formatMetricValue(metric: FinancialDerivedMetricView): String {
    if (!metric.status.equals("available", ignoreCase = true)) {
        return "omitted"
    }
    val value = metric.value ?: return "n/a"
    return when (metric.unit.lowercase()) {
        "pct" -> formatMaybePercent(value)
        else -> formatMaybeNumber(value)
    }
}

private fun formatMaybeNumber(value: Double?): String =
    value?.let { String.format("%.2f", it) } ?: "n/a"

private fun formatMaybePercent(value: Double?): String =
    value?.let { String.format("%.1f%%", it) } ?: "n/a"
