package com.thesis.mobile.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.FilingMetricDeltaView
import com.thesis.mobile.model.FilingReadView
import com.thesis.mobile.model.IndicatorView
import com.thesis.mobile.model.IndicatorsReadView
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.util.Locale
import kotlin.math.abs

/**
 * The Deep Dive memo blocks that used to exist only in the HTML/PDF export:
 * the filing read, the value lens, key indicators and plain-English education.
 * Renders nothing when the report has neither block.
 */
@Composable
internal fun DeepDiveNativeMemo(report: DeepDiveReportView) {
    val filing = report.filingRead
    val indicators = report.indicatorsRead
    if (filing == null && indicators == null) {
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXl)) {
        filing?.let { FilingReadBlock(it) }
        indicators?.let { ValueLensBlock(it) }
        indicators?.takeIf { it.indicators.isNotEmpty() }?.let { KeyIndicatorsBlock(it.indicators) }
        indicators?.takeIf { it.education.isNotEmpty() }?.let { block ->
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                SectionTitle("Learn the terms")
                block.education.forEach { box ->
                    ExplainerCard(
                        title = box.title,
                        body = listOfNotNull(box.body, box.example).joinToString("\n\n")
                    )
                }
            }
        }
    }
}

/** Scenario Stress is an action on an open Deep Dive, not a separate Research destination. */
@Composable
internal fun DeepDiveStressAction(onClick: () -> Unit) {
    StorySurface(modifier = Modifier.clickable(onClick = onClick)) {
        Text(
            text = "STRESS TEST",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.Primary
        )
        Text(
            text = "See how this name and your list hold up in market scenarios",
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
    }
}

@Composable
private fun FilingReadBlock(filing: FilingReadView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        SectionTitle("The filing read")
        listOfNotNull(filing.form, filing.period).takeIf { it.isNotEmpty() }?.let { parts ->
            Text(
                text = parts.joinToString(" · "),
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted
            )
        }
        Paragraph(filing.theFilingRead)
        if (filing.takeaway.isNotBlank()) {
            InlineCallout("IN PLAIN ENGLISH", filing.takeaway, ThesisColors.Primary)
        }
        if (filing.topChanges.isNotEmpty()) {
            StorySurface {
                Text(
                    text = "WHAT CHANGED",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.Primary
                )
                filing.topChanges.take(4).forEach { BulletText(it) }
            }
        }
        filing.metricDeltas.take(4).forEach { MetricDeltaRow(it) }
        if (filing.theGood.isNotBlank()) ComparisonLine("The good", filing.theGood)
        if (filing.theBad.isNotBlank()) ComparisonLine("The bad", filing.theBad)
        if (filing.whatToWatchNext.isNotBlank()) ComparisonLine("What to watch next", filing.whatToWatchNext)
    }
}

@Composable
private fun MetricDeltaRow(delta: FilingMetricDeltaView) {
    val tint = when (delta.direction) {
        "improved" -> ThesisColors.SignalPositive
        "weakened" -> ThesisColors.SignalNegative
        "mixed" -> ThesisColors.SignalWarning
        else -> ThesisColors.SignalNeutral
    }
    StorySurface {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                text = delta.label,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary,
                modifier = Modifier.weight(1f)
            )
            delta.deltaPct?.let { pct ->
                Text(
                    text = String.format(Locale.US, "%+.1f%%", pct),
                    style = ThesisTypography.labelLarge,
                    color = tint
                )
            }
        }
        Text(
            text = "${delta.currentPeriod}: ${formatValue(delta.currentValue, delta.unit)}" +
                "  ·  ${delta.referencePeriod ?: "prior"}: ${formatValue(delta.referenceValue, delta.unit)}",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
        Paragraph(delta.plainEnglish)
    }
}

@Composable
private fun ValueLensBlock(read: IndicatorsReadView) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        SectionTitle("Value lens")
        read.classification?.let { classification ->
            val confidence = read.classificationConfidence?.let { " · $it confidence" }.orEmpty()
            Text(
                text = classification.replace('_', ' ').replaceFirstChar { it.uppercase() } + confidence,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.Primary
            )
        }
        Paragraph(read.valueLens)
        read.classificationReasons.forEach { BulletText(it) }
        read.trapWarnings.forEach { warning ->
            InlineCallout("VALUE TRAP WARNING", warning, ThesisColors.SignalWarning)
        }
        if (read.takeaway.isNotBlank()) {
            InlineCallout("IN PLAIN ENGLISH", read.takeaway, ThesisColors.Primary)
        }
        if (read.businessQuality.isNotBlank()) ComparisonLine("Business quality", read.businessQuality)
        if (read.cashFlowRead.isNotBlank()) ComparisonLine("Cash flow", read.cashFlowRead)
        if (read.balanceSheetRead.isNotBlank()) ComparisonLine("Balance sheet", read.balanceSheetRead)
        if (read.fiveYearRead.isNotBlank()) ComparisonLine("Five-year read", read.fiveYearRead)
        if (read.whatToWatchNext.isNotBlank()) ComparisonLine("What to watch next", read.whatToWatchNext)
    }
}

@Composable
private fun KeyIndicatorsBlock(indicators: List<IndicatorView>) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        SectionTitle("Key indicators")
        indicators.groupBy { it.group }.forEach { (group, rows) ->
            StorySurface {
                Text(
                    text = group.replace('_', ' ').uppercase(),
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.Primary
                )
                rows.forEach { indicator ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            text = indicator.label,
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.TextPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = formatValue(indicator.value, indicator.unit),
                            style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary
                        )
                    }
                    Text(
                        text = indicator.interpretation,
                        style = ThesisTypography.labelSmall,
                        color = ThesisColors.TextMuted
                    )
                }
            }
        }
    }
}

@Composable
private fun Paragraph(text: String) {
    if (text.isBlank()) {
        return
    }
    Text(text = text, style = ThesisTypography.bodyMedium, color = ThesisColors.TextSecondary)
}

private fun formatValue(value: Double?, unit: String): String {
    if (value == null) {
        return "n/a"
    }
    return when (unit) {
        "pct" -> String.format(Locale.US, "%.1f%%", value)
        "multiple" -> String.format(Locale.US, "%.1fx", value)
        "ratio" -> String.format(Locale.US, "%.2f", value)
        "currency" -> when {
            abs(value) >= 1e12 -> String.format(Locale.US, "$%.2fT", value / 1e12)
            abs(value) >= 1e9 -> String.format(Locale.US, "$%.1fB", value / 1e9)
            abs(value) >= 1e6 -> String.format(Locale.US, "$%.1fM", value / 1e6)
            else -> String.format(Locale.US, "$%,.2f", value)
        }
        else -> String.format(Locale.US, "%,.0f", value)
    }
}
