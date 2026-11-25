package com.thesis.mobile.ui.charts.kit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.components.Meter
import com.thesis.mobile.ui.copy.ChartCopy
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.markColor
import com.thesis.mobile.ui.theme.tnum
import kotlin.math.max
import kotlin.math.min

/*
 * RankedBars and MeterRow (section 3 "Charts"; deep-dive-visual-language.md section 8: ranked horizontal bars, 34 dp
 * rows, label 11 / 500 left, value 11 / 600 tabular right, 8 dp track on `grid` radius 4, sorted descending; meters:
 * label, 8 dp track, 52 dp value). Fills are `ink2` @ 60% (lists, grids); a [Tone] colours a bar by meaning, the
 * accent marks the one subject. Signed values diverge from a zero line.
 */

/**
 * One ranked bar. [valueText] is the formatted value with its unit ("+6 pts"); a missing [value] shows
 * [valueText] (one of the three words of 2.4) in place of the bar. [rationale] makes the two-line (52 dp) row.
 */
@Immutable
data class RankedBar(
    val label: String,
    val value: Double?,
    val valueText: String,
    val rationale: String? = null,
    val tone: Tone? = null,
    val subject: Boolean = false,
)

/**
 * Ranked bars, sorted descending (gaps last) when [sorted]. [scaleLabel] is the header that states the scale
 * ("Change in monitor score in the scenario, points"); it is also the start of the spoken summary. [dataKey]
 * grows the bars once per data identity.
 */
@Composable
fun RankedBars(
    items: List<RankedBar>,
    scaleLabel: String,
    modifier: Modifier = Modifier,
    sorted: Boolean = true,
    dataKey: Any? = null,
    emptyText: String = ChartCopy.NO_DATA,
) {
    val p = LocalThesisPalette.current
    val rows = remember(items, sorted) { if (sorted) ChartMath.rankedDescending(items) { it.value } else items }
    val finite = rows.mapNotNull { it.value.finiteOrNull() }
    val lo = min(0.0, finite.minOrNull() ?: 0.0)
    val hi = max(0.0, finite.maxOrNull() ?: 0.0)
    val span = (hi - lo).takeIf { it > 0.0 } ?: 1.0
    val zero = ((0.0 - lo) / span).toFloat()
    val reveal = rememberDrawOn(DrawOnKind.Ranked, dataKey)
    // One value column for every row (the widest figure), so the tracks line up. A missing value's word sits in
    // the track instead (no bar), so it never widens the column and pushes the figures away from their bars.
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val valueWidth = remember(rows, density) {
        with(density) {
            (rows.filter { it.value.finiteOrNull() != null }.maxOfOrNull { measurer.line(it.valueText, ChartText.rankValue).size.width } ?: 0).toDp()
        }
    }.coerceAtLeast(ChartDims.valueColumn)
    Column(modifier.fillMaxWidth()) {
        Text(scaleLabel, style = ThesisType.caption, color = p.muted)
        Spacer(Modifier.height(ThesisSpace.s))
        if (finite.isEmpty()) {
            ChartEmpty(emptyText)
            return@Column
        }
        rows.forEach { item ->
            val v = item.value.finiteOrNull()
            Column(
                Modifier
                    .fillMaxWidth()
                    // The row height is a minimum; the padding keeps rows apart when large text outgrows it.
                    .heightIn(min = if (item.rationale != null) ChartDims.rankedRowTwoLine else ChartDims.rankedRow)
                    .padding(vertical = ThesisSpace.s)
                    .semantics(mergeDescendants = true) {
                        contentDescription = listOfNotNull(item.label, item.valueText, item.rationale).joinToString(", ")
                    },
                verticalArrangement = Arrangement.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                    Text(item.label, Modifier.weight(LABEL_SHARE), style = ChartText.rankLabel, color = p.ink)
                    if (v == null) {
                        Text(item.valueText, Modifier.weight(1f - LABEL_SHARE), style = ChartText.rankValue, color = p.muted)
                        Spacer(Modifier.width(valueWidth))
                    } else {
                        Box(
                            Modifier
                                .weight(1f - LABEL_SHARE)
                                .height(ChartDims.track)
                                .drawBehind {
                                    val radius = CornerRadius(ChartDims.trackRadius.toPx())
                                    drawRoundRect(p.grid, cornerRadius = radius)
                                    val f = ((v - lo) / span).toFloat()
                                    val a = min(zero, f) * size.width
                                    val b = max(zero, f) * size.width
                                    val grow = reveal.value
                                    val start = if (v >= 0) a else b - (b - a) * grow
                                    val w = (b - a) * grow
                                    if (w > 0f) {
                                        drawRoundRect(barColor(p, item), topLeft = Offset(start, 0f), size = Size(w, size.height), cornerRadius = radius)
                                    }
                                    if (lo < 0.0) {
                                        val zx = zero * size.width
                                        drawLine(p.axis, Offset(zx, -ChartDims.zeroOverhang.toPx()), Offset(zx, size.height + ChartDims.zeroOverhang.toPx()), ChartDims.hairline.toPx())
                                    }
                                },
                        )
                        Text(
                            item.valueText,
                            Modifier.width(valueWidth),
                            style = ChartText.rankValue,
                            color = p.ink,
                            textAlign = TextAlign.End,
                        )
                    }
                }
                if (item.rationale != null) {
                    Spacer(Modifier.height(ThesisSpace.xxs))
                    // The label (11 / 500 ink) leads; the reason under it is no larger (11 / 400 ink2).
                    Text(item.rationale, style = ChartText.rankNote, color = p.ink2, maxLines = 2)
                }
            }
        }
    }
}

private const val LABEL_SHARE = 0.38f

private fun barColor(p: ThesisPalette, item: RankedBar): Color = when {
    item.tone != null -> item.tone.markColor(p)
    item.subject -> p.series[0] // marks take the bright gold; accent is for subject text and UI (section 2.2)
    else -> p.ink2.copy(alpha = Kit.METER_FILL_ALPHA)
}

/**
 * A meter with its label and value (DD meter row: label, track, 52 dp value) over the kit [Meter]: `ink2` @ 60%
 * on `grid` in lists and grids, [tone] by meaning, [subject] = the one accent meter of a screen. [value] runs from
 * [min] to [max]; the spoken text is "label, valueText of max". [valueWidth] is the value column: keep the
 * default (or pass one width) for every row of a group so the tracks line up; a missing [value]'s word sits in the
 * track's place instead of widening the column.
 */
@Composable
fun MeterRow(
    label: String,
    value: Double?,
    valueText: String,
    modifier: Modifier = Modifier,
    min: Double = 0.0,
    max: Double = 100.0,
    maxText: String? = null,
    subject: Boolean = false,
    tone: Tone? = null,
    valueWidth: Dp = ChartDims.valueColumn,
) {
    val p = LocalThesisPalette.current
    val span = (max - min).takeIf { it > 0.0 && it.isFinite() } ?: 1.0
    val f = value.finiteOrNull()?.let { ((it - min) / span).toFloat().coerceIn(0f, 1f) } ?: 0f
    val spoken = listOfNotNull(label, valueText + (maxText?.let { " of $it" } ?: "")).joinToString(", ")
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = ChartDims.rankedRow)
            .semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        Text(label, Modifier.weight(LABEL_SHARE), style = ThesisType.bodySmall, color = p.ink2)
        if (value.finiteOrNull() == null) {
            Text(valueText, Modifier.weight(1f - LABEL_SHARE), style = ThesisType.bodySmall, color = p.muted)
            Spacer(Modifier.width(valueWidth))
        } else {
            Box(Modifier.weight(1f - LABEL_SHARE)) {
                Meter(f, subject = subject, tone = tone)
            }
            Text(
                valueText,
                Modifier.width(valueWidth),
                style = ThesisType.bodySmall.tnum(),
                color = p.ink,
                textAlign = TextAlign.End,
            )
        }
    }
}
