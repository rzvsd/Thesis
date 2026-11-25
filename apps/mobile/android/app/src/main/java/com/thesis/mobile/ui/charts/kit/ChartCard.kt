package com.thesis.mobile.ui.charts.kit

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.VisibilityThreshold
import androidx.compose.animation.core.snap
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntSize
import com.thesis.mobile.ui.components.CardFooter
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Chart card anatomy (section 3 "Charts", the renderer's chart card in dd-shots/renderer-*-05 and -08):
 *   CHART 3                         gold fignum (eyebrow, accent @ .9)
 *   Sales grew 5.9% a year ...      serif conclusion title (cardTitle), a heading
 *   Sales, fiscal years             subtitle: units and period (caption, muted)
 *   [readout] [chart] [legend]      the chart, a legend only for two or more series
 *   [table]                         "Show table" expands the values as a CompareTable in place
 *   ---- Income statement   Show table     card foot: hairline, source, the table toggle
 */

/** Labels of the table toggle in the card foot. */
const val SHOW_TABLE = "Show table"
const val HIDE_TABLE = "Hide table"

/**
 * A chart card. [fignum] is the figure number ("CHART 3"); [title] is a conclusion sentence, not a label
 * ("Macro stress is Balanced and rising"); [subtitle] names units and period ("Score 0 to 100, last 30 days").
 * [readout] sits above the chart ([LineChartReadout] for scrubbable lines). With a [table] the foot carries
 * "Show table", which expands a [CompareTable] of the values in place (`animateContentSize`, `spatial`).
 */
@Composable
fun ChartCard(
    title: String,
    modifier: Modifier = Modifier,
    fignum: Int? = null,
    subtitle: String? = null,
    source: String? = null,
    legend: List<LegendEntry> = emptyList(),
    table: CompareTableModel? = null,
    initiallyShowTable: Boolean = false,
    readout: (@Composable () -> Unit)? = null,
    chart: @Composable () -> Unit,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    var showTable by rememberSaveable { mutableStateOf(initiallyShowTable) }
    val footer = if (source != null || table != null) {
        CardFooter(
            source = source,
            actionLabel = table?.let { if (showTable) HIDE_TABLE else SHOW_TABLE },
            onAction = table?.let { { showTable = !showTable } },
        )
    } else {
        null
    }
    ThesisCard(
        modifier = modifier.animateContentSize(
            if (reduced) snap() else ThesisMotion.spatial(IntSize.VisibilityThreshold),
        ),
        footer = footer,
    ) {
        Column(Modifier.fillMaxWidth()) {
            if (fignum != null) {
                Eyebrow("Chart $fignum", color = p.accent.copy(alpha = Kit.FIGNUM_ALPHA))
                Spacer(Modifier.height(ChartDims.fignumGap))
            }
            Text(title, modifier = Modifier.semantics { heading() }, style = ThesisType.cardTitle, color = p.ink)
            if (subtitle != null) {
                Spacer(Modifier.height(ChartDims.subtitleGap))
                Text(subtitle, style = ThesisType.caption, color = p.muted)
            }
        }
        readout?.invoke()
        chart()
        ChartLegend(legend)
        if (showTable && table != null) CompareTable(table)
    }
}
